import { PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  CountryFilter,
  FieldsFilter,
  FilterGroup,
  FilterSelect,
  MoreFilters,
  YesNoSelect,
} from '@/components/more-filters'
import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { COMPANY_CLASHES, COMPANY_MORE_FILTERS, useCompanies } from '@/hooks/use-companies'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useFilterParams } from '@/hooks/use-filter-params'
import { useLeadOwners } from '@/hooks/use-leads'
import { useMe } from '@/hooks/use-me'
import { filterFields, optionsFrom, pickParams } from '@/lib/filters'
import { countryFlag, formatCount, formatDate, fullName, plural } from '@/lib/format'
import {
  COMPANY_STATUS_LABELS,
  COMPANY_STATUSES,
  COMPANY_TYPE_LABELS,
  COMPANY_TYPES,
} from '@/lib/leads'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { CompanyStatusChip } from '../leads/lead-badges'
import { CompanyFormDialog } from './company-form-dialog'

const FILTER_KEYS = ['type', 'status', 'owner', ...COMPANY_MORE_FILTERS]

// Companies: travel agents, DMCs, OTAs, corporates and media, A to Z.
export function CompaniesPage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const canEdit = can(me?.permissions, 'leads', 'edit')
  const { params, update } = useFilterParams(COMPANY_CLASHES)
  const { data: owners = [] } = useLeadOwners()
  const filter = {
    q: params.get('q') ?? undefined,
    type: params.get('type') ?? undefined,
    status: params.get('status') ?? undefined,
    owner: params.get('owner') ?? undefined,
    ...pickParams(params, COMPANY_MORE_FILTERS),
  }
  const { data, isPending, isError, isPlaceholderData } = useCompanies(filter)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState(filter.q ?? '')
  const q = useDebouncedValue(search.trim(), 250)
  useEffect(() => {
    if (q !== (params.get('q') ?? '')) update({ q: q || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed text settles
  }, [q])
  const f = filterFields(params, update)
  const hasFilters = FILTER_KEYS.some((k) => params.has(k))

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-2xl font-semibold">Companies</h1>
        {data && <span className="text-sm text-muted-foreground tabular-nums">{plural(data.rows.length, 'company', 'companies')}</span>}
        {canEdit && (
          <Button className="ml-auto" onClick={() => setAdding(true)}>
            <PlusIcon /> New company
          </Button>
        )}
      </div>

      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
          aria-label="Search companies"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          {...f.multi('type')}
          options={optionsFrom(COMPANY_TYPES, COMPANY_TYPE_LABELS)}
          anyLabel="Any type"
          className="w-40"
          aria-label="Filter by type"
        />
        <MultiSelect
          {...f.multi('status')}
          options={optionsFrom(COMPANY_STATUSES, COMPANY_STATUS_LABELS)}
          anyLabel="Any status"
          className="w-36"
          aria-label="Filter by status"
        />
        <MultiSelect
          {...f.multi('owner')}
          options={[{ value: 'none', label: 'No account owner' }, ...owners.map((o) => ({ value: String(o.id), label: fullName(o) }))]}
          anyLabel="Any account owner"
          className="w-44"
          aria-label="Filter by account owner"
        />
        <MoreFilters
          params={params}
          keys={COMPANY_MORE_FILTERS}
          update={update}
          total={data ? plural(data.rows.length, 'company', 'companies') : undefined}
        >
          <CompanyMoreFilters params={params} update={update} />
        </MoreFilters>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])))}>
            <XIcon /> Clear filters
          </Button>
        )}
      </div>

      <div className={cn('rounded-md border transition-opacity', isPlaceholderData && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Account owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right" title="Arrived in the last 12 months, or still to come">
                Stays, 12 months
              </TableHead>
              <TableHead>Last contact</TableHead>
              <TableHead className="text-right">People</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <MessageRow>Loading…</MessageRow>
            ) : isError ? (
              <MessageRow className="text-destructive">Couldn't load companies.</MessageRow>
            ) : data.rows.length === 0 ? (
              <MessageRow>{filter.q || hasFilters ? 'No companies match.' : 'No companies yet. Add one with New company.'}</MessageRow>
            ) : (
              data.rows.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/companies/${c.id}`)}>
                  <TableCell className="max-w-64">
                    <Link to={`/companies/${c.id}`} className="block truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{COMPANY_TYPE_LABELS[c.companyType]}</TableCell>
                  <TableCell className="whitespace-nowrap">{c.country && `${countryFlag(c.countryCode)} ${c.country}`}</TableCell>
                  <TableCell className="max-w-40 truncate">{c.accountOwner?.name}</TableCell>
                  <TableCell>
                    <CompanyStatusChip status={c.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(c.staysLastYear)}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{c.lastContact ? formatDate(c.lastContact) : ''}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(c.people)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CompanyFormDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}

function MessageRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={8} className={cn('h-24 text-center text-muted-foreground', className)}>
        {children}
      </TableCell>
    </TableRow>
  )
}

// Companies → More filters: where they are, their people, bookings and when we last spoke.
function CompanyMoreFilters({
  params,
  update,
}: {
  params: URLSearchParams
  update: (changes: Record<string, string | undefined>) => void
}) {
  const f = filterFields(params, update)
  return (
    <>
      <FilterGroup title="Filled in or missing">
        <FieldsFilter
          options={[
            { value: 'country', label: 'Country' },
            { value: 'address', label: 'Address' },
            { value: 'website', label: 'Website' },
            { value: 'commissionNotes', label: 'Commission notes' },
          ]}
          params={params}
          update={update}
        />
      </FilterGroup>

      <FilterGroup title="Where">
        <CountryFilter label="Country" {...f.multi('country')} />
      </FilterGroup>

      <FilterGroup title="Business">
        <YesNoSelect
          label="Bookings"
          yes="Stays in the last 12 months"
          no="No stays in the last 12 months"
          {...f.choice('bookedLastYear')}
        />
        <YesNoSelect label="Open leads" yes="Its people have open leads" no="No open leads" {...f.choice('openLeads')} />
        <YesNoSelect label="People" yes="Has people in the CRM" no="No people yet" {...f.choice('people')} />
      </FilterGroup>

      <FilterGroup title="Keeping in touch">
        <FilterSelect
          label="Last conversation"
          options={[
            { value: '30', label: 'In the last 30 days' },
            { value: '90', label: 'In the last 90 days' },
            { value: 'over_90', label: 'More than 90 days ago' },
            { value: 'never', label: 'Never' },
          ]}
          anyLabel="Any time, or never"
          {...f.choice('lastContact')}
        />
      </FilterGroup>
    </>
  )
}
