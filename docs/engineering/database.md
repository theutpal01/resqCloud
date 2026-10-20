# Database

`apps/api/src/database.ts` defines typed Sequelize models and the versioned initial migration. Tables cover users, departments, incident types, incidents, histories, assignments, profiles, locations, notifications, feedback, audits, configurations, sessions, media, events and consumed events. `schema_migrations` records migration completion.

Incident indexes include status, severity, category, department, timestamps and reporter. Assignment, notification, location and outbox indexes support scoped operational queries. Tracking IDs/client IDs and notification event keys are unique. Feedback is unique per incident. Foreign keys enforce ownership references. Aurora PostgreSQL connections use TLS with a trusted CA bundle (`DB_SSL=true`, `DB_SSL_CA_PATH`) and short-lived IAM DB tokens (`DB_IAM_AUTH=true`) for the express configuration path.

Transaction boundaries wrap creation, transitions and assignment. Assignment takes an incident and responder profile row lock. Local tests use SQLite; validate migrations and locking behavior on Aurora PostgreSQL before relying on it. No destructive reset command ships. Apply future changes as numbered migrations after backup, using backward-compatible expansion and contraction.
