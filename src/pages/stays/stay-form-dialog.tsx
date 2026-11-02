import { zodResolver } from '@hookform/resolvers/zod'
import { XIcon } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
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
import { useCompanyOptions, useOccasionOptions, usePropertyOptions } from '@/hooks/use-reference-data'
import { useStayMutations, type StayInput } from '@/hooks/use-stays'
import { useStayPanel } from '@/hooks/use-stay-panel'
import { errorMessage } from '@/lib/api'
import { fullName } from '@/lib/format'
import { marketForCountry } from '@/lib/guests'
import { formatPhone, phoneHint } from '@/lib/phone'
import {
  CHANNEL_LABELS,
  COMMON_CURRENCIES,
  NEW_STAY_STATUSES,
  nightsBetween,
  nightsLabel,
  STAY_CHANNELS,
  STAY_STATUS_LABELS,
} from '@/lib/stays'
import type { Stay } from '@/lib/types'
import { DuplicateWarning } from '../guests/duplicate-warning'
import { GuestPicker, type PickedGuest } from './guest-picker'

const NONE = 'none'
const DEFAULT_PHONE_COUNTRY = 'LK'

const count = z.string().trim().regex(/^\d{0,2}$/, 'Enter a number of people')

const schema = z
  .object({
    guest: z.custom<PickedGuest | null>(),
    newGuest: z.boolean(),
    firstName: z.string().trim(),
    lastName: z.string().trim(),
    countryCode: z.string().nullable(),
    email: z.string().trim().pipe(z.union([z.literal(''), z.email('Enter a valid email')])),
    phoneNumber: z.string().trim(),
    phoneCountry: z.string().nullable(),
    propertyId: z.string().min(1, 'Choose a hotel'),
    arrivalDate: z.string().min(1, 'Enter the arrival date'),
    departureDate: z.string().min(1, 'Enter the departure date'),
    bookingReference: z.string().trim(),
    roomType: z.string().trim(),
    adults: count,
    children: count,
    roomRevenue: z.string().trim().regex(/^(\d+([.,]\d{1,2})?)?$/, 'Enter an amount, e.g. 450 or 450.50'),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^([A-Z]{3})?$/, 'Use a 3-letter code such as USD'),
    channel: z.enum(STAY_CHANNELS),
    bookingCompanyId: z.string(),
    occasionId: z.string(),
    status: z.enum(['booked', 'checked_in', 'checked_out']),
    bookingRemarks: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.newGuest) {
      if (!v.firstName) ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'Enter a first name' })
      if (!v.email && !v.phoneNumber) {
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter an email or a phone number' })
      }
      if (v.phoneNumber && !formatPhone(v.phoneNumber, v.phoneCountry)) {
        ctx.addIssue({ code: 'custom', path: ['phoneNumber'], message: 'Enter a valid phone number' })
      }
    } else if (!v.guest) {
      ctx.addIssue({ code: 'custom', path: ['guest'], message: 'Choose a guest, or add a new one' })
    }
    if (v.arrivalDate && v.departureDate && v.departureDate < v.arrivalDate) {
      ctx.addIssue({ code: 'custom', path: ['departureDate'], message: 'Departure cannot be before arrival' })
    }
    if (v.roomRevenue && !v.currency) {
      ctx.addIssue({ code: 'custom', path: ['currency'], message: 'Room revenue needs a currency' })
    }
  })
type Values = z.infer<typeof schema>

