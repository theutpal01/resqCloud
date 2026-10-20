"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import type { IncidentView } from "../../../../packages/shared/src/index";
import { useAuth } from "../../components/providers/AuthProvider";
import { api, API, getToken, post } from "../../lib/api";
import { syncQueue, queueCount } from "../../lib/offlineQueue";
import { canAccessSection, type WorkspaceSection } from "./sections";
export interface Metrics {
  total: number;
  open: number;
  critical: number;
  resolved: number;
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  responseTime: { averageSeconds: number | null; count: number };
  resolutionTime: { averageSeconds: number | null; count: number };
  responseSla: {
    tracked: number;
    met: number;
    breached: number;
    overdue: number;
    pending: number;
    targetMinutes: { high: number; critical: number };
  };
}
export interface MetricsDateRange {
  from: string;
  to: string;
}
export function useWorkspace(section: WorkspaceSection) {
  const { user, loading: authLoading } = useAuth();
  const canAccess = canAccessSection(section, user?.role);
  const actorId = user?.id;
  const refreshSequence = useRef(0);
  const [items, setItems] = useState<IncidentView[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsDateRange, setMetricsDateRange] = useState<MetricsDateRange>({
    from: "",
    to: "",
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [notificationRevision, setNotificationRevision] = useState(0);
  const [offline, setOffline] = useState(false);
  const [sos, setSos] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [queued, setQueued] = useState(0);
  const [publicPoints, setPublicPoints] = useState<IncidentView[]>([]);
  useEffect(() => {
    document.querySelector<HTMLElement>("#main")?.focus();
  }, [section]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const refresh = useCallback(async () => {
    if (!user || !canAccess) return;
    const sequence = ++refreshSequence.current;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        pageSize: "12",
        search: query,
        ...(severity ? { severity } : {}),
        ...(section === "escalations"
          ? { status: "escalated" }
          : status
            ? { status }
            : {}),
      });
      const analyticsQuery = new URLSearchParams();
      if (metricsDateRange.from)
        analyticsQuery.set("from", metricsDateRange.from);
      if (metricsDateRange.to) analyticsQuery.set("to", metricsDateRange.to);
      const analyticsSearch = analyticsQuery.toString();
      const [list, stats] = await Promise.all([
        api<{ items: IncidentView[]; total: number }>(`/incidents?${q}`),
        ["overview", "analytics"].includes(section)
          ? api<Metrics>(
              `/analytics${analyticsSearch ? `?${analyticsSearch}` : ""}`,
            )
          : Promise.resolve(null),
      ]);
      if (sequence !== refreshSequence.current) return;
      setItems(list.items);
      setTotal(list.total);
      setMetrics(stats);
      setError("");
    } catch (e) {
      if (sequence !== refreshSequence.current) return;
      setError((e as Error).message);
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }, [
    user,
    canAccess,
    page,
    query,
    severity,
    status,
    section,
    metricsDateRange,
  ]);
  useEffect(() => {
    refreshSequence.current += 1;
    setSelected(null);
    if (actorId) return;
    setItems([]);
    setMetrics(null);
    setMetricsDateRange({ from: "", to: "" });
    setTotal(0);
    setLoading(false);
  }, [actorId]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!user || !canAccess) return;
    const socket = io(API, {
      auth: { token: getToken() },
      transports: ["websocket", "polling"],
    });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("incident.updated", refresh);
    socket.on(
      "notification.created",
      (notification: { id: string; title: string; severity: string }) => {
        toast(notification.title, {
          id: notification.id,
          description: `${notification.severity} severity incident update`,
        });
        setNotificationRevision((revision) => revision + 1);
      },
    );
    const poll = setInterval(() => {
      if (!socket.connected) refresh();
    }, 30000);
    return () => {
      socket.disconnect();
      clearInterval(poll);
    };
  }, [user, canAccess, refresh]);
  useEffect(() => {
    if (!user && section === "map")
      api<IncidentView[]>("/public/incidents")
        .then(setPublicPoints)
        .catch((e) => setError(e.message));
  }, [user, section]);
  useEffect(() => {
    if (!user) return;
    let running = false;
    const sync = async () => {
      if (running) return;
      running = true;
      try {
        await syncQueue(user.id);
        setQueued(await queueCount(user.id));
      } catch {
        setQueued(0);
      } finally {
        running = false;
      }
    };
    sync();
    window.addEventListener("online", sync);
    const timer = setInterval(sync, 30000);
    return () => {
      window.removeEventListener("online", sync);
      clearInterval(timer);
    };
  }, [user]);
  async function sendSos() {
    if (!navigator.onLine) {
      setError(
        "SOS needs an internet connection. Contact local emergency services directly.",
      );
      setSos(false);
      return;
    }
    setSosBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          const result = await post<{
            incident: IncidentView;
            trackingToken: string;
          }>("/sos", {
            title: "SOS: urgent assistance requested",
            description:
              "An urgent SOS was submitted from the current GPS position. Please assess and dispatch an appropriate response.",
            category: "medical",
            severity: "critical",
            peopleAffected: 1,
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            location: "GPS position supplied by reporter",
            anonymous: !user,
            incidentTime: new Date().toISOString(),
            clientId: crypto.randomUUID(),
          });
          setNotice(
            `SOS recorded: ${result.incident.trackingId}. Private tracking key: ${result.trackingToken}. Save this key. No external emergency call was placed.`,
          );
          setSos(false);
          refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setSosBusy(false);
        }
      },
      () => {
        setError(
          "GPS permission is needed for SOS. Use the report form to enter your location manually.",
        );
        setSosBusy(false);
        setSos(false);
      },
    );
  }

  return {
    user,
    canAccess,
    authLoading,
    items,
    metrics,
    metricsDateRange,
    setMetricsDateRange,
    total,
    page,
    setPage,
    search,
    setSearch,
    severity,
    setSeverity,
    status,
    setStatus,
    error,
    setError,
    loading,
    selected,
    setSelected,
    connected,
    notificationRevision,
    offline,
    sos,
    setSos,
    sosBusy,
    notice,
    queued,
    publicPoints,
    refresh,
    sendSos,
  };
}
