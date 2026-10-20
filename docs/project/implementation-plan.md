# ResQCloud — Project Implementation Plan

> Execution plan for implementing the ResQCloud system defined in `AGENT.md`.
>
> `AGENT.md` is the product and architecture source of truth. This document defines the implementation order, engineering tasks, verification steps, and completion criteria.

---

## 1. Implementation Principles

1. Build incrementally and keep the repository runnable after every phase.
2. Implement security together with each feature.
3. Every database change requires a migration.
4. Every API requires validation and authorization.
5. Every asynchronous workflow requires an explicit event contract.
6. Important operations must produce appropriate logs/audit records.
7. Test each feature before moving to the next phase.
8. Do not introduce AI/ML.
9. Do not split the backend into unnecessary microservices.
10. Do not replace locked architecture decisions without identifying the technical blocker.

---

## 2. Target Repository

```text
resqcloud/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── shared/
│   ├── types/
│   └── config/
├── infrastructure/
│   └── terraform/
├── tests/
├── docs/
├── scripts/
├── .github/
│   └── workflows/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── README.md
└── AGENT.md
```

Use a workspace/build system only when it improves development without unnecessary complexity.

---

## 3. Technology Baseline

### Frontend

- Next.js
- App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod

### Backend

- Node.js
- Express
- TypeScript
- Sequelize
- PostgreSQL
- Zod
- JWT
- WebSockets

### AWS

- EC2
- ALB
- Auto Scaling
- Aurora PostgreSQL
- S3
- CloudFront
- SQS
- SNS
- WAF
- CloudWatch
- CloudTrail
- Secrets Manager
- Parameter Store
- IAM
- VPC

### Infrastructure

- Terraform
- GitHub Actions

### Maps

- Mapbox
- OpenStreetMap-based services where appropriate

---

## 4. Environment Strategy

Use:

```text
development
staging
production
```

Local development should emulate AWS-dependent functionality where practical. Developers should not need a production AWS deployment simply to run the application locally.

---

## 5. Phase 0 — Repository Bootstrap

### Tasks

- Create monorepo/workspaces.
- Create Next.js frontend.
- Create Express backend.
- Create shared/types/config packages.
- Configure TypeScript.
- Configure ESLint and Prettier.
- Configure Tailwind and shadcn/ui.
- Add Git configuration.
- Add CI skeleton.
- Add initial documentation.

### Backend health endpoints

```http
GET /health
GET /ready
```

### Acceptance

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

All must succeed.

---

## 6. Phase 1 — Shared Types & Validation

Create shared domain types for:

- User
- Department
- Incident
- Incident status
- Severity
- Assignment
- Notification
- Feedback
- Pagination
- API errors

Use Zod for runtime validation.

Core enums:

```ts
type UserRole = "citizen" | "dispatcher" | "responder" | "supervisor" | "admin";

type Severity = "low" | "medium" | "high" | "critical";
```

Incident statuses:

```text
reported
under_review
verified
severity_assessed
assigned
responding
resolved
closed
rejected
duplicate
escalated
reopened
```

---

## 7. Phase 2 — Database Foundation

Use:

- Amazon Aurora PostgreSQL
- Sequelize

Create migrations/models for:

```text
User
Department
IncidentType
Incident
IncidentStatusHistory
IncidentAssignment
ResponderProfile
ResponderLocation
Notification
Feedback
AuditLog
SystemConfiguration
```

Add foreign keys and indexes.

Recommended indexes:

```text
incident.status
incident.severity
incident.category
incident.department_id
incident.created_at
incident.updated_at
incident.tracking_id
incident.reporter_id
assignment.responder_id
assignment.status
notification.user_id
notification.read_at
responder_location.responder_id
responder_location.created_at
```

---

## 8. Phase 3 — Authentication

### Citizens

Use AWS Cognito for:

- Registration
- Login
- Logout
- Token validation
- Account recovery

Anonymous incident submission remains available independently.

### Authorities/Admins

Use custom authentication with:

- Short-lived JWT access tokens
- Rotating refresh tokens
- Strong password hashing
- MFA
- Session/device management
- Token revocation
- Suspicious-login logging
- Rate limiting
- Security audit events

---

## 9. Authorization Middleware

Implement:

```text
authenticateCitizen
authenticateAuthority
requireRole
requireDepartmentAccess
requirePermission
```

