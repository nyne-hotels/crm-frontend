import { ExternalLinkIcon, RotateCwIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useEmailHtml, useRefreshReport } from '@/hooks/use-campaigns'
import { countryFlag, formatCount, formatDateTime, plural } from '@/lib/format'
import type { Campaign, CampaignReport } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MailchimpProblem } from './mailchimp-problem'

// ---------------------------------------------------------------------
// A campaign's report: its Mailchimp email's figures (fetched live, see
// backend campaign-report.service.ts) and the CRM's own (form leads).
// Opens leave out Apple Mail's automatic opens, which open every email
// whether it's read or not; the all-in figures are shown beside them.
// Charts are one series each, in the --viz-1 colour, with a table to read
// the same figures without hovering.
// ---------------------------------------------------------------------
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 })
const pct = (fraction: number | null | undefined) => (fraction === null || fraction === undefined ? '–' : percent.format(fraction))
const hourFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const dayHourFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 })

function Card({ title, description, children, className }: { title: string; description?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border bg-card', className)}>
      <div className="border-b px-4 py-3">
        <h2 className="font-medium">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

// ---------- headline figures ----------
function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1 rounded-lg border bg-card px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
      {children && <div className="grid gap-0.5 text-xs text-muted-foreground">{children}</div>}
    </div>
  )
}

function Tiles({ report }: { report: CampaignReport }) {
  const avg = report.audienceAverage
  const bounced = report.bounces.hard + report.bounces.soft
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Tile label="Sent" value={formatCount(report.sent)}>
        {report.email.audience && <span>to {report.email.audience}</span>}
      </Tile>
      <Tile label="Delivered" value={formatCount(report.delivered)}>
        <span>{pct(report.sent ? report.delivered / report.sent : null)} of those sent</span>
        <span>
          {plural(bounced, 'bounce')}
          {report.bounces.hard > 0 && ` (${formatCount(report.bounces.hard)} permanent)`}
        </span>
      </Tile>
      <Tile label="Opened" value={pct(report.opens.rate)}>
        <span>{plural(report.opens.people, 'person', 'people')}</span>
        {avg?.openRate != null && <span>Your audience’s average: {pct(avg.openRate)}</span>}
        <span title="Apple Mail opens every email it receives, read or not">
          {pct(report.opens.allRate)} with Apple Mail’s automatic opens
        </span>
      </Tile>
      <Tile label="Clicked" value={pct(report.clicks.rate)}>
        <span>{plural(report.clicks.people, 'person', 'people')}</span>
        {avg?.clickRate != null && <span>Your audience’s average: {pct(avg.clickRate)}</span>}
        <span>{plural(report.clicks.total, 'click')} in all</span>
      </Tile>
      <Tile label="Unsubscribed" value={formatCount(report.unsubscribed)}>
        <span>{pct(report.delivered ? report.unsubscribed / report.delivered : null)} of those delivered</span>
        {report.spamReports > 0 && <span>{plural(report.spamReports, 'spam report')}</span>}
      </Tile>
    </div>
  )
}

// ---------- the first day, hour by hour ----------
// Round the axis top up to 1, 2 or 5 × a power of ten, in about 4 steps.
function axisTicks(max: number): number[] {
  if (max <= 0) return [0, 1]
  const rough = max / 4
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power
  const ticks = []
  for (let t = 0; t < max + step; t += step) ticks.push(t)
  return ticks
}

