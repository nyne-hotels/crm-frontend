import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, MailCheckIcon, XIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  FieldsFilter,
  FilterGroup,
  FilterMultiSelect,
  MoreFilters,
  RangeFilter,
  YesNoSelect,
} from '@/components/more-filters'
import { CountryMultiSelect, MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useFilterParams } from '@/hooks/use-filter-params'
import {
  EMAIL_LIST_CLASHES,
  EMAIL_LIST_MORE_FILTERS,
  useEmailList,
  useExportHistory,
  useMarketingMutations,
  type EmailListFilter,
} from '@/hooks/use-marketing'
import { useMe } from '@/hooks/use-me'
import { usePropertyOptions, useTagOptions } from '@/hooks/use-reference-data'
import { errorMessage } from '@/lib/api'
import { todayIso } from '@/lib/consent'
import { filterFields, listOf, optionsFrom, pickParams } from '@/lib/filters'
import { countryFlag, formatCount, formatDate, formatDateTime, fullName, plural } from '@/lib/format'
import {
  CONTACT_TYPE_LABELS,
  CONTACT_TYPES,
  MARKET_LABELS,
  MARKETS,
  STAGE_FILTER_OPTIONS,
  STAGE_LABELS,
} from '@/lib/guests'
import { MONTHS } from '@/lib/knowledge'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { StageChip } from '../guests/guest-badges'

const FILTER_KEYS = ['market', 'country', 'hotel', 'stage', 'from', 'to', 'tag', ...EMAIL_LIST_MORE_FILTERS] as const

// Filters and page live in the address, so Back from a profile returns to the same list.
function readFilter(params: URLSearchParams): EmailListFilter & { page: number } {
  return {
    market: params.get('market') ?? undefined,
    country: params.get('country') ?? undefined,
    propertyId: params.get('hotel') ?? undefined,
    stage: params.get('stage') ?? undefined,
    lastStayFrom: params.get('from') ?? undefined,
    lastStayTo: params.get('to') ?? undefined,
    tagId: params.get('tag') ?? undefined,
    ...pickParams(params, EMAIL_LIST_MORE_FILTERS),
    page: Number(params.get('page')) || 1,
  }
}

