import { Router } from "express";
import { randomUUID } from "node:crypto";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { config } from "../config.js";
import { User, Session } from "../database.js";
import {
  authenticate,
  HttpError,
  login,
  issueSession,
  rotateSession,
  exchangeCognito,
  safeUser,
  hash,
} from "../auth.js";
import { audit } from "../incidents.js";
import {
  loginSchema,
  registerSchema,
} from "../../../../packages/shared/src/index.js";

export const authRoutes = Router();
const router = authRoutes;
const authLimiter = rateLimit({ windowMs: 15 * 60000, limit: 20 });
const demoLoginSchema = z.object({
  role: z.enum(["citizen", "dispatcher", "responder", "supervisor", "admin"]),
});
function isLocalDemoRequest(req: import("express").Request) {
  const isLocalRequest = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
    req.socket.remoteAddress ?? "",
  );
  return (
    config.NODE_ENV === "development" &&
    config.DB_DIALECT === "sqlite" &&
    process.env.RESQCLOUD_DEMO_LOGIN === "true" &&
    isLocalRequest
  );
}
router.get("/api/v1/auth/demo-login", (req, res, next) => {
  if (!isLocalDemoRequest(req)) return next();
  res
    .set("Allow", "POST")
    .status(405)
    .json({ error: "Use POST with a demo role to sign in." });
});
router.post("/api/v1/auth/demo-login", authLimiter, async (req, res) => {
  if (!isLocalDemoRequest(req)) throw new HttpError(404, "Endpoint not found");
  const { role } = demoLoginSchema.parse(req.body);
  const user = await User.findOne({
    where: { email: `${role}@resqcloud.test`, enabled: true },
  });
  if (!user) throw new HttpError(503, "Run the demo setup to seed accounts");
  const accessToken = await issueSession(
    user.get().id,
    `Local demo · ${req.get("user-agent") ?? "Unknown"}`,
    res,
  );
  await audit(user.get().id, "auth.demo_login", user.get().id, { role });
  res.json({ user: safeUser(user), accessToken });
});
router.post("/api/v1/auth/login", authLimiter, async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await login(body.email, body.password, body.otp);
  const accessToken = await issueSession(
    user.get().id,
    req.get("user-agent") ?? "Unknown",
    res,
  );
  await audit(user.get().id, "auth.login", user.get().id, {});
  res.json({ user: safeUser(user), accessToken });
});
router.post("/api/v1/auth/register", authLimiter, async (req, res) => {
  if (config.NODE_ENV === "production")
    throw new HttpError(403, "Use Cognito registration in production");
  const body = registerSchema.parse(req.body);
  const user = await User.create({
    id: randomUUID(),
    name: body.name,
    email: body.email.toLowerCase(),
    passwordHash: await bcrypt.hash(body.password, 12),
    role: "citizen",
    enabled: true,
    departmentId: null,
    jurisdictionCode: null,
    mfaSecret: null,
    cognitoSub: null,
  });
  res.status(201).json({
    user: safeUser(user),
    accessToken: await issueSession(
      user.get().id,
      req.get("user-agent") ?? "Unknown",
      res,
    ),
  });
});
router.post("/api/v1/auth/cognito", authLimiter, async (req, res) => {
  const { idToken } = z
    .object({ idToken: z.string().min(1).max(10000) })
    .parse(req.body);
  const user = await exchangeCognito(idToken);
  res.json({
    user: safeUser(user),
    accessToken: await issueSession(
      user.get().id,
      req.get("user-agent") ?? "Unknown",
      res,
    ),
  });
});
router.post("/api/v1/auth/refresh", authLimiter, async (req, res) =>
  res.json({ accessToken: await rotateSession(req, res) }),
);
router.get("/api/v1/auth/me", authenticate, (req, res) => res.json(req.actor));
router.get("/api/v1/auth/sessions", authenticate, async (req, res) =>
  res.json(
    await Session.findAll({
      where: { userId: req.actor!.id, revoked: false },
      attributes: ["id", "device", "createdAt", "expiresAt"],
    }),
  ),
);
router.delete("/api/v1/auth/sessions/:id", authenticate, async (req, res) => {
  await Session.update(
    { revoked: true },
    { where: { id: req.params.id, userId: req.actor!.id } },
  );
  res.sendStatus(204);
});
router.post("/api/v1/auth/logout", async (req, res) => {
  if (typeof req.cookies.resq_refresh === "string")
    await Session.update(
      { revoked: true },
      { where: { tokenHash: hash(req.cookies.resq_refresh) } },
    );
  res
    .clearCookie("resq_refresh", {
      path: "/api/v1/auth",
      httpOnly: true,
      sameSite: "strict",
      secure: config.NODE_ENV === "production",
    })
    .sendStatus(204);
});
