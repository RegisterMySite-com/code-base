import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

// Auth APIs (Mocked for demo)
app.post("/api/auth/signup", async (c) => {
  const { email, password } = await c.req.json();
  const id = crypto.randomUUID();
  const password_hash = btoa(password); 
  
  await c.env.DB.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
    .bind(id, email, password_hash)
    .run();

  return c.json({ success: true });
});

// Projects APIs
app.get("/api/projects", async (c) => {
  const results = await c.env.DB.prepare("SELECT * FROM projects WHERE is_public = 1 ORDER BY created_at DESC").all();
  return c.json(results.results || []);
});

app.post("/api/projects", async (c) => {
  const { name, description, type, files } = await c.req.json();
  const projectId = crypto.randomUUID();
  const userId = "anonymous"; 

  await c.env.DB.prepare("INSERT INTO projects (id, owner_id, name, description, type) VALUES (?, ?, ?, ?, ?)")
    .bind(projectId, userId, name, description, type)
    .run();

  for (const file of files) {
    const fileId = crypto.randomUUID();
    const r2Key = `projects/${projectId}/${file.path}`;
    await c.env.BUCKET.put(r2Key, file.content, {
      customMetadata: { contentType: file.type }
    });
    
    await c.env.DB.prepare("INSERT INTO project_files (id, project_id, path, content_type, r2_key) VALUES (?, ?, ?, ?, ?)")
      .bind(fileId, projectId, file.path, file.type, r2Key)
      .run();
  }

  return c.json({ id: projectId });
});

// Preview Access
app.get("/p/:id", async (c) => {
  const id = c.req.param("id");
  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first();
  if (!project) return c.notFound();

  const mainFile = await c.env.DB.prepare("SELECT * FROM project_files WHERE project_id = ? AND path = 'index.html'").bind(id).first();
  if (!mainFile) return c.text("Project has no index.html", 404);

  const object = await c.env.BUCKET.get(mainFile.r2_key as string);
  if (!object) return c.notFound();

  c.executionCtx.waitUntil(
    c.env.DB.prepare("INSERT INTO analytics (project_id, views) VALUES (?, 1) ON CONFLICT(project_id) DO UPDATE SET views = views + 1, last_viewed_at = CURRENT_TIMESTAMP")
      .bind(id)
      .run()
  );

  return new Response(object.body, {
    headers: {
      "Content-Type": "text/html",
      "Content-Security-Policy": "default-src 'self' 'unsafe-inline' 'unsafe-eval' https:; sandbox allow-scripts allow-forms allow-modals allow-popups",
    }
  });
});

// Embed Script Generation
app.get("/embed/:id.js", async (c) => {
  const id = c.req.param("id");
  const host = new URL(c.req.url).origin;
  
  const script = `
    (function() {
      const id = "${id}";
      const host = "${host}";
      const container = document.currentScript.parentElement;
      const iframe = document.createElement("iframe");
      iframe.src = host + "/p/" + id;
      iframe.style.width = "100%";
      iframe.style.height = "500px";
      iframe.style.border = "1px solid #e2e8f0";
      iframe.style.borderRadius = "8px";
      iframe.setAttribute("sandbox", "allow-scripts allow-forms");
      container.appendChild(iframe);
    })();
  `;
  
  return c.text(script, 200, { "Content-Type": "application/javascript" });
});

// Frontend fallback
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