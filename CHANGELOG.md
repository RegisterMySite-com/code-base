# Changelog

## [0.2.0] - 2026-11-07
### Security
- Replaced insecure `btoa` password storage with PBKDF2 (100k iterations) via Web Crypto.
- Added real JWT authentication (signup + login) using `jose`.
- Added Zod input validation on all write endpoints.
- Added basic rate limiting.
- Hardened Content-Security-Policy and security headers on previews.
- Path traversal protection on uploaded files.
- Restricted CORS (still needs domain tightening).

### Database
- Added indexes on users.email, projects.owner_id, projects.is_public, and project_files.project_id.
- Added CHECK constraint on project type and ON DELETE CASCADE.

### Other
- Added login endpoint.
- Improved error responses.
- Version bump and production readiness improvements.

## [0.1.0] - Initial prototype