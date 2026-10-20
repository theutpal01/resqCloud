# SQS-first AWS demo setup

This guide is the low-cost first step for connecting a locally running
ResQCloud API to one Amazon SQS Standard queue. For the project's complete
AWS-backed application demo (RDS, SQS, S3 and SNS), use the
[AWS showcase guide](./service-showcase.md). Both paths keep the web app and API
running locally and avoid AWS compute infrastructure.

AWS free offers have account and usage conditions. SQS includes up to one
million requests per month at no charge, but exceeding that limit can incur
charges. This guide avoids S3, SNS, NAT Gateway, RDS and CloudFront in the
first pass. If you need a hard $0 guarantee, do
not create AWS resources; a budget alert is not a spending cap. Check your
account's Free Tier status and SQS pricing before proceeding:
[AWS Free Tier](https://aws.amazon.com/free/),
[SQS pricing](https://aws.amazon.com/sqs/pricing/).

## 1. Install and verify the local app

Use Node.js 24 and npm. From the repository root:

```bash
cd /home/user/Projects/Cloud/resCloud
npm ci
node scripts/setupLocal.mjs
npm run db:seed
```

`setupLocal.mjs` creates a private `.env` configured for SQLite if one does not
already exist. `db:seed` also runs the database migration and creates demo
accounts and sample incidents. Keep `.env` private. Note the value of
`DEV_SEED_PASSWORD` in that file; all seeded accounts use it.

## 2. Check AWS account and cost settings

1. Sign in to the AWS account you intend to use. Do not use the root user for
   CLI work.
2. In **Billing and Cost Management**, review **Free Tier** and confirm which
   offers apply to your account. Free account plan availability and limits
   depend on account eligibility.
3. If available, create a small AWS Budget alert (for example, `$1`) and email
   notification. A budget is an alert, not a hard spending limit, and usage
   reporting can be delayed.
4. Choose one region and use it consistently. The project template defaults
   to `ap-southeast-2` (Sydney); this guide uses that region.

## 3. Set up a restricted CLI identity in your personal account

Install or update to AWS CLI v2.32.0 or newer. You do not need IAM Identity
Center, an organization, or an SSO start URL. In your personal AWS account,
use the account owner's root sign-in in the **AWS Console for setup only**.
Create a dedicated demo IAM user with console access; do not use the root
identity to run the app. Attach the AWS-managed
`SignInLocalDevelopmentAccess` policy so this identity can use browser-based
CLI sign-in. You can do this in your own account; an organization is not
required.

In the AWS Console:

1. Open **IAM → Users → Create user** and name it `resqcloud-demo`.
2. Enable AWS Management Console access for this user, set a unique password,
   and enable MFA.
3. Attach the AWS-managed `SignInLocalDevelopmentAccess` policy. The
   queue-specific policy in the next step grants the app its SQS access.

If your account's sign-in experience does not offer IAM users with console
access, use a restricted console identity it provides. Do not create root
access keys or run the app as root.

Then use browser login to obtain temporary credentials:

```bash
aws login --profile resqcloud-demo --region ap-southeast-2
aws sts get-caller-identity --profile resqcloud-demo
```

Complete the browser sign-in as the dedicated IAM user and check the returned
account ID. AWS documents that `aws login` uses existing console credentials
and refreshes temporary credentials. The identity also needs the SQS
permissions in the next step. Do not create root access keys.
[AWS CLI browser login](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html)

If your CLI version does not support `aws login`, update it first. Avoid
creating long-lived access keys as a workaround unless your account
administrator explicitly requires that method. The AWS SDK in the API reads
the CLI profile; no AWS keys belong in `.env`.

## 4. Create one SQS queue

In the AWS Console, open **Amazon SQS → Create queue**, select **Standard**,
enter `resqcloud-demo-events`, and set **Receive message wait time** to 20
seconds and **Visibility timeout** to 60 seconds. Keep encryption at the
default SQS-managed key; do not select a customer-managed KMS key for this
demo. Create the queue and copy its URL from the queue details.

The API only needs `sqs:SendMessage`, `sqs:ReceiveMessage`, and
`sqs:DeleteMessage` on this queue. Add these to the IAM user or role used by
the profile, scoped to this queue's ARN. Get your account ID with
`aws sts get-caller-identity --query Account --output text --profile resqcloud-demo`;
the queue ARN is
`arn:aws:sqs:ap-southeast-2:<ACCOUNT_ID>:resqcloud-demo-events`.

Add this inline policy to the demo IAM user, replacing `<ACCOUNT_ID>` with the
account ID returned above:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage"],
      "Resource": "arn:aws:sqs:ap-southeast-2:<ACCOUNT_ID>:resqcloud-demo-events"
    }
  ]
}
```

In the AWS Console, open **IAM → Users → resqcloud-demo → Add permissions →
Create inline policy → JSON**, paste the policy, replace the account ID, then
review and save it. Re-run `aws login --profile resqcloud-demo --region
ap-southeast-2` after changing permissions so the CLI refreshes the temporary
session.

The API long-polls for up to 20 seconds and waits about one second before its
next receive. While running continuously, that is roughly 124,000 receive
requests in a 30-day month, below SQS's one-million-request free allowance
before counting sends, deletes, or other account usage. A newly created
incident can take up to about 21 seconds to appear in queue-driven
notifications. With SQS disabled, local event delivery keeps its two-second
poll interval.

## 5. Point the API at the queue

Open `/home/user/Projects/Cloud/resCloud/.env` and set:

```dotenv
AWS_REGION=ap-southeast-2
SQS_QUEUE_URL=https://sqs.ap-southeast-2.<ACCOUNT_ID>.amazonaws.com/<ACCOUNT_ID>/resqcloud-demo-events
```

Replace the placeholder URL with the exact `QueueUrl` from step 4. Leave
`S3_BUCKET`, `SNS_TOPIC_ARN`, Cognito, and CloudFront settings blank for this
first integration. No frontend variables or AWS credentials are needed.

## 6. Start the app with the AWS profile

From the repository root, authenticate and start both services:

```bash
cd /home/user/Projects/Cloud/resCloud
aws login --profile resqcloud-demo --region ap-southeast-2
AWS_PROFILE=resqcloud-demo npm run dev
```

Open `http://localhost:3000`; API health is at `http://localhost:4000/health`
and readiness is at `http://localhost:4000/ready`. The API terminal should
remain free of `AccessDenied` and SQS errors.

