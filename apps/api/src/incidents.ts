import { randomUUID, randomBytes } from "node:crypto";
import { Op, type Transaction, type WhereOptions } from "sequelize";
import {
  Incident,
  History,
  Audit,
  Event,
  Profile,
  User,
  Assignment,
  Jurisdiction,
  db,
  type IncidentRow,
} from "./database.js";
import { HttpError, hash, requireDepartmentAccess } from "./auth.js";
import { operationalPolicy } from "./policy.js";
import {
  canTransition,
  distanceKm,
  transitions,
  type Actor,
  type ReportInput,
  type Status,
  type IncidentView,
  type Severity,
} from "../../../packages/shared/src/index.js";
function jurisdictionScope(code: string) {
  return {
    jurisdictionCode: {
      [Op.like]: code.length === 5 ? `${code}%` : code,
    },
  };
}
export function scope(actor: Actor): WhereOptions<IncidentRow> {
  if (actor.role === "admin") return {};
  if (actor.role === "citizen") return { reporterId: actor.id };
  if (!actor.jurisdictionCode) return { jurisdictionCode: "__unassigned__" };
  if (actor.role === "responder")
    return {
      assignedTo: actor.id,
      ...jurisdictionScope(actor.jurisdictionCode),
    };
  return {
    departmentId: actor.departmentId ?? -1,
    ...jurisdictionScope(actor.jurisdictionCode),
  };
}
export async function accessible(
  id: string,
  actor: Actor,
  transaction?: Transaction,
) {
  const i = await Incident.findOne({
    where: { [Op.and]: [{ id }, scope(actor)] },
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!i) throw new HttpError(404, "Incident not found");
  return i;
}
export function view(i: IncidentRow, actor?: Actor): IncidentView {
  const {
    trackingHash: _secret,
    clientId: _client,
    approvedPublic: _public,
    contact,
    ...rest
  } = i;
  return {
    ...rest,
    reporterId: i.anonymous ? null : i.reporterId,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    incidentTime: i.incidentTime.toISOString(),
    ...(!i.anonymous && (actor?.id === i.reporterId || actor?.role === "admin")
      ? { contact }
      : {}),
  };
}
export async function audit(
  actorId: string | null,
  action: string,
  resourceId: string,
  metadata: Record<string, unknown>,
  transaction?: Transaction,
) {
  await Audit.create(
    { actorId, action, resourceId, metadata },
    { transaction },
  );
}
export async function event(
  eventType: string,
  incident: IncidentRow,
  transaction: Transaction,
) {
  await Event.create(
    {
      id: randomUUID(),
      eventType,
      aggregateId: incident.id,
      payload: {
        incidentId: incident.id,
        departmentId: incident.departmentId,
        jurisdictionCode: incident.jurisdictionCode,
        severity: incident.severity,
        status: incident.status,
      },
      nextAttemptAt: new Date(),
      attempts: 0,
      processedAt: null,
      dead: false,
    },
    { transaction },
  );
}
export async function createIncident(
  input: ReportInput,
  actor?: Actor,
  isSos = false,
) {
  const policy = await operationalPolicy();
  if (
    !policy.categories.includes(
      input.category as (typeof policy.categories)[number],
    )
  )
    throw new HttpError(
      400,
      "This incident category is not currently accepted",
    );
  const jurisdiction = await Jurisdiction.findByPk(input.jurisdictionCode);
  if (!jurisdiction || !jurisdiction.get().active)
    throw new HttpError(400, "Choose an active reporting jurisdiction");
  if (!input.anonymous && !actor)
    throw new HttpError(401, "Sign in or choose anonymous reporting");
  const existing = await Incident.findOne({
    where: { clientId: input.clientId },
  });
  if (existing) {
    if (actor && existing.get().reporterId === actor.id)
      return { incident: view(existing.get(), actor), replayed: true };
    throw new HttpError(
      409,
      "This request was already submitted. Use the saved tracking credentials.",
    );
  }
  const trackingToken = randomBytes(32).toString("base64url");
  const incident = await db.transaction(async (transaction) => {
    const i = await Incident.create(
      {
        ...input,
        incidentTime: new Date(input.incidentTime),
        id: randomUUID(),
        trackingId: `RQC-${randomBytes(8).toString("hex").toUpperCase()}`,
        trackingHash: hash(trackingToken),
        status: "reported",
        severity: isSos ? "critical" : input.severity,
        reporterId: actor?.id ?? null,
        contact: input.anonymous ? null : (input.contact ?? null),
        departmentId:
          policy.departmentsByCategory[
            input.category as keyof typeof policy.departmentsByCategory
          ],
        jurisdictionCode: input.jurisdictionCode,
        assignedTo: null,
        approvedPublic: false,
      },
      { transaction },
    );
    await History.create(
      {
        incidentId: i.get().id,
        actorId: input.anonymous ? null : (actor?.id ?? null),
        fromStatus: null,
        toStatus: "reported",
        reason: "Report received",
      },
      { transaction },
    );
    await audit(
      input.anonymous ? null : (actor?.id ?? null),
      "incident.created",
      i.get().id,
      { anonymous: input.anonymous },
      transaction,
    );
    await event("IncidentCreated", i.get(), transaction);
    return i;
  });
  return {
    incident: view(incident.get(), actor),
    trackingToken,
    replayed: false,
  };
}
export async function transition(
  id: string,
  actor: Actor,
  status: Status,
  reason: string,
) {
  return db.transaction(async (transaction) => {
    const i = await accessible(id, actor, transaction);
    const previous = i.get().status;
    if (!canTransition(actor.role, previous, status))
      throw new HttpError(409, "This status transition is not permitted");
    if (status === "responding") {
      const accepted = await Assignment.findOne({
        where: {
          incidentId: id,
          responderId: i.get().assignedTo ?? "",
          status: "accepted",
        },
        transaction,
      });
      if (!accepted)
        throw new HttpError(409, "Responder must accept the assignment first");
    }
    const timingUpdate: {
      status: Status;
      firstResponseSeconds?: number;
      resolutionSeconds?: number | null;
    } = { status };
    if (status === "responding" && i.get().firstResponseSeconds === null)
      timingUpdate.firstResponseSeconds = Math.max(
        0,
        Math.round((Date.now() - i.get().createdAt.getTime()) / 1000),
      );
    if (status === "resolved")
      timingUpdate.resolutionSeconds = Math.max(
        0,
        Math.round((Date.now() - i.get().createdAt.getTime()) / 1000),
      );
    if (status === "reopened") timingUpdate.resolutionSeconds = null;
    await i.update(timingUpdate, { transaction });
    await History.create(
      {
        incidentId: id,
        actorId: actor.id,
        fromStatus: previous,
        toStatus: status,
        reason,
      },
      { transaction },
    );
    if (status === "resolved" && i.get().assignedTo) {
      await Assignment.update(
        { status: "completed" },
        {
          where: { incidentId: id, responderId: i.get().assignedTo ?? "" },
          transaction,
        },
      );
      await Profile.update(
        { availability: "available" },
        { where: { userId: i.get().assignedTo ?? "" }, transaction },
      );
    }
    await audit(
      actor.id,
      "incident.status",
      id,
      { from: previous, to: status, reason },
      transaction,
    );
    await event(
      `Incident${status === "closed" ? "Closed" : status === "resolved" ? "Resolved" : status === "escalated" ? "Escalated" : "Updated"}`,
      i.get(),
      transaction,
    );
    return view(i.get(), actor);
  });
}
export async function severity(
  id: string,
  actor: Actor,
  value: Severity,
  reason: string,
) {
  return db.transaction(async (transaction) => {
    const i = await accessible(id, actor, transaction);
    if (!["dispatcher", "supervisor", "admin"].includes(actor.role))
      throw new HttpError(403, "Severity changes require an authority");
    if (["closed", "rejected", "duplicate"].includes(i.get().status))
      throw new HttpError(409, "Reopen this incident first");
    const before = i.get().severity;
    await i.update({ severity: value }, { transaction });
    await audit(
      actor.id,
      "incident.severity",
      id,
      { before, after: value, reason },
      transaction,
    );
    await event("SeverityChanged", i.get(), transaction);
    return view(i.get(), actor);
  });
}
export async function recommendations(id: string, actor: Actor) {
  const i = await accessible(id, actor);
  const users = await User.findAll({
    where: {
      departmentId: i.get().departmentId,
      ...jurisdictionScope(i.get().jurisdictionCode ?? "__unassigned__"),
      role: "responder",
      enabled: true,
    },
    limit: 100,
  });
  const profiles = await Profile.findAll({
    where: { userId: users.map((u) => u.get().id), availability: "available" },
  });
  return profiles
    .map((p) => {
      const profile = p.get();
      const u = users.find((u) => u.get().id === profile.userId)!;
      const distance =
        profile.latitude !== null && profile.longitude !== null
          ? distanceKm(i.get(), {
              latitude: profile.latitude,
              longitude: profile.longitude,
            })
          : null;
      const skillMatch = profile.skills.split(",").includes(i.get().category);
      return {
        id: u.get().id,
        name: u.get().name,
        availability: profile.availability,
        skills: profile.skills,
        distanceKm: distance === null ? null : Math.round(distance * 10) / 10,
        score: Math.max(0, 70 - (distance ?? 50)) + (skillMatch ? 30 : 0),
      };
    })
    .sort((a, b) => b.score - a.score);
}
export async function assign(
  id: string,
  actor: Actor,
  responderId: string,
  reason: string,
) {
  return db.transaction(async (transaction) => {
    const i = await accessible(id, actor, transaction);
    if (!["dispatcher", "supervisor", "admin"].includes(actor.role))
      throw new HttpError(403, "Only dispatch authorities can assign");
    if (!transitions[i.get().status].includes("assigned"))
      throw new HttpError(409, "Assess severity before assignment");
    const u = await User.findByPk(responderId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const p = await Profile.findOne({
      where: { userId: responderId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (
      !u ||
      u.get().role !== "responder" ||
      !u.get().enabled ||
      u.get().departmentId !== i.get().departmentId ||
      u.get().jurisdictionCode !== i.get().jurisdictionCode ||
      !p ||
      p.get().availability !== "available"
    )
      throw new HttpError(409, "Responder is not eligible or available");
    requireDepartmentAccess(actor, i.get().departmentId);
    const from = i.get().status;
    if (i.get().assignedTo) {
      await Profile.update(
        { availability: "available" },
        { where: { userId: i.get().assignedTo! }, transaction },
      );
      await Assignment.update(
        { status: "rejected" },
        {
          where: {
            incidentId: id,
            status: { [Op.in]: ["assigned", "accepted"] },
          },
          transaction,
        },
      );
    }
    await i.update(
      { assignedTo: responderId, status: "assigned" },
      { transaction },
    );
    await p.update({ availability: "busy" }, { transaction });
    await Assignment.create(
      { incidentId: id, responderId, assignedBy: actor.id, status: "assigned" },
      { transaction },
    );
    await History.create(
      {
        incidentId: id,
        actorId: actor.id,
        fromStatus: from,
        toStatus: "assigned",
        reason,
      },
      { transaction },
    );
    await audit(
      actor.id,
      "incident.assigned",
      id,
      { responderId, reason },
      transaction,
    );
    await event("IncidentAssigned", i.get(), transaction);
    return view(i.get(), actor);
  });
}
export async function duplicates(id: string, actor: Actor) {
  const i = await accessible(id, actor);
  const candidates = await Incident.findAll({
    where: {
      [Op.and]: [
        scope(actor),
        {
          id: { [Op.ne]: id },
          category: i.get().category,
          createdAt: { [Op.gt]: new Date(Date.now() - 86400000) },
          status: { [Op.notIn]: ["closed", "rejected", "duplicate"] },
        },
      ],
    },
    limit: 100,
  });
  const words = new Set(
    i
      .get()
      .description.toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3),
  );
  return candidates
    .map((c) => {
      const distance = distanceKm(i.get(), c.get());
      const overlap = c
        .get()
        .description.toLowerCase()
        .split(/\W+/)
        .filter((w) => words.has(w)).length;
      return {
        id: c.get().id,
        trackingId: c.get().trackingId,
        title: c.get().title,
        distanceKm: distance,
        confidence: Math.min(
          100,
          Math.round(
            Math.max(0, 60 - distance * 40) + Math.min(40, overlap * 5),
          ),
        ),
      };
    })
    .filter((c) => c.distanceKm < 2)
    .sort((a, b) => b.confidence - a.confidence);
}
