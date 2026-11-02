import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { FilterGroup, FilterMultiSelect, FilterSelect, MoreFilters, RangeFilter, YesNoSelect } from '@/components/more-filters'
import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { FEEDBACK_MORE_FILTERS, useFeedbackList, type FeedbackFilter } from '@/hooks/use-feedback'
import { useFilterParams } from '@/hooks/use-filter-params'
import { useMe } from '@/hooks/use-me'
import { usePropertyOptions } from '@/hooks/use-reference-data'
import { FEEDBACK_TAB_LABELS, FEEDBACK_TABS, firstLine, stayDates, type FeedbackTab } from '@/lib/feedback'
import { filterFields, optionsFrom, pickParams } from '@/lib/filters'
import { formatCount, formatDate, fullName, plural } from '@/lib/format'
import { MARKET_LABELS, MARKETS } from '@/lib/guests'
import { can } from '@/lib/permissions'
import { CHANNEL_LABELS, STAY_CHANNELS } from '@/lib/stays'
import { cn } from '@/lib/utils'
import { FollowedUpChip, NeedsFollowUpChip, Stars } from './feedback-badges'

const FILTER_KEYS = ['hotel', 'rating', 'from', 'to', ...FEEDBACK_MORE_FILTERS]

// Tab, filters and page live in the address, so Back from a response
// returns to the same list.
function readFilter(params: URLSearchParams): FeedbackFilter {
  const tab = params.get('tab') as FeedbackTab | null
  return {
    tab: tab && FEEDBACK_TABS.includes(tab) ? tab : 'all',
    propertyId: params.get('hotel') ?? undefined,
    rating: params.get('rating') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    q: params.get('q') ?? undefined,
    ...pickParams(params, FEEDBACK_MORE_FILTERS),
    page: Number(params.get('page')) || 1,
  }
}

// Feedback → Inbox: every response newest first, with the Needs follow-up
// tab for unresolved 1 and 2 star ratings.
export function FeedbackInboxPage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const showMentions = can(me?.permissions, 'employees')
  const { params, update } = useFilterParams()
  const filter = readFilter(params)
  const { data, isPending, isError, isPlaceholderData } = useFeedbackList(filter)
  const { data: hotels = [] } = usePropertyOptions()
  const f = filterFields(params, update)
  const hasFilters = FILTER_KEYS.some((k) => params.has(k))
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0
  const columns = showMentions ? 6 : 5
  const moreKeys = showMentions ? FEEDBACK_MORE_FILTERS : FEEDBACK_MORE_FILTERS.filter((k) => k !== 'mentions')

  const [search, setSearch] = useState(filter.q ?? '')
  const q = useDebouncedValue(search.trim(), 250)
  useEffect(() => {
    if (q !== (params.get('q') ?? '')) update({ q: q || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed text settles
  }, [q])

  return (
    <div className="grid grid-cols-1 gap-4">
      <div role="tablist" aria-label="Show" className="flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1">
        {FEEDBACK_TABS.map((tab) => {
          const count = data?.counts[tab]
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={filter.tab === tab}
              onClick={() => update({ tab: tab === 'all' ? undefined : tab })}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                filter.tab === tab && 'bg-background text-foreground shadow-sm',
              )}
            >
              {FEEDBACK_TAB_LABELS[tab]}
              {count !== undefined &&
                (tab === 'needs_follow_up' && count > 0 ? (
                  <span className="rounded-full bg-destructive px-1.5 text-xs leading-5 text-white tabular-nums">{formatCount(count)}</span>
                ) : (
                  <span className="text-xs tabular-nums">{formatCount(count)}</span>
                ))}
            </button>
          )
        })}
      </div>

      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by guest name, booking reference or words in the review"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
          aria-label="Search feedback"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          {...f.multi('hotel')}
          options={hotels.map((h) => ({ value: h.id, label: h.name }))}
          anyLabel="All hotels"
          className="w-44"
          aria-label="Filter by hotel"
        />
        <MultiSelect
          {...f.multi('rating')}
          options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? 'star' : 'stars'}` }))}
          anyLabel="Any rating"
          className="w-36"
          aria-label="Filter by rating"
        />
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="w-38"
            value={filter.from ?? ''}
            onChange={(e) => update({ from: e.target.value || undefined })}
            aria-label="Received from"
            title="Received from"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            className="w-38"
            value={filter.to ?? ''}
            min={filter.from}
            onChange={(e) => update({ to: e.target.value || undefined })}
            aria-label="Received until"
            title="Received until"
          />
        </div>
        <MoreFilters
          params={params}
          keys={moreKeys}
          update={update}
          total={data ? plural(data.total, 'response') : undefined}
        >
          <FeedbackMoreFilters params={params} update={update} showMentions={showMentions} />
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
              <TableHead>Received</TableHead>
              <TableHead>Hotel and stay</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="w-full min-w-64">Review</TableHead>
              {showMentions && (
                <TableHead className="text-right" title="Employees mentioned">
                  Mentions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <MessageRow colSpan={columns}>Loading…</MessageRow>
            ) : isError ? (
              <MessageRow colSpan={columns} className="text-destructive">
                Couldn't load feedback.
              </MessageRow>
            ) : data.rows.length === 0 ? (
              <MessageRow colSpan={columns}>
                {filter.tab === 'needs_follow_up' && !hasFilters && !filter.q
                  ? 'Nothing needs follow-up.'
                  : hasFilters || filter.q || filter.tab !== 'all'
                    ? 'No responses match.'
                    : 'No feedback yet. Add a response, or upload the file from the form tool.'}
              </MessageRow>
            ) : (
              data.rows.map((f) => (
                <TableRow key={f.id} className="cursor-pointer" onClick={() => navigate(`/feedback/${f.id}`)}>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatDate(f.submittedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {f.hotel}
                    <span className="block text-xs text-muted-foreground tabular-nums">{stayDates(f)}</span>
                  </TableCell>
                  <TableCell className="max-w-48">
                    <Link
                      to={`/guests/${f.contactId}`}
                      className="block truncate font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {fullName(f) || `Guest #${f.contactId}`}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Stars rating={f.rating} />
                  </TableCell>
                  <TableCell className="max-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/feedback/${f.id}`}
                        className={cn('min-w-0 truncate hover:underline', !f.review && 'text-muted-foreground')}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {firstLine(f.review) || 'No review'}
                      </Link>
                      {f.needsFollowUp ? (
                        <NeedsFollowUpChip className="ml-auto shrink-0" />
                      ) : f.followedUpAt ? (
                        <FollowedUpChip className="ml-auto shrink-0" />
                      ) : null}
                    </div>
                  </TableCell>
                  {showMentions && (
                    <TableCell className="text-right text-muted-foreground tabular-nums">{f.mentions ? formatCount(f.mentions) : ''}</TableCell>
                  )}
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
    </div>
  )
}