Authorization must be server-side.

Rules:

```text
Citizen     → own reports
Dispatcher  → incidents within authorized operational scope
Responder   → assigned incidents
Supervisor  → escalation/reassignment/closure within scope
Admin       → authorized system administration
```

---

## 10. Phase 4 — User & Department Management

Implement management for:

- Users
- Authority accounts
- Departments
- Roles
- Responder profiles
- Availability

Admin capabilities:

- Create authority
- Disable authority
- Assign role
- Assign department
- Change department
- Revoke sessions

Use department + role for authorization where applicable.

Initial departments:

```text
Fire & Rescue
Medical/Emergency Health
Police/Security
Municipal/Infrastructure
Utilities
Disaster Management
```

---

## 11. Phase 5 — Incident Creation

Create:

```http
POST /api/v1/incidents
```

Support:

- GPS location
- Manual map pin
- Photos
- Video
- Description
- Initial severity
- People affected
- Contact information
- Reporter identity where applicable
- Anonymous mode
- Incident time
- Type-specific fields

Validate everything server-side.

---

## 12. Anonymous Incident Flow

When anonymous mode is selected:

1. Generate a secure tracking ID.
2. Store reporter association according to privacy requirements.
3. Prevent unauthorized exposure of identity.
4. Return tracking information.
5. Exclude identity from public responses.
6. Prevent identity leakage through logs, notifications, and exports.

---

## 13. Incident Lifecycle

Implement a state-transition service.

Primary flow:

```text
reported
  → under_review
  → verified
  → severity_assessed
  → assigned
  → responding
  → resolved
  → closed
```

Exceptional transitions:

```text
rejected
duplicate
escalated
reopened
```

Do not allow arbitrary status changes.

Every transition creates an `IncidentStatusHistory` record containing:

- Previous state
- New state
- Actor
- Timestamp
- Reason where applicable

---

## 14. Severity Service

Flow:

```text
Citizen initial severity
        ↓
Dispatcher review
        ↓
Authority modification
        ↓
Escalation/de-escalation
```

Critical severity triggers the critical-incident workflow.

Record:

- Previous severity
- New severity
- Actor
- Timestamp
- Reason

---

## 15. Duplicate Detection

Create:

```text
DuplicateDetectionService
```

Compare:

- GPS proximity
- Category
- Time
- Description similarity
- Existing incident status
- Image similarity where practical

Return a confidence score and candidate incidents.

This is rule-based. Do not use AI.

**Never automatically merge incidents.** The dispatcher makes the final decision.

---

## 16. Smart Assignment

Create:

```text
AssignmentRecommendationService
```

Factors:

- Department
- Location/distance
- Availability
- Current workload
- Severity
- Responder role/skills

Return recommendations. The dispatcher makes the final assignment.

Track assignment states such as:

```text
recommended
assigned
accepted
rejected
completed
```

---

## 17. Responder Availability

Use:

```text
off_duty
available
busy
responding
unavailable
```

Only eligible responders can receive assignments.

---

## 18. Responder Location

Implement:

```http
POST /api/v1/responders/me/location
```

Requirements:

- Validate coordinates.
- Require responder authentication.
- Require appropriate duty state.
- Rate-limit updates.
- Store location history according to retention policy.
- Broadcast permitted updates through WebSockets.

---

## 19. Phase 6 — Media Upload

Preferred flow:

```text
Frontend
   ↓
Backend authorization
   ↓
Controlled S3 upload
   ↓
S3 object
   ↓
Media metadata in DB
```

Use private S3.

Validate:

- File size
- File type
- Ownership
- Incident access

Generate safe object keys:

```text
{environment}/{incidentId}/{uuid}
```

Never trust user-provided filenames.

---

## 20. CloudFront Media Access

Use CloudFront for controlled delivery.

Never expose the incident-evidence S3 bucket publicly.

Use appropriate signed/private access mechanisms.

---

## 21. Phase 7 — Authority Dashboard

### Dispatcher

```text
Overview
Incidents
Live Map
Assignments
Escalations
Notifications
```

### Responder

```text
Overview
Assigned Incidents
Active Response
Map
Notifications
Profile
```

### Supervisor

```text
Overview
Incidents
Escalations
Assignments
Analytics
```

### Admin

