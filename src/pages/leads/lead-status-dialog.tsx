import { useState } from 'react'
import { toast } from 'sonner'
import { Field, FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useLeadMutations, useLeadOwners } from '@/hooks/use-leads'
import { useMe } from '@/hooks/use-me'
import { useGuestStays } from '@/hooks/use-stays'
import { errorMessage } from '@/lib/api'
import { formatDate, fullName } from '@/lib/format'
import {
  addDays,
  hotelToday,
  isOpen,
  LEAD_STATUS_LABELS,
  LOST_REASON_LABELS,
  LOST_REASONS,
  type LeadStatus,
  type LostReason,
} from '@/lib/leads'
import { COMMON_CURRENCIES, didNotHappen, STAY_STATUS_LABELS } from '@/lib/stays'
import type { LeadCard } from '@/lib/types'

type MovingLead = Pick<LeadCard, 'id' | 'status' | 'contactId' | 'owner' | 'followUpOn' | 'quotedValue' | 'currency' | 'stay'>

const TITLES: Partial<Record<LeadStatus, string>> = { lost: 'Mark lost', booked: 'Mark booked', quoted: 'Enter the quote' }

// Asks for what the move needs, then moves the lead. `to` null = closed.
export function LeadStatusDialog({ lead, to, onClose }: { lead: MovingLead; to: LeadStatus | null; onClose: () => void }) {
  const reopening = !!to && !isOpen(lead.status) && isOpen(to)
  return (
    <Dialog open={!!to} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {to && (
          <>
            <DialogHeader>
              <DialogTitle>{reopening ? `Reopen as ${LEAD_STATUS_LABELS[to].toLowerCase()}` : (TITLES[to] ?? `Move to ${LEAD_STATUS_LABELS[to]}`)}</DialogTitle>
              <DialogDescription>
                {to === 'lost'
                  ? 'Why didn’t it book? The reasons feed the lost-reasons report.'
                  : to === 'booked'
                    ? 'Link the stay it booked. If the booking hasn’t been entered yet, mark it booked now and link the stay later.'
                    : reopening
                      ? 'The person came back. Choose who follows it up, and when.'
                      : 'The quoted amount and currency, and when to follow up.'}
              </DialogDescription>
            </DialogHeader>
            <StatusForm lead={lead} to={to} reopening={reopening} onClose={onClose} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StatusForm({ lead, to, reopening, onClose }: { lead: MovingLead; to: LeadStatus; reopening: boolean; onClose: () => void }) {
  const { data: me } = useMe()
  const { data: owners = [] } = useLeadOwners()
  const { changeStatus } = useLeadMutations()
  const { data: guestStays } = useGuestStays(lead.contactId, to === 'booked')
  const today = hotelToday()
  const [lostReason, setLostReason] = useState<LostReason | ''>('')
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState(lead.quotedValue?.toString() ?? '')
  const [currency, setCurrency] = useState(lead.currency ?? '')
  const [followUpOn, setFollowUpOn] = useState(
    lead.followUpOn && lead.followUpOn > today ? lead.followUpOn : addDays(today, reopening ? 1 : 2),
  )
  // the owner stays, unless they can no longer own leads
  const currentOwnerActive = owners.some((o) => o.id === lead.owner?.id && o.isActive)
  const [ownerId, setOwnerId] = useState(String((currentOwnerActive ? lead.owner?.id : me?.id) ?? ''))
  const [stayId, setStayId] = useState('')
  const [stayToLink, setStayToLink] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stays = (guestStays?.stays ?? []).filter((s) => !didNotHappen(s.status))
  const askQuote = to === 'quoted'
  const askFollowUp = isOpen(to)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (to === 'lost' && !lostReason) return setError('Choose why the lead was lost')
    if (askQuote) {
      if (!/^\d+([.,]\d{1,2})?$/.test(amount.trim())) return setError('Enter the quoted amount, e.g. 1600 or 1600.50')
      if (!/^[A-Za-z]{3}$/.test(currency.trim())) return setError('Enter a 3-letter currency such as USD')
    }
    if (to === 'booked' && !stayId && !stayToLink) return setError('Choose the stay, or tick that it is still to be entered')
    if (askFollowUp && !followUpOn) return setError('Choose a follow-up date')
    try {
      await changeStatus.mutateAsync({
        id: lead.id,
        status: to,
        lostReason: to === 'lost' ? (lostReason as LostReason) : null,
        ...(askQuote ? { quotedValue: Number(amount.trim().replace(',', '.')), currency: currency.trim().toUpperCase() } : {}),
        ...(to === 'booked' ? (stayId ? { stayId: Number(stayId) } : { stayToLink: true }) : {}),
        ...(askFollowUp ? { followUpOn, ownerId: ownerId ? Number(ownerId) : null } : {}),
        note: note.trim() || null,
      })
      toast.success(reopening ? 'Lead reopened' : `Lead ${LEAD_STATUS_LABELS[to].toLowerCase()}`)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormError message={error} />
      {to === 'lost' && (
        <Field label="Reason" htmlFor="lost-reason">
          <Select value={lostReason} onValueChange={(v) => setLostReason(v as LostReason)}>
            <SelectTrigger id="lost-reason" className="w-full" aria-invalid={(!!error && !lostReason) || undefined}>
              <SelectValue placeholder="Choose why" />
            </SelectTrigger>
            <SelectContent>
              {LOST_REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {LOST_REASON_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {askQuote && (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Quoted amount" htmlFor="quote-amount">
            <Input id="quote-amount" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Currency" htmlFor="quote-currency">
            <Input id="quote-currency" list="quote-currencies" maxLength={3} className="uppercase" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            <datalist id="quote-currencies">
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>
      )}
      {to === 'booked' && (
        <>
          <Field label="Stay" htmlFor="lead-stay" hint={stays.length === 0 ? 'This person has no stays on record yet.' : undefined}>
            <Select
              value={stayId}
              onValueChange={(v) => {
                setStayId(v)
                setStayToLink(false)
              }}
              disabled={stays.length === 0}
            >
              <SelectTrigger id="lead-stay" className="w-full">
                <SelectValue placeholder="Choose the stay" />
              </SelectTrigger>
              <SelectContent>
                {stays.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.hotel}, {s.arrivalDate ? formatDate(s.arrivalDate) : 'dates not known'} · {STAY_STATUS_LABELS[s.status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-start gap-2">
            <Checkbox
              id="stay-to-link"
              checked={stayToLink}
              onCheckedChange={(v) => {
                setStayToLink(v === true)
                if (v === true) setStayId('')
              }}
            />
            <Label htmlFor="stay-to-link" className="leading-snug font-normal">
              The stay is still being entered – link it later. When the booking arrives, it links itself.
            </Label>
          </div>
        </>
      )}
      {askFollowUp && (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {reopening && (
            <Field label="Owner" htmlFor="reopen-owner">
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger id="reopen-owner" className="w-full">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {owners
                    .filter((o) => o.isActive)
                    .map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {fullName(o)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Next follow-up" htmlFor="status-follow-up">
            <Input id="status-follow-up" type="date" min={today} value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} />
          </Field>
        </div>
      )}
      <Field label="Note" htmlFor="status-note" hint="Optional. Saved on the lead's timeline.">
        <Textarea id="status-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={5000} className="min-h-16" />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant={to === 'lost' ? 'destructive' : 'default'} disabled={changeStatus.isPending}>
          {changeStatus.isPending ? 'Saving…' : reopening ? 'Reopen' : (TITLES[to] ?? `Move to ${LEAD_STATUS_LABELS[to]}`)}
        </Button>
      </DialogFooter>
    </form>
  )
}
