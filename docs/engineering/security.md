# Security and privacy

Implemented controls: strict report/auth schemas, constrained status transitions, database foreign keys, JWT issuer/audience/algorithm validation, fresh session/account checks on every protected REST call, refresh-token hashing and rotation, replay-driven revocation, bcrypt, TOTP verification, rate limiting, same-site HttpOnly cookies, explicit CORS origin, mutation Origin checks, Helmet, request IDs and structured failure logs without secret payloads.

Anonymous reports keep an optional account link for owner access, but omit that association and contact information from response views. Their creation audit actor is null. Public incident output is an explicit field allowlist, without titles/descriptions that could contain personal information. Coordinates are rounded to two decimal places and publication requires supervisor/admin approval. Rounding reduces precision; it is not a formal anonymization guarantee.

Tracking secrets are 32 random bytes, hashed in storage. They are sent only once in the receipt and are not placed in query strings. Browser access tokens are memory-only. Refresh cookies are Secure in production. Production configuration requires HTTPS, a supported SQL database with verified TLS, and Cognito.

Evidence uses private keys chosen by the server, not filenames. Signed upload policy restricts type and exact size; confirmation compares S3 metadata. Actual file signature/malware analysis is still a release gate. CDN links expire after five minutes; cached content still requires CloudFront signed authorization.

Offline drafts use a non-exportable WebCrypto AES-GCM key persisted in IndexedDB. This protects raw local bytes but does not protect against malicious same-origin JavaScript. Drafts contain no access/refresh token; sync checks the signed-in account. Automatic retention is 24 hours when the queue runs.

Authority MFA secrets currently reside in the database. Encrypting them with a managed key and implementing enrollment/recovery are production release gates. Rate limiting and WebSockets are single-instance. Do not scale out until shared limits, socket distribution and worker coordination are implemented. See [project status](../project/status.md) for all outstanding security/production gates.

The local SQLite driver is updated to version 6.0.1. A scoped Sequelize UUID override uses 11.1.1 to address the audited legacy dependency; Sequelize uses the compatible v1/v4 exports, which are exercised by the migrated API tests.
