# AWS showcase architecture

The local demo runs on a developer machine. A separate limited production pilot runs on AWS; its resources are defined in `infra/aws/production.yaml`.

```text
Browser ── localhost:3000 ── Next.js web app
                                  │
                                  └── localhost:4000 ── Express API
                                                            │
                          ┌─────────────────────────────────┼──────────────────┐
                          │                 │               │                  │
                    Aurora PostgreSQL     SQS              S3                 SNS
                       incidents       outbox events   private evidence   critical email
                                                            │
                                                        CloudFront
                                                   signed private delivery
                                                            │
                                                   Cognito (optional sign-in)
```

The API uses a local AWS CLI profile for SQS, S3 and SNS. Aurora PostgreSQL access uses a dedicated database role, verified TLS, and short-lived IAM database tokens. Cognito is an optional browser sign-in integration. SQLite and local password sign-in remain available for development and tests.

CloudFront is optional and serves confirmed evidence through five-minute signed URLs. S3 remains private: CloudFront uses Origin Access Control (OAC), while a trusted key group verifies viewer URLs. The API signs URLs locally with the corresponding private key; the private key is not uploaded to AWS.

The current pilot uses single-task ECS services and HTTP from CloudFront to the ALB. It has CloudWatch application logs but remains short of emergency-response readiness. See [deployment.md](../engineering/deployment.md), [production pilot configuration](../project/production-pilot.md), and [status.md](../project/status.md).
