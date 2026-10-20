# Connect ResQCloud to Aurora PostgreSQL

The project uses Sequelize with PostgreSQL for its Aurora database connection. The recommended console path is Aurora PostgreSQL **Create with express configuration**, which uses IAM database authentication and the Aurora internet access gateway. The API creates short-lived database authentication tokens from the local AWS CLI profile; no database password is stored in `.env`.

## Aurora Free Tier and express configuration

AWS lists Aurora PostgreSQL under its Free Tier through express configuration for eligible accounts. Express clusters have an AWS-managed internet access gateway, use IAM authentication only, and currently have limits of up to 4 ACUs and 1 GB of storage per cluster. These limits and any credits are account-plan dependent. Full configuration has different options and pricing, and should not be assumed free. See [Aurora Free Tier limitations](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-free-tier.html) and [express configuration settings](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_GettingStartedAurora.AuroraPostgreSQL.ExpressConfig.html).

## 1. Create Aurora PostgreSQL in the Console

1. Open **Amazon RDS → Databases** and select the AWS Region for the demo (the project examples use `ap-southeast-2`).
2. On the RDS welcome page, select **Create with express configuration → Create**.
3. Set a cluster identifier such as `resqcloud-demo` and initial database name `resqcloud`.
4. Keep IAM database authentication and the internet access gateway enabled.
5. Review the selected account plan and settings, create the database, and wait until its status is **Available**.
6. From cluster details, record the writer/cluster endpoint, port `5432`, and **cluster resource ID**. The resource ID is different from the endpoint and cluster identifier.

Express configuration does not use a VPC security group; its managed gateway supports internet access with IAM authentication. Do not switch to full configuration without reviewing the cost and networking requirements.

## 2. Create the app database role

The express cluster's administrator uses IAM authentication. From the Aurora cluster's **Connectivity & security** tab, use the RDS Console's **CloudShell** connection option to open `psql` as the administrator. Select the `resqcloud` database, then run:

```sql
CREATE ROLE resq_app LOGIN;
GRANT rds_iam TO resq_app;
GRANT CONNECT ON DATABASE resqcloud TO resq_app;
GRANT USAGE, CREATE ON SCHEMA public TO resq_app;
```

This gives the app's migration role permission to create its tables in the `public` schema. The app identity will still be restricted by the IAM `rds-db:connect` ARN in the [showcase guide](./service-showcase.md). AWS describes creating PostgreSQL users for IAM authentication [here](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/UsingWithRDS.IAMDBAuth.DBAccounts.html).

## 3. Set up the RDS CA bundle

From the project root, download the AWS global database CA bundle:

```bash
mkdir -p .local-secrets
curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o .local-secrets/rds-global-bundle.pem
curl -fsSL https://www.amazontrust.com/repository/AmazonRootCA1.pem -o .local-secrets/amazon-root-ca-1.pem
cat .local-secrets/rds-global-bundle.pem .local-secrets/amazon-root-ca-1.pem > .local-secrets/aurora-ca-bundle.pem
realpath .local-secrets/aurora-ca-bundle.pem
```

The combined trust file contains AWS's RDS roots and Amazon Root CA 1. This Aurora endpoint currently presents a certificate chain rooted at Amazon Root CA 1, so using only the RDS global bundle fails certificate verification. The API continues to verify the TLS chain. AWS documents its RDS CA bundles [here](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/UsingWithRDS.SSL.html); Amazon Trust Services recommends including its root certificates in custom trust stores [here](https://www.amazontrust.com/repository/).

## 4. Configure the API

In the root `.env`, set the Aurora writer endpoint, database role, and absolute CA file path:

```dotenv
AWS_REGION=ap-southeast-2
DB_DIALECT=postgres
DATABASE_URL=postgres://resq_app@YOUR_AURORA_WRITER_ENDPOINT:5432/resqcloud
DB_SSL=true
DB_SSL_CA_PATH=/absolute/path/to/resCloud/.local-secrets/aurora-ca-bundle.pem
DB_IAM_AUTH=true
```

Do not put a password in this URL for an express cluster. `DB_IAM_AUTH=true` causes the API to generate a temporary token for each new PostgreSQL connection using the AWS SDK signer and credentials selected by `AWS_PROFILE`.

The database URL must use the writer/cluster endpoint, not a custom DNS alias, because IAM token signatures are made for the exact endpoint. Keep the Region, endpoint, port, DB role, and IAM policy in sync.

## 5. Run migrations and seed data

After adding the `rds-db:connect` permission for `resq_app` to the `resqcloud-demo` IAM identity, log in and apply the schema:

```bash
aws login --profile resqcloud-demo --region ap-southeast-2
npm run db:migrate
npm run db:seed
```

The seed command creates fictional dispatcher, responder, supervisor, admin, and citizen accounts and sample incidents. It requires `NODE_ENV=development`; the generated seed password is in `.env`. Then start the app:

```bash
AWS_PROFILE=resqcloud-demo npm run dev
```

Check `http://localhost:4000/ready` for dependency readiness and open `http://localhost:3000` for the app.

If migration fails with `permission denied for schema public`, connect to the `resqcloud` database as its administrator in RDS Console CloudShell and grant the dedicated app role the required schema permissions:

```sql
\c resqcloud
GRANT USAGE, CREATE ON SCHEMA public TO resq_app;
SELECT has_schema_privilege('resq_app', 'public', 'USAGE') AS can_use,
       has_schema_privilege('resq_app', 'public', 'CREATE') AS can_create;
```

The app role needs permission to create and own its tables, but should not be a database administrator.

## If you choose Aurora full configuration instead

Full configuration can use password authentication. It is not the express Free Tier path. Create Aurora PostgreSQL with a VPC, public access only if needed for the laptop, and a security group allowing TCP `5432` from your current public IP `/32` only. Never use `0.0.0.0/0`. Create a separate database user and grant it access to `resqcloud`; do not run the app as the master user.

For that password-auth setup, set `DB_IAM_AUTH=false` and use a password-bearing URL, for example:

```dotenv
DB_DIALECT=postgres
DATABASE_URL=postgres://resq_app:URL_ENCODED_PASSWORD@YOUR_AURORA_WRITER_ENDPOINT:5432/resqcloud
DB_SSL=true
DB_SSL_CA_PATH=/absolute/path/to/resCloud/.local-secrets/aurora-ca-bundle.pem
DB_IAM_AUTH=false
```

URL-encode special characters in the password. Keep `DB_SSL=true` and use the CA bundle for either configuration.

## Delete the demo database

Stop the app. In **RDS → Databases**, delete the Aurora DB instances and cluster. Do not retain a final snapshot if the data is disposable; snapshots may continue to incur charges. Remove the `rds-db:connect` permission and `resq_app` role if they are no longer needed, then check Billing for remaining resources.
