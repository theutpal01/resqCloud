import { URL } from "node:url";

type AdminSecret = {
  password: string;
};

/** Creates the least-privilege IAM database user and applies versioned migrations. */
async function bootstrap() {
  const secretText = process.env.ADMIN_DB_SECRET;
  if (!secretText) throw new Error("ADMIN_DB_SECRET is required");
  const secret = JSON.parse(secretText) as AdminSecret;
  const adminUsername = process.env.ADMIN_DB_USERNAME;
  const adminHost = process.env.ADMIN_DB_HOST;
  const adminPort = Number(process.env.ADMIN_DB_PORT);
  const adminDatabase = process.env.ADMIN_DB_NAME;
  if (
    !secret.password ||
    !adminUsername ||
    !adminHost ||
    !Number.isInteger(adminPort) ||
    !adminDatabase
  )
    throw new Error("Production database bootstrap configuration is incomplete");
  const databaseUrl = new URL(
    `postgresql://${encodeURIComponent(adminUsername)}:${encodeURIComponent(secret.password)}@${adminHost}:${adminPort}/${encodeURIComponent(adminDatabase)}`,
  );

  // Set configuration before importing the DB module, which validates env at load time.
  process.env.DATABASE_URL = databaseUrl.toString();
  process.env.DB_DIALECT = "postgres";
  process.env.DB_IAM_AUTH = "false";
  process.env.DB_SSL = "true";
  process.env.DB_SSL_CA_PATH ??= "/etc/ssl/certs/rds-global-bundle.pem";

  const { db, migrate } = await import("./database.js");
  try {
    await db.authenticate();
    await db.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'resq_app') THEN
        CREATE ROLE resq_app LOGIN;
      END IF;
    END $$;`);
    await db.query("GRANT rds_iam TO resq_app");
    await db.query("GRANT CONNECT ON DATABASE resqcloud TO resq_app");
    await db.query("GRANT USAGE ON SCHEMA public TO resq_app");
    await migrate();
    await db.query(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO resq_app",
    );
    await db.query(
      "GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO resq_app",
    );
    await db.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdentifier(adminUsername)} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO resq_app`,
    );
    await db.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdentifier(adminUsername)} IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO resq_app`,
    );
    console.log("Production database role and migrations are ready.");
  } finally {
    await db.close();
  }
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

await bootstrap();
