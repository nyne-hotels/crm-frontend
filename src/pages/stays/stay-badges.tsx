import { Badge } from '@/components/ui/badge'
import { STAY_STATUS_CHIP_CLASSES, STAY_STATUS_LABELS, type StayStatus } from '@/lib/stays'
import { cn } from '@/lib/utils'

export function StayStatusChip({ status, className }: { status: StayStatus; className?: string }) {
  return (
    <Badge className={cn('border-transparent', STAY_STATUS_CHIP_CLASSES[status], className)}>
      {STAY_STATUS_LABELS[status]}
    </Badge>
  )
}
