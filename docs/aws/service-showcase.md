# Console-managed AWS showcase

This guide connects the locally running ResQCloud web app and API to AWS services created in your personal AWS account. The database is Aurora PostgreSQL; the other services are SQS, S3, SNS and optional Cognito. The app and API remain on your computer.

| Service               | Purpose                                              | App configuration                                                              |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| Aurora PostgreSQL     | Incidents, users, workflow history and notifications | `DB_DIALECT`, `DATABASE_URL`, `DB_SSL`, `DB_SSL_CA_PATH`, `DB_IAM_AUTH`        |
| SQS                   | Outbox event delivery                                | `AWS_REGION`, `SQS_QUEUE_URL`                                                  |
| S3                    | Private incident evidence                            | `AWS_REGION`, `S3_BUCKET`                                                      |
| CloudFront (optional) | Signed delivery for private evidence                 | `CLOUDFRONT_DOMAIN`, `CLOUDFRONT_PUBLIC_KEY_ID`, `CLOUDFRONT_PRIVATE_KEY_PATH` |
| SNS                   | Critical incident email alerts                       | `AWS_REGION`, `SNS_TOPIC_ARN`                                                  |
| Cognito (optional)    | Citizen registration and sign-in                     | Cognito pool/client/domain settings                                            |

## Cost and account notes

Choose one AWS Region and use it for all resources; these steps use `ap-southeast-2` (Sydney), matching the current project resources. AWS currently offers Aurora PostgreSQL through **Create with express configuration** for eligible Free Tier accounts. That option is limited to 4 Aurora Capacity Units (ACUs) and 1 GB storage per cluster, and requires IAM database authentication. Check your account's offer and limits before creating the cluster. A full-configuration Aurora cluster may incur charges. A budget sends an alert; it does not cap spending. See [Aurora Free Tier limits](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-free-tier.html) and [Aurora pricing](https://aws.amazon.com/rds/aurora/pricing/).

Express configuration uses an AWS-managed internet access gateway and IAM authentication. It does not use a VPC security group or password-based database login. Scope the runtime `rds-db:connect` permission to the exact cluster and DB username. For a full-configuration cluster, follow the RDS guide's security group and password-auth alternative, and check pricing first.

## 1. Prepare the local app and AWS CLI identity

From the repository root:

```bash
npm ci
node scripts/setupLocal.mjs
```

Protect your AWS account with MFA and do not create root access keys. Use a separate console identity with MFA for resource management. Create a dedicated IAM user named `resqcloud-demo` with console sign-in and MFA for the local app profile, then attach the AWS-managed `SignInLocalDevelopmentAccess` policy. The runtime policy is added in step 6. An organization and IAM Identity Center are not required.

Install AWS CLI v2.32.0 or newer and sign in using browser-based console authentication:

```bash
aws --version
aws login --profile resqcloud-demo --region ap-southeast-2
aws sts get-caller-identity --profile resqcloud-demo
```

Verify the account ID belongs to you. The SDK uses temporary credentials from this profile; do not put AWS keys in `.env`. AWS's `aws login` setup and requirements are documented [here](https://docs.aws.amazon.com/signin/latest/userguide/command-line-sign-in.html).

## 2. Create Aurora PostgreSQL

In the AWS Console, choose `ap-southeast-2`, then open **RDS → Databases**. On the welcome page, find **Create with express configuration** and choose **Create**. Review the configuration, set a cluster identifier such as `resqcloud-demo`, and set the initial database name to `resqcloud`. Leave the internet access gateway and IAM authentication enabled. Create the database and wait until its status is **Available**.

From the cluster's **Connectivity & security** details, record:

- The writer/cluster endpoint hostname (do not include `https://` or `:5432`).
- Port `5432`.
- The cluster resource ID (used in the IAM policy).
- Your AWS account ID, available from the account menu or `aws sts get-caller-identity`.

Express configuration creates Aurora PostgreSQL with IAM database authentication and an internet access gateway. To connect to it, create an app DB role and grant the runtime IAM identity access. Follow [the Aurora PostgreSQL guide](./aurora-postgresql.md) for the DB role SQL and CA bundle setup.

If Express configuration is not available in your account, do not assume the full-configuration alternative is free. Either use local SQLite/PostgreSQL for the demo, or check the price estimate before creating a standard Aurora cluster. Full configuration needs a VPC and a carefully restricted security group for laptop access.

## 3. Create an SQS queue

Open **Amazon SQS → Create queue**:

1. Select **Standard** and name it `resqcloud-demo-events`.
2. Set **Receive message wait time** to 20 seconds and **Visibility timeout** to 60 seconds.
3. Keep SQS-managed encryption.
4. Create the queue and record its URL and ARN from the queue details.

