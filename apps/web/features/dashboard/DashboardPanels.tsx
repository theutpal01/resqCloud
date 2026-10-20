"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Activity,
  ClipboardList,
  TriangleAlert,
  CheckCircle2,
  ArrowUpRight,
  Clock3,
} from "lucide-react";
import type { Role } from "../../../../packages/shared/src/index";
import type { Metrics, MetricsDateRange } from "../workspace/useWorkspace";
import { download } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { EmptyState } from "../../components/ui/EmptyState";
import { SituationBrief } from "./SituationBrief";
export function MetricsStrip({
  section,
  metrics,
  role,
  setSeverity,
  setStatus,
  setPage,
}: {
  section: string;
  metrics: Metrics;
  role: Role;
  setSeverity: (s: string) => void;
  setStatus: (s: string) => void;
  setPage: (n: number) => void;
}) {
  const openQueue = (nextStatus: string, nextSeverity: string) => {
    setStatus(nextStatus);
    setSeverity(nextSeverity);
    setPage(1);
    document.getElementById("incident-queue-heading")?.focus();
  };
  const newReports = Number(
    metrics.byStatus.find((item) => item.status === "reported")?.count ?? 0,
  );
  const verifiedReports = Number(
    metrics.byStatus.find((item) => item.status === "verified")?.count ?? 0,
  );

  return (
    <div
      className={
        section === "overview"
          ? "overview-layout"
          : section === "analytics"
            ? "analytics-metrics"
            : undefined
      }
    >
      <div className="overview-primary">
        {section === "overview" && (
          <SituationBrief
            metrics={metrics}
            role={role}
            onReview={() =>
              openQueue(
                "",
                role !== "citizen" && metrics.critical ? "critical" : "",
              )
            }
          />
        )}
        <div className="metrics" aria-label="Incident totals">
          {[
            {
              label: "Open incidents",
              value: metrics.open,
              icon: ClipboardList,
              detail: "Awaiting resolution",
              style: "blue",
            },
            {
              label: "Critical priority",
              value: metrics.critical,
              icon: TriangleAlert,
              detail: "Needs immediate attention",
              style: "red",
            },
            {
              label: "Resolved incidents",
              value: metrics.resolved,
              icon: CheckCircle2,
              detail: "Resolved or closed",
              style: "green",
            },
            {
              label: "Total reports",
              value: metrics.total,
              icon: Activity,
              detail: "Across your operational scope",
              style: "neutral",
            },
            {
              label: "Response target overdue",
              value: metrics.responseSla.overdue,
              icon: Clock3,
              detail: "High or critical reports awaiting first response",
              style: "red",
            },
          ].map((m) => (
            <section className="metric" key={m.label}>
              <div>
                <span className={`metric-icon ${m.style}`}>
                  <m.icon size={16} aria-hidden="true" />
                </span>
                <span>{m.label}</span>
              </div>
              <strong>{m.value.toString().padStart(2, "0")}</strong>
              <p>{m.detail}</p>
            </section>
          ))}
        </div>
      </div>
      {section === "overview" && !["citizen", "responder"].includes(role) && (
        <aside
          className="panel next-actions"
          aria-labelledby="next-actions-title"
        >
          <h2 id="next-actions-title">Next actions</h2>
          <ul>
            <li>
              <Button
                variant="ghost"
                className="next-action h-auto w-full justify-start rounded-[var(--radius-sm)] border-0 bg-transparent px-1 py-3 text-left font-normal text-foreground shadow-none hover:bg-background"
                onClick={() =>
                  openQueue("", metrics.critical ? "critical" : "")
                }
              >
                <TriangleAlert size={19} aria-hidden="true" />
                <span>
                  <strong>
                    {metrics.critical
                      ? `Review ${metrics.critical} critical ${metrics.critical === 1 ? "report" : "reports"}`
                      : "Review the incident queue"}
                  </strong>
                  <small>Confirm details and coordinate the response.</small>
                </span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                className="next-action h-auto w-full justify-start rounded-[var(--radius-sm)] border-0 bg-transparent px-1 py-3 text-left font-normal text-foreground shadow-none hover:bg-background"
                onClick={() =>
                  openQueue(
                    verifiedReports ? "verified" : newReports ? "reported" : "",
                    "",
                  )
                }
              >
                <CheckCircle2 size={19} aria-hidden="true" />
                <span>
                  <strong>
                    {verifiedReports
                      ? `Assign ${verifiedReports} verified ${verifiedReports === 1 ? "report" : "reports"}`
                      : newReports
                        ? `Review ${newReports} new ${newReports === 1 ? "report" : "reports"}`
                        : "Check incident progress"}
                  </strong>
                  <small>
                    Open the relevant reports and choose a next step.
                  </small>
                </span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </Button>
            </li>
          </ul>
        </aside>
      )}
    </div>
  );
}
export function AnalyticsCharts({
  metrics,
  setError,
  metricsDateRange,
  onApplyDateRange,
  isLoading,
}: {
  metrics: Metrics;
  setError: (s: string) => void;
  metricsDateRange: MetricsDateRange;
  onApplyDateRange: (range: MetricsDateRange) => void;
  isLoading: boolean;
}) {
  const [from, setFrom] = useState(metricsDateRange.from);
  const [to, setTo] = useState(metricsDateRange.to);
  const [rangeError, setRangeError] = useState("");
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    setFrom(metricsDateRange.from);
    setTo(metricsDateRange.to);
  }, [metricsDateRange.from, metricsDateRange.to]);
  const applyDateRange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (from && to && from > to) {
      setRangeError("Choose a start date on or before the end date.");
      return;
    }
    setRangeError("");
    onApplyDateRange({ from, to });
  };
  const exportQuery = new URLSearchParams();
  if (metricsDateRange.from) exportQuery.set("from", metricsDateRange.from);
  if (metricsDateRange.to) exportQuery.set("to", metricsDateRange.to);
  const exportSuffix = exportQuery.toString();
  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return "No recorded durations";
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) return `${hours} hr ${remainingMinutes} min`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ${hours % 24} hr`;
  };
  const groups = [
    {
      title: "Reports by category",
      rows: metrics.byCategory.map((row) => ({
        label: row.category.replaceAll("_", " "),
        count: Number(row.count),
      })),
    },
    {
      title: "Reports by status",
      rows: metrics.byStatus.map((row) => ({
        label: row.status.replaceAll("_", " "),
        count: Number(row.count),
      })),
    },
  ];
  const rangeLabel =
    metricsDateRange.from || metricsDateRange.to
      ? `${metricsDateRange.from || "Earliest"} – ${metricsDateRange.to || "Latest"}`
      : "All report dates";

  return (
    <div className="bottom-grid analytics-grid" aria-busy={isLoading}>
      {isLoading && (
        <p className="analytics-updating" role="status">
          Updating analytics…
        </p>
      )}
      <form className="panel analytics-filter" onSubmit={applyDateRange}>
        <div className="analytics-panel-heading">
          <div>
            <h2>Report date range</h2>
            <p>Filter by the date each report was created (UTC).</p>
          </div>
          <span className="analytics-range-badge">{rangeLabel}</span>
        </div>
        <div className="form-grid">
          <div>
            <Label htmlFor="range-from">From</Label>
            <Input
              id="range-from"
              type="date"
              value={from}
              max={to || undefined}
              disabled={isLoading}
              aria-invalid={!!rangeError}
              aria-describedby={
                rangeError ? "analytics-range-error" : undefined
              }
              onChange={(event) => {
                setFrom(event.target.value);
                setRangeError("");
              }}
            />
          </div>
          <div>
            <Label htmlFor="range-to">To</Label>
            <Input
              id="range-to"
              type="date"
              value={to}
              min={from || undefined}
              disabled={isLoading}
              aria-invalid={!!rangeError}
              aria-describedby={
                rangeError ? "analytics-range-error" : undefined
              }
              onChange={(event) => {
                setTo(event.target.value);
                setRangeError("");
              }}
            />
          </div>
        </div>
        {rangeError && (
          <p
            id="analytics-range-error"
            className="mt-2 text-sm text-destructive"
            role="alert"
          >
            {rangeError}
          </p>
        )}
        <div className="button-row">
          <Button type="submit" variant="secondary" disabled={isLoading}>
            {isLoading ? "Updating…" : "Apply dates"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isLoading}
            onClick={() => {
              setFrom("");
              setTo("");
              setRangeError("");
              onApplyDateRange({ from: "", to: "" });
            }}
          >
            Clear dates
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={exporting || isLoading}
            onClick={async () => {
              setExporting(true);
              try {
                await download(
                  `/incidents/export${exportSuffix ? `?${exportSuffix}` : ""}`,
                  "resqcloud-incidents.csv",
                );
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not export incidents.",
                );
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? "Preparing CSV…" : "Export incidents (CSV)"}
          </Button>
        </div>
      </form>
      <section className="panel" aria-labelledby="response-times-title">
        <div className="analytics-panel-heading">
          <div>
            <h2 id="response-times-title">Response times</h2>
            <p>Average time from report creation to each recorded milestone.</p>
          </div>
        </div>
        <div className="chart-row">
          <div>
            <span>First responder activity</span>
            <strong>
              {formatDuration(metrics.responseTime.averageSeconds)}
            </strong>
          </div>
          <small>
            {metrics.responseTime.count} reports with recorded response time
          </small>
        </div>
        <div className="chart-row">
          <div>
            <span>Resolution</span>
            <strong>
              {formatDuration(metrics.resolutionTime.averageSeconds)}
            </strong>
          </div>
          <small>
            {metrics.resolutionTime.count} reports with recorded resolution time
          </small>
        </div>
      </section>
      {groups.map((group) => (
        <section className="panel analytics-breakdown" key={group.title}>
          <div className="analytics-panel-heading">
            <div>
              <h2>{group.title}</h2>
              <p>{metrics.total.toLocaleString()} reports in this view</p>
            </div>
          </div>
          {!group.rows.length && (
            <EmptyState
              title={
                metrics.total === 0
                  ? "No reports in this date range"
                  : "No breakdown available"
              }
              description={
                metrics.total === 0
                  ? "Try a wider date range to include more incidents."
                  : "There are no records to display for this breakdown."
              }
              action={
                metrics.total === 0 ? (
                  <Link href="/report" className="text-link">
                    Report an incident{" "}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                ) : undefined
              }
            />
          )}
          {[...group.rows]
            .sort((a, b) => b.count - a.count)
            .map((r) => (
              <div className="chart-row" key={r.label}>
                <div>
                  <span>{r.label}</span>
                  <strong>{r.count.toLocaleString()}</strong>
                </div>
                <progress
                  className="analytics-progress"
                  max={Math.max(metrics.total, 1)}
                  value={r.count}
                  aria-label={`${r.label}: ${r.count} reports`}
                />
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
