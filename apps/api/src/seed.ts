import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import {
  db,
  migrate,
  Department,
  IncidentType,
  User,
  Profile,
  Jurisdiction,
} from "./database.js";
import { config } from "./config.js";
import {
  departments,
  categoryDepartment,
  type Role,
  DEMO_JURISDICTION_CODE,
} from "../../../packages/shared/src/index.js";
import { createIncident } from "./incidents.js";
export async function seed() {
  if (config.NODE_ENV === "production")
    throw new Error("Development seeds cannot run in production");
  const password = process.env.DEV_SEED_PASSWORD;
  if (!password || password.length < 12)
    throw new Error("Set DEV_SEED_PASSWORD to at least 12 characters");
  await migrate();
  await Jurisdiction.findOrCreate({
    where: { code: DEMO_JURISDICTION_CODE },
    defaults: {
      code: DEMO_JURISDICTION_CODE,
      name: "Tamil Nadu (development demo)",
      kind: "state",
      parentCode: "IN",
      active: true,
    },
  });
  for (const [i, name] of departments.entries())
    await Department.findOrCreate({
      where: { id: i + 1 },
      defaults: { id: i + 1, name },
    });
  for (const [name, departmentId] of Object.entries(categoryDepartment))
    await IncidentType.findOrCreate({
      where: { name },
      defaults: { name, departmentId },
    });
  for (const role of [
    "citizen",
    "dispatcher",
    "responder",
    "supervisor",
    "admin",
  ] as Role[]) {
    const [u] = await User.findOrCreate({
      where: { email: `${role}@resqcloud.test` },
      defaults: {
        id: randomUUID(),
        name: `Demo ${role[0].toUpperCase() + role.slice(1)}`,
        email: `${role}@resqcloud.test`,
        role,
        departmentId: role === "citizen" || role === "admin" ? null : 2,
        jurisdictionCode: ["dispatcher", "responder", "supervisor"].includes(
          role,
        )
          ? DEMO_JURISDICTION_CODE
          : null,
        passwordHash: await bcrypt.hash(password, 12),
        enabled: true,
        mfaSecret: null,
        cognitoSub: null,
      },
    });
    if (role === "responder")
      await Profile.findOrCreate({
        where: { userId: u.get().id },
        defaults: {
          userId: u.get().id,
          availability: "available",
          latitude: 12.9692,
          longitude: 79.1559,
          skills: "accident,medical",
        },
      });
  }
  const citizen = await User.findOne({
    where: { email: "citizen@resqcloud.test" },
  });
  if (!citizen) throw new Error("Seed citizen unavailable");
  const actor = {
    id: citizen.get().id,
    name: citizen.get().name,
    email: citizen.get().email,
    role: "citizen" as const,
    departmentId: null,
    jurisdictionCode: null,
  };
  const samples = [
    [
      "Multi-vehicle collision near Katpadi",
      "accident",
      "critical",
      12.972,
      79.139,
      "Katpadi Junction",
      6,
    ],
    [
      "Medical assistance at the bus terminal",
      "medical",
      "high",
      12.934,
      79.135,
      "Vellore Bus Terminal",
      1,
    ],
    [
      "Road surface damaged after heavy rainfall",
      "infrastructure",
      "medium",
      12.95,
      79.16,
      "Gandhi Nagar",
      0,
    ],
    [
      "Rising water near the Palar riverbank",
      "flood",
      "high",
      12.964,
      79.108,
      "Palar River",
      24,
    ],
    [
      "Power line down near residential area",
      "utilities",
      "critical",
      12.949,
      79.152,
      "Sathuvachari",
      12,
    ],
  ] as const;
  for (const [
    title,
    category,
    severity,
    latitude,
    longitude,
    location,
    peopleAffected,
  ] of samples) {
    const { Incident } = await import("./database.js");
    if (await Incident.findOne({ where: { title } })) continue;
    await createIncident(
      {
        title,
        category,
        jurisdictionCode: DEMO_JURISDICTION_CODE,
        severity,
        latitude,
        longitude,
        location,
        peopleAffected,
        description:
          "Development demonstration report. A response team is requested to assess conditions and assist people at the location.",
        anonymous: false,
        incidentTime: new Date().toISOString(),
        clientId: randomUUID(),
      },
      actor,
    );
  }
}
if (process.argv[1]?.endsWith("seed.ts")) {
  try {
    await seed();
    console.log(
      "Development data ready. Accounts: citizen/dispatcher/responder/supervisor/admin @resqcloud.test. Password comes from DEV_SEED_PASSWORD.",
    );
  } finally {
    await db.close();
  }
}
