import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGuestStays } from '@/hooks/use-stays'
import { stayChipLabel } from '@/lib/knowledge'
import { STAY_STATUS_LABELS } from '@/lib/stays'
import type { GuestStay } from '@/lib/types'

const NONE = 'none'

// "Link to stay": none, or one of the guest's stays, newest first.
export function StayLinkSelect({
  id,
  guestId,
  value,
  onChange,
}: {
  id?: string
  guestId: number
  value: number | null
  onChange: (stayId: number | null) => void
}) {
  const { data, isPending } = useGuestStays(guestId)
  const stays = data?.stays ?? []
  return (
    <Select value={value ? String(value) : NONE} onValueChange={(v) => onChange(v === NONE ? null : Number(v))}>
      <SelectTrigger id={id} className="w-full" disabled={isPending}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Not linked to a stay</SelectItem>
        {stays.map((s) => (
          <SelectItem key={s.id} value={String(s.id)}>
            {stayOptionLabel(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function stayOptionLabel(s: GuestStay) {
  const status = s.status === 'checked_out' ? '' : ` (${STAY_STATUS_LABELS[s.status].toLowerCase()})`
  return `${stayChipLabel(s)}${status}`
}
