import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Field, FormError } from '@/components/field'
import { LastUpdated } from '@/components/last-updated'
import { PhoneInput } from '@/components/phone-input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGuestMutations } from '@/hooks/use-guests'
import { errorMessage } from '@/lib/api'
import { fullName } from '@/lib/format'
import { STATUS_LABELS, STATUS_OPTIONS, type ContactMethodKind, type ContactMethodStatus } from '@/lib/guests'
import { formatPhone, phoneHint, splitPhone } from '@/lib/phone'
import type { ContactMethod, Guest } from '@/lib/types'
import { DuplicateWarning } from './duplicate-warning'

const emailSchema = z.email('Enter a valid email')

export interface ContactMethodTarget {
  kind: ContactMethodKind
  method?: ContactMethod // editing; absent when adding
}

// Add email / Add phone / Edit. The first of each kind is always primary,
// and the primary can only move by making another one primary.
export function ContactMethodDialog({
  guest,
  target,
  onOpenChange,
}: {
  guest: Guest
  target: ContactMethodTarget | null
  onOpenChange: (open: boolean) => void
}) {
  const kind = target?.kind ?? 'email'
  const noun = kind === 'email' ? 'email' : 'phone'
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{target?.method ? `Edit ${noun}` : `Add ${noun}`}</DialogTitle>
          <DialogDescription>{fullName(guest) || 'This guest'}</DialogDescription>
        </DialogHeader>
        {target && <ContactMethodForm guest={guest} {...target} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ContactMethodForm({
  guest,
  kind,
  method,
  onClose,
}: ContactMethodTarget & { guest: Guest; onClose: () => void }) {
  const { addContactMethod, updateContactMethod } = useGuestMutations()
  const existing = kind === 'email' ? guest.emails : guest.phones
  const isFirst = !method && existing.length === 0
  const split = method && kind === 'phone' ? splitPhone(method.value) : null

  const [value, setValue] = useState(method && kind === 'email' ? method.value : (split?.number ?? ''))
  const [country, setCountry] = useState<string | null>(split ? split.country : (guest.countryCode ?? 'LK'))
  const [isPrimary, setPrimary] = useState(method?.isPrimary ?? isFirst)
  const [isShared, setShared] = useState(method?.isShared ?? false)
  const [isWhatsapp, setWhatsapp] = useState(method?.isWhatsapp ?? null)
  const [status, setStatus] = useState<ContactMethodStatus>(method?.status ?? 'unverified')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // the first one, or the current primary, stays primary
  const primaryLocked = isFirst || !!method?.isPrimary

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = value.trim()
    if (kind === 'email' ? !emailSchema.safeParse(trimmed).success : !formatPhone(trimmed, country)) {
      setFieldError(kind === 'email' ? 'Enter a valid email' : 'Enter a valid phone number')
      return
    }
    setFieldError(null)
    const input = {
      value: trimmed,
      ...(kind === 'phone' ? { country, isWhatsapp } : {}),
      isPrimary,
      isShared,
      status,
    }
    setSaving(true)
    try {
      if (method) await updateContactMethod.mutateAsync({ guestId: guest.id, id: method.id, ...input })
      else await addContactMethod.mutateAsync({ guestId: guest.id, kind, ...input })
      toast.success(method ? 'Saved' : kind === 'email' ? 'Email added' : 'Phone added')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form id="contact-method-form" onSubmit={submit} className="grid gap-4" noValidate>
        <FormError message={error} />
        {kind === 'email' ? (
          <Field label="Email" htmlFor="method-value" error={fieldError ?? undefined}>
            <Input
              id="method-value"
              type="email"
              autoFocus
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={!!fieldError || undefined}
            />
          </Field>
        ) : (
          <Field
            label="Phone"
            htmlFor="method-value"
            error={fieldError ?? undefined}
            hint={phoneHint(value, country)}
          >
            <PhoneInput
              id="method-value"
              country={country}
              onCountryChange={setCountry}
              number={value}
              onNumberChange={setValue}
              invalid={!!fieldError}
            />
          </Field>
        )}

        <div className="grid gap-2">
          <CheckboxRow
            id="method-primary"
            label="Primary"
            hint={
              isFirst
                ? `The first ${kind} is always primary.`
                : method?.isPrimary
                  ? `To move the star, make another ${kind} primary.`
                  : undefined
            }
            checked={isPrimary}
            disabled={primaryLocked}
            onChange={setPrimary}
          />
          <CheckboxRow
            id="method-shared"
            label="Shared"
            hint="An agent's office or family address. Never used for marketing or to match bookings."
            checked={isShared}
            onChange={setShared}
          />
          {kind === 'phone' && (
            <CheckboxRow
              id="method-whatsapp"
              label="On WhatsApp"
              checked={isWhatsapp === true}
              // unticking keeps a known "not on WhatsApp", otherwise goes back to not known
              onChange={(c) => setWhatsapp(c ? true : method?.isWhatsapp === false ? false : null)}
            />
          )}
        </div>

        <Field label="Status" htmlFor="method-status">
          <Select value={status} onValueChange={(v) => setStatus(v as ContactMethodStatus)}>
            <SelectTrigger id="method-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS[kind].map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[kind][s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <DuplicateWarning
          kind={kind}
          value={value}
          country={country}
          excludeId={guest.id}
          shared={isShared}
          onOpen={onClose}
        />
        {method && <LastUpdated value={method.lastUpdated} />}
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="contact-method-form" disabled={saving}>
          {saving ? 'Saving…' : method ? 'Save' : 'Add'}
        </Button>
      </DialogFooter>
    </>
  )
}

function CheckboxRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(c) => onChange(c === true)} className="mt-0.5" />
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}
