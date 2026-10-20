# Regional disaster-readiness: needs and anomaly map

**Status:** discovery baseline for India; intended development-mode demo now, with a separately gated real pilot only if/when production mode is prepared.  
**Purpose:** establish the scope for evolving ResQCloud from a department-scoped demo into a safely scoped, region-aware disaster coordination portal. This is an assessment, not a claim of operational or emergency-services readiness.

## Executive summary

The repository has a useful incident lifecycle, role authorization, audit/history, notification plumbing, a map view, and a local demo path. The code now stores state/UT jurisdiction codes on users and incidents and scopes core operations to that code. This is a useful state-level demo foundation, not a complete jurisdiction hierarchy: district boundaries, verified location routing, agency ownership, mutual aid, disaster activation, resource/logistics management, and jurisdiction-specific policy are not implemented. See the current [feature map](feature-map.md) and [project status](status.md).

The safest design is a hierarchy such as **India → state/union territory → district → response department**, with explicit, configurable jurisdiction records. Incidents and users should be scoped to a jurisdiction; authorized mutual-aid coordination should be explicit and audited, not achieved by widening every user's access. Geographic names, boundaries, authorities, retention rules, and escalation/SLA policies must come from the relevant Indian authorities and pilot operator rather than assumptions. Development fixtures may use fictional/demo records; production mode must not inherit demo users, sample incidents, assumed boundaries, or unapproved policy defaults.

## Current-state map

| Area                   | What exists                                                                                                                       | Boundary / gap                                                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product                | Reporting, tracking, dispatch, assignment, response, resolution, supervisor closure, feedback                                     | Demo workflow; no external dispatch or contact with emergency services                                                                                                                    |
| Identity / roles       | Citizen, dispatcher, responder, supervisor, admin; session and optional Cognito paths                                             | Authority users have one state/UT code and department; no district memberships or mutual-aid grants                                                                                       |
| Data ownership         | Incident department and state/UT code; reporter/assignment ownership checks; category-to-department mapping                       | No district-level hierarchy, boundary-based routing, or time-bounded cross-jurisdiction grants                                                                                            |
| Incident intake        | Category, severity, description, location text/coordinates, people affected, time; anonymous option                               | No incident-specific jurisdiction policy, structured hazard/taxonomy management, or verified location boundary assignment                                                                 |
| Operations             | Scoped queue, incident details, assignment recommendations, responder availability/location, notifications, analytics, CSV export | No disaster activation/operational period, mutual-aid resource picture, deployment/tasking board, shelter/evacuation/road-closure/logistics workflows, or regional analytics              |
| Mapping                | Mapbox-backed incident map when configured; public map projection exists                                                          | No jurisdiction boundaries, incident clusters/heat maps, responder operational layers, offline maps, or verified geocoding; public map uses only approved records and rounded coordinates |
| Events                 | Transactional outbox, local/SQS delivery, in-app notifications, WebSocket updates, polling fallback                               | Worker is single-instance by design; delivery is at-least-once; no production HA/ownership coordination                                                                                   |
| Evidence               | S3 upload/download path and optional CloudFront                                                                                   | Malware scanning/quarantine, abandoned upload cleanup, anonymous evidence upload, and full media workflow are outstanding                                                                 |
| Continuity             | Signed-in report drafts encrypted in browser and retry on reconnect                                                               | No cold-start offline support, attachments, conflict handling, or field-operational connectivity plan                                                                                     |
| Governance / readiness | Security and deployment documentation; production caveats                                                                         | Missing jurisdiction policy input; retention/SLA/legal rules unresolved; no production recovery rehearsal, load test, penetration test, or full lifecycle/accessibility validation        |

## Anomalies and inconsistencies to resolve