function MessageRow({ children, className, colSpan }: { children: React.ReactNode; className?: string; colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className={cn('h-24 text-center text-muted-foreground', className)}>
        {children}
      </TableCell>
    </TableRow>
  )
}

// Feedback → More filters: the rating and review, what came of it, and the stay.
function FeedbackMoreFilters({
  params,
  update,
  showMentions,
}: {
  params: URLSearchParams
  update: (changes: Record<string, string | undefined>) => void
  showMentions: boolean
}) {
  const f = filterFields(params, update)
  return (
    <>
      <FilterGroup title="The response">
        <RangeFilter label="Stars" type="number" min={1} max={5} {...f.range('ratingMin', 'ratingMax')} />
        <YesNoSelect label="Rating" yes="Has a star rating" no="Review only, no rating" {...f.choice('rated')} />
        <YesNoSelect label="Written review" yes="Has comments" no="Rating only, no comments" {...f.choice('review')} />
        {showMentions && (
          <FilterSelect
            label="Employees mentioned"
            options={[
              { value: 'any', label: 'Mentions someone' },
              { value: 'praise', label: 'Praises someone' },
              { value: 'criticism', label: 'Criticises someone' },
              { value: 'none', label: 'Mentions no one' },
            ]}
            {...f.choice('mentions')}
          />
        )}
      </FilterGroup>

      <FilterGroup title="Follow-up">
        <YesNoSelect label="Guest contacted" yes="A call or message logged" no="Nothing logged" {...f.choice('contacted')} />
      </FilterGroup>

      <FilterGroup title="The stay">
        <RangeFilter label="Checked out" type="date" {...f.range('stayFrom', 'stayTo')} />
        <FilterMultiSelect
          label="Booked through"
          options={optionsFrom(STAY_CHANNELS, CHANNEL_LABELS)}
          anyLabel="Any channel"
          {...f.multi('channel')}
        />
        <FilterMultiSelect label="Guest's market" options={optionsFrom(MARKETS, MARKET_LABELS)} anyLabel="Any market" {...f.multi('market')} />
      </FilterGroup>
    </>
  )
}
