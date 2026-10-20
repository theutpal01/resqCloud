"use client";
import { useEffect, useState, type ReactNode } from "react";
import * as Drawer from "@radix-ui/react-dialog";
import {
  ChevronRight,
  LogOut,
  Menu,
  Radio,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "../../components/providers/AuthProvider";
import { indianJurisdictions } from "../../../../packages/shared/src/index";
import { cn } from "../../lib/cn";
import { Button } from "../../components/ui/Button";
import { Sidebar } from "./Sidebar";
import { sections, type WorkspaceSection } from "./sections";

export interface WorkspaceShellProps {
  section: WorkspaceSection;
  openCount?: number;
  offline: boolean;
  connected: boolean;
  onError: (message: string) => void;
  children: ReactNode;
}

/** Owns navigation and responsive chrome; feature views own their data and actions. */
export function WorkspaceShell({
  section,
  openCount,
  offline,
  connected,
  onError,
  children,
}: WorkspaceShellProps) {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    const closeOnDesktop = () => {
      if (desktop.matches) setIsMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const connectionLabel = offline
    ? "Offline"
    : user
      ? connected
        ? "Live updates"
        : "Updates every 30s"
      : "Citizen portal";
  return (
    <Drawer.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <div className="app-shell">
        <aside
          className="sidebar sidebar-desktop"
          aria-label="Workspace sidebar"
        >
          <Sidebar section={section} openCount={openCount} />
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <Drawer.Trigger asChild>
                <Button
                  variant="ghost"
                  className="icon-button mobile-menu size-11 p-0"
                  aria-label="Open navigation"
                >
                  <Menu size={21} aria-hidden="true" />
                </Button>
              </Drawer.Trigger>
              <span>ResQCloud</span>
              <ChevronRight size={14} aria-hidden="true" />
              <strong>{sections[section].title}</strong>
            </div>
            <div className="topbar-actions">
              {user?.jurisdictionCode && (
                <span className="jurisdiction-badge">
                  {indianJurisdictions.find(
                    (j) => j.code === user.jurisdictionCode,
                  )?.name ?? user.jurisdictionCode}
                  <span> · {user.jurisdictionCode}</span>
                </span>
              )}
              <span
                className={cn(
                  "connection",
                  offline && "connection-offline",
                  user && !connected && !offline && "connection-polling",
                )}
                role="status"
              >
                <Radio size={14} aria-hidden="true" />
                {connectionLabel}
              </span>
              {user && (
                <Button
                  variant="ghost"
                  className="icon-button size-11 p-0"
                  aria-label={isSigningOut ? "Signing out" : "Sign out"}
                  disabled={isSigningOut}
                  onClick={async () => {
                    setIsSigningOut(true);
                    try {
                      await logout();
                    } catch (error) {
                      onError(
                        error instanceof Error
                          ? error.message
                          : "Could not sign out. Please try again.",
                      );
                    } finally {
                      setIsSigningOut(false);
                    }
                  }}
                >
                  <LogOut size={18} aria-hidden="true" />
                </Button>
              )}
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            {children}
            <footer className="page-footer">
              <span>ResQCloud · Incident coordination</span>
              <span>
                <ShieldCheck size={14} aria-hidden="true" /> Role-based access
              </span>
            </footer>
          </main>
        </div>
      </div>
      <Drawer.Portal>
        <Drawer.Overlay className="dialog-overlay" />
        <Drawer.Content className="sidebar sidebar-drawer">
          <Drawer.Title className="sr-only">Workspace navigation</Drawer.Title>
          <Drawer.Description className="sr-only">
            Navigate to reports, incident updates, and your account.
          </Drawer.Description>
          <Drawer.Close
            className="icon-button drawer-close"
            aria-label="Close navigation"
          >
            <X size={20} aria-hidden="true" />
          </Drawer.Close>
          <Sidebar
            section={section}
            openCount={openCount}
            onNavigate={() => setIsMenuOpen(false)}
          />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
