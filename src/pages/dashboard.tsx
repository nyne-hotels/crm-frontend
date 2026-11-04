import {
  AlarmClockIcon,
  BedDoubleIcon,
  CakeIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  CopyIcon,
  MegaphoneIcon,
  MessageSquareHeartIcon,
  PlaneLandingIcon,
  PlaneTakeoffIcon,
  SearchIcon,
  TargetIcon,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Input } from '@/components/ui/input'
import { useCampaigns } from '@/hooks/use-campaigns'
import { useDuplicates } from '@/hooks/use-duplicates'
import { useHotelRatings } from '@/hooks/use-feedback'
import { useUpcomingOccasions } from '@/hooks/use-knowledge'
import { useFollowUps, useLeadBoard } from '@/hooks/use-leads'
import { useEmailList } from '@/hooks/use-marketing'
import { useMe } from '@/hooks/use-me'
import { useQuickCounts } from '@/hooks/use-stays'
import { queryString } from '@/lib/api'
import { formatCount, formatDate, fullName, plural } from '@/lib/format'
import { daysAwayLabel, SPECIAL_DATE_LABELS, UPCOMING_DAYS, yearsLabel } from '@/lib/knowledge'
import { LEAD_STATUS_CHIP_CLASSES, LEAD_STATUS_LABELS, OPEN_LEAD_STATUSES } from '@/lib/leads'
import { can } from '@/lib/permissions'
import { QUICK_VIEW_LABELS, QUICK_VIEWS, type QuickView } from '@/lib/stays'
import { cn } from '@/lib/utils'

const QUICK_VIEW_ICONS: Record<QuickView, LucideIcon> = {
  arriving_today: PlaneLandingIcon,
  in_house: BedDoubleIcon,
  departing_today: PlaneTakeoffIcon,
  arriving_week: CalendarDaysIcon,
}

const LIST_LIMIT = 5

const average = (n: number | null) => (n === null ? '–' : n.toFixed(2))

// The first page after sign-in: a contact search, today's arrivals and
// departures, and what needs doing. Each section shows only for roles that can
// open the page it links to.
export function DashboardPage() {
  const { data: me } = useMe()
  const p = me?.permissions
  const followUps = can(p, 'leads', 'edit')
  const marketing = can(p, 'marketingExport') || can(p, 'campaigns')

  return (
    <div className="mx-auto grid max-w-6xl gap-6 py-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Welcome, {me?.firstName}</h1>
          <p className="mt-1 text-muted-foreground">{formatDate(new Date())}</p>
        </div>
        <ContactSearch />
      </div>
      {can(p, 'stays') && <TodayAtTheHotels />}
      {/* two balanced columns: sections stack down the first, then the second */}
      <div className="gap-4 lg:columns-2 [&>section]:mb-4 [&>section]:break-inside-avoid">
        {followUps && <FollowUpsSection />}
        {can(p, 'leads') && <PipelineSection />}
        {can(p, 'feedback') && <FeedbackSection canFollowUp={can(p, 'feedback', 'edit')} />}
        {can(p, 'guests') && <OccasionsSection />}
        {marketing && <MarketingSection emailList={can(p, 'marketingExport')} campaigns={can(p, 'campaigns')} />}
        {can(p, 'mergeGuests', 'edit') && <DuplicatesSection />}
      </div>
    </div>
  )
}

function ContactSearch() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  return (
    <form
      className="relative w-full sm:w-80"
      onSubmit={(e) => {
        e.preventDefault()
        navigate(`/guests${queryString({ q: search.trim() })}`)
      }}
    >
      <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Find a contact by name, email or phone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-8"
        aria-label="Find a contact"
      />
    </form>
  )
}

// The Stays quick filters as tiles, each opening the filtered list.
function TodayAtTheHotels() {
  const { data } = useQuickCounts()
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Today at the hotels">
      {QUICK_VIEWS.map((view) => {
        const Icon = QUICK_VIEW_ICONS[view]
        return (
          <Link
            key={view}
            to={`/stays?view=${view}`}
            className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4" />
              {QUICK_VIEW_LABELS[view]}
            </span>
            <span className="mt-2 block text-3xl font-semibold tabular-nums">{data ? formatCount(data[view]) : '–'}</span>
          </Link>
        )
      })}
    </div>
  )
}

