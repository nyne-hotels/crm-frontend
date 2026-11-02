import { BedDoubleIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGuestStays } from '@/hooks/use-stays'
import { useStayPanel } from '@/hooks/use-stay-panel'
import { formatCount, formatDate, fullName } from '@/lib/format'
import { didNotHappen, nightsLabel } from '@/lib/stays'
import type { Guest, GuestStay } from '@/lib/types'
import { cn } from '@/lib/utils'
import { StayStatusChip } from './stay-badges'
import { StayDetailSheet } from './stay-detail-sheet'
import { StayFormDialog } from './stay-form-dialog'

// Totals for checked-out stays, then every stay newest first. Cancelled and
// no-show stays are struck through; click one to open the stay detail.
export function GuestStaysPanel({ guest, canEdit }: { guest: Guest; canEdit: boolean }) {
  const { data, isPending, isError } = useGuestStays(guest.id)
  const { open } = useStayPanel()
  const [adding, setAdding] = useState(false)
  const name = fullName(guest) || guest.emails[0]?.value || guest.phones[0]?.value || `Guest #${guest.id}`

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BedDoubleIcon className="size-4 text-muted-foreground" /> Stays
        </CardTitle>
        {canEdit && (
          <CardAction>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setAdding(true)}>
              <PlusIcon /> Add stay
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {isPending ? (
          <Skeleton className="h-32" />
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load stays.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Total label="Stays">{formatCount(data.totals.stays)}</Total>
              <Total label="Nights">{formatCount(data.totals.nights)}</Total>
              <Total label="Hotels visited" title={data.totals.hotels.join(', ')}>
                {formatCount(data.totals.hotels.length)}
              </Total>
              <Total label="Last stay">{data.totals.lastStay ? formatDate(data.totals.lastStay) : '–'}</Total>
            </dl>
            {data.totals.nextStay && (
              <p className="text-sm">
                <span className="text-muted-foreground">Next:</span>{' '}
                <button type="button" className="underline-offset-4 hover:underline" onClick={() => open(data.totals.nextStay!.id)}>
                  {data.totals.nextStay.hotel}, arriving {formatDate(data.totals.nextStay.arrivalDate)}
                </button>
              </p>
            )}
            {data.stays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stays on record.</p>
            ) : (
              <ul className="grid">
                {data.stays.map((s) => (
                  <StayLine key={s.id} stay={s} onOpen={() => open(s.id)} />
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>

      <StayFormDialog open={adding} onOpenChange={setAdding} guest={{ id: guest.id, name, detail: null }} />
      <StayDetailSheet />
    </Card>
  )
}

function Total({ label, title, children }: { label: string; title?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5" title={title}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{children}</dd>
    </div>
  )
}

function StayLine({ stay, onOpen }: { stay: GuestStay; onOpen: () => void }) {
  const gone = didNotHappen(stay.status)
  const details = [stay.roomType, stay.occasion].filter(Boolean).join(' · ')
  return (
    <li className="border-b last:border-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-sm py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className={cn('grid min-w-0 flex-1 gap-0.5', gone && 'text-muted-foreground line-through decoration-1')}>
          <span className="truncate text-sm font-medium">{stay.hotel}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {stay.arrivalDate ? `${formatDate(stay.arrivalDate)} – ${formatDate(stay.departureDate)}` : 'Dates not known'}
            {stay.nights != null && ` · ${nightsLabel(stay.nights)}`}
            {details && ` · ${details}`}
          </span>
        </span>
        <StayStatusChip status={stay.status} className="shrink-0" />
      </button>
    </li>
  )
}
