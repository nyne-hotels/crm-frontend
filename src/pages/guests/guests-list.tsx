import { ArrowDownIcon, ArrowUpIcon, CakeIcon, CopyIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { FilterGroup, FilterMultiSelect, FilterSelect, MoreFilters, RangeFilter, YesNoSelect } from '@/components/more-filters'
import { CountryMultiSelect, MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { GUEST_MORE_FILTERS, useGuests, type GuestFilter } from '@/hooks/use-guests'
import { useMe } from '@/hooks/use-me'
import { useCompanyOptions, usePropertyOptions, useTagOptions } from '@/hooks/use-reference-data'
import { CONSENT_STATUS_LABELS, CONSENT_STATUSES } from '@/lib/consent'
import { filterFields, listOf, optionsFrom, pickParams } from '@/lib/filters'
import { countryFlag, formatCount, formatDate, fullName, plural } from '@/lib/format'
import {
  CONTACT_METHOD_STATUSES,
  CONTACT_TYPE_LABELS,
  CONTACT_TYPES,
  MARKET_LABELS,
  MARKETS,
  STAGE_FILTER_OPTIONS,
  STAGE_LABELS,
  STATUS_LABELS,
} from '@/lib/guests'
import { MONTHS } from '@/lib/knowledge'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { StageChip } from './guest-badges'
import { GuestFormDialog } from './guest-form-dialog'

const FILTER_KEYS = ['type', 'stage', 'market', 'country', 'hotel', 'tag', ...GUEST_MORE_FILTERS] as const
type SortColumn = 'name' | 'lastStay' | 'stays'

// Search, filters, sort and page live in the address, so Back from a
// profile returns to the same results.
function readFilter(params: URLSearchParams): GuestFilter {
  return {
    q: params.get('q') ?? undefined,
    type: params.get('type') ?? undefined,
    stage: params.get('stage') ?? undefined,
    market: params.get('market') ?? undefined,
    country: params.get('country') ?? undefined,
    propertyId: params.get('hotel') ?? undefined,
    tagId: params.get('tag') ?? undefined,
    ...pickParams(params, GUEST_MORE_FILTERS),
    sort: (['lastStay', 'stays'] as const).find((s) => s === params.get('sort')) ?? 'name',
    order: (params.get('order') as 'asc' | 'desc') ?? undefined,
    page: Number(params.get('page')) || 1,
  }
}

export function GuestsPage() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = readFilter(params)
  const { data, isPending, isError, isPlaceholderData } = useGuests(filter)
  const { data: hotels = [] } = usePropertyOptions()
  const { data: tags = [] } = useTagOptions()
  const { data: companies = [] } = useCompanyOptions()
  const [adding, setAdding] = useState(false)

  // Any change other than paging goes back to page 1.
  function update(changes: Record<string, string | undefined>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!('page' in changes)) next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  // results update as the user types, once they pause
  const [search, setSearch] = useState(filter.q ?? '')
  const q = useDebouncedValue(search.trim(), 250)
  useEffect(() => {
    if (q !== (params.get('q') ?? '')) update({ q: q || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed text settles
  }, [q])

  const f = filterFields(params, update)
  const hasFilters = FILTER_KEYS.some((k) => params.has(k))

  function sortBy(column: SortColumn) {
    if (filter.sort === column) {
      const current = filter.order ?? (column === 'name' ? 'asc' : 'desc')
      update({ sort: column, order: current === 'asc' ? 'desc' : 'asc' })
    } else {
      update({ sort: column, order: undefined })
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-2xl font-semibold">Contacts</h1>
        {data && <span className="text-sm text-muted-foreground tabular-nums">{plural(data.total, 'contact')}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {can(me?.permissions, 'mergeGuests', 'edit') && (
            <Button asChild variant="outline">
              <Link to="/guests/duplicates">
                <CopyIcon /> Possible duplicates
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/guests/occasions">
              <CakeIcon /> Upcoming occasions
            </Link>
          </Button>
          {can(me?.permissions, 'guests', 'edit') && (
            <Button onClick={() => setAdding(true)}>
              <PlusIcon /> Add contact
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name, email or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
          aria-label="Search contacts"
          autoFocus
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          {...f.multi('type')}
          options={optionsFrom(CONTACT_TYPES, CONTACT_TYPE_LABELS)}
          anyLabel="All types"
          className="w-40"
          aria-label="Filter by type"
        />
        <MultiSelect
          {...f.multi('stage')}
          options={STAGE_FILTER_OPTIONS.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
          anyLabel="Any stage"
          className="w-40"
          aria-label="Filter by stage"
        />
        <MultiSelect
          {...f.multi('market')}
          options={optionsFrom(MARKETS, MARKET_LABELS)}
          anyLabel="Any market"
          className="w-40"
          aria-label="Filter by market"
        />
        <CountryMultiSelect {...f.multi('country')} className="w-48" aria-label="Filter by country" />
        <MultiSelect
          {...f.multi('hotel')}
          options={hotels.map((h) => ({ value: h.id, label: `Stayed at ${h.name}` }))}
          anyLabel="Any hotel"
          className="w-44"
          aria-label="Filter by hotel stayed at"
        />
        {/* a retired tag can still be filtered on when it's in the address (from Settings → Tags) */}
        {(tags.length > 0 || filter.tagId) && (
          <MultiSelect
            {...f.multi('tag')}
            options={[
              ...tags.map((t) => ({ value: String(t.id), label: `Tagged ${t.name}` })),
              ...listOf(params, 'tag')
                .filter((id) => !tags.some((t) => String(t.id) === id))
                .map((id) => ({ value: id, label: 'Tagged (retired tag)' })),
            ]}
            anyLabel="Any tag"
            className="w-44"
            aria-label="Filter by tag"
          />
        )}
        <MoreFilters
          params={params}
          keys={GUEST_MORE_FILTERS}
          update={update}
          total={data ? plural(data.total, 'contact') : undefined}
        >
          <GuestMoreFilters params={params} update={update} companies={companies} />
        </MoreFilters>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])))}
          >
            <XIcon /> Clear filters
          </Button>
        )}
      </div>

      <div className={cn('rounded-md border transition-opacity', isPlaceholderData && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Name" column="name" filter={filter} onSort={sortBy} />
              <TableHead>Stage</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Hotels stayed at</TableHead>
              <SortableHead label="Stays" column="stays" filter={filter} onSort={sortBy} className="text-right" />
              <SortableHead label="Last stay" column="lastStay" filter={filter} onSort={sortBy} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <MessageRow>Loading…</MessageRow>
            ) : isError ? (
              <MessageRow className="text-destructive">Couldn't load contacts.</MessageRow>
            ) : data.rows.length === 0 ? (
              <MessageRow>{filter.q || hasFilters ? 'No contacts match.' : 'No contacts yet.'}</MessageRow>
            ) : (
              data.rows.map((g) => (
                <TableRow key={g.id} className="cursor-pointer" onClick={() => navigate(`/guests/${g.id}`)}>
                  <TableCell className="max-w-56">
                    <Link
                      to={`/guests/${g.id}`}
                      className={cn('block truncate font-medium hover:underline', !fullName(g) && 'text-muted-foreground italic')}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {fullName(g) || 'No name'}
                    </Link>
                    {g.company && <div className="truncate text-xs text-muted-foreground">{g.company}</div>}
                  </TableCell>
                  <TableCell>
                    <StageChip stage={g.lifecycleStage} />
                  </TableCell>
                  <TableCell className="max-w-64 truncate">{g.email}</TableCell>
                  <TableCell className="tabular-nums">{g.phone}</TableCell>
                  <TableCell className="max-w-40 truncate">
                    {g.country && `${countryFlag(g.countryCode)} ${g.country}`}
                  </TableCell>
                  <TableCell className="max-w-56 truncate" title={g.hotels ?? undefined}>
                    {g.hotels}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{g.stayCount || ''}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(g.lastStay)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {formatCount(from)}–{formatCount(to)} of {formatCount(data.total)}
          </span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              Page {formatCount(data.page)} of {formatCount(pages)}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={data.page <= 1}
              onClick={() => update({ page: data.page > 2 ? String(data.page - 1) : undefined })}
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={data.page >= pages}
              onClick={() => update({ page: String(data.page + 1) })}
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}

      <GuestFormDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}

function SortableHead({
  label,
  column,
  filter,
  onSort,
  className,
}: {
  label: string
  column: SortColumn
  filter: GuestFilter
  onSort: (column: SortColumn) => void
  className?: string
}) {
  const active = filter.sort === column
  const order = filter.order ?? (column === 'name' ? 'asc' : 'desc')
  const Arrow = order === 'asc' ? ArrowUpIcon : ArrowDownIcon
  return (
    <TableHead className={className} aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn('inline-flex items-center gap-1 hover:text-foreground', !active && 'text-muted-foreground')}
      >
        {label}
        {active && <Arrow className="size-3.5" />}
      </button>
    </TableHead>
  )
}

// Contacts → More filters: consent, contact details, stays, sales and what we know about them.
function GuestMoreFilters({
  params,
  update,
  companies,
}: {
  params: URLSearchParams
  update: (changes: Record<string, string | undefined>) => void
  companies: { id: number; name: string }[]
}) {
  const f = filterFields(params, update)
  const consentOptions = optionsFrom(CONSENT_STATUSES, CONSENT_STATUS_LABELS)
  return (
    <>
      <FilterGroup title="Consent">
        <FilterMultiSelect label="Email marketing" options={consentOptions} {...f.multi('emailConsent')} />
        <FilterMultiSelect label="WhatsApp marketing" options={consentOptions} {...f.multi('whatsappConsent')} />
        <YesNoSelect label="Marketing email list" yes="On the list (can be emailed)" no="Not on the list" {...f.choice('canEmail')} />
        <YesNoSelect label="Do not contact" yes="Marked do not contact" no="Not marked" {...f.choice('doNotContact')} />
      </FilterGroup>

      <FilterGroup title="Contact details">
        <YesNoSelect label="Email" yes="Has an email" no="No email" {...f.choice('hasEmail')} />
        <FilterMultiSelect
          label="Primary email status"
          options={optionsFrom(CONTACT_METHOD_STATUSES, STATUS_LABELS.email)}
          {...f.multi('emailStatus')}
        />
        <YesNoSelect label="Phone" yes="Has a phone" no="No phone" {...f.choice('hasPhone')} />
        <YesNoSelect label="WhatsApp" yes="Has a WhatsApp number" no="No WhatsApp number known" {...f.choice('hasWhatsapp')} />
        <FilterMultiSelect
          label="Company"
          options={[
            { value: 'any', label: 'Works for a company' },
            { value: 'none', label: 'No company' },
            ...companies.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
          anyLabel="Any or none"
          {...f.multi('company')}
        />
      </FilterGroup>

      <FilterGroup title="Stays">
        <RangeFilter label="Number of stays" type="number" min={0} hint="Checked-out stays" {...f.range('staysMin', 'staysMax')} />
        <RangeFilter label="Last stay" type="date" {...f.range('lastStayFrom', 'lastStayTo')} />
        <YesNoSelect label="Coming up" yes="Booked to come or in house" no="Nothing booked" {...f.choice('upcomingStay')} />
        <FilterSelect
          label="Feedback"
          options={[
            { value: 'given', label: 'Gave feedback' },
            { value: 'low', label: 'Gave a 1 or 2 star rating' },
            { value: 'none', label: 'Never gave feedback' },
          ]}
          {...f.choice('feedback')}
        />
      </FilterGroup>

      <FilterGroup title="Sales">
        <YesNoSelect label="Open lead" yes="Has an open lead" no="No open lead" {...f.choice('openLead')} />
        <YesNoSelect label="VIP / industry" yes="Has a VIP reason" no="No VIP reason" {...f.choice('vip')} />
      </FilterGroup>

      <FilterGroup title="What we know">
        <FilterMultiSelect
          label="Birthday in"
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
          anyLabel="Any month"
          {...f.multi('birthdayMonth')}
        />
        <YesNoSelect label="Special dates" yes="Has a birthday or anniversary on file" no="None on file" {...f.choice('specialDates')} />
        <YesNoSelect label="Likes and dislikes" yes="Some noted" no="None noted" {...f.choice('preferences')} />
        <RangeFilter label="Added to the CRM" type="date" {...f.range('addedFrom', 'addedTo')} />
      </FilterGroup>
    </>
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
