# CodeHost

A production-oriented Code Hosting & Deployment Platform powered by Cloudflare Workers, Hono, R2, and D1.

## Features
- Instant HTML/CSS/JS hosting with live previews
- Embeddable previews via script or iframe
- Sandboxed rendering with hardened CSP
- D1 analytics (view counts)
- Public gallery
- JWT authentication with secure password hashing

## Setup

1. Create resources:
```bash
npx wrangler d1 create codehost-db
npx wrangler r2 bucket create codehost-files
```

2. Update `wrangler.toml` with the real `database_id` and a strong `JWT_SECRET` (32+ random chars).

3. Apply schema:
```bash
npx wrangler d1 execute codehost-db --file=./schema.sql
```

4. Deploy:
```bash
npm install
npm run deploy
```

## Project Structure
- `src/index.ts` – Hono API (auth, projects, previews, embeds)
- `src/frontend/` – React dashboard (requires Vite build for production)
- `schema.sql` – Database definitions
- `wrangler.toml` – Cloudflare configuration

## Production Notes
- Frontend currently loads raw TSX; add a Vite build step and serve static assets for production.
- Replace in-memory rate limit with a Durable Object for multi-instance deployments.
- Tighten CORS origins.
- Consider adding file size/type allowlists and malware scanning for user uploads.
