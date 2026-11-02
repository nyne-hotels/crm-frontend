import { ArrowLeftIcon, MailCheckIcon, XIcon } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { FilterGroup, FilterMultiSelect, FilterSelect, MoreFilters, YesNoSelect } from '@/components/more-filters'
import { MultiSelect } from '@/components/multi-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UPCOMING_MORE_FILTERS, useUpcomingOccasions, type UpcomingFilter } from '@/hooks/use-knowledge'
import { usePropertyOptions } from '@/hooks/use-reference-data'
import { CONSENT_STATUS_LABELS } from '@/lib/consent'
import { filterFields, optionsFrom, pickParams } from '@/lib/filters'
import { formatDate, fullName, plural } from '@/lib/format'
import { STAGE_FILTER_OPTIONS, STAGE_LABELS } from '@/lib/guests'
import {
  daysAwayLabel,
  SPECIAL_DATE_LABELS,
  SPECIAL_DATE_OCCASIONS,
  UPCOMING_DAYS,
  yearsLabel,
} from '@/lib/knowledge'
import { cn } from '@/lib/utils'

const ANY = 'any'
const FILTER_KEYS = ['occasion', 'hotel', 'email', ...UPCOMING_MORE_FILTERS] as const

// Filters live in the address, so Back from a profile returns to the same list.
function readFilter(params: URLSearchParams): UpcomingFilter {
  const email = params.get('email')
  return {
    occasion: params.get('occasion') ?? undefined,
    propertyId: params.get('hotel') ?? undefined,
    canEmail: email === 'yes' || email === 'no' ? email : undefined,
    ...pickParams(params, UPCOMING_MORE_FILTERS),
  }
}

// Guests → Upcoming occasions: birthdays and anniversaries in the next 60
// days, soonest first, so each hotel can plan a cake or an offer.
export function UpcomingOccasionsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = readFilter(params)
  const { data, isPending, isError, isPlaceholderData } = useUpcomingOccasions(filter)
  const { data: hotels = [] } = usePropertyOptions()
  const hasFilters = FILTER_KEYS.some((k) => params.has(k))
  const f = filterFields(params, update)

  function update(changes: Record<string, string | undefined>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value && value !== ANY) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <Link to="/guests" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Contacts
      </Link>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-heading text-2xl font-semibold">Upcoming occasions</h1>
        {data && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {plural(data.rows.length, 'occasion')} in the next {UPCOMING_DAYS} days
          </span>
        )}
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        Birthdays and anniversaries coming up, soonest first. Guests marked do not contact aren't listed.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          {...f.multi('occasion')}
          options={optionsFrom(SPECIAL_DATE_OCCASIONS, SPECIAL_DATE_LABELS)}
          anyLabel="All occasions"
          className="w-52"
          aria-label="Filter by occasion"
        />
        <MultiSelect
          {...f.multi('hotel')}
          options={hotels.map((h) => ({ value: h.id, label: `${h.name} (next or last stay)` }))}
          anyLabel="Any hotel"
          className="w-56"
          aria-label="Filter by hotel of next or last stay"
        />
        <Select value={filter.canEmail ?? ANY} onValueChange={(v) => update({ email: v })}>
          <SelectTrigger className="w-44" aria-label="Filter by whether they can be emailed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Email: anyone</SelectItem>
            <SelectItem value="yes">Can be emailed</SelectItem>
            <SelectItem value="no">Can't be emailed</SelectItem>
          </SelectContent>
        </Select>
        <MoreFilters
          params={params}
          keys={UPCOMING_MORE_FILTERS}
          update={update}
          total={data ? plural(data.rows.length, 'occasion') : undefined}
        >
          <UpcomingMoreFilters params={params} update={update} />
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
              <TableHead>Date</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Occasion</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Years</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Next stay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <MessageRow>Loading…</MessageRow>
            ) : isError ? (
              <MessageRow className="text-destructive">Couldn't load upcoming occasions.</MessageRow>
            ) : data.rows.length === 0 ? (
              <MessageRow>
                {hasFilters ? 'No occasions match.' : `No birthdays or anniversaries in the next ${UPCOMING_DAYS} days.`}
              </MessageRow>
            ) : (
              data.rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/guests/${r.guest.id}`)}>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatDate(r.nextDate)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant="outline"
                      className={cn(
                        'tabular-nums',
                        r.daysAway <= 7 && 'border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300',
                      )}
                    >
                      {daysAwayLabel(r.daysAway)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {SPECIAL_DATE_LABELS[r.occasion]}
                    {r.label && <div className="text-xs text-muted-foreground">{r.label}</div>}
                  </TableCell>
                  <TableCell className="max-w-56">
                    <Link
                      to={`/guests/${r.guest.id}`}
                      className={cn('block truncate font-medium hover:underline', !fullName(r.guest) && 'text-muted-foreground italic')}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {fullName(r.guest) || 'No name'}
                    </Link>
                    {r.lastStayHotel && <div className="truncate text-xs text-muted-foreground">Last stay: {r.lastStayHotel}</div>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{yearsLabel(r.occasion, r.years) ?? '–'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.canEmail ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <MailCheckIcon className="size-4" /> Can be emailed
                      </span>
                    ) : (
                      <span className="text-muted-foreground" title="Not on the marketing email list">
                        {r.emailConsent ? CONSENT_STATUS_LABELS[r.emailConsent] : 'No consent'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.nextStay ? (
                      <>
                        {r.nextStay.hotel}
                        <div className="text-xs text-muted-foreground tabular-nums">{formatDate(r.nextStay.arrivalDate)}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function MessageRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={7} className={cn('h-24 text-center text-muted-foreground', className)}>
        {children}
      </TableCell>
    </TableRow>
  )
}

// Upcoming occasions → More filters: how soon, round numbers, bookings and the guest's stage.
function UpcomingMoreFilters({
  params,
  update,
}: {
  params: URLSearchParams
  update: (changes: Record<string, string | undefined>) => void
}) {
  const f = filterFields(params, update)
  return (
    <>
      <FilterGroup title="When">
        <FilterSelect
          label="Coming up within"
          options={[
            { value: '0', label: 'Today' },
            { value: '7', label: 'The next 7 days' },
            { value: '14', label: 'The next 14 days' },
            { value: '30', label: 'The next 30 days' },
          ]}
          anyLabel={`The next ${UPCOMING_DAYS} days`}
          {...f.choice('within')}
        />
      </FilterGroup>

      <FilterGroup title="The occasion">
        <YesNoSelect label="Year known" yes="Age or years married known" no="Year not known" {...f.choice('yearKnown')} />
        <YesNoSelect label="Round number" yes="A 5th, 10th, 40th …" no="Not a round number" {...f.choice('milestone')} />
      </FilterGroup>

      <FilterGroup title="The guest">
        <YesNoSelect label="Next stay" yes="Booked to come" no="Nothing booked" {...f.choice('nextStay')} />
        <FilterMultiSelect
          label="Stage"
          options={STAGE_FILTER_OPTIONS.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
          anyLabel="Any stage"
          {...f.multi('stage')}
        />
      </FilterGroup>
    </>
  )
}