// Add stay (a walk-in, an owner's guest, or while the booking system is down)
// and Edit stay. The status changes with the buttons on the stay detail.
export function StayFormDialog({
  open,
  onOpenChange,
  stay,
  guest,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stay?: Stay
  guest?: PickedGuest // adding from a guest's profile
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{stay ? 'Edit stay' : 'Add stay'}</DialogTitle>
          <DialogDescription>
            {stay
              ? 'Check-in, check-out and cancelling are buttons on the stay itself.'
              : 'For walk-ins, owner’s guests, or while the booking system is down. Leave the booking reference blank if there isn’t one; a later import can fill it in.'}
          </DialogDescription>
        </DialogHeader>
        {/* mounted only while open, so each opening starts from fresh values */}
        {open && <StayForm stay={stay} guest={guest} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function StayForm({ stay, guest, onClose }: { stay?: Stay; guest?: PickedGuest; onClose: () => void }) {
  const isNew = !stay
  const { create, update } = useStayMutations()
  const { open: openStay } = useStayPanel()
  const { data: hotels = [] } = usePropertyOptions()
  const { data: occasionOptions = [] } = useOccasionOptions()
  const { data: companies = [] } = useCompanyOptions()
  const [error, setError] = useState<string | null>(null)

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
      guest: stay
        ? { id: stay.guest.id, name: fullName(stay.guest) || `Guest #${stay.guest.id}`, detail: stay.guest.email ?? stay.guest.phone }
        : (guest ?? null),
      newGuest: false,
      firstName: '',
      lastName: '',
      countryCode: null,
      email: '',
      phoneNumber: '',
      phoneCountry: DEFAULT_PHONE_COUNTRY,
      propertyId: stay?.propertyId ?? '',
      arrivalDate: stay?.arrivalDate ?? '',
      departureDate: stay?.departureDate ?? '',
      bookingReference: stay?.bookingReference ?? '',
      roomType: stay?.roomType ?? '',
      adults: stay?.adults?.toString() ?? '',
      children: stay?.children?.toString() ?? '',
      roomRevenue: stay?.roomRevenue?.toString() ?? '',
      currency: stay?.currency ?? '',
      channel: stay?.channel ?? 'direct',
      bookingCompanyId: stay?.bookingCompanyId?.toString() ?? NONE,
      occasionId: stay?.occasionId?.toString() ?? NONE,
      status: 'booked',
      bookingRemarks: stay?.bookingRemarks ?? '',
    },
  })
  const [newGuest, arrival, departure, email, phoneNumber, phoneCountry] = useWatch({
    control,
    name: ['newGuest', 'arrivalDate', 'departureDate', 'email', 'phoneNumber', 'phoneCountry'],
  })
  const nights = arrival && departure ? nightsBetween(arrival, departure) : null
  // the guest is fixed when adding from their profile
  const guestLocked = isNew && !!guest

  async function submit(v: Values) {
    setError(null)
    const fields: StayInput = {
      propertyId: v.propertyId,
      arrivalDate: v.arrivalDate,
      departureDate: v.departureDate,
      bookingReference: v.bookingReference || null,
      roomType: v.roomType || null,
      adults: v.adults ? Number(v.adults) : null,
      children: v.children ? Number(v.children) : null,
      roomRevenue: v.roomRevenue ? Number(v.roomRevenue.replace(',', '.')) : null,
      currency: v.currency || null,
      channel: v.channel,
      bookingCompanyId: v.bookingCompanyId === NONE ? null : Number(v.bookingCompanyId),
      occasionId: v.occasionId === NONE ? null : Number(v.occasionId),
      bookingRemarks: v.bookingRemarks || null,
    }
    try {
      if (stay) {
        await update.mutateAsync({ id: stay.id, ...fields, contactId: v.guest!.id })
        toast.success('Stay saved')
        onClose()
        return
      }
      const created = await create.mutateAsync({
        ...fields,
        status: v.status,
        ...(v.newGuest
          ? {
              newGuest: {
                firstName: v.firstName,
                lastName: v.lastName || null,
                contactType: 'guest',
                countryCode: v.countryCode,
                market: marketForCountry(v.countryCode),
                designation: null,
                vipReason: null,
                email: v.email ? { value: v.email, isShared: false } : null,
                phone: v.phoneNumber
                  ? { value: v.phoneNumber, country: v.phoneCountry, isShared: false, isWhatsapp: null }
                  : null,
              },
            }
          : { contactId: v.guest!.id }),
      })
      toast.success(v.newGuest ? 'Guest and stay added' : 'Stay added')
      onClose()
      openStay(created.id)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <form id="stay-form" onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
        <FormError message={error} />

        {/* ---- guest ---- */}
        {!newGuest ? (
          <Field label="Guest" htmlFor="guest" error={errors.guest?.message}>
            {guestLocked ? (
              <p className="py-1.5 text-sm font-medium">{guest.name}</p>
            ) : (
              <Controller
                control={control}
                name="guest"
                render={({ field }) => (
                  <GuestPicker
                    id="guest"
                    value={field.value}
                    onChange={field.onChange}
                    invalid={!!errors.guest}
                    onNewGuest={
                      isNew
                        ? (typed) => {
                            setValue('newGuest', true)
                            // what was typed in the search starts the new guest
                            if (typed.includes('@')) setValue('email', typed)
                            else if (/^[+\d][\d\s-]+$/.test(typed)) setValue('phoneNumber', typed)
                            else {
                              const [first, ...rest] = typed.split(/\s+/)
                              setValue('firstName', first ?? '')
                              setValue('lastName', rest.join(' '))
                            }
                          }
                        : undefined
                    }
                  />
                )}
              />
            )}
          </Field>
        ) : (
          <fieldset className="grid gap-4 rounded-md border p-4">
            <legend className="flex items-center gap-2 px-1 text-sm font-medium">
              New guest
              <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => setValue('newGuest', false)}>
                <XIcon /> Pick an existing guest
              </Button>
            </legend>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="firstName" error={errors.firstName?.message}>
                <Input id="firstName" autoFocus {...register('firstName')} />
              </Field>
              <Field label="Last name" htmlFor="lastName">
                <Input id="lastName" {...register('lastName')} />
              </Field>
            </div>
            <Field label="Country" htmlFor="countryCode">
              <Controller
                control={control}
                name="countryCode"
                render={({ field }) => (
                  <CountryPicker
                    id="countryCode"
                    value={field.value}
                    onChange={(code) => {
                      field.onChange(code)
                      if (code && !getValues('phoneNumber')) setValue('phoneCountry', code)
                    }}
                  />
                )}
              />
            </Field>
            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="off" {...register('email')} />
            </Field>
            <DuplicateWarning kind="email" value={email} onOpen={onClose} />
            <Field label="Phone" htmlFor="phoneNumber" error={errors.phoneNumber?.message} hint={phoneHint(phoneNumber, phoneCountry)}>
              <PhoneInput
                id="phoneNumber"
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

        {/* ---- the stay ---- */}
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Hotel" htmlFor="propertyId" error={errors.propertyId?.message}>
            <SelectField control={control} name="propertyId" id="propertyId" placeholder="Choose a hotel">
              {hotels.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectField>
          </Field>
          <Field label="Booking reference" htmlFor="bookingReference" hint="Optional for stays entered by hand">
            <Input id="bookingReference" {...register('bookingReference')} />
          </Field>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Arrival" htmlFor="arrivalDate" error={errors.arrivalDate?.message}>
            <Input id="arrivalDate" type="date" {...register('arrivalDate')} />
          </Field>
          <Field
            label="Departure"
            htmlFor="departureDate"
            error={errors.departureDate?.message}
            hint={nights != null && nights >= 0 ? nightsLabel(nights) : undefined}
          >
            <Input id="departureDate" type="date" min={arrival || undefined} {...register('departureDate')} />
          </Field>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-4">
          <Field label="Room type" htmlFor="roomType" className="sm:col-span-2">
            <Input id="roomType" placeholder="e.g. Garden Suite" {...register('roomType')} />
          </Field>
          <Field label="Adults" htmlFor="adults" error={errors.adults?.message}>
            <Input id="adults" inputMode="numeric" {...register('adults')} />
          </Field>
          <Field label="Children" htmlFor="children" error={errors.children?.message}>
            <Input id="children" inputMode="numeric" {...register('children')} />
          </Field>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-4">
          <Field label="Room revenue" htmlFor="roomRevenue" error={errors.roomRevenue?.message} className="sm:col-span-2">
            <Input id="roomRevenue" inputMode="decimal" {...register('roomRevenue')} />
          </Field>
          <Field label="Currency" htmlFor="currency" error={errors.currency?.message} className="sm:col-span-2">
            <Input id="currency" list="currencies" maxLength={3} className="uppercase" {...register('currency')} />
            <datalist id="currencies">
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <Field label="Channel" htmlFor="channel">
            <SelectField control={control} name="channel" id="channel">
              {STAY_CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </SelectItem>
              ))}
            </SelectField>
          </Field>
          <Field
            label="Agent or OTA"
            htmlFor="bookingCompanyId"
            hint={companies.length === 0 ? 'Add travel agents and OTAs under Companies' : 'Shows on the company’s profile'}
          >
            <SelectField control={control} name="bookingCompanyId" id="bookingCompanyId" disabled={companies.length === 0}>
              <SelectItem value={NONE}>None</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectField>
          </Field>
          <Field label="Occasion" htmlFor="occasionId">
            <SelectField control={control} name="occasionId" id="occasionId">
              <SelectItem value={NONE}>None</SelectItem>
              {occasionOptions.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectField>
          </Field>
        </div>
        {isNew && (
          <Field label="Status" htmlFor="status" hint="Pick checked in or checked out to record a stay that has already started or ended.">
            <SelectField control={control} name="status" id="status">
              {NEW_STAY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STAY_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectField>
          </Field>
        )}
        <Field label="Special requests" htmlFor="bookingRemarks" hint="Booking remarks. A booking import replaces them.">
          <Textarea id="bookingRemarks" {...register('bookingRemarks')} />
        </Field>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="stay-form" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : isNew ? 'Add stay' : 'Save'}
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
  disabled,
  children,
}: {
  control: Control<Values>
  name: 'propertyId' | 'channel' | 'bookingCompanyId' | 'occasionId' | 'status'
  id: string
  placeholder?: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select value={field.value || undefined} onValueChange={field.onChange} disabled={disabled}>
          <SelectTrigger id={id} className="w-full" aria-invalid={!!fieldState.error || undefined}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>{children}</SelectContent>
        </Select>
      )}
    />
  )
}
