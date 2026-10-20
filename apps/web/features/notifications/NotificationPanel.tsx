"use client";
import { useState, useEffect, useCallback } from "react";
import { api, post } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
import { EmptyState } from "../../components/ui/EmptyState";
interface Notice {
  id: string;
  title: string;
  severity: string;
  readAt: string | null;
  createdAt: string;
}
export function NotificationPanel({ refreshSignal }: { refreshSignal: number }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  const refresh = useCallback(
    () =>
      api<Notice[]>("/notifications")
        .then(setItems)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    refresh();
  }, [refresh, refreshSignal]);
  const unreadCount = items.filter((item) => !item.readAt).length;
  return (
    <section className="panel">
      <div className="section-title">
        <h2>Your notifications</h2>
        <Button
          variant="secondary"
          disabled={!unreadCount}
          onClick={async () => {
            try {
              await post("/notifications/read");
              refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {unreadCount ? `Mark ${unreadCount} unread as read` : "All caught up"}
        </Button>
      </div>
      {error && (
        <Alert role="alert" variant="destructive">
          {error}
        </Alert>
      )}
      {items.map((n) => (
        <article className="list-row" key={n.id}>
          <div>
            <strong>{n.title}</strong>
            <small className="notification-meta">
              <time dateTime={n.createdAt}>
                {new Date(n.createdAt).toLocaleString()}
              </time>
              <span className={n.readAt ? "read-state" : "read-state unread"}>
                <span aria-hidden="true" /> {n.readAt ? "Read" : "Unread"}
              </span>
            </small>
          </div>
          <Badge variant={n.severity as "critical" | "high" | "medium" | "low"}>
            {n.severity}
          </Badge>
        </article>
      ))}
      {!items.length && !error && (
        <EmptyState
          title="You're all caught up"
          description="Updates about reports and response activity will appear here."
        />
      )}
    </section>
  );
}
