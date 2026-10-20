import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
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
  } catch {
    throw new Error(
      `AWS command failed: ${args[0]} ${args[1] ?? ""}. Inspect the service events for details.`,
    );
  }
  return json ? JSON.parse(result) : result.trim();
}

function run(command, args, options = {}) {
  console.log(`${command} ${args.slice(0, 3).join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed with exit code ${result.status}`);
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
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (response.ok) return response;
      lastError = new Error(`${url} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(10_000);
  }
  throw lastError;
}

function deleteOldDemoDatabase() {
  const old = aws(
    ["rds", "describe-db-clusters", "--db-cluster-identifier", "resqcloud", "--output", "json"],
    { json: true, quiet: true },
  ).DBClusters[0];
  for (const member of old.DBClusterMembers ?? []) {
    const id = member.DBInstanceIdentifier;
    console.log(`Deleting old demo database instance ${id} after production checks passed`);
    aws(["rds", "delete-db-instance", "--db-instance-identifier", id, "--skip-final-snapshot"]);
    aws(["rds", "wait", "db-instance-deleted", "--db-instance-identifier", id]);
  }
  console.log("Deleting old demo Aurora cluster without a final snapshot as requested");
  aws(["rds", "delete-db-cluster", "--db-cluster-identifier", "resqcloud", "--skip-final-snapshot"]);
  aws(["rds", "wait", "db-cluster-deleted", "--db-cluster-identifier", "resqcloud"]);
}

async function main() {
  const identity = aws(["sts", "get-caller-identity", "--output", "json"], { json: true, quiet: true });
  if (identity.Account !== "590951085792")
    throw new Error(`AWS profile resolved to unexpected account ${identity.Account}`);
  console.log(`Deploying to AWS account ${identity.Account}, ${region}`);
  const cognito = loadCognito();
  let originSecret = randomBytes(32).toString("hex");
  try {
    const priorOutputs = outputMap();
    const { DistributionConfig } = aws(
      ["cloudfront", "get-distribution-config", "--id", priorOutputs.CloudFrontDistributionId, "--output", "json"],
      { json: true, quiet: true },
    );
    const priorHeader = DistributionConfig.Origins.Items[0].CustomHeaders?.Items?.find(
      (item) => item.HeaderName.toLowerCase() === "x-resqcloud-origin",
    );
    if (priorHeader?.HeaderValue) originSecret = priorHeader.HeaderValue;
  } catch {
    // First deployment has no existing stack/distribution.
  }

  console.log("Validating CloudFormation template...");
  aws(["cloudformation", "validate-template", "--template-body", `file://${template}`, "--output", "json"], { json: true });

  console.log("Creating encrypted database, private network, services, and CloudFront distribution...");
  aws([
    "cloudformation", "deploy", "--template-file", template, "--stack-name", stack,
    "--capabilities", "CAPABILITY_IAM", "--no-fail-on-empty-changeset",
    "--parameter-overrides", `OriginSecret=${originSecret}`, `ImageTag=${tag}`,
    `CognitoUserPoolId=${cognito.poolId}`, `CognitoDomain=${cognito.domain}`,
  ]);
  const outputs = outputMap();
  const appUrl = outputs.ApplicationUrl;

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

  deleteOldDemoDatabase();
  console.log(`Production pilot is online at ${appUrl}`);
}

await main();
