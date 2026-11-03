import { ChevronLeftIcon, ChevronRightIcon, FileUpIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  CountryFilter,
  FieldsFilter,
  FilterGroup,
  FilterMultiSelect,
  FilterSelect,
  MoreFilters,
  RangeFilter,
  TextFilter,
  YesNoSelect,
} from '@/components/more-filters'
import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useFilterParams } from '@/hooks/use-filter-params'
import { useMe } from '@/hooks/use-me'
import { useCompanyOptions, useOccasionOptions, usePropertyOptions } from '@/hooks/use-reference-data'
import { STAY_CLASHES, STAY_MORE_FILTERS, useQuickCounts, useStays, type StayFilter } from '@/hooks/use-stays'
import { useStayPanel } from '@/hooks/use-stay-panel'
import { filterFields, optionsFrom, pickParams } from '@/lib/filters'
import { formatCount, formatDate, fullName, plural } from '@/lib/format'
import { MARKET_LABELS, MARKETS, STAGE_FILTER_OPTIONS, STAGE_LABELS } from '@/lib/guests'
import { can } from '@/lib/permissions'
import {
  CHANNEL_LABELS,
  COMMON_CURRENCIES,
  didNotHappen,
  QUICK_VIEW_LABELS,
  QUICK_VIEWS,
  STAY_CHANNELS,
  STAY_STATUS_LABELS,
  STAY_STATUSES,
  type QuickView,
} from '@/lib/stays'
import { cn } from '@/lib/utils'
import { StayStatusChip } from './stay-badges'
import { StayDetailSheet } from './stay-detail-sheet'
import { StayFormDialog } from './stay-form-dialog'

const FILTER_KEYS = ['hotel', 'status', 'from', 'to', 'channel', 'occasion', 'agent', ...STAY_MORE_FILTERS] as const
const SORTS = {
  'arrival-desc': 'Arrival, latest first',
  'arrival-asc': 'Arrival, earliest first',
  'departure-desc': 'Departure, latest first',
  'departure-asc': 'Departure, earliest first',
}

// Quick view, search, filters and page live in the address, so Back from a
// guest's profile returns to the same list.
function readFilter(params: URLSearchParams): StayFilter {
  return {
    q: params.get('q') ?? undefined,
    view: (params.get('view') as QuickView) ?? undefined,
    propertyId: params.get('hotel') ?? undefined,
    status: params.get('status') ?? undefined,
    arrivalFrom: params.get('from') ?? undefined,
    arrivalTo: params.get('to') ?? undefined,
    channel: params.get('channel') ?? undefined,
    occasionId: params.get('occasion') ?? undefined,
    companyId: params.get('agent') ?? undefined,
    ...pickParams(params, STAY_MORE_FILTERS),
    sort: (['arrival', 'departure'] as const).find((s) => s === params.get('sort')),
    order: (['asc', 'desc'] as const).find((o) => o === params.get('order')),
    page: Number(params.get('page')) || 1,
  }
}

