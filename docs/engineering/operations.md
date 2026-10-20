# Local operations and troubleshooting

- API exits on configuration error: run `node scripts/setupLocal.mjs`; check a JWT secret of at least 32 characters.
- Missing tables/readiness failure: run `npm run db:migrate` using the same `.env` and working directory.
- Empty department queue: the medical demo dispatcher only sees medical/accident reports. Admin sees all departments.
- Assignment rejected: verify severity was assessed and the responder is available in the same department.
- Transition rejected: inspect the state graph and required role; the responder must accept before responding.
- Map unavailable: configure a public Mapbox token and rebuild. The coordinate list remains usable.
- Evidence unavailable: configure private S3 and CORS; local mode has no synthetic upload success.
- Session ended: sign in again; reused refresh tokens revoke the account's sessions.
- Offline queue: reconnect while signed into the same account; drafts expire after 24 hours.
- SQLite native build fails: use Node 24 with a supported native build environment, or the local PostgreSQL container for application runtime.
