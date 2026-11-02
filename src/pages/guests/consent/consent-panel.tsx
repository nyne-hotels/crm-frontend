import { MailCheckIcon, MailXIcon, QuoteIcon, ShieldCheckIcon, TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, FormError } from '@/components/field'
import { LastUpdated } from '@/components/last-updated'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useConsentMutations, useGuestConsent } from '@/hooks/use-consent'
import { errorMessage } from '@/lib/api'
import {
  CHANNEL_LABELS,
  CHOICE_SOURCES,
  CONSENT_CHIP_CLASSES,
  CONSENT_SOURCE_LABELS,
  CONSENT_STATUS_LABELS,
  NOT_ON_LIST_LABELS,
  todayIso,
  type ConsentSource,
  type ConsentStatus,
} from '@/lib/consent'
import { formatDate } from '@/lib/format'
import type { ConsentRecord, GuestConsent } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ContactImportNote } from '../contact-import-note'

// Email and WhatsApp consent: status, where and when it was given, and
// whether the guest is on the marketing email list (or why not).
export function ConsentPanel({
  guestId,
  guestName,
  canEdit,
  canOpenImports,
}: {
  guestId: number
  guestName: string
  canEdit: boolean
  canOpenImports: boolean // admins can open the contact import that set it
}) {
  const { data, isPending, isError } = useGuestConsent(guestId)
  const [changing, setChanging] = useState<ConsentRecord | null>(null)

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon className="size-4 text-muted-foreground" /> Consent
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isPending ? (
          <Skeleton className="h-24" />
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load consent.</p>
        ) : (
          <>
            <ul className="grid">
              {data.channels.map((c) => (
                <ConsentLine
                  key={c.channel}
                  record={c}
                  canOpenImport={canOpenImports}
                  onChange={canEdit ? () => setChanging(c) : undefined}
                />
              ))}
            </ul>
            <EmailListLine emailList={data.emailList} />
          </>
        )}
      </CardContent>

      <ChangeConsentDialog
        guestId={guestId}
        guestName={guestName}
        record={changing}
        doNotContact={!!data?.doNotContact}
        onOpenChange={(open) => !open && setChanging(null)}
      />
    </Card>
  )
}

function ConsentLine({
  record: c,
  canOpenImport,
  onChange,
}: {
  record: ConsentRecord
  canOpenImport: boolean
  onChange?: () => void
}) {
  const where = [c.source && CONSENT_SOURCE_LABELS[c.source], formatDate(c.givenAt)].filter(Boolean).join(' · ')
  return (
    <li className="grid gap-1 border-b py-2 last:border-0">
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-sm font-medium">{CHANNEL_LABELS[c.channel]}</span>
        <ConsentChip status={c.status} evidence={c.evidence} />
        {onChange && (
          <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={onChange}>
            Change
          </Button>
        )}
      </div>
      {c.contactImport ? (
        <ContactImportNote contactImport={c.contactImport} canOpen={canOpenImport} className="text-xs" />
      ) : (
        <span className="text-xs text-muted-foreground">{where || 'No choice on record'}</span>
      )}
    </li>
  )
}

// Hover (or focus) the chip to read the wording the guest agreed to.
export function ConsentChip({ status, evidence }: { status: ConsentStatus; evidence?: string | null }) {
  const chip = (
    <Badge className={cn('border-transparent', CONSENT_CHIP_CLASSES[status], evidence && 'cursor-help')} tabIndex={evidence ? 0 : undefined}>
      {CONSENT_STATUS_LABELS[status]}
      {evidence && <QuoteIcon aria-label="Has wording" />}
    </Badge>
  )
  if (!evidence) return chip
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-line">{evidence}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function EmailListLine({ emailList }: { emailList: GuestConsent['emailList'] }) {
  if (emailList.onList) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <MailCheckIcon className="size-3.5 shrink-0" /> On the marketing list
      </p>
    )
  }
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <MailXIcon className="mt-px size-3.5 shrink-0" />
      <span>Not on the marketing list: {emailList.reasons.map((r) => NOT_ON_LIST_LABELS[r]).join(', ')}</span>
    </p>
  )
}