1. **Jurisdiction support is partial.** Reports require an explicit active state/UT or district selection; district records can be activated, authority assignments use active jurisdictions, and state-level staff see descendant district incidents. Candidate-only geometry import and advisory location suggestions are implemented, but Survey of India data has not been fully imported or approved, and there is no agency-ownership validation, uncertainty triage workflow, or audited cross-jurisdiction grant. Source version and production reuse terms still need verification; see the [boundary source review](jurisdiction-boundary-source-review.md).
2. **Department and category routing has an editable application-level policy.** Admins can assign each supported category to an existing department and configure high/critical first-response targets. Verified agency coverage and jurisdiction-specific department mappings still need approval and configuration.
3. **Operational scope is narrower than the product ambition.** `PRODUCT.md` describes the incident lifecycle and role/scope authorization. The current code provides an incident coordination workflow, not a regional command system; there are no disaster activations, operational periods, objectives, resource logistics, or situation-report approvals.
4. **Requirements traceability needs review.** [Project status](status.md) points to the [implementation plan](implementation-plan.md) for supplied requirements. Confirm that the plan still captures the current requirements before claiming full traceability.
5. **Repository contributor instructions are mixed-stack.** Root `AGENTS.md` contains Angular/Astro/HTML/Next.js rules, while the actual web app is Next.js/React and API is Express. `apps/web/AGENTS.md` correctly indicates Next.js-specific guidance. Contributors should follow the applicable Next.js/React and API conventions, not infer that Angular or Astro is used.
6. **Disaster operations are broader than incident tickets.** Current workflow does not represent activation levels, operational periods, objectives/assignments, resource requests/offers, staging, shelters, evacuation, damage assessments, public warnings, or situation-report approval. These are capability gaps, not merely missing dashboard widgets.
7. **External integrations are conditional.** Mapbox/Cognito/AWS evidence/queue/notification integrations require live configuration and verification. Local tests use SQLite, not Aurora; no deployment proof exists.
8. **SOS wording must remain unambiguous.** It creates a critical in-platform incident, requires internet/GPS, and does not reach emergency services. It must never be represented as a 911/112/999 call or a guaranteed dispatch.

## Target capability map

### A. Jurisdiction and access foundation — prerequisite

- Complete the initial state/UT-to-district hierarchy with stable IDs, boundary source/version, and approved agency coverage; current districts have names, codes, parents, and an active flag but no geometry or version history.
- Explicit assignment of departments and personnel to jurisdictions; roles are scoped to their assigned jurisdiction, while report submission records the reporter-selected area and never grants staff access.
- Add an authoritative location workflow; uncertain or out-of-boundary reports must enter a triage queue instead of silently landing in a default department.
- Admin can configure hierarchy, boundaries, departments, category routing, memberships and delegations; changes are audited.
- Mutual aid: time-bounded grant/activation, named granting and receiving authorities, least-privilege view/action set, incident sharing rules, audit trail, expiry/revocation.
- Database migrations/backfill plan and tests proving isolation across jurisdictions, including admin, exports, analytics, media, search, sockets, notifications and background consumers.

### B. Regional disaster coordination

- Regional situation board: incident status/severity, confidence/verification, resource availability, affected people, timestamps, source, freshness and geographic extent.
- Configurable incident/hazard taxonomy and intake forms; minimum required information varies by hazard and jurisdiction.
- Activation / operational period, objectives, task assignments, decision log and approved situation reports.
- Resource inventory and mutual-aid request/offer/task lifecycle (people, vehicles, equipment, supplies, staging and availability); avoid claiming live capacity unless refreshed.
- Map layers for jurisdiction boundaries, incidents, shelters, closures, hazards and resources, with source/time/provenance and permission-aware visibility.
- Public information separated from restricted operational data: approved advisories, accessible status information, privacy-safe maps, correction/withdrawal workflow.
- Durable notifications with acknowledgement/escalation, channel preferences and delivery state; no silent failure for critical operator actions.

### C. Resilience, privacy and assurance