// ---------- sections ----------
function Section({
  title,
  icon: Icon,
  to,
  link = 'View all',
  children,
}: {
  title: string
  icon: LucideIcon
  to: string
  link?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Icon className="size-4 text-muted-foreground" />
        <h2 className="font-medium">{title}</h2>
        <Link to={to} className="ml-auto flex items-center text-sm text-muted-foreground hover:text-foreground">
          {link}
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

// Loading, failed or empty: one muted line in place of the section's body.
function Note({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>
}

function QueryNote({ isError, what }: { isError: boolean; what: string }) {
  return isError ? <Note className="text-destructive">Couldn't load {what}.</Note> : <Note>Loading…</Note>
}

function More({ shown, total, what }: { shown: number; total: number; what: string }) {
  return total > shown ? <Note className="mt-3">and {plural(total - shown, what)} more</Note> : null
}

// The signed-in person's open leads due today or overdue, oldest first.
function FollowUpsSection() {
  const { data, isError } = useFollowUps()
  const rows = data ? [...data.rows].sort((a, b) => (a.followUpOn ?? '').localeCompare(b.followUpOn ?? '')) : []
  const overdue = data ? rows.filter((l) => l.followUpOn && l.followUpOn < data.today).length : 0

  return (
    <Section title="My follow-ups" icon={AlarmClockIcon} to="/leads/follow-ups">
      {!data ? (
        <QueryNote isError={isError} what="your follow-ups" />
      ) : !rows.length ? (
        <Note>No follow-ups due today.</Note>
      ) : (
        <>
          <p className="mb-3 text-sm">
            {plural(rows.length, 'follow-up')} due
            {overdue > 0 && <span className="text-destructive">, {formatCount(overdue)} overdue</span>}
          </p>
          <ul className="divide-y">
            {rows.slice(0, LIST_LIMIT).map((lead) => {
              const late = !!lead.followUpOn && lead.followUpOn < data.today
              return (
                <li key={lead.id}>
                  <Link to={`/leads/${lead.id}`} className="flex items-center gap-3 py-2 hover:underline">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{fullName(lead) || 'No name'}</span>
                      {lead.hotel && <span className="text-muted-foreground"> · {lead.hotel}</span>}
                    </span>
                    <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', LEAD_STATUS_CHIP_CLASSES[lead.status])}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </span>
                    <span
                      className={cn('min-w-24 text-right text-sm whitespace-nowrap tabular-nums', late ? 'text-destructive' : 'text-muted-foreground')}
                    >
                      {late ? `Overdue ${formatDate(lead.followUpOn)}` : 'Today'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <More shown={LIST_LIMIT} total={rows.length} what="follow-up" />
        </>
      )}
    </Section>
  )
}

// Open leads by stage, and how the recently closed ones went.
function PipelineSection() {
  const { data, isError } = useLeadBoard({})
  const booked = data?.columns.booked.length ?? 0
  const lost = data?.columns.lost.length ?? 0

  return (
    <Section title="Leads pipeline" icon={TargetIcon} to="/leads" link="Open board">
      {!data ? (
        <QueryNote isError={isError} what="the leads" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {OPEN_LEAD_STATUSES.map((status) => (
              <div key={status} className="rounded-md bg-muted/40 p-3">
                <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', LEAD_STATUS_CHIP_CLASSES[status])}>
                  {LEAD_STATUS_LABELS[status]}
                </span>
                <span className="mt-2 block text-2xl font-semibold tabular-nums">{formatCount(data.columns[status].length)}</span>
              </div>
            ))}
          </div>
          <Note className="mt-3">
            Last {data.closedDays} days: {formatCount(booked)} booked, {formatCount(lost)} lost
            {booked + lost > 0 && ` (${Math.round((booked / (booked + lost)) * 100)}% won)`}.
          </Note>
        </>
      )}
    </Section>
  )
}

// The average rating of each hotel with responses, and the low ratings waiting for a call.
function FeedbackSection({ canFollowUp }: { canFollowUp: boolean }) {
  const { data, isError } = useHotelRatings()
  const waiting = data?.group.needsFollowUp ?? 0
  const rated = data?.rows.filter((h) => h.responses > 0) ?? []

  return (
    <Section title="Guest feedback" icon={MessageSquareHeartIcon} to="/feedback/ratings" link="Hotel ratings">
      {!data ? (
        <QueryNote isError={isError} what="the ratings" />
      ) : (
        <>
          {canFollowUp && (
            <Link
              to="/feedback?tab=needs_follow_up"
              className={cn(
                'mb-3 flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50',
                waiting > 0 && 'border-destructive/40 text-destructive',
              )}
            >
              {waiting ? `${plural(waiting, 'low rating')} to follow up` : 'No low ratings waiting'}
              <ChevronRightIcon className="size-4" />
            </Link>
          )}
          {!rated.length ? (
            <Note>No feedback responses yet.</Note>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="pb-2 font-normal">Hotel</th>
                  <th className="pb-2 text-right font-normal">Average</th>
                  <th className="pb-2 text-right font-normal" title="Average and responses in the last 90 days">
                    Last 90 days
                  </th>
                </tr>
              </thead>
              <tbody>
                {rated.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="py-1.5">
                      <Link to={`/feedback?hotel=${h.id}`} className="hover:underline">
                        {h.name}
                      </Link>
                    </td>
                    <td
                      className={cn(
                        'py-1.5 text-right tabular-nums',
                        h.avgRating !== null && h.avgRating < 3 && 'text-destructive',
                      )}
                    >
                      {average(h.avgRating)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {average(h.avgRating90Days)}
                      <span className="text-muted-foreground"> ({formatCount(h.responses90Days)})</span>
                    </td>
                  </tr>
                ))}
                <tr className="border-t font-medium">
                  <td className="pt-1.5">All hotels</td>
                  <td className="pt-1.5 text-right tabular-nums">{average(data.group.avgRating)}</td>
                  <td className="pt-1.5 text-right tabular-nums">
                    {average(data.group.avgRating90Days)}
                    <span className="font-normal text-muted-foreground"> ({formatCount(data.group.responses90Days)})</span>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </>
      )}
    </Section>
  )
}

// The next birthdays and anniversaries, soonest first.
function OccasionsSection() {
  const { data, isError } = useUpcomingOccasions({})
  const rows = data?.rows ?? []

  return (
    <Section title="Upcoming occasions" icon={CakeIcon} to="/guests/occasions">
      {!data ? (
        <QueryNote isError={isError} what="the occasions" />
      ) : !rows.length ? (
        <Note>No birthdays or anniversaries in the next {UPCOMING_DAYS} days.</Note>
      ) : (
        <>
          <ul className="divide-y">
            {rows.slice(0, LIST_LIMIT).map((o) => (
              <li key={o.id}>
                <Link to={`/guests/${o.guest.id}`} className="flex items-center gap-3 py-2 hover:underline">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{fullName(o.guest) || 'No name'}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {o.label || SPECIAL_DATE_LABELS[o.occasion]}
                      {yearsLabel(o.occasion, o.years) && `, ${yearsLabel(o.occasion, o.years)}`}
                    </span>
                  </span>
                  {o.nextStay && (
                    <span className="hidden text-xs text-muted-foreground sm:inline" title="Their next stay">
                      Staying at {o.nextStay.hotel}
                    </span>
                  )}
                  <span className={cn('w-20 text-right text-sm', o.daysAway === 0 ? 'font-medium' : 'text-muted-foreground')}>
                    {daysAwayLabel(o.daysAway)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <More shown={LIST_LIMIT} total={rows.length} what="occasion" />
        </>
      )}
    </Section>
  )
}

// The size of the email list and how the open campaigns are doing.
function MarketingSection({ emailList, campaigns }: { emailList: boolean; campaigns: boolean }) {
  const list = useEmailList({ pageSize: 1 }, emailList)
  const { data: rows } = useCampaigns(campaigns)
  const active = (rows ?? []).filter((c) => c.isActive).sort((a, b) => b.leads - a.leads)

  return (
    <Section
      title="Marketing"
      icon={MegaphoneIcon}
      to={emailList ? '/marketing/email-list' : '/marketing/campaigns'}
      link={emailList ? 'Email list' : 'Campaigns'}
    >
      {emailList && (
        <p className="text-sm">
          <span className="text-2xl font-semibold tabular-nums">{list.data ? formatCount(list.data.listTotal) : '–'}</span>{' '}
          <span className="text-muted-foreground">contacts can be emailed</span>
        </p>
      )}
      {campaigns && rows && (
        <div className={cn(emailList && 'mt-4')}>
          <div className="mb-1 flex items-center text-sm text-muted-foreground">
            Open campaigns
            <Link to="/marketing/campaigns" className="ml-auto hover:text-foreground">
              All campaigns
            </Link>
          </div>
          {!active.length ? (
            <Note>No open campaigns.</Note>
          ) : (
            <ul className="divide-y text-sm">
              {active.slice(0, LIST_LIMIT).map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-1.5">
                  <Link to={`/leads?campaignId=${c.id}`} className="min-w-0 flex-1 truncate hover:underline">
                    {c.name}
                  </Link>
                  <span className="text-muted-foreground tabular-nums">
                    {plural(c.leads, 'lead')} · {formatCount(c.open)} open · {formatCount(c.booked)} booked
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  )
}

function DuplicatesSection() {
  const { data, isError } = useDuplicates({})
  const pairs = data?.counts.all ?? 0
  return (
    <Section title="Possible duplicates" icon={CopyIcon} to="/guests/duplicates" link="Review">
      {!data ? (
        <QueryNote isError={isError} what="the duplicates" />
      ) : (
        <Note className={cn(pairs > 0 && 'text-foreground')}>
          {pairs ? `${plural(pairs, 'pair')} of contacts may be the same person.` : 'No possible duplicates to review.'}
        </Note>
      )}
    </Section>
  )
}
