# Disaster recovery runbook

Proposed procedure; not yet rehearsed:

1. Declare the incident, preserve audit records and stop damaging writers if necessary.
2. Identify the last known good application image and RDS recovery point.
3. Restore RDS into a new private instance, then validate migrations and incident/history consistency.
4. Update the application secret to the restored endpoint and deploy a compatible image.
5. Reconcile pending outbox records and queued messages by event ID. Do not discard queues blindly.
6. Check private evidence access and notification behavior before routing traffic.
7. Record the recovery timeline and test data consistency against agreed recovery objectives.

The console-managed demo does not configure a recovery plan, cross-region copies, S3 versioning or deletion protection. Review the RDS backup-retention setting shown during creation and choose deliberately; retained backups and snapshots may incur charges. RPO/RTO targets and a restore rehearsal remain future work. Treat demo data as disposable and do not use this setup for real emergency operations.
