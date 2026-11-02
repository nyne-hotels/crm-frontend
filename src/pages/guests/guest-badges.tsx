import { CrownIcon, MessageCircleIcon, StarIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  STAGE_CHIP_CLASSES,
  STAGE_LABELS,
  STATUS_LABELS,
  type ContactMethodKind,
  type ContactMethodStatus,
  type LifecycleStage,
} from '@/lib/guests'
import { cn } from '@/lib/utils'

// `labelled` adds "Stage:" where there's no column heading to say so (the
// profile header), so it isn't mistaken for the guest's type.
export function StageChip({ stage, labelled, className }: { stage: LifecycleStage; labelled?: boolean; className?: string }) {
  return (
    <Badge className={cn('border-transparent', STAGE_CHIP_CLASSES[stage], className)}>
      {labelled && <span className="font-normal opacity-75">Stage:</span>}
      {STAGE_LABELS[stage]}
    </Badge>
  )
}

export function VipTag({ reason }: { reason: string }) {
  return (
    <Badge variant="outline" className="border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300" title={reason}>
      <CrownIcon /> VIP
    </Badge>
  )
}

const STATUS_CLASSES: Record<ContactMethodStatus, string> = {
  valid: 'border-emerald-300 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300',
  unverified: 'text-muted-foreground',
  bounced: 'border-destructive/40 text-destructive',
  invalid: 'border-destructive/40 text-destructive',
}

export function MethodStatusBadge({ kind, status }: { kind: ContactMethodKind; status: ContactMethodStatus }) {
  return (
    <Badge variant="outline" className={STATUS_CLASSES[status]}>
      {STATUS_LABELS[kind][status]}
    </Badge>
  )
}

export function PrimaryStar({ primary }: { primary: boolean }) {
  return (
    <StarIcon
      className={cn('size-4 shrink-0', primary ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/30')}
      aria-label={primary ? 'Primary' : undefined}
      aria-hidden={!primary}
    />
  )
}

export function WhatsappIcon() {
  return (
    <span title="On WhatsApp" className="inline-flex text-emerald-600 dark:text-emerald-400">
      <MessageCircleIcon className="size-4" aria-hidden />
      <span className="sr-only">On WhatsApp</span>
    </span>
  )
}
