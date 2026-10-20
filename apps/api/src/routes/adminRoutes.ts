import { Router } from "express";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { z } from "zod";
import { config } from "../config.js";
import {
  db,
  User,
  Profile,
  Audit,
  Session,
  Configuration,
  Event,
  Jurisdiction,
  JurisdictionBoundary,
  Department,
  Incident,
} from "../database.js";
import { authenticate, requireRole, HttpError, safeUser } from "../auth.js";
import { audit } from "../incidents.js";
import { encryptMfaSecret } from "../mfaCrypto.js";
import {
  registerSchema,
  roles,
  DEMO_JURISDICTION_CODE,
  categories,
} from "../../../../packages/shared/src/index.js";

export const adminRoutes = Router();
const router = adminRoutes;
const categoryRoutingSchema = z
  .record(z.enum(categories), z.number().int().positive())
  .refine(
    (assignments) =>
      Object.keys(assignments).length === categories.length &&
      categories.every((category) => assignments[category] !== undefined),
    "Provide a department for every supported category",
  );

async function assertCategoryDepartments(
  assignments: Record<(typeof categories)[number], number>,
) {
  const ids = [...new Set(Object.values(assignments))];
  const existing = await Department.count({ where: { id: { [Op.in]: ids } } });
  if (existing !== ids.length)
    throw new HttpError(
      400,
      "Category routing references an unknown department",
    );
}

