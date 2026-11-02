import { SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  CountryFilter,
  FilterGroup,
  FilterMultiSelect,
  MoreFilters,
  RangeFilter,
  YesNoSelect,
} from '@/components/more-filters'
import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { LEAD_MORE_FILTERS, useLeadOwners } from '@/hooks/use-leads'
import { useMe } from '@/hooks/use-me'
import { useOccasionOptions, usePropertyOptions } from '@/hooks/use-reference-data'
import { filterFields, optionsFrom } from '@/lib/filters'
import { fullName } from '@/lib/format'
import { MARKET_LABELS, MARKETS } from '@/lib/guests'
import { LEAD_SOURCES, LOST_REASON_LABELS, LOST_REASONS, SOURCE_LABELS } from '@/lib/leads'
import { can } from '@/lib/permissions'
import { COMMON_CURRENCIES } from '@/lib/stays'

// Search, owner, hotel and source, kept in the address, and More filters.
// `update` is the page's own setter, so it can reset paging. The list adds
// the lost reason, which would empty the board's other columns.
export function LeadFilterBar({
  params,
  update,
  children,
  extraKeys = [],
  lostReason = false,
  total,
}: {
  params: URLSearchParams
  update: (changes: Record<string, string | undefined>) => void
  children?: React.ReactNode
  extraKeys?: string[]
  lostReason?: boolean
  total?: string
}) {
  const { data: me } = useMe()
  const { data: owners = [] } = useLeadOwners()
  const { data: hotels = [] } = usePropertyOptions()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebouncedValue(search.trim(), 250)
  useEffect(() => {
    if (q !== (params.get('q') ?? '')) update({ q: q || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed text settles
  }, [q])
  const f = filterFields(params, update)
  const moreKeys = lostReason ? [...LEAD_MORE_FILTERS, 'lostReason'] : LEAD_MORE_FILTERS
  const filterKeys = ['owner', 'hotel', 'source', ...extraKeys, ...moreKeys]
  const hasFilters = filterKeys.some((k) => params.has(k))

  return (
    <div className="grid gap-3">
      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name, email or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
          aria-label="Search leads"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          {...f.multi('owner')}
          options={[
            ...(me && can(me.permissions, 'leads', 'edit') ? [{ value: 'me', label: 'Mine' }] : []),
            { value: 'none', label: 'No owner' },
            ...owners.map((o) => ({ value: String(o.id), label: `${fullName(o)}${o.isActive ? '' : ' (left)'}` })),
          ]}
          anyLabel="Any owner"
          className="w-44"
          aria-label="Filter by owner"
        />
        <MultiSelect
          {...f.multi('hotel')}
          options={hotels.map((h) => ({ value: h.id, label: h.name }))}
          anyLabel="All hotels"
          className="w-40"
          aria-label="Filter by hotel"
        />
        <MultiSelect
          {...f.multi('source')}
          options={optionsFrom(LEAD_SOURCES, SOURCE_LABELS)}
          anyLabel="Any source"
          className="w-40"
          aria-label="Filter by source"
        />
        {children}
        <MoreFilters params={params} keys={moreKeys} update={update} total={total}>
          <LeadMoreFilters params={params} update={update} lostReason={lostReason} />
        </MoreFilters>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => update(Object.fromEntries(filterKeys.map((k) => [k, undefined])))}>
            <XIcon /> Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}

// Leads → More filters: the request, the quote, progress and the person.
function LeadMoreFilters({
  params,
  update,
  lostReason,
}: {
  params: URLSearchParams
  update: (changes: Record<string, string | undefined>) => void
  lostReason: boolean
}) {
  const { data: occasions = [] } = useOccasionOptions()
  const f = filterFields(params, update)
  return (
    <>
      <FilterGroup title="The request">
        <RangeFilter label="Check-in asked for" type="date" {...f.range('checkInFrom', 'checkInTo')} />
        <FilterMultiSelect
          label="Occasion"
          options={occasions.map((o) => ({ value: String(o.id), label: o.name }))}
          anyLabel="Any occasion"
          {...f.multi('occasionId')}
        />
        <RangeFilter label="Came in" type="date" {...f.range('createdFrom', 'createdTo')} />
      </FilterGroup>

      <FilterGroup title="Quote">
        <FilterMultiSelect
          label="Currency"
          options={COMMON_CURRENCIES.map((c) => ({ value: c, label: c }))}
          anyLabel="Any currency"
          {...f.multi('currency')}
        />
        <RangeFilter label="Quoted" type="number" min={0} step={0.01} hint="In the quote's own currency" {...f.range('quoteMin', 'quoteMax')} />
      </FilterGroup>

      <FilterGroup title="Progress">
        <YesNoSelect label="Conversations" yes="At least one logged" no="None logged yet" {...f.choice('contacted')} />
        <YesNoSelect label="Stay to link" yes="Booked, stay still to link" no="Everything else" {...f.choice('stayToLink')} />
        {lostReason && (
          <FilterMultiSelect label="Lost because" options={optionsFrom(LOST_REASONS, LOST_REASON_LABELS)} {...f.multi('lostReason')} />
        )}
      </FilterGroup>

      <FilterGroup title="The person">
        <FilterMultiSelect label="Market" options={optionsFrom(MARKETS, MARKET_LABELS)} anyLabel="Any market" {...f.multi('market')} />
        <CountryFilter label="Country" {...f.multi('country')} />
      </FilterGroup>
    </>
  )
}