// Marketing → Email list: everyone who may receive marketing email right
// now (opted in, not do not contact, a personal email that hasn't bounced).
// Narrow it, check the count, export it for the email tool.
export function EmailListPage() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  const { params, update } = useFilterParams(EMAIL_LIST_CLASHES)
  const { page, ...filter } = readFilter(params)
  const { data, isPending, isError, isPlaceholderData } = useEmailList({ ...filter, page })
  const { data: hotels = [] } = usePropertyOptions()
  const { data: tags = [] } = useTagOptions()
  const { exportList } = useMarketingMutations()
  const hasFilters = FILTER_KEYS.some((k) => params.has(k))
  const f = filterFields(params, update)


  async function download() {
    try {
      const result = await exportList.mutateAsync(filter)
      // SheetJS is large, so it loads only when someone exports
      const { downloadXlsx } = await import('@/lib/spreadsheet')
      downloadXlsx(
        `Nyne email list ${todayIso()}.xlsx`,
        ['First name', 'Last name', 'Email', 'Country', 'Last hotel'],
        result.rows.map((r) => [r.firstName ?? '', r.lastName ?? '', r.email, r.country ?? '', r.lastHotel ?? '']),
      )
      toast.success(`Exported ${plural(result.count, 'guest')}`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="flex items-center gap-2 text-lg font-medium">
          <MailCheckIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
          {data ? `${plural(data.listTotal, 'guest')} can be emailed` : 'Loading…'}
        </p>
        {data && hasFilters && (
          <span className="text-sm text-muted-foreground tabular-nums">{formatCount(data.total)} match these filters</span>
        )}
        {can(me?.permissions, 'marketingExport', 'edit') && (
          <Button className="ml-auto" onClick={download} disabled={exportList.isPending || !data?.total}>
            <DownloadIcon /> {exportList.isPending ? 'Exporting…' : 'Export'}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        <MultiSelect
          {...f.multi('stage')}
          options={STAGE_FILTER_OPTIONS.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
          anyLabel="Any stage"
          className="w-40"
          aria-label="Filter by stage"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">Last stay</span>
          <Input
            type="date"
            className="w-38"
            value={filter.lastStayFrom ?? ''}
            max={filter.lastStayTo}
            onChange={(e) => update({ from: e.target.value || undefined })}
            aria-label="Last stay on or after"
            title="Last stay on or after"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            className="w-38"
            value={filter.lastStayTo ?? ''}
            min={filter.lastStayFrom}
            onChange={(e) => update({ to: e.target.value || undefined })}
            aria-label="Last stay on or before"
            title="Last stay on or before"
          />
        </div>
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
          keys={EMAIL_LIST_MORE_FILTERS}
          update={update}
          total={data ? plural(data.total, 'guest') : undefined}
        >
          <EmailListMoreFilters params={params} update={update} hotels={hotels} />
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
              <TableHead>Email</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Hotels stayed at</TableHead>
              <TableHead>Last stay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <MessageRow>Loading…</MessageRow>
            ) : isError ? (
              <MessageRow className="text-destructive">Couldn't load the email list.</MessageRow>
            ) : data.rows.length === 0 ? (
              <MessageRow>{hasFilters ? 'No guests match.' : 'No one can be emailed yet.'}</MessageRow>
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
                  </TableCell>
                  <TableCell className="max-w-64 truncate">{g.email}</TableCell>
                  <TableCell className="max-w-40 truncate">{g.country && `${countryFlag(g.countryCode)} ${g.country}`}</TableCell>
                  <TableCell>
                    <StageChip stage={g.lifecycleStage} />
                  </TableCell>
                  <TableCell className="max-w-56 truncate" title={g.hotels ?? undefined}>
                    {g.hotels}
                  </TableCell>
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

      <ExportHistory />
    </div>
  )
}

// Every export is logged: who, when, the filters and how many guests.
function ExportHistory() {
  const { data = [], isPending } = useExportHistory()
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Recent exports</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing exported yet.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exported</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Filters</TableHead>
                  <TableHead className="text-right">Guests</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(e.exported.at)}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.exported.by ?? 'System'}</TableCell>
                    <TableCell className="max-w-96 truncate" title={e.summary}>
                      {e.summary}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(e.rowCount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MessageRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={6} className={cn('h-24 text-center text-muted-foreground', className)}>
        {children}
      </TableCell>
    </TableRow>
  )
}

// Email list → More filters: who they are, their stays and when they joined.
// The export sends these too, and the export log lists them.
function EmailListMoreFilters({
  params,
  update,
  hotels,
}: {
  params: URLSearchParams
  update: (changes: Record<string, string | undefined>) => void
  hotels: { id: string; name: string }[]
}) {
  const f = filterFields(params, update)
  return (
    <>
      <FilterGroup title="Filled in or missing">
        <FieldsFilter
          options={[
            { value: 'firstName', label: 'First name' },
            { value: 'lastName', label: 'Last name' },
            { value: 'country', label: 'Country' },
            { value: 'birthday', label: 'Birthday' },
          ]}
          params={params}
          update={update}
        />
      </FilterGroup>

      <FilterGroup title="Who">
        <FilterMultiSelect
          label="Type"
          options={optionsFrom(CONTACT_TYPES, CONTACT_TYPE_LABELS)}
          anyLabel="All types"
          {...f.multi('contactType')}
        />
        <FilterMultiSelect
          label="Birthday in"
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
          anyLabel="Any month"
          {...f.multi('birthdayMonth')}
        />
      </FilterGroup>

      <FilterGroup title="Stays">
        <RangeFilter label="Number of stays" type="number" min={0} hint="Checked-out stays" {...f.range('staysMin', 'staysMax')} />
        <FilterMultiSelect
          label="Last stayed at"
          options={hotels.map((h) => ({ value: h.id, label: h.name }))}
          anyLabel="Any hotel"
          {...f.multi('lastHotelId')}
        />
        <YesNoSelect label="Coming up" yes="Booked to come or in house" no="Nothing booked" {...f.choice('upcomingStay')} />
        <YesNoSelect label="Low ratings" yes="Gave a 1 or 2 star rating" no="Never rated us 1 or 2 stars" {...f.choice('lowRating')} />
      </FilterGroup>

      <FilterGroup title="When">
        <RangeFilter label="Opted in" type="date" {...f.range('optedInFrom', 'optedInTo')} />
        <RangeFilter label="Added to the CRM" type="date" {...f.range('addedFrom', 'addedTo')} />
      </FilterGroup>
    </>
  )
}
