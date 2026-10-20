import { readFileSync } from "node:fs";
import {
  Sequelize,
  DataTypes as D,
  Model,
  type Optional,
  type ModelAttributes,
} from "sequelize";
import { config } from "./config.js";
import { Signer } from "@aws-sdk/rds-signer";
import type {
  Role,
  Status,
  Severity,
} from "../../../packages/shared/src/index.js";
import {
  DEMO_JURISDICTION_CODE,
  indianJurisdictions,
} from "../../../packages/shared/src/index.js";
export const db =
  config.DB_DIALECT === "sqlite"
    ? new Sequelize({
        dialect: "sqlite",
        storage: config.SQLITE_PATH,
        logging: false,
      })
    : new Sequelize(config.DATABASE_URL ?? "", {
        dialect: config.DB_DIALECT,
        logging: false,
        pool: { max: 10, min: 0 },
        dialectOptions:
          config.DB_SSL === "true"
            ? {
                ssl: {
                  ca: readFileSync(config.DB_SSL_CA_PATH!),
                  rejectUnauthorized: true,
                },
              }
            : {},
        ...(config.DB_IAM_AUTH === "true"
          ? {
              hooks: {
                beforeConnect: async (connection: {
                  host?: string;
                  port?: number | string;
                  username?: string;
                  password?: string | null;
                }) => {
                  if (!connection.host || !connection.username)
                    throw new Error(
                      "Aurora IAM authentication needs a database URL with hostname and username",
                    );
                  const signer = new Signer({
                    hostname: connection.host,
                    port: Number(connection.port ?? 5432),
                    region: config.AWS_REGION,
                    username: connection.username,
                    ...(process.env.AWS_PROFILE
                      ? { profile: process.env.AWS_PROFILE }
                      : {}),
                  });
                  connection.password = await signer.getAuthToken();
                },
              },
            }
          : {}),
      });
