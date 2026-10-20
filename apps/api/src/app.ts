import { randomUUID } from "node:crypto";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { UniqueConstraintError } from "sequelize";
import { ZodError } from "zod";
import { config } from "./config.js";
import { db } from "./database.js";
import { HttpError } from "./auth.js";

import { mediaRouter } from "./media.js";
import { authRoutes } from "./routes/authRoutes.js";
import { incidentRoutes } from "./routes/incidentRoutes.js";
import { operationsRoutes } from "./routes/operationsRoutes.js";
import { adminRoutes } from "./routes/adminRoutes.js";

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: config.APP_ORIGIN, credentials: true }));
app.use(express.json({ limit: "128kb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  res.setHeader("Cache-Control", "no-store");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== config.APP_ORIGIN
  )
    return next(new HttpError(403, "Origin not allowed"));
  next();
});
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/ready", async (_req, res) => {
  try {
    await db.authenticate();
    await db.query("SELECT version FROM schema_migrations");
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

app.use(authRoutes);
app.use(incidentRoutes);
app.use(operationsRoutes);
app.use(adminRoutes);
app.use("/api/v1", mediaRouter);
app.use((_req, _res, next) => next(new HttpError(404, "Endpoint not found")));
app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof ZodError
          ? 400
          : error instanceof UniqueConstraintError
            ? 409
            : 500;
    if (status === 500)
      console.error(
        JSON.stringify({
          level: "error",
          requestId: req.requestId,
          event: "request.failed",
          type: error instanceof Error ? error.name : "unknown",
        }),
      );
    res.status(status).json({
      error:
        error instanceof HttpError
          ? error.message
          : error instanceof ZodError
            ? "Check the submitted fields"
            : status === 409
              ? "This record already exists"
              : "Request could not be completed",
      ...(error instanceof ZodError ? { details: error.flatten() } : {}),
      requestId: req.requestId,
    });
  },
);
