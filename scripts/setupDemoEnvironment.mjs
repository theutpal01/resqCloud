import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (existsSync(".env.demo")) {
  console.log(".env.demo already exists; leaving it unchanged.");
} else {
  const password = randomBytes(18).toString("base64url");
  const content = readFileSync(".env.example", "utf8")
    .replace(
      "REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS",
      randomBytes(48).toString("base64url"),
    )
    .replace("REPLACE_WITH_A_DEVELOPMENT_PASSWORD", password)
    .replace("DB_DIALECT=postgres", "DB_DIALECT=sqlite")
    .replace("DB_SSL=true", "DB_SSL=false")
    .replace(
      "DB_SSL_CA_PATH=/absolute/path/to/resCloud/.local-secrets/aurora-ca-bundle.pem",
      "DB_SSL_CA_PATH=",
    )
    .replace("DB_IAM_AUTH=true", "DB_IAM_AUTH=false")
    .replace(
      "SQLITE_PATH=./resqcloud.sqlite",
      "SQLITE_PATH=./resqcloud-demo.sqlite",
    );
  writeFileSync(".env.demo", content, { mode: 0o600 });
  console.log("Created private .env.demo with isolated SQLite storage.");
}
