import type { Role } from "../../../../packages/shared/src/index";

/** Shared route metadata keeps navigation and page headings consistent. */
export const sections = {
  overview: {
    title: "Operations overview",
    description: "Incidents in your scope, with the next step clearly marked.",
  },
  incidents: {
    title: "Incident queue",
    description:
      "Find a report, assess its priority, and move the response forward.",
  },
  report: {
    title: "Report an incident",
    description:
      "Share what happened so the right team can take the next step.",
  },
  tracking: {
    title: "Track an incident",
    description: "Follow your report from the first update to resolution.",
  },
  map: {
    title: "Incident map",
    description: "Understand where incidents are happening in your community.",
  },
  assignments: {
    title: "Response teams",
    description:
      "See your department’s people, availability, and areas of expertise.",
  },
  escalations: {
    title: "Escalations",
    description: "Review incidents that need additional attention and support.",
  },
  analytics: {
    title: "Response analytics",
    description: "Understand incident volume and progress across your scope.",
  },
  notifications: {
    title: "Notifications",
    description:
      "Stay up to date with the reports and responses that matter to you.",
  },
  users: {
    title: "User management",
    description: "Manage accounts and access for citizens and response teams.",
  },
  departments: {
    title: "Departments",
    description: "The departments working together to coordinate a response.",
  },
  jurisdictions: {
    title: "Regional administration",
    description:
      "Manage state, territory, and district reporting areas.",
  },
  audit: {
    title: "Audit trail",
    description:
      "Review the recorded actions behind each operational decision.",
  },
  settings: {
    title: "System settings",
    description: "Configure report policy and review failed event deliveries.",
  },
  profile: {
    title: "Your account",
    description: "Manage your availability, location, and signed-in devices.",
  },
} as const;

export type WorkspaceSection = keyof typeof sections;

const sectionsByRole: Record<Role, readonly WorkspaceSection[]> = {
  citizen: [
    "overview",
    "incidents",
    "report",
    "tracking",
    "map",
    "notifications",
    "profile",
  ],
  responder: [
    "overview",
    "incidents",
    "report",
    "tracking",
    "map",
    "notifications",
    "profile",
  ],
  dispatcher: [
    "overview",
    "incidents",
    "report",
    "tracking",
    "map",
    "assignments",
    "escalations",
    "analytics",
    "notifications",
    "profile",
  ],
  supervisor: [
    "overview",
    "incidents",
    "report",
    "tracking",
    "map",
    "assignments",
    "escalations",
    "analytics",
    "notifications",
    "profile",
  ],
  admin: Object.keys(sections) as WorkspaceSection[],
};

const publicSections: readonly WorkspaceSection[] = [
  "overview",
  "report",
  "tracking",
  "map",
];

interface NavigationGroup {
  label: string;
  items: readonly WorkspaceSection[];
}

/** Keeps direct-route access aligned with the tools shown in the sidebar. */
export function canAccessSection(
  section: WorkspaceSection,
  role: Role | null | undefined,
): boolean {
  return role
    ? sectionsByRole[role].includes(section)
    : publicSections.includes(section);
}

export function navigationForRole(role: Role | null): NavigationGroup[] {
  let groups: NavigationGroup[];

  if (!role) {
    groups = [
      {
        label: "CITIZEN SERVICES",
        items: ["overview", "report", "tracking", "map"],
      },
    ];
  } else if (role === "citizen") {
    groups = [
      {
        label: "MY REPORTS",
        items: ["overview", "incidents", "report", "tracking"],
      },
      { label: "COMMUNITY", items: ["map", "notifications"] },
    ];
  } else if (role === "responder") {
    groups = [
      {
        label: "MY RESPONSE",
        items: ["overview", "incidents", "report", "map"],
      },
      {
        label: "FOLLOW-UP",
        items: ["tracking", "notifications"],
      },
    ];
  } else {
    groups = [
      {
        label: role === "supervisor" ? "OVERSIGHT" : "OPERATIONS",
        items: [
          "overview",
          "incidents",
          "report",
          "map",
          "assignments",
          "escalations",
          "analytics",
        ],
      },
      { label: "FOLLOW-UP", items: ["tracking", "notifications"] },
    ];

    if (role === "admin") {
      groups.push({
        label: "ADMINISTRATION",
        items: ["users", "departments", "jurisdictions", "audit", "settings"],
      });
    }
  }

  const allowedSections = role ? sectionsByRole[role] : publicSections;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((section) => allowedSections.includes(section)),
    }))
    .filter((group) => group.items.length > 0);
}

export function isWorkspaceSection(value: string): value is WorkspaceSection {
  return Object.prototype.hasOwnProperty.call(sections, value);
}
