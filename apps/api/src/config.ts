import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  CLOUDFRONT_DOMAIN: z.string().optional(),
  CLOUDFRONT_PUBLIC_KEY_ID: z.string().optional(),
  CLOUDFRONT_PRIVATE_KEY_PATH: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  APP_ORIGIN: z.url().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(32),
  MFA_ENCRYPTION_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(32).optional(),
  ),
  DB_DIALECT: z.enum(["postgres", "sqlite"]).default("postgres"),
  DATABASE_URL: z.string().optional(),
  DB_SSL: z.enum(["true", "false"]).default("false"),
  DB_SSL_CA_PATH: z.string().optional(),
  DB_IAM_AUTH: z.enum(["true", "false"]).default("false"),
  SQLITE_PATH: z.string().default("./resqcloud.sqlite"),
  AWS_REGION: z.string().default("ap-south-1"),
  AWS_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  SQS_QUEUE_URL: z.string().optional(),
  SNS_TOPIC_ARN: z.string().optional(),
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),
});
export const config = schema.parse(process.env);
if (
  config.NODE_ENV === "production" &&
  (config.JWT_SECRET.includes("REPLACE") ||
    !config.MFA_ENCRYPTION_KEY ||
    config.DB_DIALECT !== "postgres" ||
    !config.DATABASE_URL ||
    config.DB_SSL !== "true" ||
    !config.DB_SSL_CA_PATH ||
    !config.APP_ORIGIN.startsWith("https://") ||
    !config.COGNITO_USER_POOL_ID ||
    !config.COGNITO_CLIENT_ID)
)
  throw new Error(
    "Production requires a dedicated MFA encryption key, PostgreSQL with verified TLS, HTTPS and Cognito configuration",
  );
if (config.DB_SSL === "true" && !config.DB_SSL_CA_PATH)
  throw new Error(
    "DB_SSL requires DB_SSL_CA_PATH to verify the database certificate",
  );
if (config.DB_IAM_AUTH === "true" && config.DB_DIALECT !== "postgres")
  throw new Error("DB_IAM_AUTH is supported only with PostgreSQL");
if (config.DB_IAM_AUTH === "true" && config.DB_SSL !== "true")
  throw new Error("DB_IAM_AUTH requires verified database TLS");