function HourlyColumns({ label, unit, points }: { label: string; unit: [string, string]; points: { at: string; value: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const ticks = axisTicks(Math.max(...points.map((p) => p.value), 0))
  const top = ticks[ticks.length - 1]
  const tip = hovered !== null ? points[hovered] : null
  return (
    <figure className="grid gap-2">
      <figcaption className="text-sm font-medium">{label}</figcaption>
      <div className="mt-2 flex gap-2">
        {/* y axis */}
        <div className="relative h-40 w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums" aria-hidden>
          {ticks.map((t) => (
            // placed by its bottom edge, so moved down half its height to sit on the gridline
            <span key={t} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: `${(t / top) * 100}%` }}>
              {t >= 10_000 ? compact.format(t) : formatCount(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative h-40">
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-border" style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-0.5" onPointerLeave={() => setHovered(null)}>
              {points.map((p, i) => (
                <button
                  key={p.at}
                  type="button"
                  className="group flex h-full min-w-0 flex-1 items-end justify-center focus-visible:outline-none"
                  onPointerEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                  aria-label={`${hourFormat.format(new Date(p.at))}: ${plural(p.value, unit[0], unit[1])}`}
                >
                  <span
                    className={cn(
                      'w-full max-w-6 rounded-t bg-viz-1 transition-opacity',
                      hovered !== null && hovered !== i && 'opacity-50',
                      'group-focus-visible:ring-2 group-focus-visible:ring-ring',
                    )}
                    style={{ height: `${(p.value / top) * 100}%`, minHeight: p.value > 0 ? 2 : 0 }}
                  />
                </button>
              ))}
            </div>
            {tip && hovered !== null && (
              <div
                className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
                style={{ left: `${((hovered + 0.5) / points.length) * 100}%` }}
                role="status"
              >
                <span className="font-semibold">{plural(tip.value, unit[0], unit[1])}</span>
                <span className="text-muted-foreground"> · {dayHourFormat.format(new Date(tip.at))}</span>
              </div>
            )}
          </div>
          {/* x axis: every 3 hours, or 6 on a phone */}
          <div className="relative mt-1 h-4 text-xs text-muted-foreground tabular-nums" aria-hidden>
            {points.map((p, i) =>
              i % 3 === 0 ? (
                <span
                  key={p.at}
                  className={cn('absolute -translate-x-1/2', i % 6 !== 0 && 'hidden sm:inline')}
                  style={{ left: `${((i + 0.5) / points.length) * 100}%` }}
                >
                  {hourFormat.format(new Date(p.at))}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </figure>
  )
}

function FirstDay({ report }: { report: CampaignReport }) {
  if (!report.hourly.length) return null
  return (
    <Card
      title="The first day, hour by hour"
      description="People opening or clicking for the first time in each hour after it was sent. Opens leave out Apple Mail’s automatic opens."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <HourlyColumns label="Opened" unit={['person', 'people']} points={report.hourly.map((h) => ({ at: h.at, value: h.opens }))} />
        <HourlyColumns label="Clicked" unit={['person', 'people']} points={report.hourly.map((h) => ({ at: h.at, value: h.clicks }))} />
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show as a table</summary>
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>Hour</TableHead>
              <TableHead className="text-right">Opened</TableHead>
              <TableHead className="text-right">With Apple Mail</TableHead>
              <TableHead className="text-right">Clicked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.hourly.map((h) => (
              <TableRow key={h.at}>
                <TableCell>{dayHourFormat.format(new Date(h.at))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(h.opens)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(h.allOpens)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(h.clicks)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </details>
    </Card>
  )
}

// ---------- ranked bars: links and countries ----------
interface BarRow {
  key: string
  label: React.ReactNode
  value: number
  figure: string // beside the bar
  detail?: string // under it
}

function RankedBars({ rows, empty }: { rows: BarRow[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="grid grid-cols-1 gap-3">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-1 gap-1 text-sm">
          <div className="flex items-baseline gap-3">
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            <span className="shrink-0 font-medium tabular-nums">{r.figure}</span>
          </div>
          <div className="h-2 rounded-r bg-muted" aria-hidden>
            <div className="h-full rounded-r bg-viz-1" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? 2 : 0 }} />
          </div>
          {r.detail && <span className="text-xs text-muted-foreground">{r.detail}</span>}
        </li>
      ))}
    </ul>
  )
}

// "https://www.tablebynyne.com/menu?x=1" → "tablebynyne.com/menu", or with
// "?x=1" when another link would read the same (the same page, tagged differently)
function shortUrl(url: string, withQuery = false) {
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')
    return `${u.hostname.replace(/^www\./, '')}${path}${withQuery ? decodeURIComponent(u.search) : ''}`
  } catch {
    return url
  }
}

// Labels for the links, most clicked first. The same page tagged differently
// shows its query; the very same address twice is two links in the email
// (a button at the top and one at the bottom), and Mailchimp counts each.
function linkLabels(urls: string[]): string[] {
  const short = urls.map((url) => shortUrl(url))
  const seen = new Set<string>()
  return urls.map((url, i) => {
    const clash = short.filter((s) => s === short[i]).length > 1
    const label = clash ? shortUrl(url, true) : short[i]
    const again = seen.has(url)
    seen.add(url)
    return again ? `${label} (another link to the same page)` : label
  })
}

function Links({ report }: { report: CampaignReport }) {
  const labels = linkLabels(report.links.map((l) => l.url))
  return (
    <Card title="Links clicked" description="Every link in the email, most clicked first.">
      <RankedBars
        empty="No links were clicked."
        rows={report.links.map((l, i) => ({
          key: `${i}-${l.url}`,
          label: (
            <a href={l.url} target="_blank" rel="noreferrer" title={l.url} className="underline-offset-4 hover:underline">
              {labels[i]}
            </a>
          ),
          value: l.clicks,
          figure: plural(l.clicks, 'click'),
          detail: `${plural(l.uniqueClicks, 'person', 'people')} · ${pct(l.share)} of all clicks`,
        }))}
      />
    </Card>
  )
}

const TOP_COUNTRIES = 10

function Countries({ report }: { report: CampaignReport }) {
  const rows = report.countries.filter((c) => c.opens > 0)
  const shown = rows.slice(0, TOP_COUNTRIES)
  const rest = rows.slice(TOP_COUNTRIES).reduce((n, c) => n + c.opens, 0)
  return (
    <Card
      title="Where it was opened"
      description="Opens by country, as Mailchimp sees them, leaving out Apple Mail’s automatic opens. Some email apps load emails through their own servers (Gmail through Google’s, in the US), so a few countries look bigger than they are."
    >
      <RankedBars
        empty="No opens with a known location yet."
        rows={[
          ...shown.map((c) => ({
            key: c.code,
            label: `${countryFlag(c.code)} ${c.name ?? c.code}`,
            value: c.opens,
            figure: plural(c.opens, 'open'),
          })),
          ...(rest ? [{ key: 'other', label: `Other countries (${rows.length - TOP_COUNTRIES})`, value: rest, figure: plural(rest, 'open') }] : []),
        ]}
      />
    </Card>
  )
}

const TOP_DOMAINS = 8

function Domains({ report }: { report: CampaignReport }) {
  if (!report.domains.length) return null
  const shown = report.domains.slice(0, TOP_DOMAINS)
  return (
    <Card title="Email providers" description="How the email did at each provider, by the address it went to. Opens include Apple Mail’s automatic ones.">
      <div className="-mx-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Provider</TableHead>
              <TableHead className="text-right">Sent</TableHead>
              <TableHead className="text-right">Bounced</TableHead>
              <TableHead className="text-right">Opened</TableHead>
              <TableHead className="text-right">Clicked</TableHead>
              <TableHead className="pr-4 text-right">Unsubscribed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((d) => (
              <TableRow key={d.domain}>
                <TableCell className="pl-4">{d.domain}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(d.sent)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(d.bounces)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(d.opens)} <span className="text-muted-foreground">({pct(d.delivered ? d.opens / d.delivered : null)})</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(d.clicks)}</TableCell>
                <TableCell className="pr-4 text-right tabular-nums">{formatCount(d.unsubscribed)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

// ---------- the email itself ----------
function EmailDetails({ campaignId, report }: { campaignId: number; report: CampaignReport }) {
  const [showing, setShowing] = useState(false)
  const html = useEmailHtml(campaignId, showing)
  const e = report.email
  const rows: [string, React.ReactNode][] = [
    ['Subject', e.subject],
    ['Preview text', e.previewText],
    ['From', [e.fromName, e.replyTo && `<${e.replyTo}>`].filter(Boolean).join(' ')],
    ['Sent', e.sentAt && formatDateTime(e.sentAt)],
    ['To', [e.audience, e.segment].filter(Boolean).join(': ')],
  ]
  return (
    <Card title="The email">
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="min-w-0 wrap-break-word">{v}</dd>
            </div>
          ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowing((s) => !s)}>
          {showing ? 'Hide the email' : 'Show the email'}
        </Button>
        {e.webVersionUrl && (
          <Button asChild variant="ghost" size="sm">
            <a href={e.webVersionUrl} target="_blank" rel="noreferrer">
              Web version <ExternalLinkIcon />
            </a>
          </Button>
        )}
      </div>
      {showing &&
        (html.error ? (
          <MailchimpProblem error={html.error} onRetry={() => html.refetch()} className="mt-3" />
        ) : html.isPending ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading the email…</p>
        ) : (
          // sandboxed with no permissions: the email's own scripts and links can't run or navigate
          <iframe
            title={`The email: ${e.subject ?? ''}`}
            sandbox=""
            srcDoc={html.data.html}
            className="mt-3 h-[640px] w-full rounded-md border bg-white"
          />
        ))}
    </Card>
  )
}

// ---------- the CRM's own figures ----------
export function FormResults({ campaign }: { campaign: Campaign }) {
  const leadsLink = `/leads/list?campaignId=${campaign.id}`
  return (
    <Card title="Enquiry form" description="People who sent the campaign’s form. Each became a lead for the campaign’s owner.">
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          ['Leads', campaign.leads],
          ['Still open', campaign.open],
          ['Booked', campaign.booked],
        ].map(([label, n]) => (
          <div key={label} className="rounded-md bg-muted/50 px-2 py-3">
            <div className="text-2xl font-semibold">{formatCount(n as number)}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      {campaign.leads > 0 && (
        <Link to={leadsLink} className="mt-3 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          See the leads
        </Link>
      )}
    </Card>
  )
}

// ---------- the whole report ----------
// afterTiles and afterLinks are the synced parts (bookings, people): they're
// the CRM's own copy, so they show even when Mailchimp can't be reached.
export function MailchimpReport({
  campaign,
  report,
  error,
  isPending,
  onRetry,
  afterTiles,
  afterLinks,
}: {
  campaign: Campaign
  report: CampaignReport | undefined
  error: unknown
  isPending: boolean
  onRetry: () => void
  afterTiles?: React.ReactNode
  afterLinks?: React.ReactNode
}) {
  const refresh = useRefreshReport(campaign.id)
  if (error || isPending || !report) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {error ? (
          <MailchimpProblem error={error} onRetry={onRetry} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading the figures from Mailchimp…</p>
        )}
        {afterTiles}
        {afterLinks}
      </div>
    )
  }
  return (
    <div className={cn('grid grid-cols-1 gap-4', refresh.isPending && 'opacity-60 transition-opacity')}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Figures from Mailchimp as of {hourFormat.format(new Date(report.fetchedAt))}</span>
        <Button variant="ghost" size="sm" className="h-7" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
          <RotateCwIcon className={cn(refresh.isPending && 'animate-spin')} /> Refresh
        </Button>
      </div>
      {refresh.error && <MailchimpProblem error={refresh.error} />}
      <Tiles report={report} />
      {afterTiles}
      <FirstDay report={report} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Links report={report} />
        <Countries report={report} />
      </div>
      {afterLinks}
      <Domains report={report} />
      <EmailDetails campaignId={campaign.id} report={report} />
    </div>
  )
}
