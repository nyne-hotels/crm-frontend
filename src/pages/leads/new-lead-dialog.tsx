import { zodResolver } from '@hookform/resolvers/zod'
import { XIcon } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { CountryPicker } from '@/components/country-picker'
import { Field, FormError } from '@/components/field'
import { PhoneInput } from '@/components/phone-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useLeadMutations, useLeadOwners } from '@/hooks/use-leads'
import { useMe } from '@/hooks/use-me'
import { useOccasionOptions, usePropertyOptions } from '@/hooks/use-reference-data'
import { errorMessage } from '@/lib/api'
import { fullName } from '@/lib/format'
import { marketForCountry } from '@/lib/guests'
import { addDays, hotelToday, LEAD_SOURCES, SOURCE_LABELS } from '@/lib/leads'
import { formatPhone, phoneHint } from '@/lib/phone'
import { nightsBetween, nightsLabel } from '@/lib/stays'
import { DuplicateWarning } from '../guests/duplicate-warning'
import { GuestPicker, type PickedGuest } from '../stays/guest-picker'

const NONE = 'none'
const DEFAULT_PHONE_COUNTRY = 'LK'
const count = z.string().trim().regex(/^\d{0,2}$/, 'Enter a number of people')

const schema = z
  .object({
    person: z.custom<PickedGuest | null>(),
    newPerson: z.boolean(),
    firstName: z.string().trim(),
    lastName: z.string().trim(),
    countryCode: z.string().nullable(),
    email: z.string().trim().pipe(z.union([z.literal(''), z.email('Enter a valid email')])),
    phoneNumber: z.string().trim(),
    phoneCountry: z.string().nullable(),
    source: z.enum(LEAD_SOURCES, 'Choose where the enquiry came from'),
    propertyId: z.string(),
    checkIn: z.string(),
    checkOut: z.string(),
    adults: count,
    children: count,
    occasionId: z.string(),
    ownerId: z.string().min(1, 'Choose who follows it up'),
    followUpOn: z.string().min(1, 'Choose a follow-up date'),
    note: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.newPerson) {
      if (!v.firstName) ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'Enter a first name' })
      if (!v.email && !v.phoneNumber) {
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter an email or a phone number' })
      }
      if (v.phoneNumber && !formatPhone(v.phoneNumber, v.phoneCountry)) {
        ctx.addIssue({ code: 'custom', path: ['phoneNumber'], message: 'Enter a valid phone number' })
      }
    } else if (!v.person) {
      ctx.addIssue({ code: 'custom', path: ['person'], message: 'Find the person, or add them as new' })
    }
    if (v.checkIn && v.checkOut && v.checkOut < v.checkIn) {
      ctx.addIssue({ code: 'custom', path: ['checkOut'], message: 'Check-out cannot be before check-in' })
    }
  })
type Values = z.infer<typeof schema>

