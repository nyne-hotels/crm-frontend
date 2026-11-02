import { XIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CountryPicker } from '@/components/country-picker'
import { Field, FormError } from '@/components/field'
import { PhoneInput } from '@/components/phone-input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCompanyMutations } from '@/hooks/use-companies'
import { errorMessage } from '@/lib/api'
import { marketForCountry } from '@/lib/guests'
import { formatPhone, phoneHint } from '@/lib/phone'
import { DuplicateWarning } from '../guests/duplicate-warning'
import { GuestPicker, type PickedGuest } from '../stays/guest-picker'

// Add person: link someone already in the CRM (it moves them from any other
// company), or add a new agent contact with their work email and phone.
export function AddPersonDialog({
  companyId,
  companyName,
  open,
  onOpenChange,
}: {
  companyId: number
  companyName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add person to {companyName}</DialogTitle>
          <DialogDescription>A person belongs to one company; linking someone moves them here.</DialogDescription>
        </DialogHeader>
        {open && <PersonForm companyId={companyId} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function PersonForm({ companyId, onClose }: { companyId: number; onClose: () => void }) {
  const { addPerson } = useCompanyMutations()
  const [picked, setPicked] = useState<PickedGuest | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [designation, setDesignation] = useState('')
  const [countryCode, setCountryCode] = useState<string | null>('LK')
  const [email, setEmail] = useState('')
  const [emailShared, setEmailShared] = useState(false)
  const [phone, setPhone] = useState('')
  const [phoneCountry, setPhoneCountry] = useState<string | null>('LK')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (!isNew) {
        if (!picked) return setError('Find the person, or add them as new')
        await addPerson.mutateAsync({ id: companyId, contactId: picked.id })
      } else {
        if (!firstName.trim()) return setError('Enter a first name')
        if (!email.trim() && !phone.trim()) return setError('Enter an email or a phone number')
        if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email')
        if (phone.trim() && !formatPhone(phone, phoneCountry)) return setError('Enter a valid phone number')
        await addPerson.mutateAsync({
          id: companyId,
          newPerson: {
            firstName: firstName.trim(),
            lastName: lastName.trim() || null,
            contactType: 'agent_contact',
            countryCode,
            market: marketForCountry(countryCode),
            designation: designation.trim() || null,
            vipReason: null,
            email: email.trim() ? { value: email.trim(), isShared: emailShared } : null,
            phone: phone.trim() ? { value: phone.trim(), country: phoneCountry, isShared: false, isWhatsapp: null } : null,
          },
        })
      }
      toast.success('Person added')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormError message={error} />
      {!isNew ? (
        <Field label="Person" htmlFor="company-person">
          <GuestPicker
            id="company-person"
            value={picked}
            onChange={setPicked}
            newLabel="New person"
            onNewGuest={(typed) => {
              setIsNew(true)
              if (typed.includes('@')) setEmail(typed)
              else if (/^[+\d][\d\s-]+$/.test(typed)) setPhone(typed)
              else {
                const [first, ...rest] = typed.split(/\s+/)
                setFirstName(first ?? '')
                setLastName(rest.join(' '))
              }
            }}
          />
        </Field>
      ) : (
        <fieldset className="grid gap-4 rounded-md border p-4">
          <legend className="flex items-center gap-2 px-1 text-sm font-medium">
            New agent contact
            <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => setIsNew(false)}>
              <XIcon /> Find someone already here
            </Button>
          </legend>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="person-first">
              <Input id="person-first" autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last name" htmlFor="person-last">
              <Input id="person-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field label="Job title" htmlFor="person-title">
              <Input id="person-title" placeholder="e.g. Sales manager" value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </Field>
            <Field label="Country" htmlFor="person-country">
              <CountryPicker id="person-country" value={countryCode} onChange={setCountryCode} />
            </Field>
          </div>
          <Field label="Email" htmlFor="person-email">
            <Input id="person-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox id="person-email-shared" checked={emailShared} onCheckedChange={(v) => setEmailShared(v === true)} />
            <Label htmlFor="person-email-shared" className="font-normal">
              Shared office address (never used for marketing or matching)
            </Label>
          </div>
          <DuplicateWarning kind="email" value={email} onOpen={onClose} />
          <Field label="Phone" htmlFor="person-phone" hint={phoneHint(phone, phoneCountry)}>
            <PhoneInput id="person-phone" country={phoneCountry} onCountryChange={setPhoneCountry} number={phone} onNumberChange={setPhone} />
          </Field>
          <DuplicateWarning kind="phone" value={phone} country={phoneCountry} onOpen={onClose} />
        </fieldset>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={addPerson.isPending}>
          {addPerson.isPending ? 'Saving…' : 'Add person'}
        </Button>
      </DialogFooter>
    </form>
  )
}