## 4. Create a private S3 bucket

Open **Amazon S3 → Create bucket**. Enter a globally unique name, choose `ap-southeast-2`, keep **Block all public access** enabled, and leave default encryption enabled. Create it and record the bucket name.

Open the bucket's **Permissions → CORS** settings and add this rule for local evidence uploads:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Do not add a public bucket policy. The API stores demo evidence under the `development/` key prefix.

## 5. Configure CloudFront for private evidence (optional)

CloudFront is optional; the authenticated API download continues to work without it. This adds a private CDN path: the API checks the user and signs a five-minute URL, CloudFront validates it with a trusted key group, and OAC lets CloudFront read the private S3 bucket. Do not enable public access on the bucket. CloudFront and data transfer can incur charges, so check current [CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/) and your account's offer before creating a distribution. A budget alert does not cap spending.

### Generate a signing key pair locally

From the repository root, create a 2048-bit RSA key pair. Keep the private key on this machine; only upload the public key to CloudFront. `.local-secrets/` is ignored by Git.

```bash
mkdir -p .local-secrets
openssl genrsa -out .local-secrets/cloudfront-private-key.pem 2048
openssl rsa -pubout -in .local-secrets/cloudfront-private-key.pem -out .local-secrets/cloudfront-public-key.pem
```

Do not paste or commit the private key. The API reads it from the path configured in `.env`.

### Add the public key and trusted key group

1. In **CloudFront → Public keys**, choose **Create public key**. Give it a name such as `resqcloud-demo-signer`, open `cloudfront-public-key.pem` locally, and paste its full PEM contents into the public key field. Save and record the **Public key ID** (not the key group ID).
2. In **CloudFront → Key groups**, choose **Create key group**, add that public key, save, and record the group name. CloudFront recommends trusted key groups for signed URLs. See AWS's [trusted signer guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-trusted-signers.html).

### Create a distribution with a private S3 origin

1. Open **CloudFront → Distributions → Create distribution**. Choose the evidence S3 bucket as the origin. Use its normal regional S3 bucket endpoint, not the S3 website endpoint.
2. Set **Origin access** to **Origin access control settings (recommended)**. Create an OAC with **Sign requests (recommended)**. Keep all S3 Block Public Access settings enabled.
3. For the default cache behavior, redirect HTTP to HTTPS; allow only **GET, HEAD**; use the default cache policy; and set **Restrict viewer access** to **Yes**. Choose **Trusted key groups** and add the key group created above.
4. Create the distribution. When CloudFront offers to update the bucket policy for OAC, allow it. Otherwise, apply the policy CloudFront provides under the origin's access settings. Check that the policy grants `cloudfront.amazonaws.com` access only for this distribution and the bucket objects. Do not add anonymous `s3:GetObject` access.
5. Wait for the distribution status to become **Deployed**. Record its **Distribution domain name**, for example `d123example.cloudfront.net`. The default CloudFront hostname already supports HTTPS; no custom domain or certificate is needed for this demo.

OAC secures the origin connection, while the trusted key group restricts viewers. Both are required for private signed delivery. AWS describes the supported OAC setup [here](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html) and the signed URL flow [here](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html).

## 6. Create an SNS topic

Open **Amazon SNS → Topics → Create topic**, select **Standard**, and name it `resqcloud-critical-alerts`. Create the topic and record its ARN. Create an **Email** subscription for an address you can access, then confirm the subscription from the message SNS sends.

## 7. Grant the runtime identity narrow permissions

