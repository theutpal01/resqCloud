import { Siren } from "lucide-react";
import type { Role } from "../../../../packages/shared/src/index";
import { Button } from "../../components/ui/Button";
import { sections, type WorkspaceSection } from "./sections";

export interface WorkspaceHeaderProps {
  section: WorkspaceSection;
  isGuest: boolean;
  isCitizen: boolean;
  role?: Role;
  onSos: () => void;
}

/** Route-specific context and the two primary reporting actions. */
export function WorkspaceHeader({
  section,
  isGuest,
  isCitizen,
  role,
  onSos,
}: WorkspaceHeaderProps) {
  const page = sections[section];
  const title = isGuest
    ? "A safer community starts with you."
    : isCitizen && section === "incidents"
      ? "My reports"
      : page.title;
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p className="muted">
          {isGuest
            ? "Report an incident, follow its progress, or sign in to your workspace."
            : role === "responder" && section === "overview"
              ? "Your assigned incidents and the next step in each response."
              : page.description}
        </p>
      </div>
      {section !== "report" && (
        <div className="button-row">
          <Button variant="destructive" onClick={onSos}>
            <Siren size={17} aria-hidden="true" /> Urgent in-app report
          </Button>
        </div>
      )}
    </div>
  );
}
