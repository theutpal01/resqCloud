"use client";
import { ArrowUpRight, CheckCircle2, TriangleAlert } from "lucide-react";
import { Button } from "../../components/ui/Button";
import type { Role } from "../../../../packages/shared/src/index";
import type { Metrics } from "../workspace/useWorkspace";

export function SituationBrief({
  metrics,
  role,
  onReview,
}: {
  metrics: Metrics;
  role: Role;
  onReview: () => void;
}) {
  const hasCritical = metrics.critical > 0;
  const isCitizen = role === "citizen";
  const isResponder = role === "responder";
  const title = isCitizen
    ? metrics.open
      ? `${metrics.open} of your reports are still open`
      : "Your reports are up to date"
    : isResponder
      ? hasCritical
        ? `${metrics.critical} critical assigned ${metrics.critical === 1 ? "incident needs" : "incidents need"} attention`
        : `${metrics.open} assigned ${metrics.open === 1 ? "incident is" : "incidents are"} still open`
      : hasCritical
        ? `${metrics.critical} critical ${metrics.critical === 1 ? "incident needs" : "incidents need"} coordination`
        : "The response is moving steadily";
  const description = isCitizen
    ? "Open a report to see its latest recorded progress."
    : isResponder
      ? "Review assigned incidents and record your response progress."
      : hasCritical
        ? "Review the highest-priority reports and decide the next step."
        : "Review new reports, verify details, and keep each response on track.";
  const actionLabel = isCitizen
    ? "View your reports"
    : isResponder
      ? "Review assigned incidents"
      : hasCritical
        ? "Review critical reports"
        : "Open incident queue";

  return (
    <section
      className="situation-brief"
      aria-labelledby="situation-title"
      data-priority={hasCritical ? "urgent" : "steady"}
    >
      <div className="situation-copy">
        <div className="situation-title-row">
          {hasCritical ? (
            <TriangleAlert size={22} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={22} aria-hidden="true" />
          )}
          <h2 id="situation-title">{title}</h2>
        </div>
        <p className="situation-description">{description}</p>
        <Button onClick={onReview}>
          {actionLabel}
          <ArrowUpRight size={17} aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
