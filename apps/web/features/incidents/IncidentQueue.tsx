"use client";
import Link from "next/link";
import { Search, ArrowUpRight } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { IncidentView, Role } from "../../../../packages/shared/src/index";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Label } from "../../components/ui/Label";
interface QueueProps {
  section: string;
  role: Role;
  total: number;
  items: IncidentView[];
  loading: boolean;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  search: string;
  setSearch: (s: string) => void;
  severity: string;
  setSeverity: (s: string) => void;
  status: string;
  setStatus: (s: string) => void;
  setSelected: (id: string) => void;
}
export function IncidentQueue({
  section,
  role,
  total,
  items,
  loading,
  page,
  setPage,
  search,
  setSearch,
  severity,
  setSeverity,
  status,
  setStatus,
  setSelected,
}: QueueProps) {
  return (
    <section className="panel queue-panel" aria-busy={loading}>
      <div className="section-title">
        <div>
          <h2 id="incident-queue-heading" tabIndex={-1}>
            {role === "citizen"
              ? "Your reports"
              : role === "responder"
                ? "Assigned incidents"
                : section === "overview"
                  ? "Priority queue"
                  : section === "escalations"
                    ? "Escalated incidents"
                    : "Incident queue"}
          </h2>
          <p className="muted small">
            {total} reports in your authorized scope
          </p>
        </div>
        {section === "overview" && (
          <Link className="text-link" href="/incidents">
            View all incidents <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      <div className="filters">
        <div className="search-field">
          <Search size={18} />
          <Label className="sr-only" htmlFor="incident-search">
            Search incidents
          </Label>
          <Input
            id="incident-search"
            placeholder="Search title or tracking ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label>
          <span className="sr-only">Filter severity</span>
          <Select
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All severities</option>
            {["critical", "high", "medium", "low"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Filter status</span>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {[
              "reported",
              "under_review",
              "verified",
              "severity_assessed",
              "assigned",
              "responding",
              "resolved",
              "closed",
              "escalated",
            ].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <p className="table-hint" id="incident-table-hint">
        Open a report to see its response history and available actions.
      </p>
      <div
        className="table-wrap desktop-incident-table"
        role="region"
        aria-label="Incident results"
        aria-describedby="incident-table-hint"
        tabIndex={0}
      >
        <table>
          <caption className="sr-only">
            Incidents in your operational scope
          </caption>
          <thead>
            <tr>
              <th>Incident</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Location</th>
              <th>Reported</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <Button
                    variant="ghost"
                    className="incident-link h-auto min-h-11 justify-start bg-transparent px-0 py-1 text-left font-semibold text-foreground shadow-none hover:bg-transparent hover:text-primary"
                    onClick={() => setSelected(i.id)}
                  >
                    {i.title}
                  </Button>
                  <small>
                    {i.trackingId} · {i.category}
                  </small>
                </td>
                <td>
                  <Badge variant={i.severity}>{i.severity}</Badge>
                </td>
                <td>
                  <span className="status-label">
                    {i.status.replaceAll("_", " ")}
                  </span>
                </td>
                <td>{i.location}</td>
                <td className="nowrap">
                  {new Date(i.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </td>
                <td>
                  <Button
                    variant="ghost"
                    className="icon-button size-11 p-0"
                    aria-label={`Open ${i.title}`}
                    onClick={() => setSelected(i.id)}
                  >
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mobile-incident-list" aria-label="Incident results">
        {items.map((incident) => (
          <li className="mobile-incident" key={incident.id}>
            <div className="mobile-incident-heading">
              <div>
                <strong>{incident.title}</strong>
                <small>
                  {incident.trackingId} · {incident.category}
                </small>
              </div>
              <Badge variant={incident.severity}>{incident.severity}</Badge>
            </div>
            <div className="mobile-incident-meta">
              <span className="status-label">
                {incident.status.replaceAll("_", " ")}
              </span>
              <span>{incident.location}</span>
              <time dateTime={incident.createdAt}>
                {new Date(incident.createdAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </time>
            </div>
            <Button
              variant="secondary"
              onClick={() => setSelected(incident.id)}
            >
              Open incident
            </Button>
          </li>
        ))}
      </ul>
      {loading && (
        <p className="queue-status" role="status">
          Updating incidents…
        </p>
      )}
      {!items.length && !loading && (
        <EmptyState
          title={
            search || severity || status
              ? "No matching incidents"
              : "No incidents to show"
          }
          description={
            search || severity || status
              ? "Try a different search or clear the filters to see more reports."
              : "Reports available to your role will appear here."
          }
          action={
            search || severity || status ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setSeverity("");
                  setStatus("");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : section === "escalations" ? (
              <Button asChild variant="secondary">
                <Link href="/incidents">View incident queue</Link>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <Link href="/report">Report an incident</Link>
              </Button>
            )
          }
        />
      )}
      <footer className="table-footer">
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / 12))}
        </span>
        <div>
          <Button
            variant="ghost"
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={page * 12 >= total || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </footer>
    </section>
  );
}
