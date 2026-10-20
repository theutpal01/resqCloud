"use client";
import { EvidencePanel } from "./EvidencePanel";
import { useState, useEffect, useRef } from "react";
import {
  canTransition,
  statuses,
  type IncidentView,
  type TimelineEntry,
  type Severity,
} from "../../../../packages/shared/src/index";
import { api } from "../../lib/api";
import { useAuth } from "../../components/providers/AuthProvider";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { Badge } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
interface Detail {
  incident: IncidentView;
  history: TimelineEntry[];
}
export function IncidentDetail({
  id,
  onClose,
  onChange,
}: {
  id: string | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [responders, setResponders] = useState<
    { id: string; name: string; score: number; distanceKm: number | null }[]
  >([]);
  const [duplicates, setDuplicates] = useState<
    { id: string; title: string; confidence: number }[]
  >([]);
  const [success, setSuccess] = useState("");
  const currentId = useRef(id);
  currentId.current = id;
  useEffect(() => {
    if (!id) return;
    let active = true;
    setData(null);
    setError("");
    setSuccess("");
    setReason("");
    setBusy(false);
    setResponders([]);
    setDuplicates([]);
    api<Detail>(`/incidents/${id}`)
      .then((detail) => {
        if (active) setData(detail);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function action(path: string, body: unknown = {}, method = "POST") {
    if (!id) return;
    const requestedId = id;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(`/incidents/${requestedId}/${path}`, {
        method,
        body: JSON.stringify(body),
      });
      const detail = await api<Detail>(`/incidents/${requestedId}`);
      if (currentId.current !== requestedId) return;
      setData(detail);
      setSuccess("Update saved");
      onChange();
    } catch (e) {
      if (currentId.current === requestedId)
        setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      if (currentId.current === requestedId) setBusy(false);
    }
  }
  const i = data?.incident;
  return (
    <Dialog
      open={!!id}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={i?.title ?? "Incident details"}
      description={
        i ? `${i.trackingId} · ${i.location}` : "Loading incident information"
      }
    >
      {error && (
        <Alert role="alert" variant="destructive">
          {error}
        </Alert>
      )}
      {success && <Alert variant="success">{success}</Alert>}
      {!data && !error && <p role="status">Loading details…</p>}
      {i && (
        <>
          <div className="detail-badges">
            <Badge variant={i.severity}>{i.severity}</Badge>
            <Badge variant="outline">{i.status.replaceAll("_", " ")}</Badge>
            <Badge variant="outline">{i.category}</Badge>
          </div>
          <p>{i.description}</p>
          <dl className="detail-grid">
            <div>
              <dt>People affected</dt>
              <dd>{i.peopleAffected}</dd>
            </div>
            <div>
              <dt>Coordinates</dt>
              <dd>
                {i.latitude.toFixed(4)}, {i.longitude.toFixed(4)}
              </dd>
            </div>
            <div>
              <dt>Reporter</dt>
              <dd>
                {i.anonymous ? "Identity protected" : "Registered citizen"}
              </dd>
            </div>
            <div>
              <dt>Reported</dt>
              <dd>{new Date(i.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
          {user && user.role !== "citizen" && (
            <section className="action-panel">
              <h3>Response actions</h3>
              <label htmlFor="action-reason">Reason for this update</label>
              <Input
                id="action-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Record the operational reason"
              />
              <div className="button-row">
                {statuses
                  .filter((s) => canTransition(user.role, i.status, s))
                  .map((s) => (
                    <Button
                      key={s}
                      variant="secondary"
                      disabled={busy || reason.trim().length < 3}
                      onClick={() =>
                        action("transition", { status: s, reason })
                      }
                    >
                      {s.replaceAll("_", " ")}
                    </Button>
                  ))}
                {user.role === "responder" && i.status === "assigned" && (
                  <Button disabled={busy} onClick={() => action("accept")}>
                    Accept assignment
                  </Button>
                )}
              </div>
              {["dispatcher", "supervisor", "admin"].includes(user.role) && (
                <>
                  <label htmlFor="severity-change">Assessed severity</label>
                  <Select
                    id="severity-change"
                    value={i.severity}
                    disabled={busy || reason.trim().length < 3}
                    onChange={(e) =>
                      action(
                        "severity",
                        { severity: e.target.value as Severity, reason },
                        "PATCH",
                      )
                    }
                  >
                    {["low", "medium", "high", "critical"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                  <div className="button-row">
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          setResponders(
                            await api(`/incidents/${id}/recommendations`),
                          );
                          setSuccess(
                            "Eligible responder recommendations loaded",
                          );
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Find eligible responders
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          const candidates = await api<typeof duplicates>(
                            `/incidents/${id}/duplicates`,
                          );
                          setDuplicates(candidates);
                          setSuccess(
                            candidates.length
                              ? "Review possible duplicates below"
                              : "No nearby duplicate candidates found",
                          );
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Check duplicates
                    </Button>
                  </div>
                  {responders.map((r) => (
                    <div className="list-row" key={r.id}>
                      <span>
                        <strong>{r.name}</strong>
                        <small>
                          {r.distanceKm === null
                            ? "Location unavailable"
                            : `${r.distanceKm} km away`}{" "}
                          · match score {r.score.toFixed(0)}
                        </small>
                      </span>
                      <Button
                        disabled={busy || reason.trim().length < 3}
                        onClick={() =>
                          action("assign", { responderId: r.id, reason })
                        }
                      >
                        Assign
                      </Button>
                    </div>
                  ))}
                  {duplicates.map((d) => (
                    <p key={d.id}>
                      {d.title} · {d.confidence}% rule-based confidence. Review
                      before marking duplicate.
                    </p>
                  ))}
                </>
              )}
              {["supervisor", "admin"].includes(user.role) && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => action("public", { approved: true }, "PATCH")}
                >
                  Approve approximate location for public map
                </Button>
              )}
            </section>
          )}
          {user?.role === "citizen" && i.status === "closed" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const values = new FormData(e.currentTarget);
                action("feedback", {
                  rating: Number(values.get("rating")),
                  responseRating: Number(values.get("rating")),
                  resolutionRating: Number(values.get("rating")),
                  comment: String(values.get("comment")),
                  complaint: false,
                });
              }}
            >
              <h3>How was the response?</h3>
              <label htmlFor="rating">Rating</label>
              <Select id="rating" name="rating">
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>
                    {r} / 5
                  </option>
                ))}
              </Select>
              <label htmlFor="comment">Feedback</label>
              <Textarea id="comment" name="comment" maxLength={2000} />
              <Button disabled={busy}>Submit feedback</Button>
            </form>
          )}
          <EvidencePanel incidentId={i.id} />
          <h3>Incident timeline</h3>
          <ol className="timeline">
            {data.history.map((h) => (
              <li key={h.id}>
                <strong>{h.toStatus.replaceAll("_", " ")}</strong>
                <time>{new Date(h.createdAt).toLocaleString()}</time>
                {h.reason && <p>{h.reason}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
    </Dialog>
  );
}