```text
Overview
Users
Departments
Incidents
Analytics
Audit Logs
Configuration
Settings
```

---

## 22. Incident Queue

Implement:

- Pagination
- Filtering
- Sorting
- Search
- Severity
- Status
- Department
- Assignment
- Escalation indicators

Do not load the complete incident database into the browser.

---

## 23. Incident Details

Show according to role:

```text
Incident ID
Type
Severity
Status
Location
Map
Description
Media
People affected
Reporter information according to permissions
Department
Assignment
Timeline
Notifications
Escalation state
```

---

## 24. Phase 8 — Maps

Integrate Mapbox.

Use OpenStreetMap-based services where appropriate.

Reusable components:

```text
IncidentMap
ResponderMap
IncidentMarker
ResponderMarker
IncidentRadius
RouteLayer
CoverageLayer
PublicIncidentMap
```

Support:

- Incident locations
- Responder/team locations
- Incident radius
- Affected areas
- Routes
- Distance
- Department coverage
- Live updates

---

## 25. Public Incident API

Implement a restricted public API such as:

```http
GET /api/v1/public/incidents
```

Only return approved information.

Never return:

- Reporter identity
- Contact information
- Internal notes
- Private responder data
- Sensitive operational information

Mask/approximate exact locations where required.

---

## 26. Phase 9 — SQS Event System

Define a standard event structure:

```ts
interface DomainEvent<T> {
  eventId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  aggregateId: string;
  payload: T;
}
```

Events include:

```text
IncidentCreated
IncidentVerified
IncidentRejected
SeverityChanged
IncidentAssigned
IncidentEscalated
IncidentReopened
ResponderAccepted
ResponseStarted
IncidentResolved
IncidentClosed
NotificationRequested
FeedbackSubmitted
```

Consumers must be idempotent.

---

## 27. SQS Queues

Use:

### Standard SQS

For high-volume independent events.

### FIFO SQS

Only where ordering/deduplication matters.

### DLQs

For important queues requiring reliable failure handling.

Implement:

- Retry
- Visibility timeout
- DLQ monitoring
- Safe reprocessing

---

## 28. Phase 10 — SNS Notifications

Create:

```text
NotificationService
```

Channels:

```text
in_app
email
sms
push
```

Select channels based on:

- Severity
- User role
- Notification preferences
- Event type

Critical events can use multiple channels.

---

## 29. In-App Notifications

Support:

- Unread count
- Mark read
- Mark all read
- Notification history
- Severity indicator
- Incident link

---

## 30. Phase 11 — WebSockets

Create authorized WebSocket rooms such as:

```text
user:{userId}
department:{departmentId}
incident:{incidentId}
```

Required authorization must happen before a client joins a protected room.

Broadcast:

```text
incident.created
incident.updated
incident.assigned
incident.escalated
incident.resolved
responder.location.updated
notification.created
```

---

## 31. Polling Fallback

If WebSockets fail:

1. Detect connection loss.
2. Switch to controlled REST polling.
3. Avoid aggressive polling.
4. Reconnect WebSocket automatically.
5. Stop fallback polling after successful reconnection.

---

## 32. Phase 12 — Critical Incident & SOS

Implement:

```http
POST /api/v1/sos
```

Flow:

```text
User
 ↓
SOS
 ↓
GPS
 ↓
Critical Incident
 ↓
SQS/SNS
 ↓
Department Notification
 ↓
Authority Dashboard
 ↓
Responder Recommendation
 ↓
Assignment
```

Use idempotency protection to prevent accidental duplicate SOS incidents.

SOS requires connectivity.

Do not automatically call external emergency services.

---

## 33. Phase 13 — Offline Queue

Support offline incident creation.

States:

```text
pending
syncing
synced
failed
```

Flow:

```text
pending → syncing → synced
```

Failure:

```text
syncing → failed
```

Implement:

- Automatic retry
- Controlled backoff
- Sync status UI
- Conflict handling
- Secure local storage
- Reasonable local retention

---

## 34. Phase 14 — Analytics

Implement metrics such as:

```text
incidentCount
openIncidentCount
resolvedIncidentCount
criticalIncidentCount
averageResponseTime
averageResolutionTime
slaBreaches
departmentWorkload
categoryDistribution
severityDistribution
```

Support:

