# ResQCloud

## Incident coordination from first report to resolution

ResQCloud is a demonstration platform for coordinating community incident reports. A person submits a report, an authorized operations team reviews and assigns it, a responder records progress, and a supervisor closes the incident. The reporter can follow the report and leave feedback.

The app is available as a limited AWS pilot at [https://dsl9l1s4fdu1c.cloudfront.net](https://dsl9l1s4fdu1c.cloudfront.net). It also supports local SQLite development and AWS integration demos. The live pilot is not certified for emergency operations or real personal/medical data. Review [production configuration and readiness](./docs/project/production-pilot.md) before using or deploying it.

**For a teammate:** start with the [overview and setup](#quick-start) below. For console-by-console AWS setup, see the [AWS showcase guide](./docs/aws/service-showcase.md). For what is implemented versus still unverified, see [implementation status](./docs/project/status.md).

For the full user-facing feature inventory and prioritized gaps, see the [feature map](./docs/project/feature-map.md).

## What the product does

The product follows a report through an auditable response workflow:

1. A citizen reports an incident, optionally anonymously, and receives a private tracking receipt.
2. A dispatcher reviews the report, records a reason, confirms its details and priority, and assigns a responder.
3. A responder accepts the assignment, updates response progress and records resolution.
4. A supervisor reviews the outcome and closes the incident.
5. The citizen follows status changes and can submit feedback after closure.

The interface has role-based workspaces for citizens, responders, dispatchers, supervisors, and administrators. The API enforces role, ownership, and department access; hiding a link in the interface is not the security control. Reports and transitions are validated, written through database transactions, and recorded in incident history and an event outbox.

This is a faculty/demo platform using fictional data. It is not an emergency dispatch service: the urgent in-app report creates a critical incident inside ResQCloud and does **not** call local emergency services.

## AWS connection, in plain language

Think of the web app and API as the part your teammate sees and runs. AWS supplies selected managed building blocks behind them:

| AWS service                        | Plain-language role         | How ResQCloud uses it                                                                                          |
| ---------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Aurora PostgreSQL**              | Managed relational database | Stores users, reports, assignments, status history, notifications, and queued events.                          |
| **Amazon SQS**                     | Durable work queue          | Carries incident events from the API to a background consumer so event processing can retry independently.     |
| **Amazon S3**                      | Private object storage      | Holds incident evidence such as images. The bucket should remain private.                                      |
| **Amazon SNS**                     | Notification publisher      | Publishes critical-incident notifications to configured subscribers, such as a confirmed email subscription.   |
| **Amazon Cognito** _(optional)_    | Hosted identity service     | Provides citizen sign-in and registration. The API validates Cognito ID tokens before creating an app session. |
| **Amazon CloudFront** _(optional)_ | Content delivery network    | Delivers private evidence with short-lived signed URLs while S3 remains private.                               |
| **Mapbox** _(optional, not AWS)_   | Map display service         | Displays incident locations when a public browser token is configured.                                         |

The AWS services are separate resources in an AWS account. ResQCloud does not create them automatically and does not use Terraform. They are configured in the AWS Console using the [AWS showcase guide](./docs/aws/service-showcase.md).

### What runs where

```text
Your computer
┌────────────────────────┐       HTTP / WebSocket      ┌────────────────────────┐
│ Browser                 │ ─────────────────────────▶ │ Next.js web app :3000   │
└────────────────────────┘                             └───────────┬────────────┘
                                                                   │ REST API
                                                                   ▼
                                                       ┌────────────────────────┐
                                                       │ Express API :4000      │
                                                       │ auth, rules, events    │
                                                       └──┬─────┬────┬─────┬────┘
                                                          │     │    │     │
                                      AWS identity + TLS  │     │    │     │ AWS SDK
                                                          ▼     ▼    ▼     ▼
AWS account                                         Aurora   S3   SQS   SNS
                                                        ▲          │
                                                        └── worker ┘

Optional paths: browser ── Cognito sign-in; API ── signs CloudFront URLs ── private S3 evidence
```

The local AWS CLI profile supplies temporary AWS credentials to the API’s AWS SDK clients. Database access is a separate connection: Sequelize connects to the Aurora PostgreSQL writer endpoint over TLS, and the API can generate a short-lived IAM database authentication token for the configured database user. The token is not a database password stored in `.env`.

### Technical event and data flow

1. Locally, the browser API client calls `http://localhost:4000/api/v1`. In the AWS pilot, `NEXT_PUBLIC_API_URL` is empty and requests use same-origin `/api/v1`, which CloudFront routes to the API. Protected requests carry a short-lived access token; a same-site, HttpOnly refresh cookie is rotated by the API.
2. Express validates input with shared Zod schemas, authenticates the actor, checks authorization and performs the incident operation.
3. Sequelize stores the change in Aurora PostgreSQL. A domain event is inserted in the same database transaction through the transactional outbox.
4. A single API worker sends outbox events to SQS when configured. Without SQS, local event delivery handles the event directly. The queue consumer validates messages and creates idempotent in-app notifications.
5. Critical events can be published to SNS by the event delivery handler, whether delivery is local or follows SQS consumption. The API sends authorized update notices to a user’s WebSocket room; clients then reload data through the authorized REST API.
6. Evidence uploads use a short-lived, size- and content-type-restricted S3 upload policy. Optional CloudFront delivery requires an API authorization check and a five-minute signed URL.

The current worker is designed for one application instance. Queue delivery and SNS publication are at-least-once; notification records guard against duplicate processing where implemented. See [architecture](./docs/engineering/architecture.md), [events](./docs/engineering/events.md), and [security](./docs/engineering/security.md) for implementation details.

## Quick start

### Requirements

- Node.js 24 or newer and npm.
- Python 3, `make`, and a C++ compiler may be needed if the SQLite native package has no prebuilt binary for your platform.
- No AWS account is required for local development.

### Run locally with SQLite

From the repository root:

```bash
npm ci
npm run demo
```

`npm run demo` creates a separate private `.env.demo` if needed, checks that it selects SQLite, seeds the schema and fictional sample data, then starts the web app and API. It uses a separate `resqcloud-demo.sqlite` database and leaves your existing `.env` and local database untouched. Local demo mode disables AWS integrations for this run and binds both servers to loopback. Press **Ctrl+C** to stop both.

Open [http://localhost:3000](http://localhost:3000). The Next.js web app uses port **3000**; the Express API uses port **4000**. The combined `npm run dev` command starts both. If startup reports that port 3000 is already in use, stop the other app process first; this project’s web script is configured for 3000.

Seeded development accounts are:

| Role          | Email                       |
| ------------- | --------------------------- |
| Citizen       | `citizen@resqcloud.test`    |
| Dispatcher    | `dispatcher@resqcloud.test` |
| Responder     | `responder@resqcloud.test`  |
| Supervisor    | `supervisor@resqcloud.test` |
| Administrator | `admin@resqcloud.test`      |

When started with `npm run demo`, choose any role directly on the sign-in screen. This local shortcut is enabled only for the loopback SQLite development launcher. For manual sign-in, use the `DEV_SEED_PASSWORD` from `.env.demo` when using the demo database, or from `.env` when using the manual SQLite setup. The seed is blocked in production.

Development accounts for response authorities are scoped to the single sample jurisdiction **Tamil Nadu (`IN-TN`)**. This is a demo label only: the demo does not validate official state/district boundaries or route real emergency response. Production jurisdiction configuration, agency authorization, policy sign-off, and readiness review remain incomplete. Do not treat the development jurisdiction as a production default.

### Try the workflow

1. Sign in as the citizen and submit a fictional incident.
2. Copy the tracking ID and private tracking key from the receipt.
3. Sign in as the dispatcher, review and prioritize the incident, then assign a responder.
4. Sign in as the responder, accept the assignment, record progress, and resolve it.
5. Sign in as the supervisor and close the incident.
6. Return as the citizen to view progress and submit feedback.
7. Review notifications and analytics; use the administrator role for the audit trail.

## Connect the app to AWS

The code supports an AWS-backed path using Aurora PostgreSQL and optionally SQS, S3, SNS, Cognito, and CloudFront. AWS resources, permissions, network reachability, and account policy must all be configured first. The [AWS showcase guide](./docs/aws/service-showcase.md) contains the full console procedure; the key connections are:

### 1. AWS identity and service permissions

Use the AWS CLI profile for the account that owns or can access the demo resources. For example:

```bash
aws login --profile resqcloud-demo --region ap-southeast-2
aws sts get-caller-identity --profile resqcloud-demo
```

The API’s AWS SDK uses `AWS_PROFILE` to obtain temporary credentials for services such as SQS, S3, and SNS. Do not put AWS access keys in `.env`. Grant only the actions and resource ARNs the demo requires.

**Organization accounts can restrict services.** An AWS Organizations service control policy (SCP) can explicitly deny an action even when a role appears to have broad access. An account administrator cannot override an SCP deny; an organization administrator must review it, or the demo must use an account where the needed services are allowed.

### 2. Aurora PostgreSQL

In the repository root `.env`, set `DB_DIALECT=postgres`, the Aurora writer endpoint in `DATABASE_URL`, `DB_SSL=true`, and `DB_SSL_CA_PATH` to a local AWS RDS CA bundle. For the IAM authentication setup described in this repository, set `DB_IAM_AUTH=true`, configure `AWS_REGION`, and grant `rds-db:connect` to the exact database user and cluster resource ID.

The cluster must be **Available** and reachable from the machine running the API. If Aurora is stopped, the API fails during startup because it authenticates to the database before opening port 4000. If it is private, the app must run inside its network or use an approved private connection. A workstation cannot reach a private endpoint just by having AWS credentials.

Apply the schema and development records only after the database and IAM/network access are ready:

```bash
AWS_PROFILE=resqcloud-demo npm run db:migrate
AWS_PROFILE=resqcloud-demo npm run db:seed
AWS_PROFILE=resqcloud-demo npm run dev
```

### 3. Optional AWS integrations

- **SQS:** set `SQS_QUEUE_URL`; the API sends outbox events and polls/consumes queue messages. Configure the queue and dead-letter policy in AWS.
- **S3:** set `S3_BUCKET`; the API requests narrowly scoped AWS credentials for private evidence objects. Configure bucket CORS for `http://localhost:3000`.
- **SNS:** set `SNS_TOPIC_ARN` and confirm a subscription if the demonstration should deliver alerts.
- **Cognito:** configure the API-side pool/client identifiers plus the matching public variables `NEXT_PUBLIC_COGNITO_CLIENT_ID` and `NEXT_PUBLIC_COGNITO_DOMAIN`. Register `http://localhost:3000/auth/callback` as a callback URL. The app client is public and uses authorization code with PKCE; never put a Cognito client secret in browser variables.
- **CloudFront:** optional. Set the distribution domain, public key ID, and local private-key path. The S3 bucket stays private; the API signs short-lived viewer URLs after checking access.

`NEXT_PUBLIC_*` values are exposed in the browser bundle and are read when Next.js starts/builds. Restart the dev server after changing them; rebuild a production app. Keep database settings, private signing keys, and AWS credentials out of `NEXT_PUBLIC_*` variables.

The interactive map uses the optional public Mapbox token `NEXT_PUBLIC_MAPBOX_TOKEN` (`pk.`). Set it in the root `.env` or the deploy shell environment. The AWS deploy script forwards only this public value to the web image build; rebuild and deploy the web image after changing it. Never use a private Mapbox token (`sk.`) here.

Authority TOTP secrets are encrypted before database storage. Local development derives the encryption key from `JWT_SECRET` unless `MFA_ENCRYPTION_KEY` is set. Production requires a dedicated `MFA_ENCRYPTION_KEY`; the production CloudFormation stack supplies it from Secrets Manager and retains it with the database data.

## Check the connection

```bash
curl http://localhost:4000/health
curl http://localhost:4000/ready
```

`/health` means the API process is answering. `/ready` also checks that the database can be reached and that the migration table exists. A successful health response alone does not prove Aurora is connected. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` for local code checks. Browser tests use Playwright and require both local services unless `PLAYWRIGHT_BASE_URL` points at a running web app.

### Common startup problems

| Symptom                                  | What it means / what to check                                                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Port 3000 already in use                 | Another web process is running. Stop that process, then restart ResQCloud.                                                                                                          |
| Port 4000 or `/ready` unavailable        | The API may have failed its database startup check. Read the API log.                                                                                                               |
| Aurora reports `stopped`                 | Start the cluster in RDS, wait for **Available**, then restart the local dev command.                                                                                               |
| `AccessDenied` mentions an SCP           | Ask the organization administrator to review the explicit deny. Adding an IAM allow in the member account will not bypass it.                                                       |
| `unable to get local issuer certificate` | Check that `DB_SSL_CA_PATH` points to the correct, current CA bundle. Keep certificate verification enabled.                                                                        |
| Connection timeout/reset                 | Check cluster state, endpoint/region/port, public or private reachability, security group rules, and local network access. AWS credentials do not create a network path into a VPC. |
| `NEXT_PUBLIC_*` config appears stale     | Restart Next.js (or rebuild) after changing the value.                                                                                                                              |

## Project structure

The web app uses Tailwind CSS v4 globally through `apps/web/app/globals.css`. Its shadcn/ui configuration lives in `apps/web/components.json`, and shared primitives live in `apps/web/components/ui/`. Theme colors and typography map to the existing ResQCloud design tokens; use these shared components and the `cn` helper when building new UI.

| Path                   | Responsibility                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/web/app/`        | Next.js routes, page shells, and global styles.                                                  |
| `apps/web/features/`   | Incident reporting, tracking, dashboards, admin, auth, and role views.                           |
| `apps/web/components/` | Shared UI and application-wide auth provider.                                                    |
| `apps/web/lib/`        | Browser API client, Cognito flow, offline queue, and utilities.                                  |
| `apps/api/src/`        | Express routes, auth, authorization, database models/migrations, AWS adapters, and event worker. |
| `packages/shared/`     | Shared TypeScript types, Zod schemas, and workflow rules.                                        |
| `tests/`               | API/domain/unit tests and Playwright browser tests.                                              |
| `docs/`                | AWS setup, architecture, security, status, and operational notes.                                |

Useful commands:

```bash
npm run dev          # web :3000 + API :4000
npm run demo         # prepare SQLite seed data and start local demo
npm run demo:reset   # confirm, clear the local SQLite demo, reseed and start
npm run db:seed      # migrate and create fictional demo users/incidents
npm run db:migrate   # apply database migrations
npm run boundaries:import -w @resq/api -- ./districts.geojson soi-edition-id # import candidate district geometry
npm run lint         # ESLint and Prettier checks
npm run typecheck    # TypeScript checks
npm test             # unit/domain/API tests
npm run build        # production API and web builds
npm run test:e2e     # Playwright browser tests
```

## Project boundaries and demo safety

The AWS pilot is running, but this remains **not a production-ready emergency response system**. Local tests use SQLite, not Aurora. Basic live endpoint checks do not certify the AWS integrations or operational readiness; review [implementation status](./docs/project/status.md) and the [production pilot notes](./docs/project/production-pilot.md).

Boundary imports require a WGS84 GeoJSON FeatureCollection whose district features have a `jurisdictionCode` property matching an existing district record. Each import is stored as a candidate with source/version and retrieval metadata; it is excluded from suggestions until an administrator records an approval reference. The suggestion endpoint is advisory and never changes the reporter's selected area. See the [boundary source review](./docs/project/jurisdiction-boundary-source-review.md) before preparing data; the Survey of India archive still needs a verified edition, reuse terms, and explicit source-ID mapping.

Production compute, load balancing, and runtime secret injection are configured in AWS. Remaining release gates include HTTPS to the origin, MFA enrollment/recovery, evidence malware scanning, scale-out coordination, performance/security review, and operational recovery testing. Check [implementation status](./docs/project/status.md) before describing capabilities as complete.

Use fictional sample data only. Do not put real emergency, medical, or identifying information into this demo. Check current AWS pricing and account eligibility before creating resources; a budget alert notifies you but does not cap charges. After the demonstration, stop or delete resources as described in the [AWS showcase cleanup steps](./docs/aws/service-showcase.md#11-clean-up-after-the-demo).

## Further reading

- [Console-managed AWS setup](./docs/aws/service-showcase.md)
- [Aurora PostgreSQL and IAM database authentication](./docs/aws/aurora-postgresql.md)
- [AWS architecture](./docs/aws/architecture.md)
- [Application architecture](./docs/engineering/architecture.md)
- [API reference](./docs/engineering/api-reference.md)
- [Security and privacy](./docs/engineering/security.md)
- [Implementation status and release gates](./docs/project/status.md)
- [AWS production pilot deployment](./docs/engineering/deployment.md)
- [Production environment, pages, and readiness map](./docs/project/production-pilot.md)
