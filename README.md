# CodeHost

Production-ready code hosting platform on Cloudflare: Workers + D1 + R2 + KV + Durable Objects + Workers AI.

## Features
- Instant HTML/CSS/JS hosting with live sandboxed previews
- Embeddable via `<script>` or iframe
- Hardened CSP on all previews
- D1 analytics (view counts)
- Public gallery (KV-cached)
- Authenticated dashboard
- AI assistant for code help (Workers AI)
- Content scanning for uploads
- Durable Object rate limiting

## Setup
1. Create resources:
   ```bash
   npx wrangler d1 create codehost-db
   npx wrangler r2 bucket create codehost-files
   npx wrangler kv namespace create CODEHOST_KV
   ```
2. Update `wrangler.toml` with real IDs and a strong `JWT_SECRET`.
3. Apply schema: `npx wrangler d1 execute codehost-db --file=./schema.sql`
4. Deploy: `npm install && npm run deploy`

## Development
- `npm run dev` (Wrangler)
- Frontend hot reload via Vite proxy when running separately if needed.

## Cloudflare Services Used
- Workers, Assets, D1, R2, KV, Durable Objects, Workers AI, Observability