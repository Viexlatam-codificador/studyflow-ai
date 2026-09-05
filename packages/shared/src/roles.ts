export const APP_ROLES = [
  "OWNER",
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "PROFESSOR",
  "SUPPORT",
  "STUDENT_PRO",
  "STUDENT_FREE",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const STAFF_ROLES: AppRole[] = ["OWNER", "SUPER_ADMIN", "SUPPORT"];

export function isStaffRole(role: AppRole): boolean {
  return STAFF_ROLES.includes(role);
}

export const PLAN_KEYS = ["FREE", "PRO", "CAMPUS"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export const ENTITLEMENT_STATUSES = [
  "COMPLIMENTARY",
  "PILOT",
  "SCHOLARSHIP",
  "LIFETIME",
  "MONTHLY",
  "ANNUAL",
  "INSTITUTIONAL",
  "NONE",
] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export interface Entitlement {
  userId: string;
  planKey: PlanKey;
  status: EntitlementStatus;
  expiresAt: string | null;
}

/** A user has PRO-level (or better) access — used to gate AI features client-side. */
export function hasProAccess(entitlement: Pick<Entitlement, "planKey">): boolean {
  return entitlement.planKey === "PRO" || entitlement.planKey === "CAMPUS";
}
