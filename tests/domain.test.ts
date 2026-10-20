import { describe, it, expect } from "vitest";
import {
  canTransition,
  reportSchema,
  publicIncident,
  distanceKm,
  type IncidentView,
} from "../packages/shared/src/index.js";
describe("incident policy", () => {
  it("does not permit arbitrary transitions", () => {
    expect(canTransition("dispatcher", "reported", "closed")).toBe(false);
    expect(canTransition("citizen", "reported", "under_review")).toBe(false);
    expect(canTransition("dispatcher", "reported", "under_review")).toBe(true);
    expect(canTransition("dispatcher", "resolved", "closed")).toBe(false);
    expect(canTransition("supervisor", "resolved", "closed")).toBe(true);
  });
  it("restricts responders to response work", () => {
    expect(canTransition("responder", "assigned", "responding")).toBe(true);
    expect(canTransition("responder", "responding", "resolved")).toBe(true);
    expect(canTransition("responder", "reported", "verified")).toBe(false);
  });
  it("rejects malformed reports", () => {
    expect(
      reportSchema.safeParse({ latitude: 999, longitude: 0 }).success,
    ).toBe(false);
  });
  it("measures proximity", () => {
    expect(
      distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }),
    ).toBe(0);
    expect(
      distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }),
    ).toBeCloseTo(111.19, 1);
  });
  it("public projection excludes sensitive fields", () => {
    const p = publicIncident({
      trackingId: "RQC",
      category: "medical",
      severity: "high",
      status: "verified",
      latitude: 12.9692,
      longitude: 79.1559,
      updatedAt: "now",
      contact: "private",
      reporterId: "secret",
      description: "private",
    } as IncidentView);
    expect(p).not.toHaveProperty("contact");
    expect(p).not.toHaveProperty("reporterId");
    expect(p).not.toHaveProperty("description");
    expect(p.latitude).toBe(12.97);
  });
});
