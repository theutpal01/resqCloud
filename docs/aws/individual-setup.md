# ResQCloud setup for an individual AWS account

This guide takes you from a new personal AWS account to a running local copy of ResQCloud. It separates the free-of-cloud local setup from optional AWS integrations so you can stop before creating billable resources.

ResQCloud's web app and API run on your computer in the documented AWS demo. AWS services provide selected data and messaging features; this process does not deploy the app to AWS. The application is a development demo, not an emergency dispatch service. Use fictional data only. Its SOS action does not contact emergency services.

## Pick a setup path

| Path                           | What you set up                                                                 | AWS resources                          |
| ------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------- |
| Local first (recommended)      | Web app, API, SQLite, fictional sample accounts                                 | None                                   |
| SQS demonstration              | Local app plus AWS event queue                                                  | One SQS queue                          |
| Full AWS service demonstration | Local app plus Aurora PostgreSQL, SQS, S3, SNS; optional CloudFront and Cognito | Multiple AWS resources; may cost money |

Finish the local path before deciding whether you need AWS resources. A budget alert is not a spending limit, and free-tier eligibility and prices depend on the account, region, and current AWS offer.

## 1. Create and secure an individual AWS account

If you already have an account, start at step 3.

1. Go to [aws.amazon.com](https://aws.amazon.com/) and choose **Create an AWS Account**.
2. Enter an email address that you control and choose a strong, unique root password. This email becomes the account's root sign-in identity.
3. Choose **Personal** for account type and enter your legal contact details. AWS may ask for phone and payment-card verification. Follow the on-screen verification steps.
4. Choose the support plan that suits you. A paid support plan is optional for this demo; review its current price before selecting it.
5. Sign in to the AWS Console as the **root user** using the account email. Root is for initial account configuration and account-owner tasks only.
6. In the account menu, record the 12-digit AWS account ID. You will use it to confirm CLI identity and form a narrow IAM policy.
7. Open **IAM → Users → root user → Assign MFA device** (the exact menu can vary). Enroll a passkey/security key or authenticator app, save recovery information somewhere secure, then sign out and verify MFA sign-in works.
8. Do **not** create root access keys. Do not use root for CLI commands or run the application as root.
9. Open **Billing and Cost Management → Billing preferences** and enable the billing alerts/reports you want. If available, create an AWS Budget with a small monthly amount and email alerts. A budget reports estimated usage; it does not block charges, and notices may be delayed.
10. Open **Billing → Free Tier** and review the offers and remaining usage available to this account. Do not assume an AWS service is free based on an old tutorial.

For an individual account, this guide uses a dedicated IAM user for the local AWS CLI profile. If AWS offers your account a different guided identity method, use an equivalent dedicated non-root identity with MFA and only the permissions needed for the chosen demo. Never use root credentials in the application.

## 2. Choose a region and prepare your computer

Use one AWS Region for every resource. Project examples use **Asia Pacific (Sydney), `ap-southeast-2`**. Regions have different availability and prices. Choose another Region only if you also change every Region-specific command, ARN, and `.env` value below.

Install these tools:

- Git
- Node.js 24.x and npm (verify with `node --version` and `npm --version`)
- AWS CLI v2.32.0 or later only if you plan to use AWS
- OpenSSL only if you opt into CloudFront signed evidence delivery

Clone the repository or open your existing checkout. From the project root, install dependencies:

```bash
npm ci
```

The local one-command demo creates a separate `.env.demo` and SQLite database in the repository root. It leaves any existing `.env` and `resqcloud.sqlite` untouched. For the optional AWS paths later in this guide, `node scripts/setupLocal.mjs` creates `.env` only if it does not already exist. Both environment files contain private random development secrets; keep them out of Git and browser variables.

## 3. Run and sign in to the local demo (no AWS account needed)

One command prepares the local SQLite database, creates or updates the fictional sample accounts/incidents, and starts both servers:

```bash
npm run demo
```

Open [http://localhost:3000](http://localhost:3000) and choose Citizen, Dispatcher, Responder, Supervisor, or Administrator to enter with a ready-made sample account. The API health endpoint is [http://localhost:4000/health](http://localhost:4000/health); `/ready` also checks the database. The same accounts are available for manual password sign-in: `citizen@resqcloud.test`, `dispatcher@resqcloud.test`, `responder@resqcloud.test`, `supervisor@resqcloud.test`, and `admin@resqcloud.test`. Their shared password is `DEV_SEED_PASSWORD` in `.env`. The development interface uses one sample state, Tamil Nadu.

To stop both services, press **Ctrl+C** in the terminal running `npm run demo`. To rebuild the local database, use `npm run demo:reset`; it asks you to type `RESET` before deleting only `resqcloud-demo.sqlite`, reseeding, and restarting. This permanently deletes data in the demo database. The launcher will not overwrite `.env`, use PostgreSQL, or connect to AWS services.

Before continuing, you can run the project's checks:

```bash
npm test
npm run typecheck
npm run build
```

Browser tests are optional and need a browser installation; see the Playwright configuration and README.

## 4. Create a dedicated AWS CLI identity (only for AWS paths)

Do this while signed into the console as account owner for IAM setup. The app itself will use a separate identity.

1. In the AWS Console, set the Region selector to `ap-southeast-2`.
2. Open **IAM → Users → Create user** and enter `resqcloud-demo`.
3. Enable console access if the console offers it. Set a unique password; require password reset at first sign-in if you will use this identity interactively.
4. Add MFA for this user and verify it works.
5. Grant the AWS-managed `SignInLocalDevelopmentAccess` policy so AWS CLI browser sign-in can obtain temporary credentials. The service-specific permissions are added separately in the path you choose below. Do not attach broad administrator access for normal app use.
6. Install or update AWS CLI. Confirm the version:

```bash
aws --version
```

7. Sign in through the browser and confirm which account the CLI will use:

```bash
aws login --profile resqcloud-demo --region ap-southeast-2
aws sts get-caller-identity --profile resqcloud-demo
```

Check that `Account` is your 12-digit account ID and the identity is the dedicated demo identity. The SDK reads temporary credentials from this CLI profile; do not paste AWS credentials into `.env`. After changing IAM permissions, sign in again to refresh the temporary session.

If `aws login` is not available, update to the CLI version above. Do not work around it by creating root access keys.

## 5. Choose an AWS integration path

### Option A: SQS only

This is the smallest AWS integration. It leaves SQLite in place and creates one Standard SQS queue. Follow [SQS-first AWS demo setup](./sqs-demo.md) from its “Create one SQS queue” step if the local project is already running, or follow it from the beginning for the complete queue walkthrough. It includes the exact queue settings, scoped IAM policy, `.env` variables, verification, and cleanup.

At a high level, the queue path is:

1. Create a Standard queue named `resqcloud-demo-events` in `ap-southeast-2`; use a 20-second receive wait and 60-second visibility timeout.
2. Add only `sqs:SendMessage`, `sqs:ReceiveMessage`, and `sqs:DeleteMessage` on that queue to the demo identity.
3. Set `AWS_REGION` and `SQS_QUEUE_URL` in `.env` using the exact queue URL from AWS.
4. Sign in again with `aws login`, then start `AWS_PROFILE=resqcloud-demo npm run dev`.
5. Create a fictional incident, verify in-app notifications and SQS CloudWatch metrics, then delete the queue and remove its permissions when finished.

### Option B: Aurora, SQS, S3, and SNS

This path replaces local SQLite with Aurora PostgreSQL and creates several AWS resources. Review the current service prices and account-specific free offers before creating anything. The project's [console-managed AWS showcase guide](./service-showcase.md) provides exact console steps, policy JSON, environment values, test flow, and deletion steps. The [Aurora connection guide](./aurora-postgresql.md) provides the database role SQL, TLS CA setup, IAM database authentication details, and a full-configuration alternative.

Use this order:

1. Complete the local demo and AWS CLI identity steps above.
2. In Aurora/RDS, create Aurora PostgreSQL only after reviewing the account's price/offer. The guide recommends **Create with express configuration** where eligible. Wait for **Available** and record the writer endpoint and cluster resource ID.
3. Create the `resq_app` database role with the SQL in [Aurora PostgreSQL](aurora-postgresql.md).
4. Create the SQS queue, private S3 bucket, and SNS topic using [the AWS showcase](service-showcase.md). Keep S3 Block Public Access enabled. Confirm the SNS email subscription.
5. Add the showcase guide's runtime policy, substituting your own account ID, queue ARN, bucket name, topic ARN, and Aurora cluster resource ID. Check every substituted value before saving.
6. Download the RDS CA bundle as described in [Aurora PostgreSQL](aurora-postgresql.md). Set `.env` to use PostgreSQL, verified TLS, IAM database authentication, and the exact service names/URLs. Do not put a database password or AWS keys in the `.env` for express IAM authentication.
7. Optional: configure Cognito and/or CloudFront only by following the corresponding sections in [the AWS showcase](service-showcase.md). Cognito's browser app client must have no client secret and must use authorization code with PKCE. Keep CloudFront private-key material local.
8. Run `npm run db:migrate` and `npm run db:seed` while `NODE_ENV=development`. The seed script refuses to run in production.
9. Run `aws login --profile resqcloud-demo --region ap-southeast-2`, then `AWS_PROFILE=resqcloud-demo npm run dev`.
10. Check `/health` and `/ready`, exercise integrations with fictional records, and read the showcase troubleshooting notes if a service is unavailable.
11. When finished, use the showcase guide's complete cleanup checklist. Check RDS snapshots, CloudFront, S3 contents, and Billing for remaining resources.

Do not use a real emergency report, citizen identity, or medical information in this demo. Aurora may be reachable from your computer in the express setup; AWS credentials alone do not provide a network route to a private database. Do not make a database public or open a security group to `0.0.0.0/0` to solve connectivity problems.

## 6. Project configuration reference

The root `.env.example` documents every setting. For local SQLite, `setupLocal.mjs` prepares the correct values. For AWS, edit the ignored root `.env` and restart the API after changes. `NEXT_PUBLIC_*` variables are embedded in browser code; rebuild the web app after changing them. Never put private keys, passwords, AWS credentials, or database tokens in `NEXT_PUBLIC_*` variables.

| Variable                                                                                                   | Purpose                                                                                       |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `NODE_ENV`, `PORT`, `APP_ORIGIN`                                                                           | Runtime mode, API port, and allowed web origin                                                |
| `JWT_SECRET`, `DEV_SEED_PASSWORD`                                                                          | Local application signing and seed-account passwords                                          |
| `DB_DIALECT`, `DATABASE_URL`, `DB_SSL`, `DB_SSL_CA_PATH`, `DB_IAM_AUTH`, `SQLITE_PATH`                     | SQLite or PostgreSQL/Aurora configuration                                                     |
| `AWS_REGION`, `AWS_ENDPOINT`                                                                               | AWS SDK Region; endpoint override is for S3-compatible local services, normally blank for AWS |
| `SQS_QUEUE_URL`, `S3_BUCKET`, `SNS_TOPIC_ARN`                                                              | Optional AWS integrations                                                                     |
| `CLOUDFRONT_DOMAIN`, `CLOUDFRONT_PUBLIC_KEY_ID`, `CLOUDFRONT_PRIVATE_KEY_PATH`                             | Optional signed private-evidence delivery                                                     |
| `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_COGNITO_DOMAIN` | Optional hosted sign-in; browser client ID must match the API client ID                       |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`                                                          | Browser API endpoint and optional map display                                                 |

The app and API remain local in these instructions. The project has no AWS compute deployment or Terraform setup. See [deployment boundary](../engineering/deployment.md) and [implementation status](../project/status.md) before treating this project as production-ready.

## 7. Troubleshooting and teardown

| Symptom                                             | Check                                                                                                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run db:seed` says the seed password is missing | Confirm `DEV_SEED_PASSWORD` exists in root `.env` and is at least 12 characters.                                                                                                                       |
| `aws` command is missing or `aws login` is unknown  | Install/update AWS CLI v2.32.0 or later; check `aws --version`.                                                                                                                                        |
| AWS `AccessDenied`                                  | Confirm the selected profile/account, allowed service actions/resource ARN, Region, and refreshed CLI login. Check whether account-level policy restricts that service.                                |
| Database connection timeout                         | Check Aurora state, endpoint/Region/port, TLS CA path, and whether your network can reach the endpoint. A private VPC endpoint cannot be reached from a laptop without an approved network connection. |
| TLS certificate verification error                  | Use the current CA bundle and exact writer endpoint. Keep `DB_SSL=true`; do not turn off certificate validation.                                                                                       |
| Port 3000 or 4000 is busy                           | Stop the existing app process or configure another port/origin consistently.                                                                                                                           |
| Local app works but AWS integration does not        | Check API logs and `/ready`; installed AWS SDK packages do not mean AWS resources or permissions exist.                                                                                                |

For SQS, use the SQS guide's focused cleanup. For the multi-service path, follow [the full AWS showcase cleanup checklist](./service-showcase.md#11-clean-up-after-the-demo). Also run `aws logout --profile resqcloud-demo` to end the local CLI session. Removing `.env` or local database files is optional and permanently removes local secrets/data; decide what you want to keep before deleting them.

## Related project guides

- [Project README and commands](../README.md)
- [SQS-first demo](./sqs-demo.md)
- [Full console-managed AWS showcase](./service-showcase.md)
- [Aurora PostgreSQL setup](./aurora-postgresql.md)
- [AWS architecture](./architecture.md)
- [Deployment boundary](../engineering/deployment.md)
- [Implementation status](../project/status.md)
