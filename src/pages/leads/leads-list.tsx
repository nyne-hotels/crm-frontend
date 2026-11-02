import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { MultiSelect } from '@/components/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SHARED_LEAD_FILTERS, useFilterParams } from '@/hooks/use-filter-params'
import { LEAD_MORE_FILTERS, useLeads, type LeadFilter } from '@/hooks/use-leads'
import { listOf, pickParams } from '@/lib/filters'
import { formatCount, formatDate, fullName, plural } from '@/lib/format'
import {
  FOLLOW_UP_FILTER_LABELS,
  FOLLOW_UP_FILTERS,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  LOST_REASON_LABELS,
  money,
  requestedDates,
  SOURCE_LABELS,
  type FollowUpFilter,
} from '@/lib/leads'
import { partyLabel } from '@/lib/stays'
import { cn } from '@/lib/utils'
import { FollowUpDate, LeadStatusChip, SourceIcon } from './lead-badges'
import { LeadFilterBar } from './lead-filter-bar'

const ANY = 'any'

function readFilter(params: URLSearchParams): LeadFilter {
  return {
    q: params.get('q') ?? undefined,
    owner: params.get('owner') ?? undefined,
    propertyId: params.get('hotel') ?? undefined,
    source: params.get('source') ?? undefined,
    status: params.get('status') ?? undefined,
    followUp: (params.get('due') as FollowUpFilter) ?? undefined,
    ...pickParams(params, LEAD_MORE_FILTERS),
    lostReason: params.get('lostReason') ?? undefined,
    page: Number(params.get('page')) || 1,
  }
}

// Leads → List: the same leads as a table, newest first (oldest follow-up
// first when filtered by follow-up), with filters in the address.
export function LeadsListPage() {
  const navigate = useNavigate()
  const { params, update } = useFilterParams()
  const filter = readFilter(params)
  const { data, isPending, isError, isPlaceholderData } = useLeads(filter)
  const select = (key: string) => (value: string) => update({ [key]: value === ANY ? undefined : value })
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0
  const filtered = [...SHARED_LEAD_FILTERS, 'status', 'due', 'lostReason'].some((k) => params.has(k))

  return (
    <div className="grid grid-cols-1 gap-4">
      <LeadFilterBar
        params={params}
        update={update}
        extraKeys={['status', 'due']}
        lostReason
        total={data ? plural(data.total, 'lead') : undefined}
      >
        <MultiSelect
          values={listOf(params, 'status')}
          onChange={(values) => update({ status: values.join(',') || undefined })}
          options={[
            { value: 'open', label: 'Open (not booked or lost)' },
            ...LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] })),
          ]}
          anyLabel="Any status"
          className="w-36"
          aria-label="Filter by status"
        />
        <Select value={filter.followUp ?? ANY} onValueChange={select('due')}>
          <SelectTrigger className="w-48" aria-label="Filter by follow-up">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any follow-up</SelectItem>
            {FOLLOW_UP_FILTERS.map((f) => (
              <SelectItem key={f} value={f}>
                {FOLLOW_UP_FILTER_LABELS[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </LeadFilterBar>

      {data && <p className="text-sm text-muted-foreground tabular-nums">{plural(data.total, 'lead')}</p>}

      <div className={cn('rounded-md border transition-opacity', isPlaceholderData && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Hotel</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Guests</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Follow-up</TableHead>
              <TableHead className="text-right">Quote</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <MessageRow>Loading…</MessageRow>
            ) : isError ? (
              <MessageRow className="text-destructive">Couldn't load leads.</MessageRow>
            ) : data.rows.length === 0 ? (
              <MessageRow>{filtered ? 'No leads match.' : 'No leads yet. Add one with New lead.'}</MessageRow>
            ) : (
              data.rows.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                  <TableCell className="max-w-48">
                    <Link
                      to={`/leads/${lead.id}`}
                      className={cn('block truncate font-medium hover:underline', !fullName(lead) && 'text-muted-foreground italic')}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {fullName(lead) || 'No name'}
                    </Link>
                    {lead.occasion && <div className="truncate text-xs text-muted-foreground">{lead.occasion}</div>}
                  </TableCell>
                  <TableCell>
                    <LeadStatusChip status={lead.status} />
                    {lead.status === 'lost' && lead.lostReason && (
                      <div className="mt-0.5 text-xs text-muted-foreground">{LOST_REASON_LABELS[lead.lostReason]}</div>
                    )}
                    {lead.status === 'booked' && !lead.stay && (
                      <div className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">Stay to link</div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <SourceIcon source={lead.source} /> {SOURCE_LABELS[lead.source]}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{lead.hotel ?? <span className="text-muted-foreground">Not decided</span>}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{requestedDates(lead.checkIn, lead.checkOut)}</TableCell>
                  <TableCell className="whitespace-nowrap">{partyLabel(lead.adults, lead.children)}</TableCell>
                  <TableCell className="max-w-36 truncate">{lead.owner?.name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <FollowUpDate status={lead.status} followUpOn={lead.followUpOn} today={data.today} />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {lead.quotedValue != null ? money(lead.quotedValue, lead.currency) : ''}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatDate(lead.createdAt)}</TableCell>
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

function MessageRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={10} className={cn('h-24 text-center text-muted-foreground', className)}>
        {children}
      </TableCell>
    </TableRow>
  )
}
