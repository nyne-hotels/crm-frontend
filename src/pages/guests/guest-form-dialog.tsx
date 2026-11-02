import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { CountryPicker } from '@/components/country-picker'
import { Field, FormError } from '@/components/field'
import { PhoneInput } from '@/components/phone-input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useGuestMutations } from '@/hooks/use-guests'
import { useCompanyOptions } from '@/hooks/use-reference-data'
import { errorMessage } from '@/lib/api'
import { CONTACT_TYPE_LABELS, CONTACT_TYPES, MARKET_LABELS, MARKETS, marketForCountry } from '@/lib/guests'
import { formatPhone, phoneHint } from '@/lib/phone'
import type { Guest } from '@/lib/types'
import { DuplicateWarning } from './duplicate-warning'

// Hotels are in Sri Lanka, so a number with no country picked is read as Sri Lankan.
const DEFAULT_PHONE_COUNTRY = 'LK'
const NO_COMPANY = 'none'

const schema = z.object({
  firstName: z.string().trim(),
  lastName: z.string().trim(),
  contactType: z.enum(CONTACT_TYPES),
  countryCode: z.string().nullable(),
  market: z.enum(MARKETS),
  designation: z.string().trim(),
  companyId: z.string(),
  vipReason: z.string().trim(),
  // only when adding
  email: z.string().trim().pipe(z.union([z.literal(''), z.email('Enter a valid email')])),
  emailShared: z.boolean(),
  phoneNumber: z.string().trim(),
  phoneCountry: z.string().nullable(),
  phoneShared: z.boolean(),
  phoneWhatsapp: z.boolean(),
})
type Values = z.infer<typeof schema>

// Imported guests may have no first name; editing doesn't force one on them.
const withRules = (isNew: boolean, requireFirstName: boolean) =>
  schema.superRefine((v, ctx) => {
    if (requireFirstName && !v.firstName) ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'Enter a first name' })
    if (!isNew) return
    if (!v.email && !v.phoneNumber) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter an email or a phone number' })
    }
    if (v.phoneNumber && !formatPhone(v.phoneNumber, v.phoneCountry)) {
      ctx.addIssue({ code: 'custom', path: ['phoneNumber'], message: 'Enter a valid phone number' })
    }
  })

