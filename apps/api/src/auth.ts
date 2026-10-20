import { randomBytes, createHash, randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { TOTP, Secret } from "otpauth";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { Op } from "sequelize";
import { config } from "./config.js";
import { User, Session, Audit, db } from "./database.js";
import type { Actor, Role } from "../../../packages/shared/src/index.js";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
declare module "express-serve-static-core" {
  interface Request {
    actor?: Actor;
    sessionId?: string;
    requestId: string;
  }
}
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const verifier =
  config.COGNITO_USER_POOL_ID && config.COGNITO_CLIENT_ID
    ? CognitoJwtVerifier.create({
        userPoolId: config.COGNITO_USER_POOL_ID,
        tokenUse: "id",
        clientId: config.COGNITO_CLIENT_ID,
      })
    : null;
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined;
    if (!token) throw new HttpError(401, "Sign in to continue");
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "resqcloud",
      audience: "resqcloud-web",
    }) as jwt.JwtPayload;
    const session = await Session.findOne({
      where: {
        id: decoded.sid,
        userId: decoded.sub,
        revoked: false,
        expiresAt: { [Op.gt]: new Date() },
      },
    });
    const user = await User.findByPk(String(decoded.sub));
    if (!session || !user || !user.get().enabled)
      throw new HttpError(401, "Session expired");
    const u = user.get();
    req.actor = {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      departmentId: u.departmentId,
      jurisdictionCode: u.jurisdictionCode,
    };
    req.sessionId = session.get().id;
    next();
  } catch (e) {
    next(e instanceof HttpError ? e : new HttpError(401, "Session expired"));
  }
}
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  if (req.headers.authorization) return authenticate(req, res, next);
  next();
}
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.actor || !roles.includes(req.actor.role))
      return next(
        new HttpError(403, "You do not have permission for this action"),
      );
    next();
  };
}
export function requireDepartmentAccess(actor: Actor, departmentId: number) {
  if (actor.role !== "admin" && actor.departmentId !== departmentId)
    throw new HttpError(403, "Outside your department");
}
export async function issueSession(
  userId: string,
  device: string,
  res: Response,
) {
  const token = randomBytes(48).toString("base64url");
  const sid = randomUUID();
  await Session.create({
    id: sid,
    userId,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + 7 * 86400000),
    revoked: false,
    device: device.slice(0, 255),
  });
  return sendTokens(sid, userId, token, res);
}
function sendTokens(
  sid: string,
  userId: string,
  refresh: string,
  res: Response,
) {
  res.cookie("resq_refresh", refresh, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: 7 * 86400000,
  });
  return jwt.sign({ sid }, config.JWT_SECRET, {
    algorithm: "HS256",
    subject: userId,
    issuer: "resqcloud",
    audience: "resqcloud-web",
    expiresIn: "15m",
  });
}
export async function rotateSession(req: Request, res: Response) {
  const token = req.cookies?.resq_refresh;
  if (typeof token !== "string") throw new HttpError(401, "Sign in again");
  const nextToken = randomBytes(48).toString("base64url");
  let newId = "",
    userId = "";
  await db.transaction(async (transaction) => {
    const session = await Session.findOne({
      where: { tokenHash: hash(token) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!session || session.get().expiresAt < new Date())
      throw new HttpError(401, "Session expired");
    if (session.get().revoked) {
      userId = session.get().userId;
      return;
    }
    const user = await User.findByPk(session.get().userId, { transaction });
    if (!user?.get().enabled) throw new HttpError(401, "Account disabled");
    await session.update({ revoked: true }, { transaction });
    newId = randomUUID();
    userId = user.get().id;
    await Session.create(
      {
        id: newId,
        userId,
        tokenHash: hash(nextToken),
        expiresAt: session.get().expiresAt,
        revoked: false,
        device: session.get().device,
      },
      { transaction },
    );
  });
  if (!newId) {
    await Session.update({ revoked: true }, { where: { userId } });
    throw new HttpError(401, "Reused refresh token; sessions revoked");
  }
  return sendTokens(newId, userId, nextToken, res);
}
export async function login(email: string, password: string, otp?: string) {
  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  const valid = await bcrypt.compare(
    password,
    user?.get().passwordHash ??
      "$2b$12$uT1bZBQqULud5OPCNBe3uuoZaiZpLqSLAGB8lFWZRByIGSj16Y0se",
  );
  if (!user || !valid || !user.get().enabled) {
    await Audit.create({
      actorId: null,
      action: "auth.login_failed",
      resourceId: "authentication",
      metadata: {},
    });
    throw new HttpError(401, "Invalid credentials");
  }
  if (config.NODE_ENV === "production" && user.get().role === "citizen")
    throw new HttpError(403, "Use Cognito to sign in");
  const secret = user.get().mfaSecret;
  if (
    user.get().role !== "citizen" &&
    config.NODE_ENV === "production" &&
    !secret
  )
    throw new HttpError(403, "MFA must be provisioned by an administrator");
  if (secret) {
    const totp = new TOTP({ secret: Secret.fromBase32(secret) });
    if (!otp || totp.validate({ token: otp, window: 1 }) === null)
      throw new HttpError(401, "A valid authenticator code is required");
  }
  return user;
}
export async function exchangeCognito(token: string) {
  if (!verifier) throw new HttpError(503, "Cognito is not configured");
  let payload;
  try {
    payload = await verifier.verify(token);
  } catch {
    throw new HttpError(401, "Invalid Cognito token");
  }
  if (!payload.email_verified || typeof payload.email !== "string")
    throw new HttpError(403, "Verify your email first");
  const [user] = await User.findOrCreate({
    where: { cognitoSub: payload.sub },
    defaults: {
      id: randomUUID(),
      name: typeof payload.name === "string" ? payload.name : "Citizen",
      email: payload.email.toLowerCase(),
      role: "citizen",
      enabled: true,
      departmentId: null,
      jurisdictionCode: null,
      passwordHash: null,
      mfaSecret: null,
      cognitoSub: payload.sub,
    },
  });
  if (!user.get().enabled) throw new HttpError(403, "Account disabled");
  return user;
}
export function safeUser(user: {
  get(): {
    id: string;
    name: string;
    email: string;
    role: Role;
    departmentId: number | null;
    jurisdictionCode: string | null;
  };
}): Actor {
  const u = user.get();
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
    jurisdictionCode: u.jurisdictionCode,
  };
}
