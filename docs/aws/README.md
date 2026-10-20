# ResQCloud AWS and project setup

This folder contains the compiled PDF and its documentation entry point. The guide is for an individual developer setting up a local ResQCloud demo, with optional AWS integrations. The web application and API remain local throughout these instructions.

## Start here

1. Follow the [individual AWS account and local project setup](./individual-setup.md). It covers account security, local prerequisites, environment setup, demo accounts, and both AWS paths.
2. Choose the level of AWS integration you need:
   - [SQS first demo](./sqs-demo.md) for a single queue and scoped permissions.
   - [Full AWS service showcase](./service-showcase.md) for the multi-service configuration and cleanup steps.
   - [Aurora PostgreSQL details](./aurora-postgresql.md) for database access, TLS, and IAM authentication.
3. Review the [AWS architecture](./architecture.md), [deployment boundary](../engineering/deployment.md), and [implementation status](../project/status.md) before adapting the demo or treating it as production software.
4. Use the [project README](../../README.md) for repository commands and general development notes.

## Contents

| File                                                 | What it covers                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [Compiled PDF](./ResQCloud-Individual-AWS-Setup.pdf) | Account setup, local project setup, AWS walkthroughs, and project readiness references in one document. |
| [Individual account setup](./individual-setup.md)    | Step-by-step setup for a personal AWS account, local development, SQS, and the full AWS demo.           |
| [SQS first demo](./sqs-demo.md)                      | Queue creation, least-privilege access, verification, and cleanup.                                      |
| [Full AWS showcase](./service-showcase.md)           | Console steps for Aurora, SQS, S3, SNS, and optional Cognito or CloudFront.                             |
| [Aurora PostgreSQL](./aurora-postgresql.md)          | Database configuration, TLS, IAM database authentication, and connection checks.                        |
| [AWS architecture](./architecture.md)                | AWS resources and how they connect to the local app.                                                    |
| [Deployment boundary](../engineering/deployment.md)  | Current deployment model and constraints.                                                               |
| [Implementation status](../project/status.md)        | Current capabilities, known gaps, and production readiness notes.                                       |
| [Project README](../../README.md)                    | Repository overview, commands, and development workflow.                                                |

## Rebuild the PDF

From the repository root, run:

```bash
node scripts/renderAwsSetupPdf.mjs
```

The renderer reads the source files listed in `scripts/renderAwsSetupPdf.mjs` and writes the PDF into this folder. It uses the installed Playwright package and local Chromium; set `CHROMIUM_PATH` if Chromium is installed somewhere else.

## Safety notes

Use fictional data only. The demo is not an emergency dispatch service, and its SOS action does not contact emergency services. AWS resources can incur charges; check current prices and account offers before creating them. A budget alert does not cap spending. Follow the source guide's cleanup checklist when finished.