router.get(
  "/api/v1/admin/users",
  authenticate,
  requireRole("admin"),
  async (_req, res) =>
    res.json(
      await User.findAll({
        attributes: [
          "id",
          "name",
          "email",
          "role",
          "departmentId",
          "jurisdictionCode",
          "enabled",
        ],
        limit: 200,
      }),
    ),
);
router.post(
  "/api/v1/admin/users",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const b = registerSchema
      .extend({
        role: z.enum(roles),
        departmentId: z.number().int().positive().nullable(),
        jurisdictionCode: z
          .string()
          .regex(/^IN-[A-Z0-9]{2,5}$/)
          .nullable(),
        mfaSecret: z
          .string()
          .regex(/^[A-Z2-7]{16,64}$/)
          .optional(),
      })
      .parse(req.body);
    if (b.role !== "citizen" && !b.departmentId && b.role !== "admin")
      throw new HttpError(400, "A department is required");
    if (b.departmentId && !(await Department.findByPk(b.departmentId)))
      throw new HttpError(400, "Select an existing department");
    if (["dispatcher", "responder", "supervisor"].includes(b.role)) {
      if (!b.jurisdictionCode)
        throw new HttpError(400, "A state/UT jurisdiction is required");
      const jurisdiction = await Jurisdiction.findByPk(b.jurisdictionCode);
      if (!jurisdiction || !jurisdiction.get().active)
        throw new HttpError(400, "Select an active jurisdiction");
      if (
        config.NODE_ENV !== "production" &&
        b.jurisdictionCode !== DEMO_JURISDICTION_CODE &&
        jurisdiction.get().kind !== "district"
      )
        throw new HttpError(
          400,
          "Development authorities must use the sample jurisdiction or an active district",
        );
    }
    if (
      config.NODE_ENV === "production" &&
      b.role !== "citizen" &&
      !b.mfaSecret
    )
      throw new HttpError(
        400,
        "Provision an MFA secret through a secure channel",
      );
    const user = await db.transaction(async (transaction) => {
      const u = await User.create(
        {
          name: b.name,
          email: b.email.toLowerCase(),
          role: b.role,
          departmentId: b.departmentId,
          jurisdictionCode: b.jurisdictionCode,
          passwordHash: await bcrypt.hash(b.password, 12),
          mfaSecret: b.mfaSecret ? encryptMfaSecret(b.mfaSecret) : null,
          enabled: true,
        },
        { transaction },
      );
      if (b.role === "responder")
        await Profile.create(
          {
            userId: u.get().id,
            availability: "off_duty",
            skills: "",
            latitude: null,
            longitude: null,
          },
          { transaction },
        );
      await audit(
        req.actor!.id,
        "user.created",
        u.get().id,
        { role: b.role },
        transaction,
      );
      return u;
    });
    res.status(201).json(safeUser(user));
  },
);
router.patch(
  "/api/v1/admin/users/:id",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const b = z
      .object({
        enabled: z.boolean().optional(),
        role: z.enum(roles).optional(),
        departmentId: z.number().int().positive().nullable().optional(),
        jurisdictionCode: z
          .string()
          .regex(/^IN-[A-Z0-9]{2,5}$/)
          .nullable()
          .optional(),
      })
      .refine((value) => Object.keys(value).length > 0)
      .parse(req.body);
    if (req.params.id === req.actor!.id)
      throw new HttpError(409, "Cannot change your own account");
    await db.transaction(async (transaction) => {
      const u = await User.findByPk(String(req.params.id), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!u) throw new HttpError(404, "User not found");
      const current = u.get();
      const role = b.role ?? current.role;
      let departmentId = b.departmentId ?? current.departmentId;
      let jurisdictionCode = b.jurisdictionCode ?? current.jurisdictionCode;
      const scopeProvided =
        b.role !== undefined ||
        b.departmentId !== undefined ||
        b.jurisdictionCode !== undefined;

      if (
        scopeProvided &&
        config.NODE_ENV === "production" &&
        role !== "citizen" &&
        !current.mfaSecret &&
        role !== current.role
      )
        throw new HttpError(
          409,
          "Provision MFA securely before assigning an authority role",
        );

      if (role === "citizen" || role === "admin") {
        departmentId = null;
        jurisdictionCode = null;
      } else if (scopeProvided) {
        if (departmentId === null)
          throw new HttpError(400, "A department is required for this role");
        if (!jurisdictionCode)
          throw new HttpError(400, "A state/UT jurisdiction is required");
        if (!(await Department.findByPk(departmentId, { transaction })))
          throw new HttpError(400, "Select an existing department");
        const jurisdiction = await Jurisdiction.findByPk(jurisdictionCode, {
          transaction,
        });
        if (!jurisdiction || !jurisdiction.get().active)
          throw new HttpError(400, "Select an active jurisdiction");
        if (
          config.NODE_ENV !== "production" &&
          jurisdictionCode !== DEMO_JURISDICTION_CODE &&
          jurisdiction.get().kind !== "district"
        )
          throw new HttpError(
            400,
            "Development authorities must use the sample jurisdiction or an active district",
          );
      }

      const scopeChanged =
        role !== current.role ||
        departmentId !== current.departmentId ||
        jurisdictionCode !== current.jurisdictionCode;

      const disabling = b.enabled === false && current.enabled;
      if (
        (scopeChanged || disabling) &&
        (current.role === "responder" || role === "responder")
      ) {
        const activeAssignments = await Incident.count({
          where: {
            assignedTo: current.id,
            status: {
              [Op.notIn]: ["resolved", "closed", "rejected", "duplicate"],
            },
          },
          transaction,
        });
        if (activeAssignments)
          throw new HttpError(
            409,
            "Resolve or reassign active incidents before changing this responder's role or scope",
          );
      }

      const changes = {
        enabled: b.enabled ?? current.enabled,
        role,
        departmentId,
        jurisdictionCode,
      };
      await u.update(changes, { transaction });
      if (role === "responder") {
        const [profile] = await Profile.findOrBuild({
          where: { userId: current.id },
          defaults: {
            userId: current.id,
            availability: "off_duty",
            skills: "",
            latitude: null,
            longitude: null,
          },
          transaction,
        });
        if (!profile.isNewRecord && current.role !== "responder")
          await profile.update({ availability: "off_duty" }, { transaction });
        else if (profile.isNewRecord) await profile.save({ transaction });
      } else if (current.role === "responder") {
        await Profile.update(
          { availability: "off_duty" },
          { where: { userId: current.id }, transaction },
        );
      }
      await Session.update(
        { revoked: true },
        { where: { userId: current.id }, transaction },
      );
      await audit(
        req.actor!.id,
        "user.updated",
        current.id,
        changes,
        transaction,
      );
    });
    res.json({ ok: true });
  },
);
router.post(
  "/api/v1/admin/jurisdictions/:code/boundary/approve",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const body = z
      .object({ approvalReference: z.string().trim().min(8).max(500) })
      .strict()
      .parse(req.body);
    const jurisdiction = await Jurisdiction.findByPk(String(req.params.code));
    const boundary = await JurisdictionBoundary.findByPk(
      String(req.params.code),
    );
    if (!jurisdiction || jurisdiction.get().kind !== "district")
      throw new HttpError(404, "District jurisdiction not found");
    if (!boundary)
      throw new HttpError(404, "No imported district boundary found");
    await boundary.update({
      reviewStatus: "approved",
      approvalReference: body.approvalReference,
      approvedBy: req.actor!.id,
      approvedAt: new Date(),
    });
    await audit(
      req.actor!.id,
      "jurisdiction.boundary.approved",
      String(req.params.code),
      {
        approvalReference: body.approvalReference,
        sourceName: boundary.get().sourceName,
        sourceVersion: boundary.get().sourceVersion,
      },
    );
    res.json({
      jurisdictionCode: String(req.params.code),
      reviewStatus: "approved",
    });
  },
);
router.get(
  "/api/v1/admin/audit",
  authenticate,
  requireRole("admin"),
  async (_req, res) =>
    res.json(
      await Audit.findAll({ order: [["createdAt", "DESC"]], limit: 100 }),
    ),
);
router.get(
  "/api/v1/admin/configuration",
  authenticate,
  requireRole("admin"),
  async (_req, res) => res.json(await Configuration.findAll()),
);
router.put(
  "/api/v1/admin/policy",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const body = z
      .object({
        categories: z
          .array(z.enum(categories))
          .min(1)
          .max(categories.length)
          .refine((items) => new Set(items).size === items.length),
        departmentsByCategory: categoryRoutingSchema,
        targets: z
          .object({
            high: z.number().int().positive().max(10080),
            critical: z.number().int().positive().max(10080),
          })
          .strict(),
      })
      .strict()
      .refine(
        (value) =>
          value.categories.every(
            (category) => value.departmentsByCategory[category] !== undefined,
          ),
        {
          path: ["departmentsByCategory"],
          message: "Every accepted category must have a department",
        },
      )
      .parse(req.body);
    await assertCategoryDepartments(body.departmentsByCategory);
    await db.transaction(async (transaction) => {
      for (const [key, value] of [
        [
          "incident-policy",
          {
            categories: body.categories,
            departmentsByCategory: body.departmentsByCategory,
          },
        ],
        ["service-targets", body.targets],
      ] as const) {
        const [row] = await Configuration.findOrCreate({
          where: { key },
          defaults: { key, value },
          transaction,
        });
        await row.update({ value }, { transaction });
        await audit(
          req.actor!.id,
          "admin.configuration.updated",
          key,
          { key, value },
          transaction,
        );
      }
    });
    res.json({
      categories: body.categories,
      departmentsByCategory: body.departmentsByCategory,
      targets: body.targets,
    });
  },
);
router.put(
  "/api/v1/admin/configuration/:key",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const key = z
      .enum(["incident-policy", "service-targets"])
      .parse(req.params.key);
    const value =
      key === "incident-policy"
        ? z
            .object({
              categories: z
                .array(z.enum(categories))
                .min(1)
                .max(categories.length)
                .refine((items) => new Set(items).size === items.length),
              departmentsByCategory: categoryRoutingSchema,
            })
            .strict()
            .parse(req.body)
        : z
            .object({
              high: z.number().int().positive().max(10080),
              critical: z.number().int().positive().max(10080),
            })
            .strict()
            .parse(req.body);
    if (key === "incident-policy") {
      const policyValue = value as {
        departmentsByCategory: Record<(typeof categories)[number], number>;
      };
      await assertCategoryDepartments(policyValue.departmentsByCategory);
    }
    const [row] = await Configuration.findOrCreate({
      where: { key },
      defaults: { key, value },
    });
    await row.update({ value });
    await audit(req.actor!.id, "admin.configuration.updated", key, {
      key,
      value,
    });
    res.json({ key, value: row.get().value });
  },
);
router.get(
  "/api/v1/admin/jurisdictions",
  authenticate,
  requireRole("admin"),
  async (_req, res) =>
    res.json(
      await Jurisdiction.findAll({
        order: [
          ["parentCode", "ASC"],
          ["name", "ASC"],
        ],
      }),
    ),
);
router.post(
  "/api/v1/admin/jurisdictions",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const body = z
      .object({
        localCode: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9]{1,3}$/),
        name: z.string().trim().min(2).max(120),
        parentCode: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^IN-[A-Z]{2,3}$/),
      })
      .parse(req.body);
    const parent = await Jurisdiction.findByPk(body.parentCode);
    if (!parent || parent.get().parentCode !== "IN" || !parent.get().active)
      throw new HttpError(400, "Choose an existing state or union territory");
    const code = `${body.parentCode}${body.localCode}`;
    if (await Jurisdiction.findByPk(code))
      throw new HttpError(409, "That jurisdiction code already exists");
    const row = await Jurisdiction.create({
      code,
      name: body.name,
      parentCode: body.parentCode,
      kind: "district",
      active: false,
    });
    await audit(req.actor!.id, "jurisdiction.district.created", code, {
      parentCode: body.parentCode,
    });
    res.status(201).json(row);
  },
);
router.patch(
  "/api/v1/admin/jurisdictions/:code",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const body = z.object({ active: z.boolean() }).strict().parse(req.body);
    const row = await Jurisdiction.findByPk(String(req.params.code));
    if (!row || row.get().kind !== "district")
      throw new HttpError(404, "District jurisdiction not found");
    const parent = await Jurisdiction.findByPk(row.get().parentCode ?? "");
    if (!parent || !parent.get().active)
      throw new HttpError(409, "Activate the parent jurisdiction first");
    await row.update({ active: body.active });
    await audit(
      req.actor!.id,
      "jurisdiction.district.activation",
      row.get().code,
      {
        active: body.active,
      },
    );
    res.json(row);
  },
);
router.get(
  "/api/v1/admin/dead-events",
  authenticate,
  requireRole("admin"),
  async (_req, res) =>
    res.json(await Event.findAll({ where: { dead: true }, limit: 100 })),
);
router.post(
  "/api/v1/admin/dead-events/:id/retry",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    await Event.update(
      { dead: false, attempts: 0, nextAttemptAt: new Date() },
      { where: { id: req.params.id, dead: true } },
    );
    await audit(req.actor!.id, "event.retried", String(req.params.id), {});
    res.json({ ok: true });
  },
);
