# Monitoring the local AWS demo

The app writes structured logs to the local API process. `/health` checks process liveness and `/ready` checks database connectivity and migration availability. This project does not configure CloudWatch log shipping, alarms, dashboards or CloudTrail.

During a demo, inspect the RDS database status and metrics, SQS queue metrics, S3 bucket objects, SNS subscription status, and Cognito sign-in activity (if enabled) in their AWS service consoles. SQS messages are consumed and deleted by the API, so a zero visible-message count can be normal; compare sent and received metrics instead. Console metric updates may take several minutes.

Do not interpret default service metrics as production monitoring. Centralized logs, alert thresholds, outbox-age monitoring, notification delivery checks and an operational response process remain future work.
