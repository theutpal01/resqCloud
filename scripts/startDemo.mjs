import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createConnection } from "node:net";
import { parse } from "dotenv";

const root = process.cwd();
if (!existsSync(`${root}/package.json`)) {
  console.error("Run `npm run demo` from the ResQCloud repository root.");
  process.exit(1);
}

function runNode(args, env = process.env) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function portIsInUse(port) {
  return new Promise((resolvePort) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolvePort(true);
    });
    socket.once("error", () => resolvePort(false));
  });
}

if (!existsSync(`${root}/.env.demo`))
  runNode(["scripts/setupDemoEnvironment.mjs"]);
const localConfig = parse(readFileSync(`${root}/.env.demo`));
if (localConfig.NODE_ENV === "production") {
  console.error("The demo launcher cannot use NODE_ENV=production.");
  process.exit(1);
}
if (localConfig.DB_DIALECT !== "sqlite") {
  console.error(
    "The one-command demo requires DB_DIALECT=sqlite in .env.demo. That file is preserved; use the documented AWS/PostgreSQL flow for that configuration.",
  );
  process.exit(1);
}
if (process.argv.includes("--reset")) {
  if ((await portIsInUse(3000)) || (await portIsInUse(4000))) {
    console.error(
      "Stop the running ResQCloud web/API processes before resetting the demo database.",
    );
    process.exit(1);
  }
  const databasePath = resolve(
    root,
    localConfig.SQLITE_PATH || "./resqcloud.sqlite",
  );
  const pathFromRoot = relative(root, databasePath);
  if (
    !pathFromRoot ||
    pathFromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(pathFromRoot)
  ) {
    console.error("Reset is limited to a SQLite file inside this repository.");
    process.exit(1);
  }
  if (!stdin.isTTY) {
    console.error(
      "Interactive confirmation is required to reset the demo database.",
    );
    process.exit(1);
  }
  const prompt = createInterface({ input: stdin, output: stdout });
  const answer = await prompt.question(
    `This permanently deletes local demo data in ${pathFromRoot}. Type RESET to continue: `,
  );
  prompt.close();
  if (answer !== "RESET") {
    console.log("Reset cancelled; local data is unchanged.");
    process.exit(0);
  }
  for (const file of [
    databasePath,
    `${databasePath}-wal`,
    `${databasePath}-shm`,
  ]) {
    try {
      unlinkSync(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

const env = {
  ...localConfig,
  ...process.env,
  NODE_ENV: "development",
  DB_DIALECT: "sqlite",
  DB_SSL: "false",
  DB_SSL_CA_PATH: "",
  DB_IAM_AUTH: "false",
  SQLITE_PATH: localConfig.SQLITE_PATH || "./resqcloud.sqlite",
  PORT: "4000",
  APP_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_API_URL: "http://localhost:4000",
  NEXT_PUBLIC_DEMO_MODE: "true",
  DOTENV_CONFIG_PATH: `${root}/.env.demo`,
  RESQCLOUD_DEMO_LOGIN: "true",
  S3_BUCKET: "",
  SQS_QUEUE_URL: "",
  SNS_TOPIC_ARN: "",
  AWS_ENDPOINT: "",
  CLOUDFRONT_DOMAIN: "",
  CLOUDFRONT_PUBLIC_KEY_ID: "",
  CLOUDFRONT_PRIVATE_KEY_PATH: "",
  COGNITO_USER_POOL_ID: "",
  COGNITO_CLIENT_ID: "",
  NEXT_PUBLIC_COGNITO_CLIENT_ID: "",
  NEXT_PUBLIC_COGNITO_DOMAIN: "",
};
for (const key of [
  "AWS_PROFILE",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_WEB_IDENTITY_TOKEN_FILE",
])
  delete env[key];

console.log("Preparing the local SQLite demo and sample accounts…");
runNode(["--import", "tsx", "apps/api/src/seed.ts"], env);
console.log("\nResQCloud demo is starting.");
console.log("Web: http://localhost:3000");
console.log("API: http://localhost:4000/health");
console.log(
  "Choose any seeded role on the sign-in screen. Press Ctrl+C to stop.\n",
);

const child = spawn("npm", ["run", "dev"], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!stopping) {
      stopping = true;
      child.kill(signal);
    }
  });
}
child.on("error", (error) => {
  console.error(`Could not start the development servers: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