- Geographic heatmaps
- Incident density
- Recurring incident areas
- Time trends
- Department comparison
- Historical analysis

Use server-side aggregation and appropriate indexes.

---

## 35. Export

Support controlled:

```http
GET /api/v1/analytics/export
GET /api/v1/incidents/export
```

Formats:

- CSV
- PDF where appropriate

Respect RBAC, privacy, department scope, and date filters.

Large exports should use asynchronous processing where needed.

---

## 36. Phase 15 — Feedback

After closure:

```http
POST /api/v1/incidents/:id/feedback
```

Support:

- Rating
- Comment
- Response-time feedback
- Resolution-quality feedback
- Optional complaint

Prevent unauthorized or duplicate submissions.

---

## 37. Phase 16 — Audit

Create a centralized audit service.

Example:

```ts
audit({
  actorId,
  action,
  resourceType,
  resourceId,
  before,
  after,
  metadata,
});
```

Audit important operations:

- Role changes
- Department changes
- Severity changes
- Assignment changes
- Escalation
- Incident closure
- Reopening
- Administrative actions
- Authentication/security events

Never log passwords, tokens, or secrets.

---

## 38. Phase 17 — Security Hardening

Implement:

- Security headers
- CORS
- Rate limiting
- Input validation
- Secure authentication
- Token rotation
- MFA
- Session revocation
- Password hashing
- WAF
- IAM least privilege
- Private RDS
- Private S3
- Controlled CloudFront access
- Audit logging

---

## 39. Phase 18 — Terraform

Use:

```text
infrastructure/terraform/
├── modules/
│   ├── vpc/
│   ├── security/
│   ├── alb/
│   ├── ec2/
│   ├── autoscaling/
│   ├── rds/
│   ├── s3/
│   ├── cloudfront/
│   ├── sqs/
│   ├── sns/
│   ├── waf/
│   ├── cloudwatch/
│   └── iam/
└── environments/
    ├── dev/
    ├── staging/
    └── prod/
```

Manage AWS resources through Terraform wherever practical.

---

## 40. Terraform Infrastructure Order

Conceptually:

```text
VPC
 ↓
Security Groups
 ↓
IAM
 ↓
S3
 ↓
SQS/SNS
 ↓
RDS
 ↓
EC2/Launch Template
 ↓
Auto Scaling
 ↓
ALB
 ↓
CloudFront
 ↓
WAF
 ↓
CloudWatch
```

Prefer Terraform dependencies over manual ordering.

---

## 41. AWS IAM

Use least privilege.

Separate roles/policies for:

```text
EC2 application
EC2 workers
Terraform deployment
GitHub Actions deployment
Monitoring
```

Never use root credentials for workloads.

Do not place long-lived AWS access keys in source code.

---

## 42. GitHub Actions

Create:

```text
.github/workflows/
├── ci.yml
├── frontend.yml
├── backend.yml
├── terraform.yml
└── security.yml
```

CI:

```text
install
lint
typecheck
test
build
```

Terraform:

```text
fmt
validate
plan
```

Production apply requires approval.

---

## 43. Deployment Pipeline

Target:

```text
Pull Request
     ↓
Lint
     ↓
Typecheck
     ↓
Unit Tests
     ↓
Integration Tests
     ↓
Build
     ↓
Merge
     ↓
Development
     ↓
Staging
     ↓
Approval
     ↓
Production
```

Use rolling deployment.

---

## 44. EC2 Deployment

Application startup:

1. Load configuration.
2. Validate configuration.
3. Initialize dependencies.
4. Connect to DB.
5. Start server.
6. Start required workers.
7. Expose health endpoints.

Graceful shutdown:

1. Stop accepting new requests.
2. Finish active work.
3. Stop WebSocket acceptance.
4. Stop queue consumers.
5. Close DB connections.
6. Exit cleanly.

---

## 45. Database Migration Strategy

Every schema change requires a migration.

Deployment sequence:

```text
Backup
 ↓
Migration
 ↓
Application Deployment
 ↓
Health Check
```

Avoid destructive migrations without a backward-compatible migration strategy.

---

## 46. Testing Strategy

### Unit tests

- Validation
- State transitions
- Severity
- Assignment recommendations
- Duplicate detection
- Permissions
- Utility functions

### Integration tests

