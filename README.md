# CodeHost

A production-ready Code Hosting & Deployment Platform powered by Cloudflare Workers, Hono, R2, and D1.

## Features
- **Instant Hosting**: Upload HTML/CSS/JS and get a live link.
- **Embedded Previews**: Use `<script>` or `<iframe>` to embed code on any site.
- **Sandboxed**: Previews are isolated for security.
- **D1 Analytics**: View counts for every project.
- **Public Gallery**: Discover and fork community snippets.

## Setup Instructions

### 1. Create Cloudflare Resources
You need a D1 database and an R2 bucket.

```bash
# Create D1 Database
npx wrangler d1 create codehost-db

# Create R2 Bucket
npx wrangler r2 bucket create codehost-files
```

### 2. Configure `wrangler.toml`
Update your `wrangler.toml` with the `database_id` from the D1 creation step.

### 3. Initialize Database
Run the schema against your D1 database:

```bash
npx wrangler d1 execute codehost-db --file=./schema.sql
```

### 4. Deploy
```bash
npm install
npm run deploy
```

## Project Structure
- `src/index.ts`: Hono API (Backend)
- `src/frontend/`: React Dashboard (Frontend)
- `schema.sql`: Database definitions
- `wrangler.toml`: Cloudflare configuration
# codehost
