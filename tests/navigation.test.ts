import { describe, expect, it } from "vitest";
import type { Role } from "../packages/shared/src/index.js";
import {
  canAccessSection,
  navigationForRole,
  sections,
  type WorkspaceSection,
} from "../apps/web/features/workspace/sections.js";

const roles: Role[] = [
  "citizen",
  "responder",
  "dispatcher",
  "supervisor",
  "admin",
];

describe("workspace navigation access", () => {
  it("shows only routes allowed to each role", () => {
    for (const role of roles) {
      const visibleRoutes = navigationForRole(role).flatMap(
        (group) => group.items,
      );

      for (const section of visibleRoutes) {
        expect(canAccessSection(section, role), `${role} → ${section}`).toBe(
          true,
        );
      }
    }
  });

  it("keeps administrative and coordination tools out of personal roles", () => {
    const personalRoles: Role[] = ["citizen", "responder"];
    const staffOnly: WorkspaceSection[] = [
      "assignments",
      "escalations",
      "analytics",
      "users",
      "departments",
      "jurisdictions",
      "audit",
      "settings",
    ];

    for (const role of personalRoles) {
      for (const section of staffOnly) {
        expect(canAccessSection(section, role), `${role} → ${section}`).toBe(
          false,
        );
      }
    }

    for (const section of [
      "users",
      "departments",
      "jurisdictions",
      "audit",
      "settings",
    ] as const) {
      expect(canAccessSection(section, "dispatcher")).toBe(false);
      expect(canAccessSection(section, "supervisor")).toBe(false);
      expect(canAccessSection(section, "admin")).toBe(true);
    }
  });

  it("keeps reporting, tracking and public map available without sign-in", () => {
    for (const section of ["report", "tracking", "map"] as const) {
      expect(canAccessSection(section, null)).toBe(true);
    }
    expect(canAccessSection("settings", null)).toBe(false);
  });

  it("covers every defined route with an explicit access decision", () => {
    for (const section of Object.keys(sections) as WorkspaceSection[]) {
      expect(typeof canAccessSection(section, "admin")).toBe("boolean");
      expect(typeof canAccessSection(section, "citizen")).toBe("boolean");
    }
  });
});
