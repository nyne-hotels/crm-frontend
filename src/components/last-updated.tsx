import { formatDate } from '@/lib/format'
import type { LastUpdated as LastUpdatedValue } from '@/lib/types'
import { cn } from '@/lib/utils'

// "Last updated by Nisha Silva, 21 Oct 2026". Changes made by the system
// (imports, jobs) have no staff member and show as "System".
export function LastUpdated({ value, className }: { value: LastUpdatedValue | null | undefined; className?: string }) {
  if (!value) return null
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      Last updated by {value.by ?? 'System'}, {formatDate(value.at)}
    </p>
  )
}

// Record footer: "Created 6 Oct 2026 by System · Last updated 21 Oct 2026 by Nisha Silva"
export function CreatedAndUpdated({
  created,
  lastUpdated,
  className,
}: {
  created: LastUpdatedValue
  lastUpdated: LastUpdatedValue
  className?: string
}) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      Created {formatDate(created.at)} by {created.by ?? 'System'} · Last updated {formatDate(lastUpdated.at)} by{' '}
      {lastUpdated.by ?? 'System'}
    </p>
  )
}
