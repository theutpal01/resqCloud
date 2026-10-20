import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { app } from "../apps/api/src/app.js";
import {
  db,
  migrate,
  User,
  Department,
  Profile,
  Audit,
  Notification,
  Event,
  Jurisdiction,
  JurisdictionBoundary,
  Configuration,
  Incident,
} from "../apps/api/src/database.js";
import { processEvents } from "../apps/api/src/events.js";
import {
  departments,
  categoryDepartment,
  categories,
  type Role,
} from "../packages/shared/src/index.js";
const server = createServer(app);
const api = request(server);
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};
const password = "TestPassword!2026";
const report = () => ({
  title: "Road accident near the station",
  description: "Two vehicles involved. Medical assistance is required.",
  category: "accident",
  jurisdictionCode: "IN-TN",
  severity: "high",
  latitude: 12.97,
  longitude: 79.14,
  location: "Katpadi Station",
  peopleAffected: 2,
  anonymous: false,
  incidentTime: new Date().toISOString(),
  clientId: randomUUID(),
});
beforeAll(async () => {
  await migrate();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  for (const [i, name] of departments.entries())
    await Department.create({ id: i + 1, name });
  await Jurisdiction.findOrCreate({
    where: { code: "IN-KA" },
    defaults: {
      code: "IN-KA",
      name: "Karnataka (test fixture)",
      kind: "state",
      parentCode: "IN",
      active: true,
    },
  });
  const passwordHash = await bcrypt.hash(password, 4);
  for (const [key, role, departmentId] of [
    ["citizen", "citizen", null],
    ["other", "citizen", null],
    ["dispatcher", "dispatcher", 2],
    ["foreign", "dispatcher", 2],
    ["responder", "responder", 2],
    ["foreign_responder", "responder", 2],
    ["supervisor", "supervisor", 2],
    ["admin", "admin", null],
  ] as [string, Role, number | null][]) {
    const u = await User.create({
      name: key,
      email: `${key}@test.local`,
      role,
      departmentId,
      jurisdictionCode: ["dispatcher", "responder", "supervisor"].includes(role)
        ? key.startsWith("foreign")
          ? "IN-KA"
          : "IN-TN"
        : null,
      passwordHash,
      enabled: true,
      mfaSecret: null,
      cognitoSub: null,
    });
    ids[key] = u.get().id;
    if (role === "responder")
      await Profile.create({
        userId: u.get().id,
        availability: "available",
        latitude: 12.97,
        longitude: 79.15,
        skills: "accident",
      });
    const login = await api
      .post("/api/v1/auth/login")
      .send({ email: `${key}@test.local`, password });
    expect(login.status).toBe(200);
    tokens[key] = login.body.accessToken;
  }
});
afterAll(async () => {
  if (server.listening)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  await db.close();
});
const auth = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });
describe("jurisdiction migration and demo catalog", () => {
  it("keeps the migration chain idempotent", async () => {
    await expect(migrate()).resolves.toBeUndefined();
  });
  it("exposes only the sample state outside production", async () => {
    const response = await api.get("/api/v1/jurisdictions");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ code: "IN-TN", name: "Tamil Nadu" }]);
  });
});
describe("admin regional and policy configuration", () => {
  it("keeps imported boundaries inactive until an audited admin approves them", async () => {
    const code = "IN-TN98";
    await Jurisdiction.create({
      code,
      name: "Routing Test District",
      kind: "district",
      parentCode: "IN-TN",
      active: true,
    });
    await JurisdictionBoundary.create({
      jurisdictionCode: code,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [79, 12],
            [80, 12],
            [80, 13],
            [79, 13],
            [79, 12],
          ],
        ],
      },
      sourceName: "Survey of India test fixture",
      sourceUrl: "https://surveyofindia.gov.in/",
      sourceVersion: "test-fixture-v1",
      retrievedAt: new Date(),
      reviewStatus: "candidate",
      approvalReference: null,
      approvedBy: null,
      approvedAt: null,
    });

    const query = "/api/v1/jurisdictions/suggest?latitude=12.5&longitude=79.5";
    expect((await api.get(query)).body.status).toBe("unavailable");
    const approved = await api
      .post(`/api/v1/admin/jurisdictions/${code}/boundary/approve`)
      .set(auth("admin"))
      .send({ approvalReference: "authority-review-record-2026-01" });
    expect(approved.status, approved.text).toBe(200);
    expect((await api.get(query)).body).toEqual({
      status: "suggested",
      jurisdictionCode: code,
      candidates: [code],
    });
    expect(
      (
        await api.get(
          "/api/v1/jurisdictions/suggest?latitude=12&longitude=79.5",
        )
      ).body,
    ).toMatchObject({
      status: "ambiguous",
      jurisdictionCode: null,
      candidates: [code],
    });
    expect(
      (
        await api
          .post(`/api/v1/admin/jurisdictions/${code}/boundary/approve`)
          .set(auth("dispatcher"))
          .send({ approvalReference: "authority-review-record-2026-01" })
      ).status,
    ).toBe(403);
  });

  it("restricts regional and policy endpoints to administrators", async () => {
    expect((await api.get("/api/v1/admin/jurisdictions")).status).toBe(401);
    expect(
      (await api.get("/api/v1/admin/jurisdictions").set(auth("dispatcher")))
        .status,
    ).toBe(403);
    expect(
      (
        await api
          .put("/api/v1/admin/policy")
          .set(auth("dispatcher"))
          .send({ categories: ["fire"] })
      ).status,
    ).toBe(403);
  });

  it("activates a district for reporting and scopes its incidents to the parent authority", async () => {
    const created = await api
      .post("/api/v1/admin/jurisdictions")
      .set(auth("admin"))
      .send({ localCode: "01", name: "Test District", parentCode: "IN-TN" });
    expect(created.status, created.text).toBe(201);
    expect(created.body).toMatchObject({
      code: "IN-TN01",
      name: "Test District",
      kind: "district",
      parentCode: "IN-TN",
      active: false,
    });

    const regions = await api
      .get("/api/v1/admin/jurisdictions")
      .set(auth("admin"));
    expect(regions.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "IN-TN01" })]),
    );
    expect((await api.get("/api/v1/jurisdictions")).body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "IN-TN01" })]),
    );
    const activated = await api
      .patch("/api/v1/admin/jurisdictions/IN-TN01")
      .set(auth("admin"))
      .send({ active: true });
    expect(activated.status, activated.text).toBe(200);
    expect((await api.get("/api/v1/jurisdictions")).body).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "IN-TN01" })]),
    );
    const districtReport = await api
      .post("/api/v1/incidents")
      .set(auth("citizen"))
      .send({ ...report(), jurisdictionCode: "IN-TN01" });
    expect(districtReport.status, districtReport.text).toBe(201);
    const stateAuthorityIncidents = await api
      .get("/api/v1/incidents")
      .set(auth("dispatcher"));
    expect(stateAuthorityIncidents.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: districtReport.body.incident.id }),
      ]),
    );
    expect(
      (
        await api.post("/api/v1/admin/jurisdictions").set(auth("admin")).send({
          localCode: "01",
          name: "Orphan District",
          parentCode: "IN-XX",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api.post("/api/v1/admin/jurisdictions").set(auth("admin")).send({
          localCode: "01",
          name: "Duplicate District",
          parentCode: "IN-TN",
        })
      ).status,
    ).toBe(409);
  });

  it("applies saved categories and response targets to intake and SLA metrics", async () => {
    const previous = (await api.get("/api/v1/policy")).body;
    try {
      expect(
        (
          await api
            .put("/api/v1/admin/policy")
            .set(auth("admin"))
            .send({ categories: [], targets: { high: 1, critical: 2 } })
        ).status,
      ).toBe(400);
      expect(
        (
          await api
            .put("/api/v1/admin/policy")
            .set(auth("admin"))
            .send({
              categories: ["fire"],
              departmentsByCategory: { ...categoryDepartment, fire: 999 },
              targets: { high: 1, critical: 2 },
            })
        ).status,
      ).toBe(400);

      const policy = await api
        .put("/api/v1/admin/policy")
        .set(auth("admin"))
        .send({
          categories: ["fire", "medical"],
          departmentsByCategory: {
            ...categoryDepartment,
            fire: 4,
          },
          targets: { high: 1, critical: 2 },
        });
      expect(policy.status, policy.text).toBe(200);
      expect(policy.body).toEqual({
        categories: ["fire", "medical"],
        departmentsByCategory: { ...categoryDepartment, fire: 4 },
        targets: { high: 1, critical: 2 },
      });
      expect((await api.get("/api/v1/policy")).body).toEqual(policy.body);

      const rejected = await api
        .post("/api/v1/incidents")
        .set(auth("citizen"))
        .send(report());
      expect(rejected.status).toBe(400);
      const created = await api
        .post("/api/v1/incidents")
        .set(auth("citizen"))
        .send({ ...report(), category: "fire" });
      expect(created.status, created.text).toBe(201);
      expect(created.body.incident.departmentId).toBe(4);
      const incident = await Incident.findByPk(created.body.incident.id);
      await incident!.update({ createdAt: new Date(Date.now() - 3 * 60_000) });
      const analytics = await api.get("/api/v1/analytics").set(auth("admin"));
      expect(analytics.body.responseSla).toMatchObject({
        overdue: expect.any(Number),
        targetMinutes: { high: 1, critical: 2 },
      });
      expect(analytics.body.responseSla.overdue).toBeGreaterThanOrEqual(1);

      const stored = await Configuration.findAll();
      expect(stored.map((row) => row.get().key)).toEqual(
        expect.arrayContaining(["incident-policy", "service-targets"]),
      );
      expect(
        await Audit.findOne({
          where: { action: "admin.configuration.updated" },
        }),
      ).not.toBeNull();
    } finally {
      await api.put("/api/v1/admin/policy").set(auth("admin")).send(previous);
    }
  });
});
describe("secured incident workflow", () => {
  let id = "";
  it("rejects unauthenticated and invalid requests", async () => {
    expect((await api.get("/api/v1/incidents")).status).toBe(401);
    expect(
      (
        await api
          .post("/api/v1/incidents")
          .send({ ...report(), anonymous: true, latitude: 200 })
      ).status,
    ).toBe(400);
  });
  it("creates a citizen report and protects object access", async () => {
    const body = report();
    const r = await api
      .post("/api/v1/incidents")
      .set(auth("citizen"))
      .send(body);
    expect(r.status).toBe(201);
    id = r.body.incident.id;
    expect(r.body.incident).not.toHaveProperty("trackingHash");
    expect(
      (await api.post("/api/v1/incidents").set(auth("citizen")).send(body))
        .status,
    ).toBe(200);
    for (const role of ["other", "foreign", "responder"])
      expect(
        (await api.get(`/api/v1/incidents/${id}`).set(auth(role))).status,
      ).toBe(404);
    expect(
      (await api.get("/api/v1/incidents").set(auth("foreign"))).body.total,
    ).toBe(0);
  });
  it("rejects role escalation and status skipping", async () => {
    expect(
      (
        await api
          .post(`/api/v1/incidents/${id}/transition`)
          .set(auth("citizen"))
          .send({ status: "under_review", reason: "Review requested" })
      ).status,
    ).toBe(409);
    expect(
      (
        await api
          .post(`/api/v1/incidents/${id}/assign`)
          .set(auth("dispatcher"))
          .send({ responderId: ids.responder, reason: "Dispatch now" })
      ).status,
    ).toBe(409);
  });
  it("verifies, assesses, recommends and assigns", async () => {
    for (const status of ["under_review", "verified", "severity_assessed"]) {
      const r = await api
        .post(`/api/v1/incidents/${id}/transition`)
        .set(auth("dispatcher"))
        .send({ status, reason: "Verified through operational review" });
      expect(r.status, r.text).toBe(200);
    }
    const recommendations = await api
      .get(`/api/v1/incidents/${id}/recommendations`)
      .set(auth("dispatcher"));
    expect(recommendations.body.map((r: { id: string }) => r.id)).toEqual([
      ids.responder,
    ]);
    const assigned = await api
      .post(`/api/v1/incidents/${id}/assign`)
      .set(auth("dispatcher"))
      .send({
        responderId: ids.responder,
        reason: "Closest eligible medical responder",
      });
    expect(assigned.status, assigned.text).toBe(200);
  });
  it("requires acceptance before response and closes through supervisor", async () => {
    expect(
      (
        await api
          .post(`/api/v1/incidents/${id}/transition`)
          .set(auth("responder"))
          .send({ status: "responding", reason: "On our way" })
      ).status,
    ).toBe(409);
    expect(
      (await api.post(`/api/v1/incidents/${id}/accept`).set(auth("responder")))
        .status,
    ).toBe(200);
    for (const status of ["responding", "resolved"])
      expect(
        (
          await api
            .post(`/api/v1/incidents/${id}/transition`)
            .set(auth("responder"))
            .send({ status, reason: "Medical response recorded" })
        ).status,
      ).toBe(200);
    expect(
      (
        await api
          .post(`/api/v1/incidents/${id}/transition`)
          .set(auth("dispatcher"))
          .send({ status: "closed", reason: "Close case" })
      ).status,
    ).toBe(409);
    expect(
      (
        await api
          .post(`/api/v1/incidents/${id}/transition`)
          .set(auth("supervisor"))
          .send({
            status: "closed",
            reason: "Resolution reviewed and confirmed",
          })
      ).status,
    ).toBe(200);
  });
  it("accepts feedback once from the reporter only", async () => {
    const body = {
      rating: 5,
      responseRating: 4,
      resolutionRating: 5,
      comment: "Response was helpful",
      complaint: false,
    };
    expect(
      (
        await api
          .post(`/api/v1/incidents/${id}/feedback`)
          .set(auth("other"))
          .send(body)
      ).status,
    ).toBe(404);
    expect(
      (
        await api
          .post(`/api/v1/incidents/${id}/feedback`)
          .set(auth("citizen"))
          .send(body)
      ).status,
    ).toBe(201);
    expect(
      (
        await api
          .post(`/api/v1/incidents/${id}/feedback`)
          .set(auth("citizen"))
          .send(body)
      ).status,
    ).toBe(409);
  });
  it("publishes notifications idempotently and updates analytics", async () => {
    await processEvents();
    const count = await Notification.count();
    expect(count).toBeGreaterThan(0);
    await Event.update({ processedAt: null }, { where: { aggregateId: id } });
    await processEvents();
    expect(await Notification.count()).toBe(count);
    expect(
      (await api.get("/api/v1/analytics").set(auth("dispatcher"))).body
        .resolved,
    ).toBe(1);
    expect(await Audit.count({ where: { resourceId: id } })).toBeGreaterThan(5);
  });
  it("protects anonymous identity and public projections", async () => {
    const r = await api
      .post("/api/v1/incidents")
      .set(auth("citizen"))
      .send({ ...report(), anonymous: true, contact: "secret@example.com" });
    expect(r.status).toBe(201);
    expect(r.body.incident.reporterId).toBe(null);
    expect(r.body.incident).not.toHaveProperty("contact");
    const tracking = await api.post("/api/v1/tracking").send({
      trackingId: r.body.incident.trackingId,
      trackingToken: r.body.trackingToken,
    });
    expect(tracking.status).toBe(200);
    expect(tracking.body).not.toHaveProperty("description");
    expect(
      (
        await api.post("/api/v1/tracking").send({
          trackingId: r.body.incident.trackingId,
          trackingToken: "incorrect-but-long-enough",
        })
      ).status,
    ).toBe(404);
    expect((await api.get("/api/v1/public/incidents")).body).toHaveLength(0);
    await api
      .patch(`/api/v1/incidents/${r.body.incident.id}/public`)
      .set(auth("supervisor"))
      .send({ approved: true });
    const publicResult = await api.get("/api/v1/public/incidents");
    expect(publicResult.body).toHaveLength(1);
    expect(publicResult.body[0]).not.toHaveProperty("title");
  });
  it("enforces admin access and refresh rotation replay detection", async () => {
    expect(
      (await api.get("/api/v1/admin/users").set(auth("dispatcher"))).status,
    ).toBe(403);
    const login = await api
      .post("/api/v1/auth/login")
      .send({ email: "other@test.local", password });
    const cookie = login.headers["set-cookie"];
    const rotated = await api
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie);
    expect(rotated.status).toBe(200);
    expect(
      (await api.post("/api/v1/auth/refresh").set("Cookie", cookie)).status,
    ).toBe(401);
    expect(
      (
        await api
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${rotated.body.accessToken}`)
      ).status,
    ).toBe(401);
  });
  it("rejects foreign-origin cookie mutations", async () => {
    expect(
      (
        await api
          .post("/api/v1/auth/refresh")
          .set("Origin", "https://evil.example")
      ).status,
    ).toBe(403);
  });
});
