import { Hono } from "hono";
import { cors } from "hono/cors";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Secure CORS – adjust origins for production
app.use("*", cors({
  origin: (origin) => origin || "*", // tighten in production to your domains
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Simple in-memory rate limit (replace with Durable Object for production scale)
const rateLimit = new Map<string, { count: number; reset: number }>();
app.use("*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const window = rateLimit.get(ip) || { count: 0, reset: now + 60_000 };
  if (now > window.reset) {
    window.count = 0;
    window.reset = now + 60_000;
  }
  window.count++;
  rateLimit.set(ip, window);
  if (window.count > 60) return c.text("Too many requests", 429);
  await next();
});

// Auth helpers – PBKDF2 via Web Crypto (Workers-compatible)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(hash));
  const saltArray = Array.from(salt);
  return `pbkdf2:${saltArray.join(",")}:${hashArray.join(",")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltStr, hashStr] = stored.split(":");
  if (algo !== "pbkdf2") return false;
  const salt = new Uint8Array(saltStr.split(",").map(Number));
  const expected = new Uint8Array(hashStr.split(",").map(Number));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return crypto.subtle.timingSafeEqual(new Uint8Array(hash), expected);
}

async function createToken(userId: string, secret: string) {
  const secretKey = new TextEncoder().encode(secret);
  return await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

// Schemas
const AuthSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const ProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["snippet", "project"]),
  files: z.array(z.object({
    path: z.string().min(1).max(255).regex(/^[a-zA-Z0-9._/-]+$/),
    content: z.string().max(1_000_000),
    type: z.string().max(100),
  })).min(1).max(50),
});

// Auth routes
app.post("/api/auth/signup", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = AuthSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input" }, 400);

  const { email, password } = parsed.data;
  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return c.json({ error: "Email already registered" }, 409);

  const id = crypto.randomUUID();
  const password_hash = await hashPassword(password);

  await c.env.DB.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
    .bind(id, email, password_hash)
    .run();

  const token = await createToken(id, c.env.JWT_SECRET);
  return c.json({ success: true, token });
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = AuthSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input" }, 400);

  const user = await c.env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ?").bind(parsed.data.email).first();
  if (!user || !(await verifyPassword(parsed.data.password, user.password_hash as string))) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await createToken(user.id as string, c.env.JWT_SECRET);
  return c.json({ success: true, token });
});

// Auth middleware
async function requireAuth(c: any, next: () => Promise<void>) {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(auth.slice(7), secret);
    c.set("userId", payload.sub as string);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
}

// Projects
app.get("/api/projects", async (c) => {
  const results = await c.env.DB.prepare(
    "SELECT id, name, description, type, created_at FROM projects WHERE is_public = 1 ORDER BY created_at DESC LIMIT 100"
  ).all();
  return c.json(results.results || []);
});

app.post("/api/projects", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = ProjectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid project data" }, 400);

  const { name, description, type, files } = parsed.data;
  const projectId = crypto.randomUUID();
  const userId = c.get("userId");

  await c.env.DB.prepare("INSERT INTO projects (id, owner_id, name, description, type) VALUES (?, ?, ?, ?, ?)")
    .bind(projectId, userId, name, description || null, type)
    .run();

  for (const file of files) {
    if (file.path.includes("..") || file.path.startsWith("/")) continue;
    const fileId = crypto.randomUUID();
    const r2Key = `projects/${projectId}/${file.path}`;
    await c.env.BUCKET.put(r2Key, file.content, {
      httpMetadata: { contentType: file.type || "text/plain" },
    });
    await c.env.DB.prepare("INSERT INTO project_files (id, project_id, path, content_type, r2_key) VALUES (?, ?, ?, ?, ?)")
      .bind(fileId, projectId, file.path, file.type, r2Key)
      .run();
  }

  return c.json({ id: projectId });
});

// Preview (sandboxed + hardened headers)
app.get("/p/:id", async (c) => {
  const id = c.req.param("id");
  const project = await c.env.DB.prepare("SELECT id FROM projects WHERE id = ?").bind(id).first();
  if (!project) return c.notFound();

  const mainFile = await c.env.DB.prepare("SELECT r2_key FROM project_files WHERE project_id = ? AND path = 'index.html'").bind(id).first();
  if (!mainFile) return c.text("No index.html", 404);

  const object = await c.env.BUCKET.get(mainFile.r2_key as string);
  if (!object) return c.notFound();

  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      "INSERT INTO analytics (project_id, views) VALUES (?, 1) ON CONFLICT(project_id) DO UPDATE SET views = views + 1, last_viewed_at = CURRENT_TIMESTAMP"
    ).bind(id).run()
  );

  return new Response(object.body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: https:; font-src data:; frame-ancestors 'none'; sandbox allow-scripts allow-forms allow-modals allow-popups",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "public, max-age=60",
    },
  });
});

// Embed script
app.get("/embed/:id.js", async (c) => {
  const id = c.req.param("id");
  const host = new URL(c.req.url).origin;
  const script = `(function(){const c=document.currentScript?.parentElement;if(!c)return;const i=document.createElement("iframe");i.src="${host}/p/${id}";i.style.cssText="width:100%;height:500px;border:1px solid #e2e8f0;border-radius:8px";i.sandbox="allow-scripts allow-forms";c.appendChild(i)})();`;
  return c.text(script, 200, { "Content-Type": "application/javascript", "Cache-Control": "public, max-age=300" });
});

// Frontend fallback (still needs proper Vite build for production)
app.get("*", async (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeHost</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 text-slate-900">
  <div id="root"></div>
  <script type="module" src="/src/frontend/main.tsx"></script>
</body>
</html>`);
});

export default app;