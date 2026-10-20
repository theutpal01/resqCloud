"use client";
import Link from "next/link";
import {
  Activity,
  Cloud,
  LayoutDashboard,
  ClipboardList,
  Map,
  Users,
  Bell,
  BarChart3,
  Settings,
  ShieldCheck,
  Plus,
  Search,
  TriangleAlert,
  Building2,
  ArrowUpRight,
  UserRound,
  Globe,
} from "lucide-react";
import { useAuth } from "../../components/providers/AuthProvider";
import { navigationForRole, type WorkspaceSection } from "./sections";

const icons = {
  overview: LayoutDashboard,
  incidents: ClipboardList,
  report: Plus,
  tracking: Search,
  map: Map,
  assignments: Users,
  escalations: TriangleAlert,
  analytics: BarChart3,
  notifications: Bell,
  users: UserRound,
  departments: Building2,
  jurisdictions: Globe,
  audit: ShieldCheck,
  settings: Settings,
  profile: UserRound,
} satisfies Record<WorkspaceSection, typeof Activity>;

const labels: Record<WorkspaceSection, string> = {
  overview: "Overview",
  incidents: "Incident queue",
  report: "Report incident",
  tracking: "Track incident",
  map: "Incident map",
  assignments: "Response teams",
  escalations: "Escalations",
  analytics: "Analytics",
  notifications: "Notifications",
  users: "Users",
  departments: "Departments",
  jurisdictions: "Regional administration",
  audit: "Audit trail",
  settings: "Settings",
  profile: "Profile",
};
export interface SidebarProps {
  section: WorkspaceSection;
  openCount?: number;
  onNavigate?: () => void;
}

/** Shared navigation content for the desktop rail and accessible mobile drawer. */
export function Sidebar({ section, openCount, onNavigate }: SidebarProps) {
  const { user } = useAuth();
  const groups = navigationForRole(user?.role ?? null);
  return (
    <>
      <Link href="/" className="brand" onClick={onNavigate}>
        <span className="brand-icon">
          <Cloud size={25} aria-hidden="true" />
        </span>
        <span>
          ResQ<span className="brand-cloud">Cloud</span>
          <small>INCIDENT RESPONSE</small>
        </span>
      </Link>
      <nav
        aria-label={
          user
            ? `${user.role} workspace navigation`
            : "Public services navigation"
        }
      >
        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="workspace-label">{group.label}</div>
            {group.items.map((key) => {
              const Icon = icons[key];
              const label =
                key === "overview" && !user
                  ? "Welcome"
                  : user?.role === "citizen" && key === "incidents"
                    ? "My reports"
                    : user?.role === "responder" && key === "incidents"
                      ? "Assigned incidents"
                      : !user && key === "map"
                        ? "Public map"
                        : labels[key];
              return (
                <Link
                  key={key}
                  href={key === "overview" ? "/" : `/${key}`}
                  aria-current={section === key ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span>{label}</span>
                  {key === "incidents" && openCount !== undefined && (
                    <span
                      className="nav-count"
                      aria-label={`${openCount} open incidents`}
                    >
                      {openCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <Link
          href={user ? "/profile" : "/"}
          className="account"
          aria-current={section === "profile" ? "page" : undefined}
          onClick={onNavigate}
        >
          <span className="avatar" aria-hidden="true">
            {user ? user.name.slice(0, 1).toUpperCase() : "R"}
          </span>
          <span className="account-details">
            <strong>{user?.name ?? "Your workspace"}</strong>
            <small>
              {user
                ? `${user.role[0].toUpperCase()}${user.role.slice(1)} · scoped access`
                : "Sign in or use public services"}
            </small>
          </span>
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
