import { PencilIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { DeleteButton } from '@/components/confirm-dialog'
import { Field } from '@/components/field'
import { CreatedAndUpdated } from '@/components/last-updated'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useMe } from '@/hooks/use-me'
import { useStay, useStayMutations } from '@/hooks/use-stays'
import { useStayPanel } from '@/hooks/use-stay-panel'
import { errorMessage } from '@/lib/api'
import { formatDate, fullName } from '@/lib/format'
import { STAGE_LABELS } from '@/lib/guests'
import { phoneHref } from '@/lib/phone'
import { can } from '@/lib/permissions'
import {
  CHANNEL_LABELS,
  didNotHappen,
  nightsLabel,
  partyLabel,
  STATUS_ACTIONS,
  STAY_STATUS_LABELS,
  type StatusAction,
} from '@/lib/stays'
import type { Stay } from '@/lib/types'
import { cn } from '@/lib/utils'
import { StayFeedback } from '../feedback/feedback-panels'
import { StageChip } from '../guests/guest-badges'
import { StayNotes } from '../guests/knowledge/notes'
import { StayStatusChip } from './stay-badges'
import { StayFormDialog } from './stay-form-dialog'

const money = (amount: number, currency: string | null) =>
  `${currency ?? ''} ${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()

// Opens from the stays list or the guest profile. All the stay's details,
// a link to the guest, and the buttons for its status.
export function StayDetailSheet() {
  const { openId, close } = useStayPanel()
  const { data: stay, isPending, error } = useStay(openId)

  return (
    <Sheet open={!!openId} onOpenChange={(open) => !open && close()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {isPending ? (
          <div className="grid gap-3 p-4">
            <SheetTitle className="sr-only">Loading stay</SheetTitle>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-48" />
          </div>
        ) : error || !stay ? (
          <div className="p-4">
            <SheetTitle>Stay not found</SheetTitle>
            <SheetDescription className="mt-2">It may have been deleted. {errorMessage(error)}</SheetDescription>
          </div>
        ) : (
          <StayDetail stay={stay} onDeleted={close} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function StayDetail({ stay, onDeleted }: { stay: Stay; onDeleted: () => void }) {
  const { data: me } = useMe()
  const canEdit = can(me?.permissions, 'stays', 'edit')
  const { changeStatus, remove } = useStayMutations()
  const [editing, setEditing] = useState(false)
  const [asking, setAsking] = useState<StatusAction | null>(null) // cancel and no-show ask first
  const guestName = fullName(stay.guest) || stay.guest.email || stay.guest.phone || `Guest #${stay.guest.id}`
  const gone = didNotHappen(stay.status)

  async function apply(action: StatusAction, reason?: string) {
    const before = stay.guest.lifecycleStage
    const saved = await changeStatus.mutateAsync({ id: stay.id, status: action.to, reason: reason || null })
    const after = saved.guest.lifecycleStage
    toast.success(
      `${STAY_STATUS_LABELS[saved.status]}${after !== before ? `. ${guestName} is now ${STAGE_LABELS[after].toLowerCase()}` : ''}`,
    )
  }

  async function click(action: StatusAction) {
    if (action.to === 'cancelled' || action.to === 'no_show') return setAsking(action)
    try {
      await apply(action)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <>
      <SheetHeader className="gap-2 border-b pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <SheetTitle className={cn('text-lg', gone && 'line-through decoration-1')}>{stay.hotel}</SheetTitle>
          <StayStatusChip status={stay.status} />
        </div>
        <SheetDescription className="tabular-nums">
          {formatDate(stay.arrivalDate) || 'No arrival date'} – {formatDate(stay.departureDate) || 'no departure date'}
          {stay.nights != null && ` · ${nightsLabel(stay.nights)}`}
        </SheetDescription>
        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-1">
            {STATUS_ACTIONS[stay.status].map((action) => (
              <Button
                key={action.to}
                size="sm"
                variant={action.primary ? 'default' : action.destructive ? 'ghost' : 'outline'}
                className={cn(action.destructive && 'text-destructive')}
                disabled={changeStatus.isPending}
                onClick={() => click(action)}
              >
                {action.label}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <PencilIcon /> Edit
            </Button>
          </div>
        )}
      </SheetHeader>

      <div className="grid gap-5 p-4">
        {gone && stay.cancellationReason && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {STAY_STATUS_LABELS[stay.status]}: {stay.cancellationReason}
          </p>
        )}

        <section className="grid gap-1">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Guest</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/guests/${stay.guest.id}`} className="font-medium underline-offset-4 hover:underline">
              {guestName}
            </Link>
            <StageChip stage={stay.guest.lifecycleStage} />
          </div>
          {stay.guest.email && (
            <a href={`mailto:${stay.guest.email}`} className="w-fit text-sm text-muted-foreground hover:underline">
              {stay.guest.email}
            </a>
          )}
          {stay.guest.phone && (
            <a href={phoneHref(stay.guest.phone)} className="w-fit text-sm text-muted-foreground tabular-nums hover:underline">
              {stay.guest.phone}
            </a>
          )}
        </section>

        <Separator />

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <Detail label="Booking reference">{stay.bookingReference ?? <Muted>None (entered by hand)</Muted>}</Detail>
          <Detail label="Room type">{stay.roomType}</Detail>
          <Detail label="Guests">{partyLabel(stay.adults, stay.children)}</Detail>
          <Detail label="Room revenue">{stay.roomRevenue != null ? money(stay.roomRevenue, stay.currency) : null}</Detail>
          <Detail label="Channel">{CHANNEL_LABELS[stay.channel]}</Detail>
          <Detail label="Agent or OTA">
            {stay.agent && stay.bookingCompanyId && can(me?.permissions, 'leads') ? (
              <Link to={`/companies/${stay.bookingCompanyId}`} className="underline-offset-4 hover:underline">
                {stay.agent}
              </Link>
            ) : (
              stay.agent
            )}
          </Detail>
          <Detail label="Occasion">{stay.occasion}</Detail>
          {stay.leadId && can(me?.permissions, 'leads') && (
            <Detail label="Lead">
              <Link to={`/leads/${stay.leadId}`} className="underline-offset-4 hover:underline">
                The enquiry this booked
              </Link>
            </Detail>
          )}
        </dl>

        {stay.bookingRemarks && (
          <section className="grid gap-1">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Booking remarks</h3>
            <p className="text-sm whitespace-pre-wrap">{stay.bookingRemarks}</p>
            <p className="text-xs text-muted-foreground">Special requests from the booking; the next import replaces them.</p>
          </section>
        )}

        {can(me?.permissions, 'feedback') && (stay.status === 'checked_out' || !!stay.feedbackId) && (
          <>
            <Separator />
            <StayFeedback stay={stay} canEdit={can(me?.permissions, 'feedback', 'edit')} />
          </>
        )}

        {can(me?.permissions, 'guests') && (
          <>
            <Separator />
            <StayNotes stayId={stay.id} canEdit={can(me?.permissions, 'guests', 'edit')} />
          </>
        )}

        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CreatedAndUpdated created={stay.created} lastUpdated={stay.lastUpdated} />
          {canEdit && (
            <DeleteButton
              what="this stay"
              onDelete={async () => {
                await remove.mutateAsync(stay.id)
                onDeleted()
              }}
            />
          )}
        </div>
      </div>

      <StayFormDialog open={editing} onOpenChange={setEditing} stay={stay} />
      <ReasonDialog
        action={asking}
        onOpenChange={(open) => !open && setAsking(null)}
        onConfirm={(reason) => apply(asking!, reason)}
      />
    </>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 wrap-break-word">{children || <Muted>–</Muted>}</dd>
    </>
  )
}

const Muted = ({ children }: { children: ReactNode }) => <span className="text-muted-foreground">{children}</span>

// Cancelling asks for a reason (required); a no-show may have one.
function ReasonDialog({
  action,
  onOpenChange,
  onConfirm,
}: {
  action: StatusAction | null
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => Promise<unknown>
}) {
  const cancelling = action?.to === 'cancelled'
  return (
    <Dialog open={!!action} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cancelling ? 'Cancel this stay?' : 'Mark as no-show?'}</DialogTitle>
          <DialogDescription>
            It stays on the guest's profile, struck through, and no longer counts towards their stays. You can reinstate
            it later.
          </DialogDescription>
        </DialogHeader>
        {/* mounted only while open, so each opening starts empty */}
        {action && <ReasonForm required={cancelling} onClose={() => onOpenChange(false)} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  )
}

function ReasonForm({
  required,
  onClose,
  onConfirm,
}: {
  required: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<unknown>
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (required && !reason.trim()) return setError('Give a reason for cancelling')
    setBusy(true)
    try {
      await onConfirm(reason.trim())
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Field label={required ? 'Reason' : 'Reason (optional)'} htmlFor="status-reason" error={error ?? undefined}>
        <Textarea
          id="status-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={required ? 'e.g. Guest cancelled by email' : undefined}
          aria-invalid={!!error || undefined}
          autoFocus
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Keep it
        </Button>
        <Button type="submit" variant={required ? 'destructive' : 'default'} disabled={busy}>
          {busy ? 'Saving…' : required ? 'Cancel stay' : 'Mark no-show'}
        </Button>
      </DialogFooter>
    </form>
  )
}
