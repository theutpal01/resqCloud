"use client";
import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { MapPin, UsersRound } from "lucide-react";
import { EmptyState } from "../../components/ui/EmptyState";
export function RespondersPanel() {
  const [items, setItems] = useState<
    {
      id: string;
      name: string;
      departmentId: number;
      profile?: {
        availability: string;
        skills: string;
        latitude: number;
        longitude: number;
      };
    }[]
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<typeof items>("/responders")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Department response teams</h2>
          <p className="muted small">Availability and skills in your department.</p>
        </div>
        {items.length > 0 && <Badge variant="secondary"><UsersRound size={14} aria-hidden="true" /> {items.length} {items.length === 1 ? "responder" : "responders"}</Badge>}
      </div>
      {error && (
        <Alert role="alert" variant="destructive">
          {error}
        </Alert>
      )}
      <div className="responder-grid">
        {items.map((r) => (
          <article className="responder-card" key={r.id}>
            <div className="responder-card-heading">
              <span className="responder-avatar" aria-hidden="true">{r.name.slice(0, 1).toUpperCase()}</span>
              <div><strong>{r.name}</strong><small>Department member</small></div>
              <Badge variant={r.profile?.availability === "available" ? "low" : "secondary"}>
                {r.profile?.availability.replaceAll("_", " ") ?? "Profile unavailable"}
              </Badge>
            </div>
            <div className="responder-detail">
              <span>Skills</span>
              <strong>{r.profile?.skills || "Not recorded"}</strong>
            </div>
            <div className="responder-detail">
              <span>Last shared location</span>
              <strong><MapPin size={14} aria-hidden="true" /> {r.profile?.latitude ?? "—"}, {r.profile?.longitude ?? "—"}</strong>
            </div>
          </article>
        ))}
      </div>
      {!items.length && !error && (
        <EmptyState
          title="No responders in your department"
          description="Team members will appear here when they are assigned to your department."
        />
      )}
    </section>
  );
}
