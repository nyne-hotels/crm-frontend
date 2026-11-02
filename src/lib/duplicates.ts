// Labels for duplicates and merging (Module 6). Mirrors
// backend/src/duplicates/merge-rules.ts.

// Email and phone first: they are the likeliest real duplicates.
export const DUPLICATE_REASONS = ['email', 'phone', 'name'] as const
export type DuplicateReason = (typeof DUPLICATE_REASONS)[number]

export const REASON_LABELS: Record<DuplicateReason, string> = {
  email: 'Same email',
  phone: 'Same phone',
  name: 'Same name',
}

export const REASON_CHIP_CLASSES: Record<DuplicateReason, string> = {
  email: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  phone: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  name: 'bg-muted text-muted-foreground',
}

// The merge screen for two guests, in either order.
export const reviewPath = (a: number, b: number) => `/guests/duplicates/review?a=${a}&b=${b}`
