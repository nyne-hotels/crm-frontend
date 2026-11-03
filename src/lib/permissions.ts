// Mirrors backend/src/auth/permissions.ts. The API sends each user's
// permissions with /me, so this file only holds the types and helpers.
export type Access = 'edit' | 'view' | 'none'

export type Area =
  | 'guests'
  | 'guestConsent'
  | 'clearDoNotContact'
  | 'stays'
  | 'leads'
  | 'feedback'
  | 'employees' // the employee list and what guests said about named employees
  | 'marketingExport'
  | 'campaigns' // campaigns and their public forms
  | 'mergeGuests'
  | 'settings'

export type Permissions = Record<Area, Access>

export const STAFF_ROLES = ['admin', 'management', 'marketing'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Admin',
  management: 'Management',
  marketing: 'Marketing',
}

export function can(permissions: Permissions | undefined, area: Area, needed: Exclude<Access, 'none'> = 'view') {
  const access = permissions?.[area] ?? 'none'
  return access === 'edit' || (needed === 'view' && access === 'view')
}