// Add contact / Edit contact. Stage isn't edited here: stays and leads move it.
export function GuestFormDialog({
  open,
  onOpenChange,
  guest,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  guest?: Guest
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{guest ? 'Edit contact' : 'Add contact'}</DialogTitle>
          <DialogDescription>
            {guest
              ? 'Emails and phones are changed in Contact details on the profile.'
              : 'For example someone who called or messaged but has no booking yet.'}
          </DialogDescription>
        </DialogHeader>
        {/* mounted only while open, so each opening starts from fresh values */}
        {open && <GuestForm guest={guest} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function GuestForm({ guest, onClose }: { guest?: Guest; onClose: () => void }) {
  const isNew = !guest
  const navigate = useNavigate()
  const { create, update } = useGuestMutations()
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
    resolver: zodResolver(withRules(isNew, isNew || !!guest.firstName)),
    defaultValues: {
      firstName: guest?.firstName ?? '',
      lastName: guest?.lastName ?? '',
      contactType: guest?.contactType ?? 'guest',
      countryCode: guest?.countryCode ?? null,
      market: guest?.market ?? 'unknown',
      designation: guest?.designation ?? '',
      companyId: guest?.companyId ? String(guest.companyId) : NO_COMPANY,
      vipReason: guest?.vipReason ?? '',
      email: '',
      emailShared: false,
      phoneNumber: '',
      phoneCountry: DEFAULT_PHONE_COUNTRY,
      phoneShared: false,
      phoneWhatsapp: false,
    },
  })
  const [email, emailShared, phoneNumber, phoneCountry, phoneShared] = useWatch({
    control,
    name: ['email', 'emailShared', 'phoneNumber', 'phoneCountry', 'phoneShared'],
  })

  async function submit(values: Values) {
    setError(null)
    const fields = {
      firstName: values.firstName || null,
      lastName: values.lastName || null,
      contactType: values.contactType,
      countryCode: values.countryCode,
      market: values.market,
      designation: values.designation || null,
      companyId: values.companyId === NO_COMPANY ? null : Number(values.companyId),
      vipReason: values.vipReason || null,
    }
    try {
      if (guest) {
        await update.mutateAsync({ id: guest.id, ...fields })
        toast.success('Contact saved')
        onClose()
        return
      }
      const created = await create.mutateAsync({
        ...fields,
        email: values.email ? { value: values.email, isShared: values.emailShared } : null,
        phone: values.phoneNumber
          ? {
              value: values.phoneNumber,
              country: values.phoneCountry,
              isShared: values.phoneShared,
              isWhatsapp: values.phoneWhatsapp || null,
            }
          : null,
      })
      toast.success('Contact added')
      onClose()
      navigate(`/guests/${created.id}`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <form id="guest-form" onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
        <FormError message={error} />
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName" error={errors.firstName?.message}>
            <Input id="firstName" autoFocus {...register('firstName')} />
          </Field>
          <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
            <Input id="lastName" {...register('lastName')} />
          </Field>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="contactType" error={errors.contactType?.message}>
            <Controller
              control={control}
              name="contactType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="contactType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CONTACT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Job title" htmlFor="designation" hint="For agent contacts, e.g. Managing Director.">
            <Input id="designation" {...register('designation')} />
          </Field>
        </div>
        <Field label="Company" htmlFor="companyId" hint="The travel agent or company they work for. A person belongs to one company.">
          <Controller
            control={control}
            name="companyId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="companyId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COMPANY}>None</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <div className="grid items-start gap-4 sm:grid-cols-2">
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
                    // market follows the country; staff can still change it after
                    setValue('market', marketForCountry(code))
                    if (isNew && code && !getValues('phoneNumber')) setValue('phoneCountry', code)
                  }}
                />
              )}
            />
          </Field>
          <Field label="Market" htmlFor="market" hint="Set from the country. Change it for, say, an expat living in Colombo.">
            <Controller
              control={control}
              name="market"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="market" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARKETS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MARKET_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
        <Field label="VIP reason" htmlFor="vipReason" hint="Fill in to tag them as VIP, e.g. Commercial Director, Condé Nast.">
          <Input id="vipReason" {...register('vipReason')} />
        </Field>

        {isNew && (
          <>
            <Separator />
            <p className="text-sm text-muted-foreground">Enter at least one email or phone number.</p>
            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="off" {...register('email')} />
            </Field>
            <CheckboxField control={control} name="emailShared" label="Shared (agent office or family address)" />
            <DuplicateWarning kind="email" value={email} shared={emailShared} onOpen={onClose} />

            <Field
              label="Phone"
              htmlFor="phoneNumber"
              error={errors.phoneNumber?.message}
              hint={phoneHint(phoneNumber, phoneCountry)}
            >
              <PhoneInput
                id="phoneNumber"
                country={phoneCountry}
                onCountryChange={(code) => setValue('phoneCountry', code)}
                number={phoneNumber}
                onNumberChange={(n) => setValue('phoneNumber', n, { shouldValidate: !!errors.phoneNumber })}
                invalid={!!errors.phoneNumber}
              />
            </Field>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <CheckboxField control={control} name="phoneShared" label="Shared (agent office or family number)" />
              <CheckboxField control={control} name="phoneWhatsapp" label="On WhatsApp" />
            </div>
            <DuplicateWarning kind="phone" value={phoneNumber} country={phoneCountry} shared={phoneShared} onOpen={onClose} />
          </>
        )}
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="guest-form" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : isNew ? 'Add contact' : 'Save'}
        </Button>
      </DialogFooter>
    </>
  )
}

function CheckboxField({
  control,
  name,
  label,
}: {
  control: ReturnType<typeof useForm<Values>>['control']
  name: 'emailShared' | 'phoneShared' | 'phoneWhatsapp'
  label: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center gap-2">
          <Checkbox id={name} checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
          <Label htmlFor={name} className="font-normal">
            {label}
          </Label>
        </div>
      )}
    />
  )
}
