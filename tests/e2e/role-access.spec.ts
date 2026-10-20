import { expect, test, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import type { IncidentView, Role } from "../../packages/shared/src/index.js";

const sampleIncident: IncidentView = {
  id: "sample-incident-1",
  trackingId: "RQC-2026-0042",
  title: "Vehicle collision near River Road",
  description: "Injury status has not been confirmed.",
  category: "accident",
  severity: "critical",
  status: "under_review",
  latitude: 12.97,
  longitude: 79.14,
  location: "River Road near Oak Bridge",
  peopleAffected: 2,
  anonymous: false,
  departmentId: 2,
  jurisdictionCode: "IN-TN",
  reporterId: "sample-citizen",
  assignedTo: null,
  createdAt: "2026-10-07T08:30:00.000Z",
  updatedAt: "2026-10-07T08:35:00.000Z",
  incidentTime: "2026-10-07T08:20:00.000Z",
};

async function stubWorkspaceApi(page: Page, role: Role) {
  const restrictedApiRequests: string[] = [];
  await page.addInitScript(
    ({ role, incident }) => {
      const requests: string[] = [];
      const adminMutations: Array<{
        path: string;
        method: string;
        body: unknown;
      }> = [];
      const adminRegions = [
        {
          code: "IN-TN",
          name: "Tamil Nadu",
          kind: "state",
          parentCode: "IN",
          active: true,
        },
        {
          code: "IN-TN01",
          name: "Sample District",
          kind: "district",
          parentCode: "IN-TN",
          active: false,
        },
      ];
      Object.assign(window, {
        __resqcloudApiRequests: requests,
        __resqcloudAdminMutations: adminMutations,
      });
      const browserFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = new URL(
          typeof input === "string" || input instanceof URL
            ? input.toString()
            : input.url,
          window.location.href,
        );
        if (!url.pathname.startsWith("/api/v1/"))
          return browserFetch(input, init);
        const path = url.pathname;
        requests.push(path);
        if (path.startsWith("/api/v1/admin/")) {
          if (role !== "admin") return new Response("{}", { status: 403 });
          const method = (init?.method ?? "GET").toUpperCase();
          if (method !== "GET") {
            adminMutations.push({
              path,
              method,
              body:
                typeof init?.body === "string" ? JSON.parse(init.body) : null,
            });
          }
          if (path === "/api/v1/admin/jurisdictions" && method === "POST") {
            const body = JSON.parse(String(init?.body ?? "{}"));
            const region = {
              code: `${body.parentCode}${body.localCode}`,
              name: body.name,
              kind: "district",
              parentCode: body.parentCode,
              active: false,
            };
            adminRegions.push(region);
            return new Response(JSON.stringify(region), {
              status: 201,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (
            path.startsWith("/api/v1/admin/jurisdictions/") &&
            method === "PATCH"
          ) {
            const region = adminRegions.find(
              (item) => item.code === path.split("/").at(-1),
            );
            if (region) region.active = JSON.parse(String(init?.body)).active;
            return new Response(JSON.stringify(region), {
              status: region ? 200 : 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          const payload =
            path === "/api/v1/admin/jurisdictions"
              ? adminRegions
              : path === "/api/v1/admin/configuration"
                ? [
                    {
                      key: "incident-policy",
                      value: { categories: ["fire", "medical"] },
                    },
                    {
                      key: "service-targets",
                      value: { high: 45, critical: 10 },
                    },
                  ]
                : path === "/api/v1/admin/dead-events"
                  ? []
                  : { ok: true };
          return new Response(JSON.stringify(payload), {
            status: method === "POST" ? 201 : 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        const payload =
          path === "/api/v1/departments"
            ? [
                { id: 1, name: "Fire & Rescue" },
                { id: 2, name: "Medical/Emergency Health" },
                { id: 3, name: "Police/Security" },
                { id: 4, name: "Municipal/Infrastructure" },
                { id: 5, name: "Utilities" },
                { id: 6, name: "Disaster Management" },
              ]
            : path === "/api/v1/auth/refresh"
              ? { accessToken: "browser-only-session" }
              : path === "/api/v1/auth/me"
                ? {
                    id: `sample-${role}`,
                    name: `Sample ${role}`,
                    email: `${role}@resqcloud.test`,
                    role,
                    departmentId:
                      role === "admin" || role === "citizen" ? null : 2,
                    jurisdictionCode:
                      role === "admin" || role === "citizen" ? null : "IN-TN",
                  }
                : path === "/api/v1/incidents"
                  ? { items: [incident], total: 1, page: 1, pageSize: 12 }
                  : path === "/api/v1/analytics"
                    ? {
                        total: 1,
                        open: 1,
                        critical: 1,
                        resolved: 0,
                        byCategory: [{ category: "accident", count: 1 }],
                        byStatus: [{ status: "under_review", count: 1 }],
                        responseSla: {
                          tracked: 1,
                          met: 0,
                          breached: 0,
                          overdue: 1,
                          pending: 0,
                          targetMinutes: { high: 45, critical: 10 },
                        },
                      }
                    : path === "/api/v1/jurisdictions"
                      ? [{ code: "IN-TN", name: "Tamil Nadu", kind: "state" }]
                      : { error: "No mock response is defined for this route" };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };
    },
    { role, incident: sampleIncident },
  );
  return async () => {
    const requests = await page.evaluate(
      () =>
        (window as unknown as Window & { __resqcloudApiRequests: string[] })
          .__resqcloudApiRequests,
    );
    restrictedApiRequests.push(
      ...requests.filter((path) => path.startsWith("/api/v1/admin/")),
    );
    return requests;
  };
}

test("operations overview is clear at desktop and mobile sizes", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Hydration failed")) {
      hydrationErrors.push(message.text());
    }
  });
  await page.setViewportSize({ width: 1505, height: 1045 });
  await stubWorkspaceApi(page, "dispatcher");
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Operations overview" }),
  ).toBeVisible();
  expect(hydrationErrors).toEqual([]);
  await expect(
    page.getByRole("heading", {
      name: "1 critical incident needs coordination",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Next actions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Priority queue" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: ".impeccable/review/desktop.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("list", { name: "Incident results" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: ".impeccable/review/mobile.png",
    fullPage: true,
  });
});

test("direct routes stay inside the signed-in role's workspace", async ({
  page,
}) => {
  const apiRequests = await stubWorkspaceApi(page, "dispatcher");
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", {
      name: "This workspace area is not available to your role",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  expect(
    (await apiRequests()).filter((path) => path.startsWith("/api/v1/admin/")),
  ).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("privacy notice is reachable without signing in", async ({ page }) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Privacy and data use" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Retention periods, legal basis, and the operating data controller have not yet been approved/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Return to ResQCloud" }),
  ).toHaveAttribute("href", "/");
});

test("admin can add and activate a district for reporting", async ({
  page,
}) => {
  await stubWorkspaceApi(page, "admin");
  await page.goto("/jurisdictions");
  await expect(
    page.getByRole("heading", { name: "Regional administration" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Sample District" }),
  ).toBeVisible();
  await page.getByLabel("District name").fill("New District");
  await page.getByLabel("Local code (1–3 letters or numbers)").fill("02");
  await page.getByLabel("State / union territory").selectOption("IN-TN");
  await page.getByRole("button", { name: "Add inactive district" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as Window & {
              __resqcloudAdminMutations: Array<{
                path: string;
                method: string;
                body: { localCode: string; parentCode: string; name: string };
              }>;
            }
          ).__resqcloudAdminMutations,
      ),
    )
    .toContainEqual({
      path: "/api/v1/admin/jurisdictions",
      method: "POST",
      body: { name: "New District", localCode: "02", parentCode: "IN-TN" },
    });
  await page
    .getByRole("row", { name: /New District/ })
    .getByRole("button", { name: "Activate" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as Window & {
              __resqcloudAdminMutations: Array<{
                path: string;
                method: string;
                body: { active: boolean };
              }>;
            }
          ).__resqcloudAdminMutations,
      ),
    )
    .toContainEqual({
      path: "/api/v1/admin/jurisdictions/IN-TN02",
      method: "PATCH",
      body: { active: true },
    });
});

test("admin can save active categories and response targets", async ({
  page,
}) => {
  await stubWorkspaceApi(page, "admin");
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Operational report policy" }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "flood" }).check();
  await page.getByLabel("fire department").selectOption("4");
  await page.getByLabel("High response target (minutes)").fill("45");
  await page.getByLabel("Critical response target (minutes)").fill("10");
  await page.getByRole("button", { name: "Save operational policy" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as Window & {
              __resqcloudAdminMutations: Array<{
                path: string;
                method: string;
              }>;
            }
          ).__resqcloudAdminMutations.filter(
            (mutation) => mutation.method === "PUT",
          ).length,
      ),
    )
    .toBe(1);
  const mutation = await page.evaluate(() =>
    (
      window as unknown as Window & {
        __resqcloudAdminMutations: Array<{
          path: string;
          method: string;
          body: {
            categories: string[];
            departmentsByCategory: Record<string, number>;
            targets: { high: number; critical: number };
          };
        }>;
      }
    ).__resqcloudAdminMutations.find(
      (item) => item.path === "/api/v1/admin/policy",
    ),
  );
  expect(mutation?.body.categories).toEqual(["fire", "medical", "flood"]);
  expect(mutation?.body.departmentsByCategory.fire).toBe(4);
  expect(mutation?.body.targets).toEqual({ high: 45, critical: 10 });
});

test("citizens do not fetch or see staff analytics on a direct route", async ({
  page,
}) => {
  const apiRequests = await stubWorkspaceApi(page, "citizen");
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", {
      name: "This workspace area is not available to your role",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "My reports" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Analytics" })).toHaveCount(0);
  const requests = await apiRequests();
  expect(requests.filter((path) => path === "/api/v1/analytics")).toEqual([]);
  expect(requests.filter((path) => path.startsWith("/api/v1/admin/"))).toEqual(
    [],
  );
});
