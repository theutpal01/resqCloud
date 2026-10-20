"use client";
import { useState, useEffect } from "react";
import { api, post } from "../../lib/api";
import { useAuth } from "../../components/providers/AuthProvider";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { CalendarDays, MapPin, MonitorSmartphone } from "lucide-react";

function describeDevice(device: string) {
  const browser = device.includes("Edg/")
    ? "Microsoft Edge"
    : device.includes("Firefox/")
      ? "Firefox"
      : device.includes("Chrome/")
        ? "Chrome"
        : device.includes("Safari/")
          ? "Safari"
          : "Signed-in device";
  const platform = /Android/i.test(device)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(device)
      ? "iOS"
      : /Windows/i.test(device)
        ? "Windows"
        : /Mac OS|Macintosh/i.test(device)
          ? "macOS"
          : /Linux/i.test(device)
            ? "Linux"
            : "";
  const localDemo = device.startsWith("Local demo ·");
  return `${localDemo ? "Local demo · " : ""}${browser}${platform ? ` on ${platform}` : ""}`;
}
export function ProfilePanel() {
  const { user } = useAuth();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<
    { id: string; device: string; createdAt: string }[]
  >([]);
  useEffect(() => {
    api<typeof sessions>("/auth/sessions")
      .then(setSessions)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel narrow profile-panel">
      <div className="profile-identity">
        <span className="profile-avatar" aria-hidden="true">
          {user?.name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h2>{user?.name}</h2>
          <p>{user?.email}</p>
        </div>
        {user?.role && <Badge variant="secondary">{user.role}</Badge>}
      </div>
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && (
        <Alert role="alert" variant="destructive">
          {error}
        </Alert>
      )}
      {user?.role === "responder" && (
        <div className="responder-profile-actions">
          <label htmlFor="availability">Duty state</label>
          <Select
            id="availability"
            defaultValue=""
            onChange={async (e) => {
              try {
                await api("/responders/me/availability", {
                  method: "PATCH",
                  body: JSON.stringify({ availability: e.target.value }),
                });
                setNotice("Availability saved");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <option disabled value="">
              Choose duty state
            </option>
            {["available", "off_duty", "unavailable"].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            onClick={() =>
              navigator.geolocation.getCurrentPosition(
                async (p) => {
                  try {
                    await post("/responders/me/location", {
                      latitude: p.coords.latitude,
                      longitude: p.coords.longitude,
                    });
                    setNotice("Current location shared with your department");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                },
                () => setError("Location permission denied"),
              )
            }
          >
            <MapPin size={16} aria-hidden="true" /> Share current location
          </Button>
        </div>
      )}
      <div className="profile-section-heading">
        <div>
          <h3>Active sessions</h3>
          <p className="muted small">Sign-ins that can access this account.</p>
        </div>
        <Badge variant="outline">{sessions.length}</Badge>
      </div>
      <div className="session-list">
        {sessions.map((s) => (
          <article className="session-card" key={s.id} title={s.device}>
            <span className="session-icon"><MonitorSmartphone size={19} aria-hidden="true" /></span>
            <div className="session-copy">
              <strong>{describeDevice(s.device)}</strong>
              <small><CalendarDays size={13} aria-hidden="true" /> Signed in <time dateTime={s.createdAt}>{new Date(s.createdAt).toLocaleString()}</time></small>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await api(`/auth/sessions/${s.id}`, { method: "DELETE" });
                  setSessions((previous) =>
                    previous.filter((p) => p.id !== s.id),
                  );
                  setNotice("Session revoked");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Revoke
            </Button>
          </article>
        ))}
      </div>
      {!sessions.length && !error && (
        <EmptyState
          title="No active sessions"
          description="Signed-in devices will appear here."
        />
      )}
    </section>
  );
}
