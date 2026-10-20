import { z } from "zod";
export const roles = [
  "citizen",
  "dispatcher",
  "responder",
  "supervisor",
  "admin",
] as const;
export const severities = ["low", "medium", "high", "critical"] as const;
export const statuses = [
  "reported",
  "under_review",
  "verified",
  "severity_assessed",
  "assigned",
  "responding",
  "resolved",
  "closed",
  "rejected",
  "duplicate",
  "escalated",
  "reopened",
] as const;
export type Role = (typeof roles)[number];
export type Severity = (typeof severities)[number];
export type Status = (typeof statuses)[number];
export const departments = [
  "Fire & Rescue",
  "Medical/Emergency Health",
  "Police/Security",
  "Municipal/Infrastructure",
  "Utilities",
  "Disaster Management",
] as const;
/** The one sample jurisdiction available in the fictional-data development demo. */
export const DEMO_JURISDICTION_CODE = "IN-TN";
export const demoJurisdictions = [
  { code: DEMO_JURISDICTION_CODE, name: "Tamil Nadu" },
] as const;
/** India state/UT code catalog; codes do not imply verified operational boundaries. */
export const indianJurisdictions = [
  { code: "IN-AP", name: "Andhra Pradesh", kind: "state" },
  { code: "IN-AR", name: "Arunachal Pradesh", kind: "state" },
  { code: "IN-AS", name: "Assam", kind: "state" },
  { code: "IN-BR", name: "Bihar", kind: "state" },
  { code: "IN-CG", name: "Chhattisgarh", kind: "state" },
  { code: "IN-GA", name: "Goa", kind: "state" },
  { code: "IN-GJ", name: "Gujarat", kind: "state" },
  { code: "IN-HR", name: "Haryana", kind: "state" },
  { code: "IN-HP", name: "Himachal Pradesh", kind: "state" },
  { code: "IN-JH", name: "Jharkhand", kind: "state" },
  { code: "IN-KA", name: "Karnataka", kind: "state" },
  { code: "IN-KL", name: "Kerala", kind: "state" },
  { code: "IN-MP", name: "Madhya Pradesh", kind: "state" },
  { code: "IN-MH", name: "Maharashtra", kind: "state" },
  { code: "IN-MN", name: "Manipur", kind: "state" },
  { code: "IN-ML", name: "Meghalaya", kind: "state" },
  { code: "IN-MZ", name: "Mizoram", kind: "state" },
  { code: "IN-NL", name: "Nagaland", kind: "state" },
  { code: "IN-OD", name: "Odisha", kind: "state" },
  { code: "IN-PB", name: "Punjab", kind: "state" },
  { code: "IN-RJ", name: "Rajasthan", kind: "state" },
  { code: "IN-SK", name: "Sikkim", kind: "state" },
  { code: "IN-TN", name: "Tamil Nadu", kind: "state" },
  { code: "IN-TG", name: "Telangana", kind: "state" },
  { code: "IN-TR", name: "Tripura", kind: "state" },
  { code: "IN-UP", name: "Uttar Pradesh", kind: "state" },
  { code: "IN-UK", name: "Uttarakhand", kind: "state" },
  { code: "IN-WB", name: "West Bengal", kind: "state" },
  {
    code: "IN-AN",
    name: "Andaman and Nicobar Islands",
    kind: "union_territory",
  },
  { code: "IN-CH", name: "Chandigarh", kind: "union_territory" },
  {
    code: "IN-DH",
    name: "Dadra and Nagar Haveli and Daman and Diu",
    kind: "union_territory",
  },
  { code: "IN-DL", name: "Delhi", kind: "union_territory" },
  { code: "IN-JK", name: "Jammu and Kashmir", kind: "union_territory" },
  { code: "IN-LA", name: "Ladakh", kind: "union_territory" },
  { code: "IN-LD", name: "Lakshadweep", kind: "union_territory" },
  { code: "IN-PY", name: "Puducherry", kind: "union_territory" },
] as const;
export const categories = [
  "fire",
  "medical",
  "accident",
  "flood",
  "infrastructure",
  "utilities",
  "security",
  "other",
] as const;
export const categoryDepartment: Record<(typeof categories)[number], number> = {
  fire: 1,
  medical: 2,
  accident: 2,
  flood: 6,
  infrastructure: 4,
  utilities: 5,
  security: 3,
  other: 6,
};
export const coordinates = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export const reportSchema = coordinates.extend({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(5000),
  category: z.string().trim().min(1).max(40),
  jurisdictionCode: z.string().trim().min(1).max(8),
  severity: z.enum(severities),
  peopleAffected: z.number().int().min(0).max(1000000),
  location: z.string().trim().min(3).max(250),
  anonymous: z.boolean(),
  contact: z.string().trim().max(150).optional(),
  incidentTime: z.iso.datetime(),
  clientId: z.uuid(),
});
export type ReportInput = z.infer<typeof reportSchema>;
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
  otp: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  password: z.string().min(12).max(128),
});
export const transitionSchema = z.object({
  status: z.enum(statuses),
  reason: z.string().trim().min(3).max(1000),
});
export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000),
  responseRating: z.number().int().min(1).max(5),
  resolutionRating: z.number().int().min(1).max(5),
  complaint: z.boolean().default(false),
});

