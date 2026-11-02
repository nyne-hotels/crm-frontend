import { useState } from 'react'
import { toast } from 'sonner'
import { Field, FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useInteractionMutations, useLeadOwners } from '@/hooks/use-leads'
import { useMe } from '@/hooks/use-me'
import { errorMessage } from '@/lib/api'
import { fullName } from '@/lib/format'
import {
  addDays,
  DIRECTION_LABELS,
  hotelToday,
  INTERACTION_KIND_LABELS,
  INTERACTION_KINDS,
  type InteractionDirection,
  type InteractionKind,
} from '@/lib/leads'
import type { CompanyPerson } from '@/lib/types'

const NOBODY = 'none'

// 'YYYY-MM-DDTHH:mm' in the browser's time, for <input type="datetime-local">
function localNow() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export interface InteractionTarget {
  leadId?: number
  feedbackId?: number // following up a feedback response; it gives the guest
  contactId?: number
  companyId?: number
  people?: CompanyPerson[] // on a company: optionally one of its people
  openLead?: { followUpOn: string | null } // on an open lead: set the next follow-up too
}

// Log call / WhatsApp / email / meeting / visit / Instagram DM, on a lead, a
// person or a company. The first reply on a new lead moves it to contacted.
export function LogInteractionDialog({
  open,
  onOpenChange,
  target,
  kind,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: InteractionTarget
  kind?: InteractionKind
  title?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? (kind ? `Log ${INTERACTION_KIND_LABELS[kind].toLowerCase()}` : 'Log a conversation')}</DialogTitle>
          <DialogDescription>A short summary of what was said, so whoever picks it up next knows where things stand.</DialogDescription>
        </DialogHeader>
        {open && <InteractionForm target={target} initialKind={kind ?? 'call'} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function InteractionForm({
  target,
  initialKind,
  onClose,
}: {
  target: InteractionTarget
  initialKind: InteractionKind
  onClose: () => void
}) {
  const { data: me } = useMe()
  const { data: owners = [] } = useLeadOwners()
  const { create } = useInteractionMutations()
  const [kind, setKind] = useState<InteractionKind>(initialKind)
  const [direction, setDirection] = useState<InteractionDirection>('outbound')
  const [when, setWhen] = useState(localNow)
  const [staffId, setStaffId] = useState<string>(me ? String(me.id) : '')
  const [personId, setPersonId] = useState(NOBODY)
  const [summary, setSummary] = useState('')
  const today = hotelToday()
  const [followUpOn, setFollowUpOn] = useState(
    target.openLead ? (target.openLead.followUpOn && target.openLead.followUpOn > today ? target.openLead.followUpOn : addDays(today, 2)) : '',
  )
  const [error, setError] = useState<string | null>(null)
  const staff = owners.filter((o) => o.isActive || String(o.id) === staffId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!summary.trim()) return setError('Write a short summary')
    if (!when || new Date(when) > new Date(Date.now() + 5 * 60_000)) return setError('Enter when it happened (not in the future)')
    try {
      await create.mutateAsync({
        kind,
        direction,
        occurredAt: new Date(when).toISOString(),
        staffId: staffId ? Number(staffId) : null,
        summary: summary.trim(),
        leadId: target.leadId ?? null,
        feedbackId: target.feedbackId ?? null,
        contactId: target.contactId ?? (personId !== NOBODY ? Number(personId) : null),
        companyId: target.companyId ?? null,
        ...(target.openLead && followUpOn ? { followUpOn } : {}),
      })
      toast.success(`${INTERACTION_KIND_LABELS[kind]} logged`)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormError message={error} />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Kind" htmlFor="interaction-kind">
          <Select value={kind} onValueChange={(v) => setKind(v as InteractionKind)}>
            <SelectTrigger id="interaction-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERACTION_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {INTERACTION_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Who started it" htmlFor="interaction-direction">
          <Select value={direction} onValueChange={(v) => setDirection(v as InteractionDirection)}>
            <SelectTrigger id="interaction-direction" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="outbound">{DIRECTION_LABELS.outbound}</SelectItem>
              <SelectItem value="inbound">{DIRECTION_LABELS.inbound}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="When" htmlFor="interaction-when">
          <Input id="interaction-when" type="datetime-local" value={when} max={localNow()} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label="Who spoke to them" htmlFor="interaction-staff">
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger id="interaction-staff" className="w-full">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {fullName(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {target.people && target.people.length > 0 && (
        <Field label="With" htmlFor="interaction-person" hint="Optional: one of the company's people">
          <Select value={personId} onValueChange={setPersonId}>
            <SelectTrigger id="interaction-person" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NOBODY}>The company</SelectItem>
              {target.people.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {fullName(p) || p.email || `Contact #${p.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field label="Summary" htmlFor="interaction-summary">
        <Textarea
          id="interaction-summary"
          autoFocus
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="e.g. Sent December rates for two Garden Suites"
          maxLength={2000}
        />
      </Field>
      {target.openLead && (
        <Field label="Next follow-up" htmlFor="interaction-follow-up">
          <Input id="interaction-follow-up" type="date" value={followUpOn} min={today} onChange={(e) => setFollowUpOn(e.target.value)} />
        </Field>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Log it'}
        </Button>
      </DialogFooter>
    </form>
  )
}
