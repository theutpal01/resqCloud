# ResQCloud feature map

This map separates behavior that works in the local demo from integrations that need live services and work that remains before a real operational pilot. The [implementation status](status.md) records the handoff boundary; this file groups the current capabilities and next work by user outcome.

## What is in the project now

| Area                  | Current capability                                                                                                                                                                                                          | State                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public reporting      | Signed-in and anonymous incident reports, location, severity, affected count, incident time, optional SOS confirmation, and a private tracking receipt                                                                      | Works locally; fictional data only                                                                                                                             |
| Reporter tracking     | Private tracking by receipt, incident history, and post-closure feedback                                                                                                                                                    | Works locally                                                                                                                                                  |
| Incident operations   | Scoped queue, search/filter/paging, review, assessment, escalation, duplicate suggestions, responder recommendations, assignment, acceptance, response, resolution, reopening, and supervisor closure                       | Works locally; role and department checks enforced by API                                                                                                      |
| Responder operations  | Availability, assigned incident work, skills, and location sharing                                                                                                                                                          | Works locally; live location map layers are absent                                                                                                             |
| Maps                  | Incident map with configured Mapbox display; advisory boundary suggestions are implemented                                                                                                                                  | Local demo SQLite has 38 inactive, candidate-only Tamil Nadu district polygons; they are not approved for routing. Integration requires a public Mapbox token; no route planning, heatmaps, or pin selection |
| Notifications         | In-app notifications, read state, WebSocket updates with polling fallback                                                                                                                                                   | Works locally; email/SMS/push preferences and subscriptions are absent                                                                                         |
| Analytics and exports | Scoped totals, open/critical/resolved counts, status/category groups, date-filtered analytics and CSV, average first-response and resolution times, high/critical response-target status                                    | Works locally; targets are configurable and overdue counts are shown; geographic filters, PDF, and queued exports remain absent                                |
| Administration        | Create users, enable/disable access, change role/department/jurisdiction, view audit events, retry failed events, create/activate districts, and configure accepted categories, department routing, and response targets    | Works locally; district routing follows the selected area and parent scope; candidate boundaries are stored locally but remain inactive/unapproved; secure authority onboarding remains incomplete |
| Privacy information   | Interim page describes collected information, uses, public display, and unresolved retention/contact decisions                                                                                                              | Available at `/privacy`; requires jurisdiction-specific legal and retention approval before operational use                                                    |
| Offline use           | Encrypted drafts for signed-in users, 24-hour expiry, reconnect retry                                                                                                                                                       | Requires an already-open client; attachment sync, conflict handling, draft management, and cold-start support are absent                                       |
| Evidence              | Authorized upload, confirmation, listing, and download for supported objects                                                                                                                                                | Requires configured S3; scanning, quarantine, abandoned-upload cleanup, anonymous upload, and previews are absent                                              |
| Authentication        | Local citizen registration, authority login, rotating refresh sessions, optional Cognito hosted flow, and encrypted TOTP secret storage                                                                                     | Cognito requires configuration; production MFA enrollment, recovery codes, secure provisioning, and account recovery remain open                                |
| Local demo startup    | `npm run demo` prepares SQLite and sample data, starts both local servers, and offers role-based demo sign-in; `npm run demo:reset` requires typed confirmation before deleting the local SQLite database and rebuilding it | Loopback development only; shortcut sign-in is disabled outside that local mode                                                                                |
| Data and events       | Sequelize migrations, SQLite local mode, PostgreSQL/Aurora runtime path, transactional outbox, retries, idempotent notifications                                                                                            | Aurora/SQS/SNS require live AWS setup; local tests do not certify those services                                                                               |
| Audit and access      | Role, ownership, department, responder-assignment, and jurisdiction scoping; incident history and audit records                                                                                                             | Implemented in local code; production security review is still required                                                                                        |
| Disaster coordination | Incident ticket workflow and department dispatch                                                                                                                                                                            | No disaster activations, operational periods, objectives, mutual-aid grants, resource logistics, shelters, evacuation, warnings, or approved situation reports |

## Current user journeys

1. **Citizen:** create an account or use the public report flow, submit a report, keep its tracking receipt, follow progress, and leave feedback after closure.
2. **Dispatcher:** review reports in the assigned scope, verify details, assess severity, recommend and assign an eligible responder, and escalate when needed.
3. **Responder:** manage availability, accept an assignment, record response progress, and resolve the incident.
4. **Supervisor:** review outcomes, close or reopen incidents, and inspect scoped analytics.
5. **Administrator:** create accounts, manage access and team scope, inspect the audit trail, and retry dead event deliveries.

The in-app urgent report does not contact emergency services. Development uses fictional data and one Tamil Nadu sample jurisdiction. Production operation requires approved jurisdiction routing and operational authorization.

Response-time averages measure report creation to the first `responding` status; resolution averages measure report creation to the latest resolution after any reopening. Only milestones recorded after the timing migration contribute, and the API returns sample counts so unmeasured historical reports are visible as missing coverage rather than treated as zero.