In **IAM → Users → resqcloud-demo → Add permissions → Create inline policy → JSON**, paste this policy. Replace each placeholder with the exact value from the console. The cluster resource ID appears in Aurora cluster details. The `rds-db:connect` ARN must include the database username `resq_app` at the end.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage"],
      "Resource": "REPLACE_WITH_QUEUE_ARN"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::REPLACE_WITH_BUCKET_NAME/development/*"
    },
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "REPLACE_WITH_TOPIC_ARN"
    },
    {
      "Effect": "Allow",
      "Action": "rds-db:connect",
      "Resource": "arn:aws:rds-db:ap-southeast-2:REPLACE_WITH_ACCOUNT_ID:dbuser:REPLACE_WITH_CLUSTER_RESOURCE_ID/resq_app"
    }
  ]
}
```

Name the policy `ResQCloudDemoRuntime`, review it, and save. The `rds-db:connect` ARN uses the **cluster resource ID**, not the endpoint, cluster identifier, or ordinary RDS ARN. AWS documents the required ARN format [here](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/UsingWithRDS.IAMDBAuth.IAMPolicy.html).

## 8. Optionally configure Cognito

For hosted citizen sign-in, open **Amazon Cognito → User pools → Create user pool** and configure email as a sign-in option. Create an app client as a **public client** with no client secret. Enable authorization code grant with PKCE; allow scopes `openid`, `email`, and `profile`. Register these URLs exactly:

- Callback: `http://localhost:3000/auth/callback`
- Sign out: `http://localhost:3000`

Create a Cognito domain. Record the user pool ID, app client ID, and full domain URL. Cognito's public client should use authorization code with PKCE; see [app client settings](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html). You can skip Cognito and use the local seeded accounts.

## 9. Configure `.env`

Use the private `.env` created by `setupLocal.mjs`. Download the Aurora/RDS CA bundle from the project root:

```bash
mkdir -p .local-secrets
curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o .local-secrets/rds-global-bundle.pem
curl -fsSL https://www.amazontrust.com/repository/AmazonRootCA1.pem -o .local-secrets/amazon-root-ca-1.pem
cat .local-secrets/rds-global-bundle.pem .local-secrets/amazon-root-ca-1.pem > .local-secrets/aurora-ca-bundle.pem
realpath .local-secrets/aurora-ca-bundle.pem
```

Set these values in `.env`, replacing the example endpoint, bucket, queue URL, topic ARN, account ID and cluster resource ID in the policy where applicable:

```dotenv
AWS_REGION=ap-southeast-2
DB_DIALECT=postgres
DATABASE_URL=postgres://resq_app@YOUR_AURORA_WRITER_ENDPOINT:5432/resqcloud
DB_SSL=true
DB_SSL_CA_PATH=/absolute/path/to/resCloud/.local-secrets/aurora-ca-bundle.pem
DB_IAM_AUTH=true
SQS_QUEUE_URL=YOUR_QUEUE_URL
S3_BUCKET=YOUR_BUCKET_NAME
SNS_TOPIC_ARN=YOUR_TOPIC_ARN
CLOUDFRONT_DOMAIN=YOUR_DISTRIBUTION_DOMAIN
CLOUDFRONT_PUBLIC_KEY_ID=YOUR_CLOUDFRONT_PUBLIC_KEY_ID
CLOUDFRONT_PRIVATE_KEY_PATH=/absolute/path/to/resCloud/.local-secrets/cloudfront-private-key.pem
```

If CloudFront is not configured, leave all three `CLOUDFRONT_*` values blank. Do not set `AWS_ENDPOINT` for AWS; leave it blank so the AWS SDK uses the standard regional service endpoints. `S3_BUCKET` is the bucket name only (for example `resqcloud-evidences-2026`), not its ARN or URL.

The app generates a short-lived Aurora IAM database token when it opens a PostgreSQL connection. Do not add a DB password to this URL. Keep the database endpoint, Region, username, and `rds-db:connect` policy values consistent. If Cognito is enabled, also set `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, and `NEXT_PUBLIC_COGNITO_DOMAIN` to the matching values.

## 10. Migrate, seed, and run

From the repository root, create the schema and fictional demo records in Aurora:

```bash
npm run db:migrate
npm run db:seed
```

Make sure `NODE_ENV=development` remains set. Read `DEV_SEED_PASSWORD` from `.env`. Authenticate the profile and start the app in two separate commands:

```bash
aws login --profile resqcloud-demo --region ap-southeast-2
AWS_PROFILE=resqcloud-demo npm run dev
```

Open `http://localhost:3000`. API health is `http://localhost:4000/health`; dependency readiness is `http://localhost:4000/ready`.

Demonstrate the services using fictional data: update an incident to send/consume an SQS event, upload a small evidence image and check for its private S3 object, request the image through its signed CloudFront URL, and make a test incident critical to trigger SNS email. A URL is valid for five minutes. To verify privacy, try the S3 object URL directly; it should be denied. SQS messages may be gone by the time you inspect the queue because the API consumes and deletes them; compare sent and received metrics. Seeded critical events may also send email alerts. If Cognito is configured, complete the citizen sign-up and email confirmation flow.

## 11. Clean up after the demo

Stop the local app. In the AWS Console, disable and delete the CloudFront distribution (deletion is allowed after it is disabled), delete its key group and public key, empty and delete the S3 bucket, delete the SQS queue and SNS topic, and delete the Cognito user pool if created. Delete the Aurora cluster and its DB instances; if the data is disposable, do not retain a final snapshot. Remove the runtime inline policy and demo IAM user if no longer needed. Review Billing for remaining snapshots or other resources.

For an SQS-only first setup, see [the low-cost AWS guide](./sqs-demo.md). This project does not deploy the web app or API to AWS compute; see [deployment status](../engineering/deployment.md).
