"use client";
import { useState, useEffect, useCallback } from "react";
import { api, post } from "../../lib/api";
import { useAuth } from "../../components/providers/AuthProvider";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  categories as supportedCategories,
  categoryDepartment as defaultCategoryDepartments,
} from "../../../../packages/shared/src/index";
interface JurisdictionOption {
  code: string;
  name: string;
  kind: "state" | "union_territory" | "district";
}
interface DepartmentOption {
  id: number;
  name: string;
}
interface AdminEdit {
  role: string;
  departmentId: string;
  jurisdictionCode: string;
}
interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  enabled: boolean;
  departmentId: number | null;
  jurisdictionCode: string | null;
}
interface JurisdictionRecord {
  code: string;
  name: string;
  kind: "state" | "union_territory" | "district";
  parentCode: string | null;
  active: boolean;
}
interface ConfigurationRecord {
  key: string;
  value: Record<string, unknown>;
}
function formatDate(value: unknown) {
  if (typeof value !== "string") return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
function readableEvent(value: unknown) {
  return String(value ?? "System event")
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function shortId(value: unknown) {
  const id = String(value ?? "");
  return id.length > 20 ? `…${id.slice(-8)}` : id;
}
export function AdminPanel({ section }: { section: string }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [jurisdictions, setJurisdictions] = useState<JurisdictionOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [regions, setRegions] = useState<JurisdictionRecord[]>([]);
  const [configurations, setConfigurations] = useState<ConfigurationRecord[]>(
    [],
  );
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [edits, setEdits] = useState<Record<string, AdminEdit>>({});
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      if (section === "users") {
        const [nextUsers, nextJurisdictions, nextDepartments] =
          await Promise.all([
            api<AdminUser[]>("/admin/users"),
            api<JurisdictionOption[]>("/jurisdictions"),
            api<DepartmentOption[]>("/departments"),
          ]);
        setUsers(nextUsers);
        setJurisdictions(nextJurisdictions);
        setDepartments(nextDepartments);
      } else if (section === "jurisdictions") {
        setRegions(await api<JurisdictionRecord[]>("/admin/jurisdictions"));
      } else if (section === "settings") {
        const [events, configRows, nextDepartments] = await Promise.all([
          api<Record<string, unknown>[]>("/admin/dead-events"),
          api<ConfigurationRecord[]>("/admin/configuration"),
          api<DepartmentOption[]>("/departments"),
        ]);
        setRows(events);
        setConfigurations(configRows);
        setDepartments(nextDepartments);
        setSettingsLoaded(true);
      } else
        setRows(
          await api(
            section === "departments"
              ? "/departments"
              : section === "audit"
                ? "/admin/audit"
                : "/admin/dead-events",
          ),
        );
    } catch (e) {
      setError((e as Error).message);
      if (section === "settings") setSettingsLoaded(true);
    }
  }, [section]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const savedPolicy =
    configurations.find((item) => item.key === "incident-policy") ??
    configurations.find((item) => item.key === "incident-policy-draft");
  const savedCategories = savedPolicy?.value?.categories;
  const selectedCategories =
    Array.isArray(savedCategories) && savedCategories.length > 0
      ? savedCategories.filter(
          (category): category is (typeof supportedCategories)[number] =>
            (supportedCategories as readonly string[]).includes(
              String(category),
            ),
        )
      : [...supportedCategories];
  const savedDepartmentMap = savedPolicy?.value?.departmentsByCategory;
  const categoryDepartmentDefaults = Object.fromEntries(
    supportedCategories.map((category) => {
      const saved =
        savedDepartmentMap && typeof savedDepartmentMap === "object"
          ? (savedDepartmentMap as Record<string, unknown>)[category]
          : undefined;
      return [
        category,
        Number.isInteger(saved) && Number(saved) > 0
          ? Number(saved)
          : defaultCategoryDepartments[category],
      ];
    }),
  );
  if (user?.role !== "admin")
    return (
      <section className="panel">
        <h2>Administrator access required</h2>
      </section>
    );
  return (
    <section className="panel">
      <h2>
        {section === "settings"
          ? "System settings"
          : section === "users"
            ? "Authority and citizen accounts"
            : section === "departments"
              ? "Response departments"
              : section === "jurisdictions"
                ? "State, territory, and district catalog"
                : "Recent audit events"}
      </h2>
      {error && (
        <Alert role="alert" variant="destructive">
          {error}
        </Alert>
      )}
      {section === "jurisdictions" && (
        <>
          <div className="action-panel">
            <h3>Add a district record</h3>
            <p className="muted">
              Add the approved district name and a short local code. Activate
              the record after confirming it is ready for report selection and
              authority assignment.
            </p>
            <form
              className="form-grid"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const values = new FormData(form);
                try {
                  await post("/admin/jurisdictions", {
                    name: values.get("districtName"),
                    localCode: values.get("districtCode"),
                    parentCode: values.get("parentCode"),
                  });
                  form.reset();
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <div>
                <label htmlFor="district-name">District name</label>
                <Input
                  id="district-name"
                  name="districtName"
                  required
                  minLength={2}
                  maxLength={120}
                />
              </div>
              <div>
                <label htmlFor="district-code">
                  Local code (1–3 letters or numbers)
                </label>
                <Input
                  id="district-code"
                  name="districtCode"
                  required
                  minLength={1}
                  maxLength={3}
                  pattern="[A-Za-z0-9]+"
                />
              </div>
              <div>
                <label htmlFor="parent-code">State / union territory</label>
                <Select
                  id="parent-code"
                  name="parentCode"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a parent
                  </option>
                  {regions
                    .filter(
                      (r) => r.parentCode === "IN" && r.kind !== "district",
                    )
                    .map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name} · {r.code}
                      </option>
                    ))}
                </Select>
              </div>
              <Button type="submit">Add inactive district</Button>
            </form>
          </div>
          <div className="table-wrap">
            <table className="user-table">
              <caption className="sr-only">Regional catalog</caption>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Kind</th>
                  <th>Parent</th>
                  <th>Routing status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((region) => (
                  <tr key={region.code}>
                    <td>{region.name}</td>
                    <td>{region.code}</td>
                    <td>{region.kind.replace("_", " ")}</td>
                    <td>{region.parentCode ?? "—"}</td>
                    <td>
                      {region.kind === "district"
                        ? region.active
                          ? "Active · available for reporting and routing"
                          : "Inactive · unavailable for reporting"
                        : "Catalog entry · not verified"}
                    </td>
                    {region.kind === "district" && (
                      <td>
                        <Button
                          type="button"
                          variant={region.active ? "secondary" : "default"}
                          onClick={async () => {
                            try {
                              await api(`/admin/jurisdictions/${region.code}`, {
                                method: "PATCH",
                                body: JSON.stringify({
                                  active: !region.active,
                                }),
                              });
                              await refresh();
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          {region.active ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    )}
                    {region.kind !== "district" && <td>—</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Alert variant="warning">
            Reports are routed using the area selected by the reporter, then
            scoped to authorities assigned to that area. This catalog has no
            district boundary geometry and does not infer an area from map
            coordinates.
          </Alert>
        </>
      )}
      {section === "settings" && (
        <section
          className="action-panel"
          aria-labelledby="policy-settings-title"
        >
          <h3 id="policy-settings-title">Operational report policy</h3>
          <p className="muted">
            Accepted categories control report submission. High and critical
            response targets measure time from submission until the incident
            first enters “responding” status; overdue unresponded reports appear
            in the operational metrics.
          </p>
          {!settingsLoaded ? (
            <p role="status">Loading operational policy…</p>
          ) : (
            <form
              className="form-grid"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                setSavingPolicy(true);
                try {
                  const categories = data.getAll("categories").map(String);
                  const departmentsByCategory = Object.fromEntries(
                    supportedCategories.map((category) => [
                      category,
                      Number(data.get(`department-${category}`)),
                    ]),
                  );
                  const serviceTargets = {
                    high: Number(data.get("targetHigh")),
                    critical: Number(data.get("targetCritical")),
                  };
                  await api("/admin/policy", {
                    method: "PUT",
                    body: JSON.stringify({
                      categories,
                      departmentsByCategory,
                      targets: serviceTargets,
                    }),
                  });
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setSavingPolicy(false);
                }
              }}
            >
              <fieldset className="col-span-full">
                <legend>Accepted categories and routing departments</legend>
                <p className="muted">
                  Select the categories reporters may submit and the department
                  that receives each category.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {supportedCategories.map((category) => (
                    <div key={category} className="form-grid">
                      <label>
                        <input
                          type="checkbox"
                          name="categories"
                          value={category}
                          defaultChecked={selectedCategories.includes(category)}
                        />{" "}
                        {category}
                      </label>
                      <Select
                        aria-label={`${category} department`}
                        name={`department-${category}`}
                        defaultValue={String(
                          categoryDepartmentDefaults[category],
                        )}
                      >
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="target-high">
                  High response target (minutes)
                </label>
                <Input
                  id="target-high"
                  name="targetHigh"
                  type="number"
                  min={1}
                  defaultValue={String(
                    (
                      configurations.find((c) => c.key === "service-targets") ??
                      configurations.find(
                        (c) => c.key === "service-targets-draft",
                      )
                    )?.value?.high ?? 60,
                  )}
                />
              </div>
              <div>
                <label htmlFor="target-critical">
                  Critical response target (minutes)
                </label>
                <Input
                  id="target-critical"
                  name="targetCritical"
                  type="number"
                  min={1}
                  defaultValue={String(
                    (
                      configurations.find((c) => c.key === "service-targets") ??
                      configurations.find(
                        (c) => c.key === "service-targets-draft",
                      )
                    )?.value?.critical ?? 15,
                  )}
                />
              </div>
              <Button type="submit" disabled={savingPolicy}>
                {savingPolicy ? "Saving…" : "Save operational policy"}
              </Button>
            </form>
          )}
        </section>
      )}
      {section === "users" ? (
        <>
          <div className="table-wrap user-table-wrap">
            <table className="user-table">
              <caption className="sr-only">Registered users</caption>
              <thead>
                <tr>
                  <th>Name and email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>State/UT</th>
                  <th>Access</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    {(() => {
                      const edit = edits[u.id] ?? {
                        role: u.role,
                        departmentId: u.departmentId?.toString() ?? "",
                        jurisdictionCode: u.jurisdictionCode ?? "",
                      };
                      const authority = [
                        "dispatcher",
                        "responder",
                        "supervisor",
                      ].includes(edit.role);
                      return (
                        <>
                          <td
                            className="user-identity"
                            data-label="Name and email"
                          >
                            <strong>{u.name}</strong>
                            <small>{u.email}</small>
                          </td>
                          <td data-label="Role">
                            <label className="sr-only" htmlFor={`role-${u.id}`}>
                              Role for {u.name}
                            </label>
                            <Select
                              id={`role-${u.id}`}
                              value={edit.role}
                              onChange={(event) =>
                                setEdits((current) => ({
                                  ...current,
                                  [u.id]: {
                                    ...edit,
                                    role: event.target.value,
                                    ...(event.target.value === "citizen" ||
                                    event.target.value === "admin"
                                      ? {
                                          departmentId: "",
                                          jurisdictionCode: "",
                                        }
                                      : {}),
                                  },
                                }))
                              }
                            >
                              {[
                                "citizen",
                                "dispatcher",
                                "responder",
                                "supervisor",
                                "admin",
                              ].map((role) => (
                                <option key={role} value={role}>
                                  {role === "admin"
                                    ? "Admin"
                                    : role.charAt(0).toUpperCase() +
                                      role.slice(1)}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td data-label="Department">
                            <label
                              className="sr-only"
                              htmlFor={`department-${u.id}`}
                            >
                              Department for {u.name}
                            </label>
                            <Select
                              id={`department-${u.id}`}
                              value={edit.departmentId}
                              disabled={!authority}
                              onChange={(event) =>
                                setEdits((current) => ({
                                  ...current,
                                  [u.id]: {
                                    ...edit,
                                    departmentId: event.target.value,
                                  },
                                }))
                              }
                            >
                              <option value="">No department</option>
                              {departments.map((department) => (
                                <option
                                  key={department.id}
                                  value={department.id}
                                >
                                  {department.name
                                    .replace(
                                      "Medical/Emergency Health",
                                      "Medical / Health",
                                    )
                                    .replace(
                                      "Municipal/Infrastructure",
                                      "Municipal / Infrastructure",
                                    )}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td data-label="State/UT">
                            <label
                              className="sr-only"
                              htmlFor={`jurisdiction-${u.id}`}
                            >
                              State or union territory for {u.name}
                            </label>
                            <Select
                              id={`jurisdiction-${u.id}`}
                              value={edit.jurisdictionCode}
                              disabled={!authority}
                              onChange={(event) =>
                                setEdits((current) => ({
                                  ...current,
                                  [u.id]: {
                                    ...edit,
                                    jurisdictionCode: event.target.value,
                                  },
                                }))
                              }
                            >
                              <option value="">No jurisdiction</option>
                              {jurisdictions.map((jurisdiction) => (
                                <option
                                  key={jurisdiction.code}
                                  value={jurisdiction.code}
                                >
                                  {jurisdiction.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td data-label="Access">
                            {u.enabled ? "Enabled" : "Disabled"}
                          </td>
                          <td data-label="Actions">
                            <div className="button-row user-actions">
                              <Button
                                variant="secondary"
                                disabled={
                                  u.id === user.id ||
                                  (authority &&
                                    (!edit.departmentId ||
                                      !edit.jurisdictionCode))
                                }
                                onClick={async () => {
                                  try {
                                    await api(`/admin/users/${u.id}`, {
                                      method: "PATCH",
                                      body: JSON.stringify({
                                        role: edit.role,
                                        departmentId: authority
                                          ? Number(edit.departmentId)
                                          : null,
                                        jurisdictionCode: authority
                                          ? edit.jurisdictionCode
                                          : null,
                                      }),
                                    });
                                    setEdits((current) => {
                                      const next = { ...current };
                                      delete next[u.id];
                                      return next;
                                    });
                                    refresh();
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              >
                                Save changes
                              </Button>
                              <Button
                                variant="secondary"
                                disabled={u.id === user.id}
                                onClick={async () => {
                                  try {
                                    await api(`/admin/users/${u.id}`, {
                                      method: "PATCH",
                                      body: JSON.stringify({
                                        enabled: !u.enabled,
                                      }),
                                    });
                                    refresh();
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              >
                                {u.enabled ? "Disable" : "Enable"}
                              </Button>
                            </div>
                          </td>
                        </>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            className="action-panel"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              try {
                await post("/admin/users", {
                  name: f.get("name"),
                  email: f.get("email"),
                  password: f.get("password"),
                  role: f.get("role"),
                  departmentId: Number(f.get("departmentId")),
                  jurisdictionCode: String(f.get("jurisdictionCode") ?? ""),
                });
                form.reset();
                refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <h3>Create authority account</h3>
            <div className="form-grid">
              {[
                ["name", "Full name", "text"],
                ["email", "Email", "email"],
                ["password", "Temporary password (12+ characters)", "password"],
              ].map(([name, label, type]) => (
                <div key={name}>
                  <label htmlFor={`new-${name}`}>{label}</label>
                  <Input
                    id={`new-${name}`}
                    name={name}
                    type={type}
                    required
                    minLength={name === "password" ? 12 : 2}
                  />
                </div>
              ))}
              <div>
                <label htmlFor="new-role">Role</label>
                <Select id="new-role" name="role">
                  {["dispatcher", "responder", "supervisor"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="new-jurisdiction">
                  State / union territory
                </label>
                <Select
                  id="new-jurisdiction"
                  name="jurisdictionCode"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a state/UT
                  </option>
                  {jurisdictions.map((jurisdiction) => (
                    <option key={jurisdiction.code} value={jurisdiction.code}>
                      {jurisdiction.name} · {jurisdiction.code}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="new-department">Department</label>
                <Select id="new-department" name="departmentId">
                  {[
                    "Fire & Rescue",
                    "Medical/Emergency Health",
                    "Police/Security",
                    "Municipal/Infrastructure",
                    "Utilities",
                    "Disaster Management",
                  ].map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Button>Create account</Button>
          </form>
        </>
      ) : (
        <>
          {rows.map((r) => (
            <article
              className={`list-row admin-record ${section === "departments" ? "department-record" : ""}`}
              key={String(r.id)}
            >
              <div>
                <strong>
                  {section === "audit"
                    ? readableEvent(r.action ?? r.eventType)
                    : String(
                        r.name ?? r.action ?? r.eventType ?? "System event",
                      )}
                </strong>
                {section === "departments" ? (
                  <small>
                    Added{" "}
                    <time dateTime={String(r.createdAt ?? "")}>
                      {formatDate(r.createdAt)}
                    </time>
                  </small>
                ) : (
                  <small>
                    <time dateTime={String(r.createdAt ?? "")}>
                      {formatDate(r.createdAt)}
                    </time>
                    {r.resourceId ? ` · Record ${shortId(r.resourceId)}` : ""}
                  </small>
                )}
              </div>
              {section === "settings" && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await post(`/admin/dead-events/${r.id}/retry`);
                      refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Retry delivery
                </Button>
              )}
            </article>
          ))}
          {!rows.length && !error && (
            <EmptyState
              title={
                section === "settings"
                  ? "No failed deliveries"
                  : section === "departments"
                    ? "No departments found"
                    : "No audit events yet"
              }
              description={
                section === "settings"
                  ? "Failed event deliveries will appear here with an option to retry them."
                  : section === "departments"
                    ? "Response departments will appear here once they are configured."
                    : "Recorded account and incident actions will appear here."
              }
            />
          )}
        </>
      )}
    </section>
  );
}
