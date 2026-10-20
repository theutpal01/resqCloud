import { Router } from "express";
import { config } from "../config.js";
import rateLimit from "express-rate-limit";
import { Op } from "sequelize";
import { z } from "zod";
import {
  db,
  Incident,
  Department,
  History,
  Assignment,
  Feedback,
  Jurisdiction,
  JurisdictionBoundary,
} from "../database.js";
import {
  authenticate,
  optionalAuth,
  requireRole,
  HttpError,
  hash,
} from "../auth.js";
import {
  scope,
  view,
  accessible,
  createIncident,
  transition,
  severity,
  assign,
  recommendations,
  duplicates,
  audit,
  event,
} from "../incidents.js";
import {
  reportSchema,
  transitionSchema,
  severities,
  feedbackSchema,
  publicIncident,
  demoJurisdictions,
  indianJurisdictions,
  dateRangeQuerySchema,
} from "../../../../packages/shared/src/index.js";
import { operationalPolicy } from "../policy.js";
import { withCreatedAtRange } from "../dateRange.js";
import { suggestJurisdiction } from "../jurisdictionRouting.js";

export const incidentRoutes = Router();
const router = incidentRoutes;
router.get("/api/v1/jurisdictions", async (_req, res) => {
  const roots =
    config.NODE_ENV === "production" ? indianJurisdictions : demoJurisdictions;
  const rootCodes = roots.map((jurisdiction) => jurisdiction.code);
  const districts = await Jurisdiction.findAll({
    where: {
      kind: "district",
      active: true,
      parentCode: { [Op.in]: rootCodes },
    },
    attributes: ["code", "name", "kind", "parentCode"],
    order: [["name", "ASC"]],
  });
  res.json([...roots, ...districts]);
});
router.get("/api/v1/jurisdictions/suggest", async (req, res) => {
  const point = z
    .object({
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
    })
    .parse(req.query);
  const roots =
    config.NODE_ENV === "production" ? indianJurisdictions : demoJurisdictions;
  const rootCodes = roots.map((jurisdiction) => jurisdiction.code);
  const [allBoundaries, activeDistricts] = await Promise.all([
    JurisdictionBoundary.findAll({
      where: { reviewStatus: "approved" },
      attributes: ["jurisdictionCode", "geometry"],
    }),
    Jurisdiction.findAll({
      where: {
        active: true,
        kind: "district",
        parentCode: { [Op.in]: rootCodes },
      },
      attributes: ["code"],
    }),
  ]);
  const activeCodes = new Set(
    activeDistricts.map((district) => district.get().code),
  );
  res.json(
    suggestJurisdiction(
      point.latitude,
      point.longitude,
      allBoundaries
        .filter((row) => activeCodes.has(row.get().jurisdictionCode))
        .map((row) => ({
          jurisdictionCode: row.get().jurisdictionCode,
          geometry: row.get()
            .geometry as import("../jurisdictionRouting.js").BoundaryGeometry,
        })),
    ),
  );
});
router.get("/api/v1/policy", async (_req, res) =>
  res.json(await operationalPolicy()),
);
router.get("/api/v1/departments", async (_req, res) =>
  res.json(await Department.findAll()),
);
router.get("/api/v1/public/incidents", async (_req, res) => {
  const rows = await Incident.findAll({
    where: {
      approvedPublic: true,
      status: { [Op.notIn]: ["rejected", "duplicate"] },
    },
    limit: 100,
    order: [["updatedAt", "DESC"]],
  });
  res.json(rows.map((i) => publicIncident(view(i.get()))));
});
router.post("/api/v1/tracking", async (req, res) => {
  const body = z
    .object({
      trackingId: z.string().max(40),
      trackingToken: z.string().min(20).max(100),
    })
    .parse(req.body);
  const i = await Incident.findOne({
    where: {
      trackingId: body.trackingId,
      trackingHash: hash(body.trackingToken),
    },
  });
  if (!i) throw new HttpError(404, "Tracking credentials not found");
  const history = await History.findAll({
    where: { incidentId: i.get().id },
    attributes: ["id", "fromStatus", "toStatus", "createdAt"],
    order: [["createdAt", "ASC"]],
  });
  res.json({
    trackingId: i.get().trackingId,
    status: i.get().status,
    severity: i.get().severity,
    history,
  });
});
router.post("/api/v1/incidents", optionalAuth, async (req, res) => {
  const result = await createIncident(reportSchema.parse(req.body), req.actor);
  res.status(result.replayed ? 200 : 201).json(result);
});
router.post(
  "/api/v1/sos",
  rateLimit({ windowMs: 60000, limit: 3 }),
  optionalAuth,
  async (req, res) => {
    const result = await createIncident(
      reportSchema.parse(req.body),
      req.actor,
      true,
    );
    res.status(result.replayed ? 200 : 201).json(result);
  },
);
router.get("/api/v1/incidents", authenticate, async (req, res) => {
  const q = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(15),
      search: z.string().max(100).optional(),
      severity: z.enum(severities).optional(),
      status: z.string().max(30).optional(),
      sort: z.enum(["newest", "oldest"]).default("newest"),
    })
    .parse(req.query);
  const filter = {
    ...scope(req.actor!),
    ...(q.severity ? { severity: q.severity } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.search
      ? {
          [Op.or]: [
            { title: { [Op.like]: `%${q.search}%` } },
            { trackingId: { [Op.like]: `%${q.search}%` } },
          ],
        }
      : {}),
  };
  const result = await Incident.findAndCountAll({
    where: filter,
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
    order: [["createdAt", q.sort === "oldest" ? "ASC" : "DESC"]],
  });
  res.json({
    items: result.rows.map((i) => view(i.get(), req.actor)),
    total: result.count,
    page: q.page,
    pageSize: q.pageSize,
  });
});
router.get(
  "/api/v1/incidents/export",
  authenticate,
  requireRole("dispatcher", "supervisor", "admin"),
  async (req, res) => {
    const range = dateRangeQuerySchema.parse(req.query);
    const rows = await Incident.findAll({
      where: withCreatedAtRange(scope(req.actor!), range),
      limit: 10000,
      order: [["createdAt", "DESC"]],
    });
    const quote = (s: unknown) =>
      `"${String(s)
        .replace(/^[=+@-]/, "'")
        .replaceAll('"', '""')}"`;
    res
      .type("text/csv")
      .attachment("resqcloud-incidents.csv")
      .send(
        [
          "Tracking ID,Category,Severity,Status,Created",
          ...rows.map((i) =>
            [
              i.get().trackingId,
              i.get().category,
              i.get().severity,
              i.get().status,
              i.get().createdAt.toISOString(),
            ]
              .map(quote)
              .join(","),
          ),
        ].join("\n"),
      );
    await audit(req.actor!.id, "incidents.export", "export", {
      count: rows.length,
      from: range.from,
      to: range.to,
    });
  },
);
router.get("/api/v1/incidents/:id", authenticate, async (req, res) => {
  const i = await accessible(String(req.params.id), req.actor!);
  const history = await History.findAll({
    where: { incidentId: i.get().id },
    attributes: [
      "id",
      "fromStatus",
      "toStatus",
      ...(req.actor!.role === "citizen" ? [] : ["reason"]),
      "createdAt",
    ],
    order: [["createdAt", "ASC"]],
  });
  res.json({ incident: view(i.get(), req.actor), history });
});
router.post(
  "/api/v1/incidents/:id/transition",
  authenticate,
  async (req, res) => {
    const b = transitionSchema.parse(req.body);
    res.json(
      await transition(String(req.params.id), req.actor!, b.status, b.reason),
    );
  },
);
router.patch(
  "/api/v1/incidents/:id/severity",
  authenticate,
  async (req, res) => {
    const b = z
      .object({
        severity: z.enum(severities),
        reason: z.string().min(3).max(1000),
      })
      .parse(req.body);
    res.json(
      await severity(String(req.params.id), req.actor!, b.severity, b.reason),
    );
  },
);
router.get(
  "/api/v1/incidents/:id/recommendations",
  authenticate,
  requireRole("dispatcher", "supervisor", "admin"),
  async (req, res) =>
    res.json(await recommendations(String(req.params.id), req.actor!)),
);
router.get(
  "/api/v1/incidents/:id/duplicates",
  authenticate,
  requireRole("dispatcher", "supervisor", "admin"),
  async (req, res) =>
    res.json(await duplicates(String(req.params.id), req.actor!)),
);
router.post("/api/v1/incidents/:id/assign", authenticate, async (req, res) => {
  const b = z
    .object({ responderId: z.uuid(), reason: z.string().min(3).max(1000) })
    .parse(req.body);
  res.json(
    await assign(String(req.params.id), req.actor!, b.responderId, b.reason),
  );
});
router.post(
  "/api/v1/incidents/:id/accept",
  authenticate,
  requireRole("responder"),
  async (req, res) => {
    await db.transaction(async (transaction) => {
      const i = await accessible(
        String(req.params.id),
        req.actor!,
        transaction,
      );
      if (i.get().status !== "assigned")
        throw new HttpError(409, "Incident is not assigned");
      const [count] = await Assignment.update(
        { status: "accepted" },
        {
          where: {
            incidentId: i.get().id,
            responderId: req.actor!.id,
            status: "assigned",
          },
          transaction,
        },
      );
      if (!count) throw new HttpError(409, "Assignment already handled");
      await audit(
        req.actor!.id,
        "assignment.accepted",
        i.get().id,
        {},
        transaction,
      );
      await event("ResponderAccepted", i.get(), transaction);
    });
    res.json({ ok: true });
  },
);
router.post(
  "/api/v1/incidents/:id/feedback",
  authenticate,
  requireRole("citizen"),
  async (req, res) => {
    const b = feedbackSchema.parse(req.body);
    const i = await accessible(String(req.params.id), req.actor!);
    if (i.get().status !== "closed")
      throw new HttpError(409, "Feedback is available after closure");
    await Feedback.create({
      ...b,
      incidentId: i.get().id,
      userId: req.actor!.id,
    });
    await audit(req.actor!.id, "feedback.submitted", i.get().id, {
      rating: b.rating,
    });
    res.status(201).json({ ok: true });
  },
);
router.patch(
  "/api/v1/incidents/:id/public",
  authenticate,
  requireRole("supervisor", "admin"),
  async (req, res) => {
    const { approved } = z.object({ approved: z.boolean() }).parse(req.body);
    const i = await accessible(String(req.params.id), req.actor!);
    await i.update({ approvedPublic: approved });
    await audit(req.actor!.id, "incident.public_visibility", i.get().id, {
      approved,
    });
    res.json({ ok: true });
  },
);
