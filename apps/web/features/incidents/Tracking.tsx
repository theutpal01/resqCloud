"use client";
import { useState } from "react";
import { post } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
export function Tracking() {
  const [result, setResult] = useState<{
    trackingId: string;
    status: string;
    severity: string;
    history: { id: string; toStatus: string; createdAt: string }[];
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel narrow">
      <h2>Track your incident privately</h2>
      <p className="muted">
        Use the credentials returned when you submitted the report.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setError("");
          setBusy(true);
          try {
            setResult(
              await post("/tracking", {
                trackingId: f.get("id"),
                trackingToken: f.get("token"),
              }),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="track-id">Tracking ID</label>
        <Input id="track-id" name="id" required />
        <label htmlFor="track-token">Private tracking key</label>
        <Input
          id="track-token"
          name="token"
          type="password"
          required
          autoComplete="off"
        />
        {error && (
          <Alert role="alert" variant="destructive">
            {error}
          </Alert>
        )}
        <Button disabled={busy}>
          {busy ? "Looking up…" : "Track incident"}
        </Button>
      </form>
      {result && (
        <div aria-live="polite">
          <h3>{result.status.replaceAll("_", " ")}</h3>
          <Badge
            variant={result.severity as "critical" | "high" | "medium" | "low"}
          >
            {result.severity}
          </Badge>
          <ol className="timeline">
            {result.history.map((h) => (
              <li key={h.id}>
                <strong>{h.toStatus.replaceAll("_", " ")}</strong>
                <time>{new Date(h.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
