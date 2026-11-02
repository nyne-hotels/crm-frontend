import { useState } from 'react'
import { toast } from 'sonner'
import { Field, FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLeadMutations, useLeadOwners } from '@/hooks/use-leads'
import { useOccasionOptions, usePropertyOptions } from '@/hooks/use-reference-data'
import { useGuestStays } from '@/hooks/use-stays'
import { errorMessage } from '@/lib/api'
import { formatDate, fullName } from '@/lib/format'
import { hotelToday, isOpen, LEAD_SOURCES, SOURCE_LABELS, type LeadSource } from '@/lib/leads'
import { COMMON_CURRENCIES, didNotHappen, nightsBetween, nightsLabel, STAY_STATUS_LABELS } from '@/lib/stays'
import type { Lead } from '@/lib/types'

const NONE = 'none'

// Edit the request, the owner, the follow-up and the quote. Entering a quote
// on a new or contacted lead moves it to quoted.
export function EditLeadDialog({ lead, open, onOpenChange }: { lead: Lead; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit lead</DialogTitle>
          <DialogDescription>The status changes with its own buttons.</DialogDescription>
        </DialogHeader>
        {open && <EditForm lead={lead} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function EditForm({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { update } = useLeadMutations()
  const { data: owners = [] } = useLeadOwners()
  const { data: hotels = [] } = usePropertyOptions()
  const { data: occasions = [] } = useOccasionOptions()
  const [source, setSource] = useState<LeadSource>(lead.source)
  const [propertyId, setPropertyId] = useState(lead.propertyId ?? NONE)
  const [checkIn, setCheckIn] = useState(lead.checkIn ?? '')
  const [checkOut, setCheckOut] = useState(lead.checkOut ?? '')
  const [adults, setAdults] = useState(lead.adults?.toString() ?? '')
  const [children, setChildren] = useState(lead.children?.toString() ?? '')
  const [occasionId, setOccasionId] = useState(lead.occasionId?.toString() ?? NONE)
  const [ownerId, setOwnerId] = useState(lead.owner ? String(lead.owner.id) : '')
  const [followUpOn, setFollowUpOn] = useState(lead.followUpOn ?? '')
  const [amount, setAmount] = useState(lead.quotedValue?.toString() ?? '')
  const [currency, setCurrency] = useState(lead.currency ?? '')
  const [error, setError] = useState<string | null>(null)
  const open = isOpen(lead.status)
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (checkIn && checkOut && checkOut < checkIn) return setError('Check-out cannot be before check-in')
    if (!/^\d{0,2}$/.test(adults.trim()) || !/^\d{0,2}$/.test(children.trim())) return setError('Enter a number of people')
    if (amount.trim() && !/^\d+([.,]\d{1,2})?$/.test(amount.trim())) return setError('Enter the quoted amount, e.g. 1600 or 1600.50')
    if (amount.trim() && !/^[A-Za-z]{3}$/.test(currency.trim())) return setError('The quote needs a 3-letter currency such as USD')
    if (open && (!ownerId || !followUpOn)) return setError('An open lead needs an owner and a follow-up date')
    try {
      await update.mutateAsync({
        id: lead.id,
        source,
        propertyId: propertyId === NONE ? null : propertyId,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        adults: adults.trim() ? Number(adults) : null,
        children: children.trim() ? Number(children) : null,
        occasionId: occasionId === NONE ? null : Number(occasionId),
        ...(ownerId ? { ownerId: Number(ownerId) } : {}),
        ...(followUpOn ? { followUpOn } : {}),
        quotedValue: amount.trim() ? Number(amount.trim().replace(',', '.')) : null,
        currency: currency.trim() ? currency.trim().toUpperCase() : null,
      })
      toast.success('Lead saved')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormError message={error} />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Source" htmlFor="edit-source">
          <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
            <SelectTrigger id="edit-source" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Hotel" htmlFor="edit-hotel">
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger id="edit-hotel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not decided yet</SelectItem>
              {hotels.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Check-in" htmlFor="edit-checkIn">
          <Input id="edit-checkIn" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </Field>
        <Field label="Check-out" htmlFor="edit-checkOut" hint={nights != null && nights >= 0 ? nightsLabel(nights) : undefined}>
          <Input id="edit-checkOut" type="date" min={checkIn || undefined} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </Field>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-4">
        <Field label="Adults" htmlFor="edit-adults">
          <Input id="edit-adults" inputMode="numeric" value={adults} onChange={(e) => setAdults(e.target.value)} />
        </Field>
        <Field label="Children" htmlFor="edit-children">
          <Input id="edit-children" inputMode="numeric" value={children} onChange={(e) => setChildren(e.target.value)} />
        </Field>
        <Field label="Occasion" htmlFor="edit-occasion" className="sm:col-span-2">
          <Select value={occasionId} onValueChange={setOccasionId}>
            <SelectTrigger id="edit-occasion" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {occasions.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Owner" htmlFor="edit-owner">
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger id="edit-owner" className="w-full">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {owners
                .filter((o) => o.isActive || String(o.id) === ownerId)
                .map((o) => (
                  <SelectItem key={o.id} value={String(o.id)} disabled={!o.isActive}>
                    {fullName(o)}
                    {!o.isActive && ' (left)'}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Follow up on" htmlFor="edit-followUp">
          <Input id="edit-followUp" type="date" min={hotelToday()} value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} />
        </Field>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Quoted amount" htmlFor="edit-amount" hint={lead.status === 'new' || lead.status === 'contacted' ? 'Entering a quote moves the lead to quoted' : undefined}>
          <Input id="edit-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Currency" htmlFor="edit-currency">
          <Input id="edit-currency" list="edit-currencies" maxLength={3} className="uppercase" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          <datalist id="edit-currencies">
            {COMMON_CURRENCIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// Link stay: one of the person's stays becomes the lead's booking (the lead becomes booked).
export function LinkStayDialog({ lead, open, onOpenChange }: { lead: Lead; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { linkStay } = useLeadMutations()
  const { data } = useGuestStays(lead.person.id, open)
  const [stayId, setStayId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const stays = (data?.stays ?? []).filter((s) => !didNotHappen(s.status) || s.id === lead.stay?.id)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!stayId) return setError('Choose the stay')
    try {
      await linkStay.mutateAsync({ id: lead.id, stayId: Number(stayId) })
      toast.success('Stay linked; the lead is booked')
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link stay</DialogTitle>
          <DialogDescription>Choose the stay this enquiry booked. The lead becomes booked.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormError message={error} />
          <Field
            label="Stay"
            htmlFor="link-stay"
            hint={data && stays.length === 0 ? 'No stays on record yet. Add the stay, or import the booking; it links itself when it arrives.' : undefined}
          >
            <Select value={stayId} onValueChange={setStayId} disabled={stays.length === 0}>
              <SelectTrigger id="link-stay" className="w-full">
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={linkStay.isPending || !stayId}>
              {linkStay.isPending ? 'Linking…' : 'Link stay'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
