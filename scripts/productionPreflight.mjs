import { readFileSync } from "node:fs";
const required = [
  "DATABASE_URL",
  "DB_SSL_CA_PATH",
  "JWT_SECRET",
  "MFA_ENCRYPTION_KEY",
  "APP_ORIGIN",
  "COGNITO_USER_POOL_ID",
  "COGNITO_CLIENT_ID",
  "S3_BUCKET",
  "SQS_QUEUE_URL",
  "SNS_TOPIC_ARN",
];
const missing = required.filter(
  (k) => !process.env[k] || process.env[k]?.includes("REPLACE"),
);
if (missing.length)
  throw new Error(`Missing production configuration: ${missing.join(", ")}`);
if (
  process.env.NODE_ENV !== "production" ||
  process.env.DB_DIALECT !== "postgres" ||
  process.env.DB_SSL !== "true"
)
  throw new Error(
    "Production must explicitly select PostgreSQL with verified TLS",
  );
if (process.env.DB_SSL !== "true")
  throw new Error(
    "Production must enable verified database TLS with DB_SSL=true",
  );
try {
  readFileSync(process.env.DB_SSL_CA_PATH);
} catch {
  throw new Error("DB_SSL_CA_PATH must point to a readable RDS CA bundle");
}
if (!process.env.APP_ORIGIN?.startsWith("https://"))
  throw new Error("HTTPS origin required");
console.log(
  "Environment checks passed. Read docs/project/status.md for remaining release gates.",
);
console.log(
  readFileSync("docs/project/status.md", "utf8")
    .split("\n")
    .slice(0, 7)
    .join("\n"),
);