const id = { type: D.UUID, primaryKey: true, defaultValue: D.UUIDV4 };
const text = (length = 255) => ({ type: D.STRING(length), allowNull: false });
const ref = (model: string, nullable = false) => ({
  type: D.UUID,
  allowNull: nullable,
  references: { model, key: "id" },
});
const dept = {
  type: D.INTEGER,
  allowNull: true,
  references: { model: "departments", key: "id" },
};
const timestamps = {
  createdAt: { type: D.DATE, allowNull: false },
  updatedAt: { type: D.DATE, allowNull: false },
};
export interface UserRow {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  role: Role;
  departmentId: number | null;
  jurisdictionCode: string | null;
  enabled: boolean;
  mfaSecret: string | null;
  cognitoSub: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface IncidentRow {
  id: string;
  trackingId: string;
  trackingHash: string;
  clientId: string;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  status: Status;
  latitude: number;
  longitude: number;
  location: string;
  peopleAffected: number;
  anonymous: boolean;
  contact: string | null;
  incidentTime: Date;
  reporterId: string | null;
  departmentId: number;
  jurisdictionCode: string | null;
  assignedTo: string | null;
  approvedPublic: boolean;
  firstResponseSeconds: number | null;
  resolutionSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface ProfileRow {
  id: string;
  userId: string;
  availability: string;
  latitude: number | null;
  longitude: number | null;
  skills: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface SessionRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  device: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface EventRow {
  id: string;
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  attempts: number;
  processedAt: Date | null;
  nextAttemptAt: Date;
  dead: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface JurisdictionBoundaryRow {
  jurisdictionCode: string;
  geometry: Record<string, unknown>;
  sourceName: string;
  sourceUrl: string;
  sourceVersion: string;
  retrievedAt: Date;
  reviewStatus: "candidate" | "approved";
  approvalReference: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
const definitions: Record<string, ModelAttributes> = {
  jurisdictions: {
    code: { type: D.STRING(8), primaryKey: true },
    name: text(120),
    kind: text(24),
    parentCode: { type: D.STRING(8), allowNull: true },
    active: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
  },
  jurisdictionBoundaries: {
    jurisdictionCode: {
      type: D.STRING(8),
      primaryKey: true,
      references: { model: "jurisdictions", key: "code" },
    },
    geometry: { type: D.JSON, allowNull: false },
    sourceName: text(120),
    sourceUrl: text(500),
    sourceVersion: text(80),
    retrievedAt: { type: D.DATE, allowNull: false },
    reviewStatus: { ...text(16), defaultValue: "candidate" },
    approvalReference: { type: D.STRING(500), allowNull: true },
    approvedBy: ref("users", true),
    approvedAt: { type: D.DATE, allowNull: true },
  },
  departments: {
    id: { type: D.INTEGER, primaryKey: true, autoIncrement: true },
    name: { ...text(), unique: true },
  },
  users: {
    id,
    name: text(100),
    email: { ...text(), unique: true },
    passwordHash: { type: D.STRING, allowNull: true },
    role: text(20),
    departmentId: dept,
    jurisdictionCode: { type: D.STRING(8), allowNull: true },
    enabled: { type: D.BOOLEAN, defaultValue: true },
    mfaSecret: { type: D.STRING, allowNull: true },
    cognitoSub: { type: D.STRING, allowNull: true, unique: true },
  },
  incidentTypes: {
    id: { type: D.INTEGER, primaryKey: true, autoIncrement: true },
    name: { ...text(), unique: true },
    departmentId: dept,
  },
  incidents: {
    id,
    trackingId: { ...text(40), unique: true },
    trackingHash: text(64),
    clientId: { ...text(36), unique: true },
    title: text(160),
    description: { type: D.TEXT, allowNull: false },
    category: text(40),
    severity: text(20),
    status: text(30),
    latitude: { type: D.DOUBLE, allowNull: false },
    longitude: { type: D.DOUBLE, allowNull: false },
    location: text(250),
    peopleAffected: { type: D.INTEGER, allowNull: false },
    anonymous: { type: D.BOOLEAN, allowNull: false },
    contact: { type: D.STRING(150), allowNull: true },
    incidentTime: { type: D.DATE, allowNull: false },
    reporterId: ref("users", true),
    departmentId: { ...dept, allowNull: false },
    jurisdictionCode: { type: D.STRING(8), allowNull: true },
    assignedTo: ref("users", true),
    approvedPublic: { type: D.BOOLEAN, defaultValue: false },
    firstResponseSeconds: { type: D.INTEGER, allowNull: true },
    resolutionSeconds: { type: D.INTEGER, allowNull: true },
  },
  histories: {
    id,
    incidentId: ref("incidents"),
    actorId: ref("users", true),
    fromStatus: { type: D.STRING, allowNull: true },
    toStatus: text(30),
    reason: text(1000),
  },
  assignments: {
    id,
    incidentId: ref("incidents"),
    responderId: ref("users"),
    assignedBy: ref("users"),
    status: text(30),
  },
  profiles: {
    id,
    userId: { ...ref("users"), unique: true },
    availability: text(30),
    latitude: { type: D.DOUBLE, allowNull: true },
    longitude: { type: D.DOUBLE, allowNull: true },
    skills: text(500),
  },
  locations: {
    id,
    responderId: ref("users"),
    latitude: { type: D.DOUBLE, allowNull: false },
    longitude: { type: D.DOUBLE, allowNull: false },
  },
  notifications: {
    id,
    userId: ref("users"),
    incidentId: ref("incidents", true),
    title: text(),
    severity: text(20),
    readAt: { type: D.DATE, allowNull: true },
    eventKey: { ...text(), unique: true },
  },
  feedback: {
    id,
    incidentId: { ...ref("incidents"), unique: true },
    userId: ref("users"),
    rating: { type: D.INTEGER, allowNull: false },
    responseRating: { type: D.INTEGER, allowNull: false },
    resolutionRating: { type: D.INTEGER, allowNull: false },
    comment: { type: D.TEXT, allowNull: false },
    complaint: { type: D.BOOLEAN, allowNull: false },
  },
  audits: {
    id,
    actorId: ref("users", true),
    action: text(),
    resourceId: text(),
    metadata: { type: D.JSON, allowNull: false },
  },
  configurations: {
    id,
    key: { ...text(), unique: true },
    value: { type: D.JSON, allowNull: false },
  },
  sessions: {
    id,
    userId: ref("users"),
    tokenHash: { ...text(64), unique: true },
    expiresAt: { type: D.DATE, allowNull: false },
    revoked: { type: D.BOOLEAN, defaultValue: false },
    device: text(),
  },
  media: {
    id,
    incidentId: ref("incidents"),
    ownerId: ref("users"),
    key: { ...text(500), unique: true },
    contentType: text(100),
    size: { type: D.INTEGER, allowNull: false },
    confirmed: { type: D.BOOLEAN, defaultValue: false },
  },
  events: {
    id,
    eventType: text(),
    aggregateId: text(),
    payload: { type: D.JSON, allowNull: false },
    attempts: { type: D.INTEGER, defaultValue: 0 },
    processedAt: { type: D.DATE, allowNull: true },
    nextAttemptAt: { type: D.DATE, allowNull: false },
    dead: { type: D.BOOLEAN, defaultValue: false },
  },
  consumedEvents: { id, consumer: text() },
};
function model<T extends object>(name: string) {
  return db.define<Model<T, Optional<T, keyof T>>>(name, definitions[name], {
    tableName: name,
    timestamps: true,
  });
}
export const User = model<UserRow>("users");
export const Incident = model<IncidentRow>("incidents");
export const Profile = model<ProfileRow>("profiles");
export const Session = model<SessionRow>("sessions");
export const Event = model<EventRow>("events");
export const Department = model<{ id: number; name: string }>("departments");
export const Jurisdiction = model<{
  code: string;
  name: string;
  kind: "state" | "union_territory" | "district";
  parentCode: string | null;
  active: boolean;
}>("jurisdictions");
export const JurisdictionBoundary = model<JurisdictionBoundaryRow>(
  "jurisdictionBoundaries",
);
export const IncidentType = model<{
  id: number;
  name: string;
  departmentId: number;
}>("incidentTypes");
export const History = model<{
  id: string;
  incidentId: string;
  actorId: string | null;
  fromStatus: Status | null;
  toStatus: Status;
  reason: string;
  createdAt: Date;
}>("histories");
export const Assignment = model<{
  id: string;
  incidentId: string;
  responderId: string;
  assignedBy: string;
  status: string;
}>("assignments");
export const Notification = model<{
  id: string;
  userId: string;
  incidentId: string | null;
  title: string;
  severity: Severity;
  readAt: Date | null;
  eventKey: string;
  createdAt: Date;
}>("notifications");
export const Feedback = model<{
  id: string;
  incidentId: string;
  userId: string;
  rating: number;
  responseRating: number;
  resolutionRating: number;
  comment: string;
  complaint: boolean;
}>("feedback");
export const Audit = model<{
  id: string;
  actorId: string | null;
  action: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}>("audits");
export const Location = model<{
  id: string;
  responderId: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
}>("locations");
export const Configuration = model<{ id: string; key: string; value: unknown }>(
  "configurations",
);
export const Media = model<{
  id: string;
  incidentId: string;
  ownerId: string;
  key: string;
  contentType: string;
  size: number;
  confirmed: boolean;
}>("media");
/** Ordered, versioned schema migration. No runtime sync/alter against production. */
export async function migrate() {
  const q = db.getQueryInterface();
  await q
    .createTable("schema_migrations", {
      version: { type: D.STRING, primaryKey: true },
    })
    .catch(async (e) => {
      const tables = await q.showAllTables();
      if (!tables.includes("schema_migrations")) throw e;
    });
  const [rows] = await db.query(
    "SELECT version FROM schema_migrations WHERE version='001_initial'",
  );
  if (!rows.length) {
    for (const [name, attributes] of Object.entries(definitions))
      await q.createTable(name, { ...attributes, ...timestamps });
    for (const field of [
      "status",
      "severity",
      "category",
      "departmentId",
      "createdAt",
      "updatedAt",
      "reporterId",
    ])
      await q.addIndex("incidents", [field]);
    await q.addIndex("assignments", ["responderId", "status"]);
    await q.addIndex("notifications", ["userId", "readAt"]);
    await q.addIndex("locations", ["responderId", "createdAt"]);
    await q.addIndex("events", ["processedAt", "dead", "nextAttemptAt"]);
    await db.query(
      "INSERT INTO schema_migrations (version) VALUES ('001_initial')",
    );
  }
  const [regionalRows] = await db.query(
    "SELECT version FROM schema_migrations WHERE version='002_india_jurisdictions'",
  );
  if (!regionalRows.length) {
    const tables = await q.showAllTables();
    if (!tables.includes("jurisdictions"))
      await q.createTable("jurisdictions", {
        ...definitions.jurisdictions,
        ...timestamps,
      });
    const jurisdictionColumns = await q.describeTable("jurisdictions");
    for (const timestamp of ["createdAt", "updatedAt"])
      if (!jurisdictionColumns[timestamp])
        await q.addColumn("jurisdictions", timestamp, {
          type: D.DATE,
          allowNull: true,
        });
    await db.query(
      'UPDATE jurisdictions SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL',
    );
    await db.query(
      'UPDATE jurisdictions SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL',
    );
    for (const table of ["users", "incidents"]) {
      const columns = await q.describeTable(table);
      if (!columns.jurisdictionCode)
        await q.addColumn(table, "jurisdictionCode", {
          type: D.STRING(8),
          allowNull: true,
        });
    }
    const indexes = (await q.showIndex("incidents")) as unknown as Array<{
      fields?: Array<{ attribute?: string; name?: string }>;
    }>;
    const jurisdictionIndex = indexes.some(
      (index) =>
        index.fields
          ?.map((field) => field.attribute ?? field.name)
          .join(",") === "jurisdictionCode,status,severity",
    );
    if (!jurisdictionIndex)
      await q.addIndex("incidents", ["jurisdictionCode", "status", "severity"]);
    const sample = await Jurisdiction.findByPk(DEMO_JURISDICTION_CODE);
    if (!sample)
      await Jurisdiction.create({
        code: DEMO_JURISDICTION_CODE,
        name: "Tamil Nadu (development demo)",
        kind: "state",
        parentCode: "IN",
        active: true,
      });
    for (const jurisdiction of indianJurisdictions)
      await Jurisdiction.findOrCreate({
        where: { code: jurisdiction.code },
        defaults: { ...jurisdiction, parentCode: "IN", active: true },
      });
    if (config.NODE_ENV !== "production") {
      await User.update(
        { jurisdictionCode: DEMO_JURISDICTION_CODE },
        {
          where: {
            role: ["dispatcher", "responder", "supervisor"],
            jurisdictionCode: null,
          },
        },
      );
      await Incident.update(
        { jurisdictionCode: DEMO_JURISDICTION_CODE },
        { where: { jurisdictionCode: null } },
      );
    }
    await db.query(
      "INSERT INTO schema_migrations (version) VALUES ('002_india_jurisdictions')",
    );
  }
  const [isoRows] = await db.query(
    "SELECT version FROM schema_migrations WHERE version='003_india_iso_codes'",
  );
  if (!isoRows.length) {
    const jurisdictionColumns = await q.describeTable("jurisdictions");
    for (const timestamp of ["createdAt", "updatedAt"])
      if (!jurisdictionColumns[timestamp])
        await q.addColumn("jurisdictions", timestamp, {
          type: D.DATE,
          allowNull: true,
        });
    await db.query(
      'UPDATE jurisdictions SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL',
    );
    await db.query(
      'UPDATE jurisdictions SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL',
    );
    for (const jurisdiction of indianJurisdictions)
      await Jurisdiction.findOrCreate({
        where: { code: jurisdiction.code },
        defaults: { ...jurisdiction, parentCode: "IN", active: true },
      });
    for (const [oldCode, newCode] of [
      ["IN-OR", "IN-OD"],
      ["IN-TS", "IN-TG"],
    ]) {
      await User.update(
        { jurisdictionCode: newCode },
        { where: { jurisdictionCode: oldCode } },
      );
      await Incident.update(
        { jurisdictionCode: newCode },
        { where: { jurisdictionCode: oldCode } },
      );
      await Jurisdiction.destroy({ where: { code: oldCode } });
    }
    await db.query(
      "INSERT INTO schema_migrations (version) VALUES ('003_india_iso_codes')",
    );
  }
  const [timingRows] = await db.query(
    "SELECT version FROM schema_migrations WHERE version='004_incident_timing'",
  );
  if (!timingRows.length) {
    const incidentColumns = await q.describeTable("incidents");
    for (const field of ["firstResponseSeconds", "resolutionSeconds"])
      if (!incidentColumns[field])
        await q.addColumn("incidents", field, {
          type: D.INTEGER,
          allowNull: true,
        });
    await db.query(
      "INSERT INTO schema_migrations (version) VALUES ('004_incident_timing')",
    );
  }
  const [boundaryRows] = await db.query(
    "SELECT version FROM schema_migrations WHERE version='005_jurisdiction_boundaries'",
  );
  if (!boundaryRows.length) {
    const tables = await q.showAllTables();
    if (!tables.includes("jurisdictionBoundaries"))
      await q.createTable("jurisdictionBoundaries", {
        ...definitions.jurisdictionBoundaries,
        ...timestamps,
      });
    await db.query(
      "INSERT INTO schema_migrations (version) VALUES ('005_jurisdiction_boundaries')",
    );
  }
}

export const ConsumedEvent = model<{ id: string; consumer: string }>(
  "consumedEvents",
);
