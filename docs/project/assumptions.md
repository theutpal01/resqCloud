# Requirement decisions

The attachments include a detailed implementation plan and a multi-framework frontend standards file. The latter is not the product `AGENT.md` referenced by the plan. Next.js/core frontend rules apply; Angular, Vue, Astro and other framework-specific blocks do not dictate this project's stack.

The project uses Next.js, Express, TypeScript and Sequelize. Its AWS demonstration path uses Aurora PostgreSQL, SQS, S3, SNS and Cognito; SQLite remains available for development and tests. Per the user's updated requirement, AWS resources are created and managed directly in the AWS Console in a personal account; Terraform is not needed and its configuration has been removed. The Aurora express configuration path uses IAM database authentication and verified TLS. The web app and API run locally, and no cloud hosting is implied. An organization is not required. npm workspaces and its lockfile are used for reproducible installation; Turbo is omitted because the current two-application build does not require it. No AI/ML is used.

Seed locations are illustrative Vellore/Katpadi records, not real emergencies. Authority accounts are development-only and share the password generated locally in `.env`. No real credentials or personal data are bundled.

The initial duplicate and responder recommendation rules are deliberately transparent. They recommend; dispatchers decide. Product-policy gaps are tracked in [status.md](status.md) rather than silently resolved with invented operational rules.
