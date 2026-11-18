import { ChevronLeftIcon, ChevronRightIcon, RefreshCwIcon, SearchIcon, SparklesIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCampaignPeople, useSyncCampaign } from '@/hooks/use-campaigns'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { ApiError } from '@/lib/api'
import { formatCount, formatDateTime, fullName, plural } from '@/lib/format'
import type { CampaignBookings, CampaignResults, PeopleShow } from '@/lib/types'
import { cn } from '@/lib/utils'
import { StageChip, VipTag } from '../guests/guest-badges'
import { MailchimpProblem } from './mailchimp-problem'

// ---------------------------------------------------------------------
// What the sync brings in from Mailchimp (backend campaign-sync.service.ts):
// who the email went to, matched to the CRM, and what each person did. It
// runs on its own (often while an email is new, then less) and with Sync now.
// ---------------------------------------------------------------------
const relative = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })
function ago(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  return relative.format(Math.round(hours / 24), 'day')
}

// "Synced 10 minutes ago · Sync now", or what went wrong last time.
export function SyncStatus({
  campaignId,
  results,
  canSync,
}: {
  campaignId: number
  results: CampaignResults | undefined
  canSync: boolean
}) {
  const sync = useSyncCampaign(campaignId)
  const state = results?.sync
  const lastFailed = state?.lastError && (!state.lastSyncedAt || state.lastErrorAt! > state.lastSyncedAt)
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {sync.isPending
            ? 'Syncing people from Mailchimp…'
            : state?.lastSyncedAt
              ? `People synced from Mailchimp ${ago(state.lastSyncedAt)}`
              : lastFailed
                ? 'People couldn’t be synced from Mailchimp yet'
                : 'Syncing people from Mailchimp for the first time…'}
        </span>
        {canSync && (
          <Button variant="ghost" size="sm" className="h-7" disabled={sync.isPending} onClick={() => sync.mutate()}>
            <RefreshCwIcon className={cn(sync.isPending && 'animate-spin')} /> Sync now
          </Button>
        )}
      </div>
      {sync.error ? (
        <MailchimpProblem error={sync.error} />
      ) : (
        lastFailed && <MailchimpProblem error={new ApiError(503, 'The last sync failed. Try Sync now.', state!.lastError!)} />
      )}
    </div>
  )
}

const money = (amount: number, currency: string | null) =>
  currency
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
    : formatCount(Math.round(amount))

function BookingTile({ label, hint, bookings }: { label: string; hint: string; bookings: CampaignBookings }) {
  return (
    <div className="grid content-start gap-1 rounded-lg border bg-card px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{plural(bookings.stays, 'booking')}</span>
      <div className="grid gap-0.5 text-xs text-muted-foreground">
        <span>{plural(bookings.guests, 'guest')}</span>
        {bookings.revenue.length > 0 && (
          <span className="text-foreground">{bookings.revenue.map((r) => money(r.amount, r.currency)).join(' + ')} room revenue</span>
        )}
        <span>{hint}</span>
      </div>
    </div>
  )
}

