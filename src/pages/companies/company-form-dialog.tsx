import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { CountryPicker } from '@/components/country-picker'
import { Field, FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCompanyMutations } from '@/hooks/use-companies'
import { useLeadOwners } from '@/hooks/use-leads'
import { errorMessage } from '@/lib/api'
import { fullName } from '@/lib/format'
import {
  COMPANY_STATUS_LABELS,
  COMPANY_STATUSES,
  COMPANY_TYPE_LABELS,
  COMPANY_TYPES,
  type CompanyStatus,
  type CompanyType,
} from '@/lib/leads'
import type { Company } from '@/lib/types'

const NOBODY = 'none'

// New company / Edit: details, account owner and commission terms.
export function CompanyFormDialog({
  open,
  onOpenChange,
  company,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  company?: Company
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{company ? 'Edit company' : 'New company'}</DialogTitle>
          <DialogDescription>Travel agents, DMCs, OTAs, corporates and media. Names are unique.</DialogDescription>
        </DialogHeader>
        {open && <CompanyForm company={company} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CompanyForm({ company, onClose }: { company?: Company; onClose: () => void }) {
  const navigate = useNavigate()
  const { create, update } = useCompanyMutations()
  const { data: owners = [] } = useLeadOwners()
  const [name, setName] = useState(company?.name ?? '')
  const [companyType, setCompanyType] = useState<CompanyType>(company?.companyType ?? 'travel_agent')
  const [status, setStatus] = useState<CompanyStatus>(company?.status ?? 'active')
  const [countryCode, setCountryCode] = useState<string | null>(company?.countryCode ?? null)
  const [ownerId, setOwnerId] = useState(company?.accountOwner ? String(company.accountOwner.id) : NOBODY)
  const [website, setWebsite] = useState(company?.website ?? '')
  const [address, setAddress] = useState(company?.address ?? '')
  const [commissionNotes, setCommissionNotes] = useState(company?.commissionNotes ?? '')
  const [error, setError] = useState<string | null>(null)
  const saving = create.isPending || update.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Enter a name')
    const input = {
      name: name.trim(),
      companyType,
      status,
      countryCode,
      accountOwnerId: ownerId === NOBODY ? null : Number(ownerId),
      website: website.trim() || null,
      address: address.trim() || null,
      commissionNotes: commissionNotes.trim() || null,
    }
    try {
      if (company) {
        await update.mutateAsync({ id: company.id, ...input })
        toast.success('Company saved')
        onClose()
      } else {
        const created = await create.mutateAsync(input)
        toast.success('Company added')
        onClose()
        navigate(`/companies/${created.id}`)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormError message={error} />
      <Field label="Name" htmlFor="company-name">
        <Input id="company-name" autoFocus value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="company-type">
          <Select value={companyType} onValueChange={(v) => setCompanyType(v as CompanyType)}>
            <SelectTrigger id="company-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {COMPANY_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status" htmlFor="company-status">
          <Select value={status} onValueChange={(v) => setStatus(v as CompanyStatus)}>
            <SelectTrigger id="company-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {COMPANY_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Country" htmlFor="company-country">
          <CountryPicker id="company-country" value={countryCode} onChange={setCountryCode} />
        </Field>
        <Field label="Account owner" htmlFor="company-owner">
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger id="company-owner" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NOBODY}>No one yet</SelectItem>
              {owners
                .filter((o) => o.isActive || String(o.id) === ownerId)
                .map((o) => (
                  <SelectItem key={o.id} value={String(o.id)} disabled={!o.isActive}>
                    {fullName(o)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Website" htmlFor="company-website">
        <Input id="company-website" type="url" placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </Field>
      <Field label="Address" htmlFor="company-address">
        <Textarea id="company-address" className="min-h-14" value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <Field label="Commission terms" htmlFor="company-commission" hint="e.g. 15% on room revenue, paid monthly">
        <Textarea id="company-commission" value={commissionNotes} maxLength={5000} onChange={(e) => setCommissionNotes(e.target.value)} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : company ? 'Save' : 'Add company'}
        </Button>
      </DialogFooter>
    </form>
  )
}
