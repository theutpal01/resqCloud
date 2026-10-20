import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      NODE_ENV: "test",
      DB_DIALECT: "sqlite",
      SQLITE_PATH: ":memory:",
      DB_SSL: "false",
      DB_SSL_CA_PATH: "",
      DB_IAM_AUTH: "false",
      JWT_SECRET: "test-only-secret-at-least-thirty-two-characters",
      APP_ORIGIN: "http://localhost:3000",
      AWS_ENDPOINT: "",
      S3_BUCKET: "",
      SQS_QUEUE_URL: "",
      SNS_TOPIC_ARN: "",
      CLOUDFRONT_DOMAIN: "",
      CLOUDFRONT_PUBLIC_KEY_ID: "",
      CLOUDFRONT_PRIVATE_KEY_PATH: "",
      COGNITO_USER_POOL_ID: "",
      COGNITO_CLIENT_ID: "",
    },
  },
});
