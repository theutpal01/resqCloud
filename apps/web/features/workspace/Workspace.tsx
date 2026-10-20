"use client";
import Link from "next/link";
import { useWorkspace } from "./useWorkspace";
import { MetricsStrip, AnalyticsCharts } from "../dashboard/DashboardPanels";
import { WorkspaceShell } from "./WorkspaceShell";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { canAccessSection, type WorkspaceSection } from "./sections";
import { IncidentQueue } from "../incidents/IncidentQueue";

import dynamic from "next/dynamic";

import { LoadingState } from "../../components/ui/LoadingState";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";

import { Dialog } from "../../components/ui/Dialog";
import { AuthLanding } from "../auth/AuthLanding";
import { IncidentDetail } from "../incidents/IncidentDetail";
const ReportForm = dynamic(
  () => import("../incidents/ReportForm").then((module) => module.ReportForm),
  { loading: () => <LoadingState /> },
);
const Tracking = dynamic(
  () => import("../incidents/Tracking").then((module) => module.Tracking),
  { loading: () => <LoadingState /> },
);
const AdminPanel = dynamic(
  () => import("../admin/AdminPanel").then((module) => module.AdminPanel),
  { loading: () => <LoadingState /> },
);
const NotificationPanel = dynamic(
  () =>
    import("../notifications/NotificationPanel").then(
      (module) => module.NotificationPanel,
    ),
  { loading: () => <LoadingState /> },
);
const ProfilePanel = dynamic(
  () => import("../profile/ProfilePanel").then((module) => module.ProfilePanel),
  { loading: () => <LoadingState /> },
);
const RespondersPanel = dynamic(
  () =>
    import("../responders/RespondersPanel").then(
      (module) => module.RespondersPanel,
    ),
  { loading: () => <LoadingState /> },
);
const IncidentMap = dynamic(() => import("../incidents/IncidentMap"), {
  ssr: false,
  loading: () => (
    <section className="panel" role="status">
      Loading map…
    </section>
  ),
});
function AccessRestricted({ section }: { section: WorkspaceSection }) {
  return (
    <section className="panel access-restricted" aria-labelledby="access-title">
      <h2 id="access-title">
        This workspace area is not available to your role
      </h2>
      <p>
        Your account can only open tools within its assigned access. Return to
        your overview or use a public reporting service.
      </p>
      <div className="button-row">
        <Button asChild>
          <Link href="/">Go to overview</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/report">Report an incident</Link>
        </Button>
      </div>
      <span className="sr-only">Requested page: {section}</span>
    </section>
  );
}

export function Workspace({ section }: { section: WorkspaceSection }) {
  const {
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
  } = useWorkspace(section);
  const isPublic = ["report", "tracking", "map"].includes(section);
  const sectionAvailable = canAccessSection(section, user?.role);
  return (
    <>
      <WorkspaceShell
        section={section}
        openCount={metrics?.open}
        offline={offline}
        connected={connected}
        onError={setError}
      >
        <WorkspaceHeader
          section={section}
          isGuest={!user && !isPublic}
          isCitizen={user?.role === "citizen"}
          role={user?.role}
          onSos={() => setSos(true)}
        />
        {sectionAvailable && queued > 0 && (
          <Alert variant="warning">
            {queued} report(s) waiting to sync on this device. Drafts expire
            after 24 hours.
          </Alert>
        )}
        {sectionAvailable && offline && (
          <Alert role="alert" variant="warning">
            You are offline. Changes cannot be sent until connectivity returns.
          </Alert>
        )}
        {sectionAvailable && error && (
          <Alert
            role="alert"
            variant="destructive"
            className="flex items-center justify-between gap-3"
          >
            {error}
            <Button variant="ghost" onClick={refresh}>
              Retry
            </Button>
          </Alert>
        )}
        {sectionAvailable && notice && (
          <Alert variant="success" className="break-all">
            {notice}
          </Alert>
        )}
        {authLoading && !isPublic ? (
          <AuthLanding isRestoring />
        ) : authLoading ? (
          <LoadingState label="Restoring your session…" />
        ) : !user && !isPublic ? (
          <AuthLanding />
        ) : !canAccess ? (
          <AccessRestricted section={section} />
        ) : section === "report" ? (
          <ReportForm />
        ) : section === "tracking" ? (
          <Tracking />
        ) : section === "map" ? (
          <IncidentMap points={user ? items : publicPoints} />
        ) : user ? (
          <>
            {["overview", "analytics"].includes(section) &&
              !metrics &&
              !error && <LoadingState label="Loading incident totals…" />}
            {["overview", "analytics"].includes(section) && metrics && (
              <MetricsStrip
                {...{
                  section,
                  metrics,
                  role: user.role,
                  setSeverity,
                  setStatus,
                  setPage,
                }}
              />
            )}
            {["overview", "incidents", "escalations"].includes(section) && (
              <IncidentQueue
                {...{
                  section,
                  role: user.role,
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
                }}
              />
            )}
            {section === "analytics" && metrics && (
              <AnalyticsCharts
                {...{
                  metrics,
                  setError,
                  metricsDateRange,
                  onApplyDateRange: setMetricsDateRange,
                  isLoading: loading,
                }}
              />
            )}
            {section === "assignments" && <RespondersPanel />}
            {section === "notifications" && (
              <NotificationPanel refreshSignal={notificationRevision} />
            )}
            {section === "profile" && <ProfilePanel />}
            {[
              "users",
              "departments",
              "jurisdictions",
              "audit",
              "settings",
            ].includes(section) && <AdminPanel section={section} />}
          </>
        ) : null}
      </WorkspaceShell>
      <IncidentDetail
        id={selected}
        onClose={() => setSelected(null)}
        onChange={refresh}
      />
      <Dialog
        open={sos}
        onOpenChange={setSos}
        title="Create an urgent in-app report?"
        description="This sends a critical incident to ResQCloud. It does not contact local emergency services. For immediate emergency help, contact local emergency services directly."
      >
        <p>GPS permission and an internet connection are required.</p>
        <div className="button-row">
          <Button variant="secondary" onClick={() => setSos(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={sosBusy} onClick={sendSos}>
            {sosBusy ? "Sending report…" : "Create critical report"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
