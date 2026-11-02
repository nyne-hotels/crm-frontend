import { AlarmClockIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import {
  COMPANY_STATUS_CHIP_CLASSES,
  COMPANY_STATUS_LABELS,
  followUpState,
  LEAD_STATUS_CHIP_CLASSES,
  LEAD_STATUS_LABELS,
  SOURCE_ICONS,
  SOURCE_LABELS,
  type CompanyStatus,
  type LeadSource,
  type LeadStatus,
} from '@/lib/leads'
import { cn } from '@/lib/utils'

export function LeadStatusChip({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <Badge className={cn('border-transparent', LEAD_STATUS_CHIP_CLASSES[status], className)}>{LEAD_STATUS_LABELS[status]}</Badge>
  )
}

export function CompanyStatusChip({ status }: { status: CompanyStatus }) {
  return <Badge className={cn('border-transparent', COMPANY_STATUS_CHIP_CLASSES[status])}>{COMPANY_STATUS_LABELS[status]}</Badge>
}

export function SourceIcon({ source, className }: { source: LeadSource; className?: string }) {
  const Icon = SOURCE_ICONS[source]
  return (
    <span title={SOURCE_LABELS[source]} className={cn('inline-flex text-muted-foreground', className)}>
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{SOURCE_LABELS[source]}</span>
    </span>
  )
}

// The follow-up date: red when overdue, bold when due today. Booked and lost
// leads have nothing to follow up, so it's left out.
export function FollowUpDate({
  status,
  followUpOn,
  today,
  className,
}: {
  status: LeadStatus
  followUpOn: string | null
  today: string
  className?: string
}) {
  const state = followUpState(status, followUpOn, today)
  if (!state) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 tabular-nums',
        state === 'overdue' && 'font-medium text-destructive',
        state === 'today' && 'font-medium',
        state === 'later' && 'text-muted-foreground',
        className,
      )}
      title={state === 'overdue' ? 'Follow-up overdue' : state === 'today' ? 'Follow up today' : 'Next follow-up'}
    >
      <AlarmClockIcon className="size-3.5" aria-hidden />
      {state === 'today' ? 'Today' : formatDate(followUpOn)}
      {state === 'overdue' && <span className="sr-only">(overdue)</span>}
    </span>
  )
}
