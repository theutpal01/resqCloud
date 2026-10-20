import { Router } from "express";
import rateLimit from "express-rate-limit";
import { Op } from "sequelize";
import { z } from "zod";
import {
  db,
  User,
  Incident,
  Profile,
  Notification,
  Location,
} from "../database.js";
import { authenticate, requireRole, HttpError } from "../auth.js";
import { scope } from "../incidents.js";
import {
  coordinates,
  dateRangeQuerySchema,
} from "../../../../packages/shared/src/index.js";
import { withCreatedAtRange } from "../dateRange.js";
import { operationalPolicy } from "../policy.js";

export const operationsRoutes = Router();
const router = operationsRoutes;
router.get(
  "/api/v1/responders",
  authenticate,
  requireRole("dispatcher", "supervisor", "admin"),
  async (req, res) => {
    const users = await User.findAll({
      where: {
        role: "responder",
        ...(req.actor!.role === "admin"
          ? {}
          : {
              departmentId: req.actor!.departmentId,
              jurisdictionCode: req.actor!.jurisdictionCode ?? "__unassigned__",
            }),
      },
      attributes: ["id", "name", "departmentId"],
      limit: 100,
    });
    const profiles = await Profile.findAll({
      where: { userId: users.map((u) => u.get().id) },
    });
    res.json(
      users.map((u) => ({
        ...u.get(),
        profile: profiles.find((p) => p.get().userId === u.get().id)?.get(),
      })),
    );
  },
);
router.patch(
  "/api/v1/responders/me/availability",
  authenticate,
  requireRole("responder"),
  async (req, res) => {
    const { availability } = z
      .object({
        availability: z.enum(["off_duty", "available", "unavailable"]),
      })
      .parse(req.body);
    const p = await Profile.findOne({ where: { userId: req.actor!.id } });
    if (!p) throw new HttpError(404, "Profile missing");
    if (["busy", "responding"].includes(p.get().availability))
      throw new HttpError(409, "Complete your active assignment first");
    await p.update({ availability });
    res.json({ availability });
  },
);
router.post(
  "/api/v1/responders/me/location",
  authenticate,
  requireRole("responder"),
  rateLimit({ windowMs: 60000, limit: 12 }),
  async (req, res) => {
    const b = coordinates.parse(req.body);
    const p = await Profile.findOne({ where: { userId: req.actor!.id } });
    if (
      !p ||
      !["available", "busy", "responding"].includes(p.get().availability)
    )
      throw new HttpError(409, "Go on duty before sharing location");
    await db.transaction(async (transaction) => {
      await p.update(b, { transaction });
      await Location.create(
        { ...b, responderId: req.actor!.id },
        { transaction },
      );
      await Location.destroy({
        where: { createdAt: { [Op.lt]: new Date(Date.now() - 7 * 86400000) } },
        transaction,
      });
    });
    res.json({ ok: true });
  },
);
router.get("/api/v1/notifications", authenticate, async (req, res) =>
  res.json(
    await Notification.findAll({
      where: { userId: req.actor!.id },
      order: [["createdAt", "DESC"]],
      limit: 100,
    }),
  ),
);
router.post("/api/v1/notifications/read", authenticate, async (req, res) => {
  const b = z.object({ id: z.uuid().optional() }).parse(req.body);
  await Notification.update(
    { readAt: new Date() },
    { where: { userId: req.actor!.id, ...(b.id ? { id: b.id } : {}) } },
  );
  res.json({ ok: true });
});
router.get("/api/v1/analytics", authenticate, async (req, res) => {
  const range = dateRangeQuerySchema.parse(req.query);
  const where = withCreatedAtRange(scope(req.actor!), range);
  const policy = await operationalPolicy();
  const [
    total,
    open,
    critical,
    resolved,
    byCategory,
    byStatus,
    responseTime,
    resolutionTime,
  ] = await Promise.all([
    Incident.count({ where }),
    Incident.count({
      where: {
        [Op.and]: [
          where,
          {
            status: {
              [Op.notIn]: ["closed", "resolved", "rejected", "duplicate"],
            },
          },
        ],
      },
    }),
    Incident.count({
      where: {
        [Op.and]: [
          where,
          {
            severity: "critical",
            status: {
              [Op.notIn]: ["closed", "resolved", "rejected", "duplicate"],
            },
          },
        ],
      },
    }),
    Incident.count({
      where: {
        [Op.and]: [where, { status: { [Op.in]: ["resolved", "closed"] } }],
      },
    }),
    Incident.findAll({
      where,
      attributes: ["category", [db.fn("COUNT", db.col("id")), "count"]],
      group: ["category"],
      raw: true,
    }),
    Incident.findAll({
      where,
      attributes: ["status", [db.fn("COUNT", db.col("id")), "count"]],
      group: ["status"],
      raw: true,
    }),
    Incident.findOne({
      where: {
        [Op.and]: [where, { firstResponseSeconds: { [Op.ne]: null } }],
      },
      attributes: [
        [db.fn("AVG", db.col("firstResponseSeconds")), "averageSeconds"],
        [db.fn("COUNT", db.col("id")), "count"],
      ],
      raw: true,
    }),
    Incident.findOne({
      where: {
        [Op.and]: [where, { resolutionSeconds: { [Op.ne]: null } }],
      },
      attributes: [
        [db.fn("AVG", db.col("resolutionSeconds")), "averageSeconds"],
        [db.fn("COUNT", db.col("id")), "count"],
      ],
      raw: true,
    }),
  ]);
  const timing = (value: unknown) => {
    const row = value as {
      averageSeconds: string | number | null;
      count: string | number;
    } | null;
    return {
      averageSeconds:
        row?.averageSeconds === null || row?.averageSeconds === undefined
          ? null
          : Math.round(Number(row.averageSeconds)),
      count: Number(row?.count ?? 0),
    };
  };
  const slaRows = await Incident.findAll({
    where: {
      [Op.and]: [
        where,
        { severity: { [Op.in]: ["high", "critical"] } },
        {
          [Op.or]: [
            {
              status: {
                [Op.notIn]: ["closed", "resolved", "rejected", "duplicate"],
              },
            },
            { firstResponseSeconds: { [Op.ne]: null } },
          ],
        },
      ],
    },
    attributes: ["severity", "createdAt", "firstResponseSeconds"],
  });
  const responseSla = {
    tracked: slaRows.length,
    met: 0,
    breached: 0,
    overdue: 0,
    pending: 0,
    targetMinutes: policy.targets,
  };
  for (const row of slaRows) {
    const incident = row.get();
    const targetSeconds =
      policy.targets[incident.severity as "high" | "critical"] * 60;
    if (incident.firstResponseSeconds !== null) {
      if (incident.firstResponseSeconds <= targetSeconds) responseSla.met += 1;
      else responseSla.breached += 1;
    } else if (Date.now() - incident.createdAt.getTime() > targetSeconds) {
      responseSla.overdue += 1;
    } else {
      responseSla.pending += 1;
    }
  }
  res.json({
    total,
    open,
    critical,
    resolved,
    byCategory,
    byStatus,
    responseTime: timing(responseTime),
    resolutionTime: timing(resolutionTime),
    responseSla,
  });
});