export function StaysPage() {
  const { data: me } = useMe()
  const canEdit = can(me?.permissions, 'stays', 'edit')
  const { params, update } = useFilterParams(STAY_CLASHES)
  const filter = readFilter(params)
  const { data, isPending, isError, isPlaceholderData } = useStays(filter)
  const { data: counts } = useQuickCounts()
  const { data: hotels = [] } = usePropertyOptions()
  const { data: occasions = [] } = useOccasionOptions()
  const { data: companies = [] } = useCompanyOptions()
  const { open } = useStayPanel()
  const [adding, setAdding] = useState(false)


  const [search, setSearch] = useState(filter.q ?? '')
  const q = useDebouncedValue(search.trim(), 250)
  useEffect(() => {
    if (q !== (params.get('q') ?? '')) update({ q: q || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed text settles
  }, [q])

  const f = filterFields(params, update)
  const hasFilters = FILTER_KEYS.some((k) => params.has(k))

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-2xl font-semibold">Stays</h1>
        {data && <span className="text-sm text-muted-foreground tabular-nums">{plural(data.total, 'stay')}</span>}
        {canEdit && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/stays/import">
                <FileUpIcon /> Import bookings
              </Link>
            </Button>
            <Button onClick={() => setAdding(true)}>
              <PlusIcon /> Add stay
            </Button>
          </div>
        )}
      </div>

      {/* quick filters */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick filters">
        {QUICK_VIEWS.map((view) => {
          const active = filter.view === view
          return (
            <Button
              key={view}
              variant={active ? 'default' : 'outline'}
              size="sm"
              aria-pressed={active}
              onClick={() => update({ view: active ? undefined : view })}
            >
              {QUICK_VIEW_LABELS[view]}
              {counts && (
                <span className={cn('tabular-nums', active ? 'opacity-80' : 'text-muted-foreground')}>
                  {formatCount(counts[view])}
                </span>
              )}
            </Button>
          )
        })}
      </div>

      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by guest name or booking reference"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
          aria-label="Search stays"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          {...f.multi('hotel')}
          options={hotels.map((h) => ({ value: h.id, label: h.name }))}
          anyLabel="All hotels"
          className="w-40"
          aria-label="Filter by hotel"
        />
        <MultiSelect
          {...f.multi('status')}
          options={optionsFrom(STAY_STATUSES, STAY_STATUS_LABELS)}
          anyLabel="Any status"
          className="w-36"
          aria-label="Filter by status"
        />
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="w-38"
            value={filter.arrivalFrom ?? ''}
            onChange={(e) => update({ from: e.target.value || undefined })}
            aria-label="Arriving from"
            title="Arriving from"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            className="w-38"
            value={filter.arrivalTo ?? ''}
            min={filter.arrivalFrom}
            onChange={(e) => update({ to: e.target.value || undefined })}
            aria-label="Arriving until"
            title="Arriving until"
          />
        </div>
        <MultiSelect
          {...f.multi('channel')}
          options={optionsFrom(STAY_CHANNELS, CHANNEL_LABELS)}
          anyLabel="Any channel"
          className="w-36"
          aria-label="Filter by channel"
        />
        <MultiSelect
          {...f.multi('occasion')}
          options={occasions.map((o) => ({ value: String(o.id), label: o.name }))}
          anyLabel="Any occasion"
          className="w-40"
          aria-label="Filter by occasion"
        />
        {companies.length > 0 && (
          <MultiSelect
            {...f.multi('agent')}
            options={companies.map((c) => ({ value: String(c.id), label: c.name }))}
            anyLabel="Any agent"
            className="w-44"
            aria-label="Filter by agent or OTA"
          />
        )}
        <MoreFilters
          params={params}
          keys={STAY_MORE_FILTERS}
          update={update}
          total={data ? plural(data.total, 'stay') : undefined}
        >
          <StayMoreFilters params={params} update={update} />
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
              <TableHead>Guest</TableHead>
              <TableHead>Hotel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Arrival</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead className="text-right">Nights</TableHead>
              <TableHead>Room type</TableHead>
              <TableHead className="text-right" title="Adults + children">
                Guests
              </TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Booking ref</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <MessageRow>Loading…</MessageRow>
            ) : isError ? (
              <MessageRow className="text-destructive">Couldn't load stays.</MessageRow>
            ) : data.rows.length === 0 ? (
              <MessageRow>
                {filter.view
                  ? `No stays ${QUICK_VIEW_LABELS[filter.view].toLowerCase()}.`
                  : filter.q || hasFilters
                    ? 'No stays match.'
                    : 'No stays yet. Import bookings or add a stay.'}
              </MessageRow>
            ) : (
              data.rows.map((s) => {
                const gone = didNotHappen(s.status)
                return (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => open(s.id)}>
                    <TableCell className="max-w-48">
                      <Link
                        to={`/guests/${s.contactId}`}
                        className={cn('block truncate font-medium hover:underline', !fullName(s) && 'text-muted-foreground italic')}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {fullName(s) || 'No name'}
                      </Link>
                      {s.occasion && <div className="truncate text-xs text-muted-foreground">{s.occasion}</div>}
                    </TableCell>
                    <TableCell className={cn('whitespace-nowrap', gone && 'text-muted-foreground line-through')}>{s.hotel}</TableCell>
                    <TableCell>
                      <StayStatusChip status={s.status} />
                    </TableCell>
                    <TableCell className={cn('whitespace-nowrap tabular-nums', gone && 'text-muted-foreground line-through')}>
                      {formatDate(s.arrivalDate)}
                    </TableCell>
                    <TableCell className={cn('whitespace-nowrap tabular-nums', gone && 'text-muted-foreground line-through')}>
                      {formatDate(s.departureDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.nights ?? ''}</TableCell>
                    <TableCell className="max-w-40 truncate" title={s.roomType ?? undefined}>
                      {s.roomType}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {s.adults != null || s.children != null ? `${s.adults ?? 0} + ${s.children ?? 0}` : ''}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{CHANNEL_LABELS[s.channel]}</TableCell>
                    <TableCell className="max-w-36 truncate">{s.agent}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{s.bookingReference}</TableCell>
                  </TableRow>
                )
              })
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

      <StayFormDialog open={adding} onOpenChange={setAdding} />
      <StayDetailSheet />
    </div>
  )
}

// Stays → More filters: dates, party, room and revenue, feedback and the guest.
function StayMoreFilters({
  params,
  update,
}: {
  params: URLSearchParams
  update: (changes: Record<string, string | undefined>) => void
}) {
  const f = filterFields(params, update)
  const sort = params.has('sort') ? `${params.get('sort')}-${params.get('order') ?? 'desc'}` : undefined
  return (
    <>
      <FilterGroup title="Filled in or missing">
        <FieldsFilter
          options={[
            { value: 'arrival', label: 'Arrival date' },
            { value: 'departure', label: 'Departure date' },
            { value: 'bookingReference', label: 'Booking reference' },
            { value: 'roomType', label: 'Room type' },
            { value: 'guests', label: 'Number of guests' },
            { value: 'revenue', label: 'Room revenue' },
            { value: 'agent', label: 'Agent (for agent and OTA bookings)' },
            { value: 'remarks', label: 'Special requests (booking remarks)' },
            { value: 'guestName', label: "Guest's name" },
            { value: 'guestEmail', label: "Guest's email" },
            { value: 'guestPhone', label: "Guest's phone" },
          ]}
          params={params}
          update={update}
        />
      </FilterGroup>

      <FilterGroup title="Dates and length">
        <RangeFilter label="Departure" type="date" {...f.range('departureFrom', 'departureTo')} />
        <RangeFilter label="Nights" type="number" min={0} {...f.range('nightsMin', 'nightsMax')} />
      </FilterGroup>

      <FilterGroup title="Party and room">
        <RangeFilter label="Guests" type="number" min={0} hint="Adults and children together" {...f.range('guestsMin', 'guestsMax')} />
        <YesNoSelect label="Children" yes="Travelling with children" no="No children" {...f.choice('children')} />
        <TextFilter label="Room type" placeholder="e.g. Deluxe" {...f.choice('roomType')} />
      </FilterGroup>

      <FilterGroup title="Revenue">
        <FilterMultiSelect
          label="Currency"
          options={COMMON_CURRENCIES.map((c) => ({ value: c, label: c }))}
          anyLabel="Any currency"
          {...f.multi('currency')}
        />
        <RangeFilter
          label="Room revenue"
          type="number"
          min={0}
          step={0.01}
          hint="In the stay's own currency; choose one above to compare like with like"
          {...f.range('revenueMin', 'revenueMax')}
        />
      </FilterGroup>

      <FilterGroup title="Follow-through">
        <FilterSelect
          label="Feedback"
          options={[
            { value: 'given', label: 'Has a response' },
            { value: 'low', label: 'Rated 1 or 2 stars' },
            { value: 'none', label: 'No response yet' },
          ]}
          {...f.choice('feedback')}
        />
        <YesNoSelect label="From a lead" yes="Converted from a lead" no="Not from a lead" {...f.choice('fromLead')} />
      </FilterGroup>

      <FilterGroup title="The guest">
        <FilterMultiSelect
          label="Stage"
          options={STAGE_FILTER_OPTIONS.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
          anyLabel="Any stage"
          {...f.multi('guestStage')}
        />
        <FilterMultiSelect label="Market" options={optionsFrom(MARKETS, MARKET_LABELS)} anyLabel="Any market" {...f.multi('market')} />
        <CountryFilter label="Country" {...f.multi('country')} />
      </FilterGroup>

      <FilterGroup title="Order">
        <FilterSelect
          label="Sort by"
          options={Object.entries(SORTS).map(([value, label]) => ({ value, label }))}
          anyLabel="Default for the view"
          value={sort}
          onChange={(value) => {
            const [by, order] = value?.split('-') ?? []
            update({ sort: by, order })
          }}
        />
      </FilterGroup>
    </>
  )
}

function MessageRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={11} className={cn('h-24 text-center text-muted-foreground', className)}>
        {children}
      </TableCell>
    </TableRow>
  )
}