## Codebase map

| Path                                      | Responsibility                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/`                           | Next.js App Router entry points, page shell, authentication callback, loading/error states, and global styling |
| `apps/web/features/auth/`                 | Local sign-in, public entry, and Cognito callback UI                                                           |
| `apps/web/features/incidents/`            | Report form, tracking, incident queue/detail, evidence panel, and incident map                                 |
| `apps/web/features/responders/`           | Responder availability and operational profile UI                                                              |
| `apps/web/features/notifications/`        | In-app notification list and read state                                                                        |
| `apps/web/features/dashboard/`            | Role-specific dashboard and situation summary                                                                  |
| `apps/web/features/admin/`                | User, audit, department, and failed-event administration                                                       |
| `apps/web/features/profile/`              | User profile and authority availability/location preferences                                                   |
| `apps/web/features/workspace/`            | Role navigation, page selection, shared workspace state and shell                                              |
| `apps/api/src/routes/`                    | HTTP route groups for authentication, incidents, operations, and administration                                |
| `apps/api/src/incidents.ts`               | Incident workflow, eligibility, assignments, recommendations, history, and audit behavior                      |
| `apps/api/src/auth.ts`                    | Authentication, sessions, role/scope authorization, MFA checks, and actor projection                           |
| `apps/api/src/database.ts` / `migrate.ts` | Sequelize models, database connection setup, and migrations                                                    |
| `apps/api/src/events.ts`                  | Transactional event/outbox processing and delivery behavior                                                    |
| `apps/api/src/dateRange.ts`               | Shared UTC date-window filtering for reports and exports                                                       |
| `apps/api/src/media.ts`                   | Evidence upload, confirmation, listing, and download paths                                                     |
| `packages/shared/src/index.ts`            | Shared roles, status/category definitions, schemas, jurisdiction catalog, and domain helpers                   |
| `tests/`                                  | API/domain tests plus browser navigation, role-access, and workspace flows                                     |
| `scripts/`                                | Local setup, production configuration preflight, and AWS setup PDF rendering                                   |
| `docs/`                                   | AWS setup, engineering references, project status, implementation plan, and readiness audits                   |

For feature-to-API details, see the [API reference](../engineering/api-reference.md). The [implementation plan](implementation-plan.md) contains the longer phase-by-phase target scope.

## Work required before a real pilot

### Decisions and safety gates

- Supply and review the missing `AGENT.md` policy specification. Approve operating jurisdictions, dispatch authority, retention, service-level targets, incident forms, escalation policy, and public-data rules.
- Define pilot ownership, training, staffing, fallback communications, incident handling procedures, and sign-off for any emergency-facing use.
- Configure verified state/district boundaries, geocoding, agency mappings, and routing; do not activate the states/UTs name catalog as operational coverage by itself.

### Product capabilities still missing

- Secure authority onboarding with production MFA enrollment, encrypted MFA secrets, recovery codes, and account recovery.
- Category acceptance, category-to-department routing, and high/critical response targets are editable, validated against existing departments, and audited.
- Map pin selection, live responder layers, response routes, coverage areas, incident radii, heatmaps, and density history.
- Geographic analytics, PDF reports, and asynchronous export jobs. High/critical response targets, overdue/breach counts, average response/resolution durations, and date filters are implemented; these measurements do not imply an approved legal or agency SLA.
- Disaster activation and command workflows: operational periods, objectives and tasks, mutual aid, personnel/equipment/supply logistics, staging, shelters, evacuation, damage assessments, public warnings, and approved situation reports.
- User notification preferences and confirmed email, SMS, and push subscriptions.
- Evidence scanning and quarantine, cleanup for abandoned uploads, anonymous evidence policy, and image/video previews.
- Offline evidence sync, a draft manager, retry/conflict resolution, and service-worker cold-start support.
- Image-similarity duplicate suggestions. Current suggestions are heuristic and do not merge incidents.

### Production engineering and assurance

- Multi-instance coordination for rate limits, WebSocket delivery, event worker ownership, and safe rolling upgrades.
- Real Aurora PostgreSQL integration coverage, complete browser lifecycle coverage for each role, cloud failure injection, load/performance budgets, screen-reader review, and penetration testing.
- Production image builds, OIDC deployment roles, approval gates, monitoring dashboards, backup/restore validation, and a rehearsed disaster-recovery procedure.
- Verify AWS service configuration, permissions, cost controls, and failure behavior in the target account and region.

## Suggested implementation order

1. Close the policy and jurisdiction decisions before enabling a real response workflow.
2. Complete account security and administrator configuration tools.
3. Add responder map and notification preferences using approved operational policy.
4. Add evidence safety and offline conflict recovery.
5. Complete operational metrics and exports.
6. Add scale-out infrastructure and production assurance, then run the pilot readiness review.

Some work depends on external decisions, credentials, AWS resources, or operational teams; code alone cannot complete those release gates. See the [regional readiness audit](regional-disaster-readiness-audit.md), [security reference](../engineering/security.md), and [deployment boundary](../engineering/deployment.md).
