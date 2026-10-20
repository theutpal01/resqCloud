import { createServer } from "node:http";
import { app } from "./app.js";
import { db } from "./database.js";
import { attachSocket, startWorker } from "./events.js";
import { config } from "./config.js";
await db.authenticate();
const server = createServer(app);
const io = attachSocket(server);
const stopWorker = startWorker();
const host = config.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
server.listen(config.PORT, host, () =>
  console.log(JSON.stringify({ event: "server.started", port: config.PORT })),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 15000).unref();
  await stopWorker();
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.close();
  clearTimeout(timeout);
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