- Offline/low-bandwidth mobile workflow, durable local drafts and queued updates with idempotency, conflict review, expiry policy and clear sync state; no false “submitted” success while offline.
- Data classification, lawful purpose, jurisdiction-specific retention/deletion, access logging, evidence chain-of-custody, malware scanning and breach handling.
- Operational security: MFA enrollment/recovery for authorities, least privilege, rate-limit strategy for multi-instance deployment, key rotation, backups, restore tests, monitoring and incident response.
- Reliability: worker ownership/locking, cross-instance WebSocket delivery, retry/dead-letter operations, queue age and failure dashboards, graceful AWS dependency degradation.
- Accessibility and language needs for crisis use: keyboard/screen-reader, high contrast, plain language, localization, time zones, low-end mobile and accessible alerting.
- Readiness gates: threat model, jurisdiction/privacy review, load and failure-injection tests, full-role E2E, PostgreSQL integration, accessibility audit, runbooks, recovery exercise and explicit go/no-go owner.

## Recommended implementation sequence

1. **India pilot discovery** (blocking for real operational behavior, not for demo prototyping): identify the first state/UT and districts; authoritative district/state boundary dataset and its license/version; participating agencies and command hierarchy; languages; pilot hazards; data-protection/retention/legal owner; emergency-service integration expectations; and the agency accountable for go/no-go.
2. **Foundation:** design India jurisdiction schema (`IN` → state/UT → district → department), migration/backfill, shared contracts, server-derived authorization scope, admin configuration and isolation tests. Keep current local demo usable via a clearly labeled sample jurisdiction (Tamil Nadu can be a fictional-data development fixture, not a production default).
3. **Regional portal:** jurisdiction-aware navigation and queue filters, map boundary/context, scoped metrics/exports, handoff and audit views.
4. **Disaster coordination:** activation, operational period, objectives, resource requests/offers/tasks, approved situation reports and notification acknowledgements.
5. **Readiness:** offline/resilience, privacy/security, operations, accessibility, integrations and release gates; validate against the named jurisdiction and real operators before any live use.

## Acceptance invariants (must hold before rollout)

- A dispatcher/supervisor/responder cannot read, mutate, export, receive socket updates for, or fetch media for an incident outside their authorized jurisdiction unless a valid mutual-aid grant explicitly allows it.
- Selecting a different region in the browser never grants access; every API/data/event/export path derives scope from authenticated server-side grants.
- Every incident is assigned to a known jurisdiction or explicitly marked for triage; no silent default jurisdiction.
- Shared/mutual-aid access has an owner, purpose, scope, start/end, audit history and revocation path.
- User-facing statuses distinguish reported, received, verified, assigned, and externally delivered; never promise dispatch or emergency-service contact that did not happen.
- Recovery, duplicate/replayed messages, stale resource information, location uncertainty, failed integrations, offline submissions and ambiguous jurisdiction all have explicit, testable behavior.

## Scope note

“Fix all shortcomings” cannot be responsibly treated as a finite code change: [project status](status.md) lists production, governance, operations, security, and assurance work, and this repository lacks target jurisdiction/policy requirements. The first implementation should be the jurisdiction/access foundation, but its real-world defaults and policy cannot be invented. This map is intended to make those decisions visible before expanding the operational surface.

## Mode boundary agreed

- **Development mode:** demo use with fictional data and clearly marked sample jurisdiction(s); no claim that state/district assignment, dispatch, alerts, or emergency-service integrations are authoritative.
- **Current demo slice:** Tamil Nadu (`IN-TN`) only. The UI and seed data intentionally do not expose every Indian state/UT in development.
- **Production mode / real pilot:** a deployment gate, not an automatic promotion of demo configuration. Require named state/UT and districts, approved boundary source, agency authorization and mutual-aid rules, privacy/retention sign-off, real integrations and credentials, trained operators, tested recovery, independent security/accessibility/reliability checks, and written go/no-go approval. Until those gates pass, production mode must fail closed rather than silently use demo defaults.
- **Production geographic coverage requested:** include all Indian states and union territories only in production deployments after the state/UT catalog, district boundaries, and participating agency jurisdiction data are sourced and approved; a list of names/codes alone is not an operational boundary dataset.