// The bookings that followed, and who the email reached in the CRM.
export function SyncedResults({ results }: { results: CampaignResults }) {
  const { recipients, bookings, windowDays } = results
  if (!recipients || !bookings) return null
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <BookingTile
        label="Bookings from people who clicked"
        hint={`Booked within ${windowDays} days of clicking`}
        bookings={bookings.fromClickers}
      />
      <BookingTile
        label="Bookings from everyone who got it"
        hint={`Booked within ${windowDays} days of the send, clicked or not`}
        bookings={bookings.fromRecipients}
      />
      <div className="grid content-start gap-1 rounded-lg border bg-card px-4 py-3">
        <span className="text-sm text-muted-foreground">Who it went to</span>
        <span className="text-2xl font-semibold">{formatCount(recipients.total)}</span>
        <div className="grid gap-0.5 text-xs text-muted-foreground">
          <span>{plural(recipients.inCrm, 'was', 'were')} already in the CRM</span>
          <span>{plural(recipients.added, 'person', 'people')} added by this email</span>
          {recipients.sharedOnly > 0 && (
            <span title="The CRM has these addresses as shared (an agent’s office, a family email), so they aren’t matched to one person">
              {plural(recipients.sharedOnly, 'shared address', 'shared addresses')}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-3">
        A booking counts when its stay was added to the CRM within {windowDays} days and arrives after the email (or
        the click). Stays don’t record when they were booked, so a booking file imported late can shift these.
      </p>
    </div>
  )
}

const SHOW_LABELS: Record<PeopleShow, string> = {
  all: 'Everyone',
  opened: 'Opened',
  clicked: 'Clicked',
  not_opened: 'Didn’t open',
  unsubscribed: 'Unsubscribed',
  bounced: 'Bounced',
  added: 'Added by this email',
  booked: 'Booked',
}
const SHOW_ORDER: PeopleShow[] = ['all', 'clicked', 'opened', 'not_opened', 'booked', 'added', 'unsubscribed', 'bounced']

const time = (iso: string | null) => (iso ? formatDateTime(iso) : '')

// Everyone the email went to, most engaged first, with what they did.
export function PeopleList({ campaignId }: { campaignId: number }) {
  const [show, setShow] = useState<PeopleShow>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebouncedValue(search.trim(), 300)
  const { data, isPending, isFetching, error, refetch } = useCampaignPeople(campaignId, { show, q, page }, true)

  function choose(next: PeopleShow) {
    setShow(next)
    setPage(1)
  }

  if (error) return <MailchimpProblem error={error} onRetry={() => refetch()} />
  const counts = data?.counts
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  return (
    <section className="rounded-lg border bg-card" aria-labelledby="people-heading">
      <div className="grid gap-3 border-b px-4 py-3">
        <div>
          <h2 id="people-heading" className="font-medium">
            People
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Everyone the email went to, most engaged first. Opens here include Apple Mail’s automatic ones: Mailchimp
            can’t tell them apart for one person.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Show">
          {SHOW_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={show === key}
              onClick={() => choose(key)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                show === key && 'border-primary bg-primary text-primary-foreground hover:bg-primary',
              )}
            >
              {SHOW_LABELS[key]}
              {counts && <span className="text-xs tabular-nums opacity-75">{formatCount(counts[key])}</span>}
            </button>
          ))}
        </div>
        <div className="relative max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search by name or email"
            className="pl-8"
            aria-label="Search people"
          />
        </div>
      </div>
      {isPending ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : !counts ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          People show here once the first sync from Mailchimp is in.
        </p>
      ) : !data.rows.length ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nobody here{q ? ' matches that search' : ''}.</p>
      ) : (
        <div className={cn('overflow-x-auto', isFetching && 'opacity-60 transition-opacity')}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Person</TableHead>
                <TableHead className="text-right">Opened</TableHead>
                <TableHead className="text-right">Clicked</TableHead>
                <TableHead className="pr-4">Also</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((p) => {
                const name = p.contact ? fullName(p.contact) : ''
                return (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-72 pl-4">
                      <div className="flex min-w-0 items-center gap-2">
                        {p.contact ? (
                          <Link to={`/guests/${p.contact.id}`} className="min-w-0 truncate font-medium underline-offset-4 hover:underline">
                            {name || p.email}
                          </Link>
                        ) : (
                          <span className="min-w-0 truncate">{p.email}</span>
                        )}
                        {p.contact?.vipReason && <VipTag reason={p.contact.vipReason} />}
                      </div>
                      {name && <div className="truncate text-xs text-muted-foreground">{p.email}</div>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {p.opens ? (
                        <span title={`Last opened ${time(p.lastOpen)}`}>{plural(p.opens, 'time')}</span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {p.clicks ? (
                        <span title={`Last clicked ${time(p.lastClick)}`}>{plural(p.clicks, 'click')}</span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex flex-wrap gap-1">
                        {p.contact && <StageChip stage={p.contact.lifecycleStage} />}
                        {p.booked && <Badge variant="outline">Booked</Badge>}
                        {p.addedByThisEmail && (
                          <Badge variant="outline" title="They weren’t in the CRM; the sync added them">
                            <SparklesIcon /> New
                          </Badge>
                        )}
                        {p.unsubscribedAt && (
                          <Badge variant="outline" title={p.unsubscribeReason ?? undefined}>
                            Unsubscribed
                          </Badge>
                        )}
                        {p.delivery !== 'sent' && (
                          <Badge variant="outline">{p.delivery === 'hard_bounce' ? 'Bounced' : 'Soft bounce'}</Badge>
                        )}
                        {!p.contact && (
                          <Badge variant="outline" title="The CRM has this address as shared, so it isn’t one person">
                            Shared address
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-end gap-2 border-t px-4 py-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {formatCount((page - 1) * data.pageSize + 1)}–{formatCount(Math.min(page * data.pageSize, data.total))} of{' '}
            {formatCount(data.total)}
          </span>
          <Button variant="ghost" size="icon" className="size-8" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page">
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </section>
  )
}
