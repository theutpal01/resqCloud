import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const profile = process.env.AWS_PROFILE || "resqcloud-prod";
const region = process.env.AWS_REGION || "ap-southeast-2";
const stack = "resqcloud-production";
const template = "infra/aws/production.yaml";
const tag = `release-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;

function aws(args, { json = false, quiet = false } = {}) {
  const allArgs = [...args, "--profile", profile, "--region", region];
  if (!quiet) console.log(`aws ${args[0]} ${args[1] ?? ""}`);
  let result;
  try {
    result = execFileSync("aws", allArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    const detail = error.stderr?.toString().trim();
    throw new Error(
      `AWS command failed: ${args[0]} ${args[1] ?? ""}.${detail ? ` ${detail}` : " Inspect the service events for details."}`,
    );
  }
  return json ? JSON.parse(result) : result.trim();
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) return { ok: false, detail: result.error.message };
  if (result.status !== 0)
    return { ok: false, detail: result.stderr?.trim() || `exit code ${result.status}` };
  return { ok: true, output: result.stdout.trim() };
}

function checkAwsCli() {
  const awsVersion = commandOutput("aws", ["--version"]);
  if (!awsVersion.ok)
    throw new Error(`AWS CLI v2.32.0 or newer is required. Install/update AWS CLI for ${process.platform}/${process.arch}; ${awsVersion.detail}`);
  const parsedAwsVersion = awsVersion.output.match(/aws-cli\/(\d+)\.(\d+)\.(\d+)/);
  if (!parsedAwsVersion || Number(parsedAwsVersion[1]) !== 2 || Number(parsedAwsVersion[2]) < 32)
    throw new Error(`AWS CLI v2.32.0 or newer is required (found ${awsVersion.output}).`);
}

function checkLocalPrerequisites() {
  const supportedPlatforms = new Set(["linux", "darwin", "win32"]);
  if (!supportedPlatforms.has(process.platform))
    throw new Error(`Unsupported host platform: ${process.platform}. Use Linux, macOS, or Windows with Docker Desktop.`);
  if (!["x64", "arm64"].includes(process.arch))
    throw new Error(`Unsupported host architecture: ${process.arch}. Use x64 or arm64.`);
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 20)
    throw new Error(`Node.js 20 or newer is required (found ${process.versions.node}). Install a supported LTS release for ${process.platform}/${process.arch}.`);
  for (const path of [template, "apps/api/Dockerfile", "apps/web/Dockerfile", "package-lock.json"])
    if (!existsSync(path)) throw new Error(`Required deployment file is missing: ${path}`);

  checkAwsCli();

  const dockerVersion = commandOutput("docker", ["--version"]);
  if (!dockerVersion.ok)
    throw new Error(`Docker Engine/Desktop 24 or newer is required. Install Docker for ${process.platform}/${process.arch}; ${dockerVersion.detail}`);
  const parsedDockerVersion = dockerVersion.output.match(/Docker version (\d+)\.(\d+)/);
  if (!parsedDockerVersion || Number(parsedDockerVersion[1]) < 24)
    throw new Error(`Docker 24 or newer is required (found ${dockerVersion.output}).`);
  const buildxVersion = commandOutput("docker", ["buildx", "version"]);
  if (!buildxVersion.ok)
    throw new Error(`Docker Buildx is required to build the production linux/amd64 images. Update Docker Desktop or install the Buildx plugin; ${buildxVersion.detail}`);

  const dockerInfo = commandOutput("docker", ["info", "--format", "{{.OSType}}/{{.Architecture}}"]);
  if (!dockerInfo.ok) {
    const platformHelp = process.platform === "linux"
      ? "Start Docker with `sudo systemctl start docker`; if socket permission is denied, grant your user Docker access and sign in again."
      : process.platform === "darwin"
        ? "Start Docker Desktop and wait for the engine to become ready."
        : "Start Docker Desktop using Linux containers and wait for the engine to become ready.";
    throw new Error(`Docker engine is unavailable (${dockerInfo.detail}). ${platformHelp}`);
  }
  const dockerPlatform = commandOutput("docker", ["buildx", "inspect"]);
  if (!dockerPlatform.ok || !dockerPlatform.output.includes("linux/amd64")) {
    const detail = dockerPlatform.ok
      ? `Builder output: ${dockerPlatform.output}`
      : dockerPlatform.detail;
    throw new Error(
      `The active Docker Buildx builder must support linux/amd64. Run docker buildx inspect --bootstrap and confirm the platform is listed. ${detail}`,
    );
  }

  console.log(`Local prerequisites ready: ${process.platform}/${process.arch}, Docker ${dockerInfo.output}, AWS CLI v2, Buildx linux/amd64.`);
  console.log(`AWS target: profile ${profile}, region ${region}.`);
}

function outputMap() {
  const result = aws(
    ["cloudformation", "describe-stacks", "--stack-name", stack, "--output", "json"],
    { json: true },
  );
  return Object.fromEntries(
    result.Stacks[0].Outputs.map(({ OutputKey, OutputValue }) => [
      OutputKey,
      OutputValue,
    ]),
  );
}

function existingStackOutputs() {
  try {
    return outputMap();
  } catch (error) {
    if (error.message.includes("does not exist") || error.message.includes("not exist"))
      return undefined;
    throw error;
  }
}

function checkTaskDefinition(taskDefinitionArn, containerName, requiredEnvironment, requiredSecrets) {
  const definition = aws([
    "ecs", "describe-task-definition", "--task-definition", taskDefinitionArn,
    "--output", "json",
  ], { json: true, quiet: true }).taskDefinition;
  const container = definition.containerDefinitions.find(
    (item) => item.name === containerName,
  );
  if (!container)
    return [`${taskDefinitionArn} has no ${containerName} container`];
  const environment = new Set((container.environment ?? []).map((item) => item.name));
  const secrets = new Set((container.secrets ?? []).map((item) => item.name));
  const missingEnvironment = requiredEnvironment.filter((name) => !environment.has(name));
  const missingSecrets = requiredSecrets.filter((name) => !secrets.has(name));
  const missing = [
        ...missingEnvironment.map((name) => `environment ${name}`),
        ...missingSecrets.map((name) => `secret ${name}`),
  ];
  if (missing.length)
    return [`${definition.family}:${definition.revision} is missing ${missing.join(", ")}`];
  console.log(`${containerName} task ${definition.family}:${definition.revision}: required configuration names are present.`);
  return [];
}

function checkProductionEnvironment() {
  const outputs = outputMap();
  const services = aws([
    "ecs", "describe-services", "--cluster", outputs.ClusterName,
    "--services", outputs.ApiServiceName, outputs.WebServiceName,
    "--output", "json",
  ], { json: true, quiet: true });
  const apiService = services.services?.find(
    (service) =>
      service.serviceArn === outputs.ApiServiceName ||
      service.serviceName === outputs.ApiServiceName.split("/").at(-1),
  );
  if (!apiService?.taskDefinition)
    throw new Error(`Could not find the live API service ${outputs.ApiServiceName}.`);
  const problems = checkTaskDefinition(
    apiService.taskDefinition,
    "api",
    [
      "NODE_ENV", "PORT", "APP_ORIGIN", "DB_DIALECT", "DATABASE_URL",
      "DB_SSL", "DB_IAM_AUTH", "AWS_REGION", "S3_BUCKET", "SQS_QUEUE_URL",
      "SNS_TOPIC_ARN", "COGNITO_USER_POOL_ID", "COGNITO_CLIENT_ID",
    ],
    ["JWT_SECRET", "MFA_ENCRYPTION_KEY"],
  );
  problems.push(...checkTaskDefinition(
    outputs.MigrationTaskDefinition,
    "migrate",
    [
      "NODE_ENV", "APP_ORIGIN", "DB_SSL_CA_PATH", "ADMIN_DB_USERNAME",
      "ADMIN_DB_HOST", "ADMIN_DB_PORT", "ADMIN_DB_NAME",
    ],
    ["ADMIN_DB_SECRET", "JWT_SECRET", "MFA_ENCRYPTION_KEY"],
  ));
  if (problems.length)
    throw new Error(`Production ECS configuration is incomplete: ${problems.join("; ")}. No secret values were read.`);
  console.log("Production ECS environment audit passed; secret values were not read.");
}

function loadCognito() {
  const poolId = "ap-southeast-2_WZcaBvFq9";
  const pool = aws(
    ["cognito-idp", "describe-user-pool", "--user-pool-id", poolId, "--output", "json"],
    { json: true, quiet: true },
  ).UserPool;
  const host = pool.CustomDomain || pool.Domain;
  if (!host) throw new Error("The Cognito user pool has no hosted domain");
  const domain = host.startsWith("http")
    ? host.replace(/\/$/, "")
    : host.includes(".")
      ? `https://${host}`
      : `https://${host}.auth.${region}.amazoncognito.com`;
  return { poolId, domain };
}