export const dateRangeQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((range) => !range.from || !range.to || range.from <= range.to, {
    message: "Start date must be on or before end date",
  });
export const transitions: Record<Status, readonly Status[]> = {
  reported: ["under_review", "rejected", "duplicate", "escalated"],
  under_review: ["verified", "rejected", "duplicate", "escalated"],
  verified: ["severity_assessed", "escalated"],
  severity_assessed: ["assigned", "escalated"],
  assigned: ["responding", "escalated"],
  responding: ["resolved", "escalated"],
  resolved: ["closed", "reopened"],
  closed: ["reopened"],
  rejected: ["reopened"],
  duplicate: ["reopened"],
  escalated: [
    "under_review",
    "verified",
    "severity_assessed",
    "assigned",
    "responding",
    "resolved",
  ],
  reopened: ["under_review"],
};
/** Central transition policy shared by UI and API; assignment itself has a separate atomic command. */
export function canTransition(role: Role, from: Status, to: Status): boolean {
  if (!transitions[from].includes(to) || to === "assigned") return false;
  if (role === "citizen") return false;
  if (role === "responder")
    return (
      (from === "assigned" && to === "responding") ||
      (from === "responding" && to === "resolved")
    );
  if (["closed", "reopened"].includes(to))
    return ["supervisor", "admin"].includes(role);
  return ["dispatcher", "supervisor", "admin"].includes(role);
}
export interface Actor {
  id: string;
  role: Role;
  departmentId: number | null;
  jurisdictionCode: string | null;
  name: string;
  email: string;
}
export interface IncidentView {
  id: string;
  trackingId: string;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  status: Status;
  latitude: number;
  longitude: number;
  location: string;
  peopleAffected: number;
  anonymous: boolean;
  departmentId: number;
  jurisdictionCode: string | null;
  reporterId: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  incidentTime: string;
  contact?: string | null;
}
export interface TimelineEntry {
  id: string;
  fromStatus: Status | null;
  toStatus: Status;
  reason: string;
  createdAt: string;
}
export interface DomainEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  version: 1;
  occurredAt: string;
  aggregateId: string;
  payload: T;
}
/** Haversine distance in kilometres. */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude);
  return (
    6371 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(dLat / 2) ** 2 +
          Math.cos(rad(a.latitude)) *
            Math.cos(rad(b.latitude)) *
            Math.sin(dLon / 2) ** 2,
      ),
    )
  );
}
export function publicIncident(i: IncidentView) {
  return {
    trackingId: i.trackingId,
    category: i.category,
    severity: i.severity,
    status: i.status,
    latitude: Math.round(i.latitude * 100) / 100,
    longitude: Math.round(i.longitude * 100) / 100,
    updatedAt: i.updatedAt,
  };
}
