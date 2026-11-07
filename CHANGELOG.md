# Changelog

## [0.3.0] - 2026-11-07
### Added
- Vite build pipeline for production frontend (static assets served via Workers Assets).
- Real authenticated Dashboard showing user's projects and view counts.
- Durable Object rate limiter (replaces in-memory).
- KV cache for public gallery.
- Workers AI integration for malware/content scanning and AI chat assistant (inspired by llm-chat-app-template).
- File type allowlist and size limits.
- Tightened CORS via ALLOWED_ORIGINS.
- Full auth flow in UI (signup/login/logout).

### Security
- Content scanning with heuristics + AI.
- Path traversal protection.
- Hardened CSP on previews.

## [0.2.0] - 2026-11-07
Previous security and schema improvements.