// New lead: find or add the person, then the request. Owner defaults to you,
// follow-up to tomorrow. Opens the lead once saved.
export function NewLeadDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person?: PickedGuest // from a guest's profile
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>An enquiry by website, WhatsApp, Instagram, phone, email, an agent, a walk-in or an OTA.</DialogDescription>
        </DialogHeader>
        {open && <LeadForm person={person} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function LeadForm({ person, onClose }: { person?: PickedGuest; onClose: () => void }) {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: owners = [] } = useLeadOwners()
  const { data: hotels = [] } = usePropertyOptions()
  const { data: occasionOptions = [] } = useOccasionOptions()
  const { create } = useLeadMutations()
  const [error, setError] = useState<string | null>(null)
  const today = hotelToday()

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      person: person ?? null,
      newPerson: false,
      firstName: '',
      lastName: '',
      countryCode: null,
      email: '',
      phoneNumber: '',
      phoneCountry: DEFAULT_PHONE_COUNTRY,
      source: undefined,
      propertyId: NONE,
      checkIn: '',
      checkOut: '',
      adults: '',
      children: '',
      occasionId: NONE,
      ownerId: me ? String(me.id) : '',
      followUpOn: addDays(today, 1),
      note: '',
    },
  })
  const [newPerson, checkIn, checkOut, email, phoneNumber, phoneCountry] = useWatch({
    control,
    name: ['newPerson', 'checkIn', 'checkOut', 'email', 'phoneNumber', 'phoneCountry'],
  })
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : null

  async function submit(v: Values) {
    setError(null)
    try {
      const lead = await create.mutateAsync({
        source: v.source,
        propertyId: v.propertyId === NONE ? null : v.propertyId,
        checkIn: v.checkIn || null,
        checkOut: v.checkOut || null,
        adults: v.adults ? Number(v.adults) : null,
        children: v.children ? Number(v.children) : null,
        occasionId: v.occasionId === NONE ? null : Number(v.occasionId),
        ownerId: Number(v.ownerId),
        followUpOn: v.followUpOn,
        note: v.note || null,
        ...(v.newPerson
          ? {
              newPerson: {
                firstName: v.firstName,
                lastName: v.lastName || null,
                contactType: 'lead',
                countryCode: v.countryCode,
                market: marketForCountry(v.countryCode),
                designation: null,
                vipReason: null,
                email: v.email ? { value: v.email, isShared: false } : null,
                phone: v.phoneNumber ? { value: v.phoneNumber, country: v.phoneCountry, isShared: false, isWhatsapp: null } : null,
              },
            }
          : { contactId: v.person!.id }),
      })
      toast.success('Lead added')
      onClose()
      navigate(`/leads/${lead.id}`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <form id="lead-form" onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
        <FormError message={error} />

        {/* ---- the person ---- */}
        {!newPerson ? (
          <Field label="Person" htmlFor="lead-person" error={errors.person?.message}>
            {person ? (
              <p className="py-1.5 text-sm font-medium">{person.name}</p>
            ) : (
              <Controller
                control={control}
                name="person"
                render={({ field }) => (
                  <GuestPicker
                    id="lead-person"
                    value={field.value}
                    onChange={field.onChange}
                    invalid={!!errors.person}
                    newLabel="New person"
                    onNewGuest={(typed) => {
                      setValue('newPerson', true)
                      // what was typed in the search starts the new person
                      if (typed.includes('@')) setValue('email', typed)
                      else if (/^[+\d][\d\s-]+$/.test(typed)) setValue('phoneNumber', typed)
                      else {
                        const [first, ...rest] = typed.split(/\s+/)
                        setValue('firstName', first ?? '')
                        setValue('lastName', rest.join(' '))
                      }
                    }}
                  />
                )}
              />
            )}
          </Field>
        ) : (
          <fieldset className="grid gap-4 rounded-md border p-4">
            <legend className="flex items-center gap-2 px-1 text-sm font-medium">
              New person
              <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => setValue('newPerson', false)}>
                <XIcon /> Find someone already here
              </Button>
            </legend>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="lead-firstName" error={errors.firstName?.message}>
                <Input id="lead-firstName" autoFocus {...register('firstName')} />
              </Field>
              <Field label="Last name" htmlFor="lead-lastName">
                <Input id="lead-lastName" {...register('lastName')} />
              </Field>
            </div>
            <Field label="Country" htmlFor="lead-countryCode">
              <Controller
                control={control}
                name="countryCode"
                render={({ field }) => (
                  <CountryPicker
                    id="lead-countryCode"
                    value={field.value}
                    onChange={(code) => {
                      field.onChange(code)
                      if (code && !getValues('phoneNumber')) setValue('phoneCountry', code)
                    }}
                  />
                )}
              />
            </Field>
            <Field label="Email" htmlFor="lead-email" error={errors.email?.message}>
              <Input id="lead-email" type="email" autoComplete="off" {...register('email')} />
            </Field>
            <DuplicateWarning kind="email" value={email} onOpen={onClose} />
            <Field label="Phone" htmlFor="lead-phone" error={errors.phoneNumber?.message} hint={phoneHint(phoneNumber, phoneCountry)}>
              <PhoneInput
                id="lead-phone"
                country={phoneCountry}
                onCountryChange={(code) => setValue('phoneCountry', code)}
                number={phoneNumber}
                onNumberChange={(n) => setValue('phoneNumber', n, { shouldValidate: !!errors.phoneNumber })}
                invalid={!!errors.phoneNumber}
              />
            </Field>
            <DuplicateWarning kind="phone" value={phoneNumber} country={phoneCountry} onOpen={onClose} />
          </fieldset>
        )}

        <Separator />

        {/* ---- the request ---- */}
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Source" htmlFor="lead-source" error={errors.source?.message}>
            <SelectField control={control} name="source" id="lead-source" placeholder="Where did it come from?">
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectField>
          </Field>
          <Field label="Hotel" htmlFor="lead-hotel">
            <SelectField control={control} name="propertyId" id="lead-hotel">
              <SelectItem value={NONE}>Not decided yet</SelectItem>
              {hotels.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectField>
          </Field>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Check-in" htmlFor="lead-checkIn">
            <Input id="lead-checkIn" type="date" {...register('checkIn')} />
          </Field>
          <Field
            label="Check-out"
            htmlFor="lead-checkOut"
            error={errors.checkOut?.message}
            hint={nights != null && nights >= 0 ? nightsLabel(nights) : undefined}
          >
            <Input id="lead-checkOut" type="date" min={checkIn || undefined} {...register('checkOut')} />
          </Field>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-4">
          <Field label="Adults" htmlFor="lead-adults" error={errors.adults?.message}>
            <Input id="lead-adults" inputMode="numeric" {...register('adults')} />
          </Field>
          <Field label="Children" htmlFor="lead-children" error={errors.children?.message}>
            <Input id="lead-children" inputMode="numeric" {...register('children')} />
          </Field>
          <Field label="Occasion" htmlFor="lead-occasion" className="sm:col-span-2">
            <SelectField control={control} name="occasionId" id="lead-occasion">
              <SelectItem value={NONE}>None</SelectItem>
              {occasionOptions.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectField>
          </Field>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Owner" htmlFor="lead-owner" error={errors.ownerId?.message}>
            <SelectField control={control} name="ownerId" id="lead-owner" placeholder="Who follows it up?">
              {owners
                .filter((o) => o.isActive)
                .map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {fullName(o)}
                    {o.id === me?.id && ' (you)'}
                  </SelectItem>
                ))}
            </SelectField>
          </Field>
          <Field label="Follow up on" htmlFor="lead-followUp" error={errors.followUpOn?.message}>
            <Input id="lead-followUp" type="date" min={today} {...register('followUpOn')} />
          </Field>
        </div>
        <Field label="First note" htmlFor="lead-note" hint="Budget, room wishes, anything they said.">
          <Textarea id="lead-note" maxLength={5000} {...register('note')} />
        </Field>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="lead-form" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Add lead'}
        </Button>
      </DialogFooter>
    </>
  )
}

function SelectField({
  control,
  name,
  id,
  placeholder,
  children,
}: {
  control: Control<Values>
  name: 'source' | 'propertyId' | 'occasionId' | 'ownerId'
  id: string
  placeholder?: string
  children: React.ReactNode
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select value={field.value || undefined} onValueChange={field.onChange}>
          <SelectTrigger id={id} className="w-full" aria-invalid={!!fieldState.error || undefined}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>{children}</SelectContent>
        </Select>
      )}
    />
  )
}