- Database
- Authentication
- API
- SQS abstractions
- SNS abstractions
- Media metadata
- WebSocket authorization

### End-to-end tests

Verify:

```text
Citizen creates incident
 → Dispatcher verifies
 → Severity assessed
 → Responder assigned
 → Responder accepts
 → Responding
 → Resolved
 → Closed
 → Citizen feedback
```

---

## 47. Security Tests

Test:

- Unauthorized API access
- Broken object-level authorization
- Role escalation
- Token expiration
- Refresh-token rotation
- Session revocation
- Rate limiting
- Invalid uploads
- Oversized uploads
- Anonymous identity leakage
- SQL injection attempts
- XSS payloads
- Invalid coordinates
- Malicious payloads

---

## 48. Failure Tests

Verify safe behavior when:

- Database is unavailable
- SQS is unavailable
- Queue processing fails
- DLQ receives messages
- WebSocket disconnects
- S3 upload fails
- Notification provider fails
- EC2 becomes unhealthy
- A dependency becomes unavailable

---

## 49. Observability

Every important production action should answer:

```text
What happened?
Who caused it?
When?
Which resource?
Which request/event?
Did it succeed?
If not, why?
```

Use:

- Request IDs
- Correlation IDs
- Structured logs
- CloudWatch
- CloudTrail
- Application audit logs

---

## 50. UI Implementation Order

### Citizen

1. Landing
2. Authentication
3. Dashboard
4. Report Incident
5. Incident Tracking
6. Incident Details
7. Notifications
8. SOS
9. Profile
10. Feedback
11. Public Map

### Authority

1. Login
2. Dashboard
3. Incident Queue
4. Incident Details
5. Map
6. Verification
7. Severity
8. Assignment
9. Responder Tracking
10. Escalations
11. Analytics

### Admin

1. Dashboard
2. Users
3. Departments
4. Categories
5. Configuration
6. Audit Logs
7. Settings

---

## 51. UI States

Every data-driven page must support:

```text
Loading
Empty
Success
Error
Unauthorized
Offline
Retry
```

Do not leave blank screens during loading/errors.

---

## 52. Frontend API Client

Create a centralized API client handling:

- Base URL
- Authentication
- Refresh flow
- Request IDs
- Error normalization
- JSON handling
- Safe retries
- Timeouts

Do not duplicate API-fetch logic throughout components.

---

## 53. Forms

Use:

```text
React Hook Form
+
Zod
```

Validate both:

- Client side for UX
- Server side for security

---

## 54. Performance

Optimize:

- Map rendering
- Large incident lists
- Media loading
- Dashboard queries
- WebSocket updates
- API pagination
- Database indexes

Use:

- Lazy loading
- Pagination
- Caching
- Image optimization
- Debounced search
- Virtualization only where justified

---

## 55. Seed Data

Development seed data should include:

### Departments

```text
Fire & Rescue
Medical/Emergency Health
Police/Security
Municipal/Infrastructure
Utilities
Disaster Management
```

### Incident Types

All required categories.

Use clearly marked development-only authority accounts.

Never put real credentials in seed files.

---

## 56. Demo Scenario

The final implementation must support:

```text
1. Citizen logs in.
2. Citizen reports a road accident.
3. GPS is captured.
4. Citizen uploads an image.
5. Incident enters Under Review.
6. Dispatcher sees it.
7. Dispatcher verifies it.
8. Severity is assessed.
9. Department is selected.
10. Responder recommendation appears.
11. Dispatcher assigns responder.
12. Responder receives notification.
13. Responder accepts.
14. Responder location appears on live map.
15. Incident becomes Responding.
16. Responder resolves incident.
17. Authorized authority closes incident.
18. Citizen receives update.
19. Citizen submits feedback.
20. Analytics update.
21. Audit trail records important actions.
```

---

## 57. Critical Incident Demo

Demonstrate:

```text
Citizen
 ↓
SOS
 ↓
GPS
 ↓
Critical Incident
 ↓
SQS/SNS
 ↓
Department Notification
 ↓
Supervisor Alert
 ↓
Responder Recommendation
 ↓
Assignment
 ↓
Live Tracking
 ↓
Resolution
```

---

## 58. Failure Demo

Demonstrate:

```text
SQS processing failure
 ↓
Retry
 ↓
DLQ
 ↓
CloudWatch alert
 ↓
Manual reprocessing
```