## 7. Verify the AWS-backed workflow

1. Sign in as `citizen@resqcloud.test` using `DEV_SEED_PASSWORD` from `.env`.
2. Create a test incident. Use sample details only; do not enter a real
   emergency or personal information.
3. Let the dispatcher/responder workflow move the incident through a status
   change, which writes an event to the transactional outbox.
4. Confirm the incident notification appears in the app. The backend sends
   the outbox event to SQS, consumes it, and records an idempotent notification.
5. In the AWS Console, open **SQS → resqcloud-demo-events → CloudWatch metrics**.
   Check sent and received message metrics; consumed messages are deleted, so
   the queue can correctly show zero visible messages. Metrics can take several
   minutes to appear. The console identity needs permission to view this queue
   and its CloudWatch metrics; ask the account administrator if needed.
6. Check the API log if notifications do not appear. `AccessDenied` usually
   means the IAM identity lacks one of the three queue actions; a malformed queue
   URL or region mismatch also prevents delivery.

Run local checks any time with:

```bash
npm run typecheck
npm test
npm run build
```

## 8. Stop and delete the demo queue

Stop the app with **Ctrl+C**, then open **Amazon SQS → resqcloud-demo-events →
Delete** in the AWS Console using an account administrator identity. Deleting
the queue permanently removes messages. Remove the queue permissions from the
demo IAM user if they were granted only for this demo, then sign out of its
local CLI session:

```bash
aws logout --profile resqcloud-demo
```

Keep local SQLite data or delete it separately according to your needs.

## Add other AWS services later

The API already supports private S3 uploads and SNS publishing, but these are
not needed to demonstrate the first SQS integration. S3 can charge for
storage, requests, or transfer; SNS delivery costs vary by endpoint. Check
their account-specific offers and regional pricing before adding them. For the
full console-managed showcase, including RDS, S3, SNS and optional Cognito, see
[AWS service showcase](./service-showcase.md). To add only RDS first, see
[Aurora PostgreSQL](./aurora-postgresql.md).