function deployStack(cognito, originSecret) {
  console.log("Applying the production CloudFormation stack...");
  aws([
    "cloudformation", "deploy", "--template-file", template, "--stack-name", stack,
    "--capabilities", "CAPABILITY_IAM", "--no-fail-on-empty-changeset",
    "--parameter-overrides", `OriginSecret=${originSecret}`, `ImageTag=${tag}`,
    `CognitoUserPoolId=${cognito.poolId}`, `CognitoDomain=${cognito.domain}`,
  ]);
}

function runDocker(args, input) {
  const result = spawnSync("docker", args, {
    stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
    input,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`docker ${args[0]} failed`);
}

async function waitForTask(cluster, taskArn) {
  for (let i = 0; i < 90; i += 1) {
    const { tasks, failures } = aws(
      ["ecs", "describe-tasks", "--cluster", cluster, "--tasks", taskArn, "--output", "json"],
      { json: true, quiet: true },
    );
    if (failures?.length) throw new Error(JSON.stringify(failures));
    const task = tasks[0];
    if (task.lastStatus === "STOPPED") {
      const container = task.containers.find((item) => item.name === "migrate");
      if (container.exitCode !== 0)
        throw new Error(`Database bootstrap failed (${container.exitCode}): ${container.reason ?? "see migration task logs"}`);
      return;
    }
    if (i % 6 === 0) console.log(`Database bootstrap task: ${task.lastStatus}`);
    await sleep(10_000);
  }
  throw new Error("Database bootstrap did not stop within 15 minutes");
}

async function waitForCloudFront(distributionId) {
  console.log("Waiting for CloudFront to finish global distribution deployment...");
  aws(["cloudfront", "wait", "distribution-deployed", "--id", distributionId]);
}

async function waitForHttp(url) {
  let lastError;
  for (let i = 0; i < 36; i += 1) {
    try {
      const response = await globalThis.fetch(url, {
        signal: globalThis.AbortSignal.timeout(15_000),
      });
      if (response.ok) return response;
      lastError = new Error(`${url} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(10_000);
  }
  throw lastError;
}

async function main() {
  if (process.argv.includes("--check-production-env")) {
    checkAwsCli();
    checkProductionEnvironment();
    return;
  }
  checkLocalPrerequisites();
  if (process.argv.includes("--preflight-only")) {
    console.log("Preflight complete. No AWS resources were changed.");
    return;
  }
  const identity = aws(["sts", "get-caller-identity", "--output", "json"], { json: true, quiet: true });
  if (identity.Account !== "590951085792")
    throw new Error(`AWS profile resolved to unexpected account ${identity.Account}`);
  console.log(`Deploying to AWS account ${identity.Account}, ${region}`);
  console.log("Validating CloudFormation template...");
  aws(["cloudformation", "validate-template", "--template-body", `file://${template}`, "--output", "json"], { json: true });

  const cognito = loadCognito();
  let originSecret = randomBytes(32).toString("hex");
  const priorOutputs = existingStackOutputs();
  if (priorOutputs) {
    const { DistributionConfig } = aws(
      ["cloudfront", "get-distribution-config", "--id", priorOutputs.CloudFrontDistributionId, "--output", "json"],
      { json: true, quiet: true },
    );
    const priorHeader = DistributionConfig.Origins.Items[0].CustomHeaders?.Items?.find(
      (item) => item.HeaderName.toLowerCase() === "x-resqcloud-origin",
    );
    if (priorHeader?.HeaderValue) originSecret = priorHeader.HeaderValue;
  }

  // On the first install, create ECR and the network with services at DesiredCount=0.
  // On updates, preserve the running stack until the new immutable images are in ECR.
  if (!priorOutputs) deployStack(cognito, originSecret);
  let outputs = outputMap();

  const password = aws(["ecr", "get-login-password"], { quiet: true });
  const registry = outputs.ApiRepositoryUri.split("/")[0];
  runDocker(["login", "--username", "AWS", "--password-stdin", registry], password);
  try {
    for (const [name, uri, dockerfile, buildArgs] of [
      ["api", outputs.ApiRepositoryUri, "apps/api/Dockerfile", []],
      [
        "web",
        outputs.WebRepositoryUri,
        "apps/web/Dockerfile",
        [
          "--build-arg", "NEXT_PUBLIC_API_URL=",
          "--build-arg", `NEXT_PUBLIC_COGNITO_CLIENT_ID=${outputs.CognitoClientId}`,
          "--build-arg", `NEXT_PUBLIC_COGNITO_DOMAIN=${cognito.domain}`,
        ],
      ],
    ]) {
      const image = `${uri}:${tag}`;
      runDocker(["build", "--platform", "linux/amd64", "--file", dockerfile, ...buildArgs, "--tag", image, "."]);
      runDocker(["push", image]);
      console.log(`${name} image pushed`);
    }
  } finally {
    runDocker(["logout", registry]);
  }

  if (priorOutputs) {
    deployStack(cognito, originSecret);
    outputs = outputMap();
  }
  const appUrl = outputs.ApplicationUrl;

  console.log("Waiting for encrypted Aurora cluster to become available...");
  aws(["rds", "wait", "db-cluster-available", "--db-cluster-identifier", outputs.DatabaseClusterIdentifier]);
  aws(["rds", "wait", "db-instance-available", "--db-instance-identifier", outputs.DatabaseWriterIdentifier]);
  const network = {
    awsvpcConfiguration: {
      subnets: outputs.PublicSubnets.split(","),
      securityGroups: [outputs.ApplicationSecurityGroup],
      assignPublicIp: "ENABLED",
    },
  };
  const started = aws([
    "ecs", "run-task", "--cluster", outputs.ClusterName, "--task-definition", outputs.MigrationTaskDefinition,
    "--launch-type", "FARGATE", "--network-configuration", JSON.stringify(network), "--output", "json",
  ], { json: true });
  if (started.failures?.length) throw new Error(JSON.stringify(started.failures));
  await waitForTask(outputs.ClusterName, started.tasks[0].taskArn);

  aws([
    "s3api", "put-bucket-cors", "--bucket", outputs.EvidenceBucketName,
    "--cors-configuration", JSON.stringify({ CORSRules: [{ AllowedOrigins: [appUrl], AllowedMethods: ["POST", "GET", "HEAD"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600 }] }),
  ]);
  for (const service of [outputs.ApiServiceName, outputs.WebServiceName]) {
    aws(["ecs", "update-service", "--cluster", outputs.ClusterName, "--service", service, "--desired-count", "1", "--output", "json"]);
  }
  aws(["ecs", "wait", "services-stable", "--cluster", outputs.ClusterName, "--services", outputs.ApiServiceName, outputs.WebServiceName]);
  await waitForCloudFront(outputs.CloudFrontDistributionId);
  await waitForHttp(`${appUrl}/`);
  const health = await waitForHttp(`${appUrl}/health`);
  const healthBody = await health.json();
  const ready = await waitForHttp(`${appUrl}/ready`);
  const readyBody = await ready.json();
  if (healthBody.status !== "ok" || readyBody.status !== "ready")
    throw new Error(`Application health checks failed: ${JSON.stringify({ healthBody, readyBody })}`);

  console.log(`Production pilot is online at ${appUrl}`);
}

await main();