Also:

```text
WebSocket unavailable
 ↓
REST polling fallback
 ↓
WebSocket reconnect
```

---

## 59. Documentation During Implementation

Maintain:

```text
README.md
docs/
├── README.md
├── aws/
│   ├── README.md
│   ├── individual-setup.md
│   ├── sqs-demo.md
│   ├── service-showcase.md
│   ├── aurora-postgresql.md
│   └── architecture.md
├── engineering/
│   ├── architecture.md
│   ├── api-reference.md
│   ├── authentication.md
│   ├── database.md
│   ├── deployment.md
│   └── security.md
├── project/
│   ├── implementation-plan.md
│   ├── status.md
│   └── test-results.md
└── design/
    └── ui-refresh.md
```

Update documentation when implementation changes.

---

## 60. Milestones

### Milestone 1

```text
Repository
Frontend
Backend
Database
Health endpoints
CI
```

### Milestone 2

```text
Authentication
RBAC
Users
Departments
```

### Milestone 3

```text
Incident creation
Lifecycle
Severity
Timeline
```

### Milestone 4

```text
Authority dashboard
Verification
Assignment
Responder workflow
```

### Milestone 5

```text
Maps
Responder tracking
Public map
```

### Milestone 6

```text
SQS
SNS
Notifications
WebSockets
```

### Milestone 7

```text
SOS
Offline support
Feedback
```

### Milestone 8

```text
Analytics
Exports
Audit
```

### Milestone 9

```text
Terraform
AWS infrastructure
CI/CD
Monitoring
Security
```

### Milestone 10

```text
Full testing
Hardening
Documentation
Final deployment
```

---

## 61. Definition of Done

A feature is complete only when:

- UI exists.
- API exists where required.
- Authorization is enforced.
- Database migrations exist.
- Validation exists.
- Errors are handled.
- Tests exist and pass.
- Lint passes.
- Typecheck passes.
- Build passes.
- Documentation is updated.
- Security implications are reviewed.
- Existing functionality remains intact.

---

## 62. Final Implementation Checklist

### Application

- [ ] Frontend builds
- [ ] Backend builds
- [ ] Database migrations work
- [ ] Authentication works
- [ ] RBAC works
- [ ] Incident lifecycle works
- [ ] Assignment works
- [ ] Notifications work
- [ ] Maps work
- [ ] WebSockets work
- [ ] Offline flow works
- [ ] SOS works
- [ ] Analytics work
- [ ] Feedback works

### Security

- [ ] No secrets in Git
- [ ] WAF configured
- [ ] Rate limiting configured
- [ ] RBAC tested
- [ ] Private S3
- [ ] Private RDS
- [ ] MFA for authorities/admins
- [ ] Token rotation
- [ ] Audit logging

### AWS

- [ ] VPC
- [ ] ALB
- [ ] EC2
- [ ] Auto Scaling
- [ ] RDS
- [ ] S3
- [ ] CloudFront
- [ ] SQS
- [ ] SNS
- [ ] WAF
- [ ] CloudWatch
- [ ] CloudTrail
- [ ] IAM
- [ ] Secrets Manager
- [ ] Parameter Store

### Infrastructure

- [ ] Terraform validated
- [ ] Development environment
- [ ] Staging environment
- [ ] Production environment
- [ ] GitHub Actions
- [ ] Deployment rollback

### Documentation

- [ ] README
- [ ] Architecture
- [ ] AWS architecture
- [ ] API documentation
- [ ] Database documentation
- [ ] Security documentation
- [ ] Deployment documentation
- [ ] Testing documentation
- [ ] Disaster recovery
- [ ] Troubleshooting

---

## 63. Agent Execution Rule

Start from Phase 0 and proceed sequentially.

After every phase:

```text
Implement
 ↓
Lint
 ↓
Typecheck
 ↓
Test
 ↓
Build
 ↓
Update docs
 ↓
Verify previous functionality
 ↓
Continue
```

When a problem occurs:

```text
Identify
 ↓
Reproduce
 ↓
Diagnose
 ↓
Fix
 ↓
Test
 ↓
Document if relevant
 ↓
Continue
```

The final implementation must be a coherent, runnable ResQCloud platform matching `AGENT.md`.

# END OF IMPLEMENTATION PLAN
