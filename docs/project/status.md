# Implementation status

This handoff describes a functional local application and a deployed, limited AWS pilot. It does **not** certify completion of every phase in the supplied 62-section implementation plan or authorize use for real emergency response. See [production pilot configuration and readiness](production-pilot.md) for the live deployment boundary.

## Implemented in the application

| Area               | Delivered behavior                                                                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation         | Next.js/Express TypeScript workspaces; Tailwind; reusable Radix/shadcn-style controls; Zod; React Hook Form; lint/format/typecheck/build commands                                                                                                   |
| Data               | Versioned Sequelize migrations through `005_jurisdiction_boundaries`, foreign keys and indexes; core tables, sessions, media, outbox and consumed-event records                                                                                     |
| Authentication     | Development citizen registration; authority password login; bcrypt; short JWTs; rotating refresh cookies; reuse revocation; sessions; TOTP verification; disabled-user checks                                                                       |
| Authorization      | Citizen ownership, department scope, responder assignment and admin checks on protected APIs                                                                                                                                                        |
| Reporting          | Anonymous or signed-in reporting, coordinates, category, severity, description, affected count, incident time and private tracking receipt                                                                                                          |
| Workflow           | Controlled status changes, reasons and history; assessment; escalation/reopening; responder recommendations, acceptance, assignment and resolution; supervisor closure                                                                              |
| Privacy            | Tracking secret hash; public allowlist projection; approximate public coordinates; anonymous contact suppression; no secrets in audit payloads                                                                                                      |
| Operations         | Queue search/filter/page controls, detail actions, duplicate candidates, notifications/read state, department responder lists, location recording                                                                                                   |
| Reliability        | Transactional outbox, backoff, local dead-event retries, SQS producer/consumer, idempotent in-app notifications, WebSocket user rooms and polling fallback                                                                                          |
| SOS/offline        | Explicit SOS confirmation, critical reporting; encrypted signed-in report drafts with expiry and retry                                                                                                                                              |
| Feedback/analytics | Reporter-only feedback after closure, uniqueness guard, scoped SQL counts/category/status groups, UTC date-filtered analytics/CSV export, average first-response/resolution durations, configured high/critical response targets and overdue counts |
| Administration     | Create authorities, enable/disable accounts, change role/department/jurisdiction, revoke sessions, department listing, audit viewing and failed event retry                                                                                         |
| Regional setup     | Admins create and activate districts, assign authorities to active districts, and route reports by selected jurisdiction; state authorities see descendant districts; candidate boundary imports and advisory point suggestions are available       |
| Policy setup       | Admin-only settings control accepted report categories and high/critical response targets; SLA analytics uses time to first “responding” status                                                                                                     |
| Privacy notice     | Interim `/privacy` page explains information handled and unresolved policy details; not an approved legal privacy policy                                                                                                                            |

## Deployed and requiring continued verification

Cognito hosted sign-in/registration/recovery with PKCE; S3 evidence upload/confirmation and authorized API downloads; SQS delivery/retries/DLQ; SNS delivery; Aurora PostgreSQL runtime with IAM database tokens. The production API task does not have the CloudFront evidence signing key configured, so signed CDN downloads are unavailable. AWS resources are deployed in `ap-southeast-2`; the deployed site and API readiness endpoints have been checked. Local tests use SQLite, **not Aurora PostgreSQL**, and cloud checks so far do not replace full browser, security, failure-recovery, and load verification.

## India jurisdiction slice (development demo)

The current development interface exposes one sample state, Tamil Nadu (`IN-TN`). Users and incidents carry jurisdiction codes; staff scope and notification delivery follow jurisdiction and department, and responders cannot be assigned across jurisdictions. Reports still require an explicitly selected active state/UT or district. Candidate WGS84 GeoJSON boundaries can be imported against existing district codes; a public API suggests a district only when an approved polygon clearly contains the point. Border/overlap points stay ambiguous, and suggestions never change a report or prove agency responsibility. The Survey of India source has not been fully imported or approved: its archive version, reuse terms, source-ID mapping, boundary validation, and agency coverage still need confirmation. See the [boundary source review](jurisdiction-boundary-source-review.md) and [regional readiness audit](regional-disaster-readiness-audit.md).

## Remaining before real emergency operations

- Complete the missing `AGENT.md` policy review, including operating jurisdictions, retention, SLA definitions and incident-specific forms.
- Production MFA enrollment, encrypted MFA-secret storage, recovery codes, trusted provisioning and authority account recovery.
- Admins can configure accepted categories, category-to-department routing, and high/critical first-response targets. Admin role/department/jurisdiction reassignment is implemented with session revocation and protection for active responder assignments.
- Regional administration supports active district records and report routing by explicit selection. Approved boundaries, coordinate-based routing, production agency mapping, and jurisdiction coverage remain prerequisites for operational district use.
- Privacy/retention requirements, responsible controller, and contact details still need approval before the interim `/privacy` notice can be replaced with an approved policy.
- Map pin selection, live responder map layers, routes, coverage polygons, incident radii, heatmaps and density history.
- Geographic analytics, PDF and asynchronous export jobs. Response/resolution times and high/critical target status are calculated, and date-filtered analytics and CSV exports are implemented; agency-approved SLA definitions remain outstanding.
- Notification channel preferences and complete email/SMS/push subscription flows. SNS topic publishing alone does not implement these experiences.
- Evidence malware/content-signature scanning, quarantine, abandoned upload cleanup, anonymous evidence upload and image/video previews.
- Production CloudFront signing configuration for direct private evidence delivery; authorized API downloads remain available.
- Offline attachment sync, draft-management UI, retry-conflict resolution and service-worker cold-start support.
- Horizontal scaling: distributed rate limits, cross-instance WebSocket delivery, event-worker ownership/locking and rolling-upgrade concurrency testing. The current configuration intentionally runs one application instance.
- Configured response targets are operational analytics thresholds, not approved agency service-level commitments.
- Timing averages include incidents whose response/resolution milestones were recorded after migration `004_incident_timing`; older incidents are not backfilled and are excluded from the sample count.
- Automated image similarity is absent; duplicate suggestions use distance, category, time and description overlap and never auto-merge.
- Full browser lifecycle coverage across every role, real Aurora PostgreSQL integration tests, cloud failure injection, load/performance budgets, screen-reader review and penetration testing.
- Production image baking, OIDC deployment roles, environment approval gates, real rolling deployment automation, configured monitoring dashboards, backups and a tested disaster-recovery rehearsal.

The supplied requirements and implementation plan are maintained in [implementation-plan.md](implementation-plan.md). This status file is the authoritative handoff boundary; pending work is not represented as completed functionality.