function ChangeConsentDialog({
  guestId,
  guestName,
  record,
  doNotContact,
  onOpenChange,
}: {
  guestId: number
  guestName: string
  record: ConsentRecord | null
  doNotContact: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{record && `${CHANNEL_LABELS[record.channel]} consent`}</DialogTitle>
          <DialogDescription>{guestName}</DialogDescription>
        </DialogHeader>
        {record && (
          <ChangeConsentForm guestId={guestId} record={record} doNotContact={doNotContact} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

const CHOICES = ['opted_in', 'opted_out'] as const

function ChangeConsentForm({
  guestId,
  record,
  doNotContact,
  onClose,
}: {
  guestId: number
  record: ConsentRecord
  doNotContact: boolean
  onClose: () => void
}) {
  const { change } = useConsentMutations(guestId)
  const today = todayIso()
  // most changes flip the current status
  const [status, setStatus] = useState<(typeof CHOICES)[number]>(record.status === 'opted_in' ? 'opted_out' : 'opted_in')
  const [source, setSource] = useState<ConsentSource | ''>('')
  const [givenOn, setGivenOn] = useState(today)
  const [evidence, setEvidence] = useState('')
  const [errors, setErrors] = useState<{ source?: string; givenOn?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const now = [
    CONSENT_STATUS_LABELS[record.status],
    record.source && CONSENT_SOURCE_LABELS[record.source],
    formatDate(record.givenAt),
  ]
    .filter(Boolean)
    .join(' · ')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const problems = {
      source: source ? undefined : 'Choose where it was given',
      givenOn: !givenOn ? 'Enter the date' : givenOn > today ? "The date can't be in the future" : undefined,
    }
    setErrors(problems)
    if (problems.source || problems.givenOn) return
    setSaving(true)
    try {
      await change.mutateAsync({
        channel: record.channel,
        status,
        source: source as ConsentSource,
        givenOn,
        evidence: evidence.trim() || null,
      })
      toast.success(`${CHANNEL_LABELS[record.channel]}: ${CONSENT_STATUS_LABELS[status].toLowerCase()}`)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form id="consent-form" onSubmit={submit} className="grid gap-4" noValidate>
        <FormError message={error} />
        <p className="text-sm text-muted-foreground">Now: {now}</p>
        <Field label="Status">
          <div role="radiogroup" aria-label="Status" className="grid grid-cols-2 gap-2">
            {CHOICES.map((s) => (
              <Button
                key={s}
                type="button"
                role="radio"
                aria-checked={status === s}
                variant={status === s ? 'default' : 'outline'}
                onClick={() => setStatus(s)}
              >
                {CONSENT_STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        </Field>
        {doNotContact && status === 'opted_in' && (
          <p className="flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            This guest is on do not contact. The opt-in is recorded, but they stay off the marketing list until an admin or
            manager clears it.
          </p>
        )}
        <Field label="Where it was given" htmlFor="consent-source" error={errors.source}>
          <Select value={source} onValueChange={(v) => setSource(v as ConsentSource)}>
            <SelectTrigger id="consent-source" className="w-full" aria-invalid={!!errors.source || undefined}>
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {CHOICE_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CONSENT_SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Date given"
          htmlFor="consent-date"
          error={errors.givenOn}
          hint="The latest choice wins: an earlier date won't replace a newer choice on file."
        >
          <Input
            id="consent-date"
            type="date"
            max={today}
            value={givenOn}
            onChange={(e) => setGivenOn(e.target.value)}
            aria-invalid={!!errors.givenOn || undefined}
            className="w-44"
          />
        </Field>
        <Field label="Wording they agreed to (optional)" htmlFor="consent-evidence">
          <Textarea
            id="consent-evidence"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Type or paste the tick box text, e.g. “Send me news and offers from Nyne Hotels”"
            maxLength={2000}
            rows={3}
          />
        </Field>
        {record.lastUpdated && <LastUpdated value={record.lastUpdated} />}
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="consent-form" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </>
  )
}
