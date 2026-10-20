# Incident workflow

Normal path: reported → under_review → verified → severity_assessed → assigned → responding → resolved → closed. Assignment is a separate transaction, not a generic status mutation. Responders must explicitly accept before starting response. Closure/reopening require supervisor or admin rights.

Exception paths include rejected, duplicate, escalated and reopened. Allowed edges live in `packages/shared/src/index.ts`. Every status transition records from/to, actor, timestamp and reason. Severity changes are audited and emit an event. Rule-based duplicate candidates never merge automatically.

Recommendation score uses eligible department, available duty status, matching skills and geographic distance. Busy responders are excluded, keeping workload to one active assignment. Advanced weighted workload/severity policies are not yet implemented.
