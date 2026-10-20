import { config as loadEnv } from "dotenv";
import path from "node:path";
loadEnv({ path: "../../.env", quiet: true });
import type { NextConfig } from "next";
const projectRoot = path.resolve(process.cwd(), "../..");
const config: NextConfig = {
  poweredByHeader: false,
  experimental: { useTypeScriptCli: false },
  output: "standalone",
  outputFileTracingRoot: projectRoot,
};
export default config;
