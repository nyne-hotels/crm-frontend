import { CopyIcon, RefreshCwIcon, TriangleAlertIcon, WebhookIcon } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCheckAudience, useAudienceStatus, useWebhookUrl } from '@/hooks/use-marketing'
import { useMe } from '@/hooks/use-me'
import { ApiError } from '@/lib/api'
import { formatCount, formatDate, formatDateTime, fullName, plural } from '@/lib/format'
import { can } from '@/lib/permissions'
import type { AudienceEvent } from '@/lib/types'
import { MailchimpProblem } from '../campaigns/mailchimp-problem'

const relative = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })
function ago(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  return relative.format(Math.round(hours / 24), 'day')
}

function what(e: AudienceEvent) {
  if (e.kind === 'unsubscribe') return 'Unsubscribed'
  return e.reason === 'abuse' ? 'Reported as spam' : 'Bounced'
}

function result(e: AudienceEvent) {
  if (e.optedOut) return `Opted out ${plural(e.optedOut, 'guest')}`
  if (e.bounced) return `Marked ${plural(e.bounced, 'address', 'addresses')} bounced`
  if (e.leftOptedIn) return `Left ${plural(e.leftOptedIn, 'guest')} opted in: opted in again later`
  return 'No change: not in the CRM, or already done'
}

// The webhook's address and how to add it in Mailchimp (admins only: it holds the secret).
function WebhookSetup() {
  const { data } = useWebhookUrl(true)
  if (!data) return null
  if (!data.url) {
    return (
      <p className="text-sm text-muted-foreground">
        To switch it on, set <code className="rounded bg-muted px-1">MAILCHIMP_WEBHOOK_SECRET</code> in the API's{' '}
        <code className="rounded bg-muted px-1">backend/.env</code> to any random text of 24 or more characters, and
        restart the API. Its address then shows here, to add in Mailchimp.
      </p>
    )
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(data!.url!)
      toast.success('Webhook address copied')
    } catch {
      toast.error("Couldn't copy. Select the address and copy it instead.")
    }
  }
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex min-w-0 items-center gap-1 rounded-md bg-muted px-2 py-1.5">
        <code className="min-w-0 flex-1 truncate text-xs">{data.url}</code>
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={copy} aria-label="Copy the webhook address">
          <CopyIcon className="size-3.5" />
        </Button>
      </div>
      {!data.reachable && (
        <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          This address isn’t public (https), so Mailchimp can’t reach it from here. Use the live CRM’s address, or set
          MAILCHIMP_WEBHOOK_BASE_URL. Until then the daily check still brings everything in.
        </p>
      )}
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>In Mailchimp, open Audience → Settings → Webhooks, and choose Create New Webhook.</li>
        <li>Paste this address as the callback URL.</li>
        <li>Tick only Unsubscribes and Cleaned address, and all three “sent” options (by a subscriber, by an admin, via the API).</li>
        <li>Save. The page shows when Mailchimp first calls it.</li>
      </ol>
    </div>
  )
}

// Marketing → Unsubscribes & bounces: Mailchimp's, applied by themselves.
export function UnsubscribesPage() {
  const { data: me } = useMe()
  const canCheck = can(me?.permissions, 'guestConsent', 'edit')
  const isAdmin = can(me?.permissions, 'settings', 'edit')
  const { data, isPending, error, refetch } = useAudienceStatus()
  const check = useCheckAudience()

  if (error) return <MailchimpProblem error={error} onRetry={() => refetch()} />
  if (isPending) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
  const audience = data.audiences[0]
  const lastFailed =
    audience?.lastError && (!audience.lastCheckedAt || (audience.lastErrorAt ?? '') > audience.lastCheckedAt)

  return (
    <div className="grid max-w-4xl gap-4">
      <p className="text-sm text-muted-foreground">
        Unsubscribes and bounces come from Mailchimp by themselves. Mailchimp tells the CRM the moment someone
        unsubscribes or an address bounces, and a daily check catches anything missed. An unsubscribe opts every guest
        with that email out of email marketing; a bounce marks the address bounced. Either way they drop off the email
        list. A guest who opted in again in the CRM after unsubscribing is left opted in and listed below to check.
      </p>

      {!data.configured && <MailchimpProblem error={new ApiError(503, '', 'mailchimp_not_configured')} />}

      <section className="grid gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">{audience?.name ? `Mailchimp audience: ${audience.name}` : 'Mailchimp audience'}</p>
            <p className="text-muted-foreground">
              {check.isPending
                ? 'Checking Mailchimp…'
                : audience?.lastCheckedAt
                  ? `Last checked ${ago(audience.lastCheckedAt)}. The next check is within a day.`
                  : 'Not checked yet. The first check brings in everyone who has unsubscribed or bounced so far.'}
            </p>
          </div>
          {canCheck && data.configured && (
            <Button variant="outline" size="sm" disabled={check.isPending} onClick={() => check.mutate()}>
              <RefreshCwIcon className={check.isPending ? 'animate-spin' : undefined} /> Check now
            </Button>
          )}
        </div>
        {check.error ? (
          <MailchimpProblem error={check.error} />
        ) : (
          lastFailed && (
            <MailchimpProblem error={new ApiError(503, 'The last check failed. Try Check now.', audience.lastError!)} />
          )
        )}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            ['Unsubscribes', data.totals.unsubscribes],
            ['Bounces', data.totals.cleaned],
            ['In the last 30 days', data.totals.last30],
          ].map(([label, n]) => (
            <div key={label} className="rounded-md bg-muted/50 px-2 py-3">
              <div className="text-2xl font-semibold">{formatCount(n as number)}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-2 rounded-lg border bg-card p-4">
        <h2 className="flex items-center gap-2 font-medium">
          <WebhookIcon className="size-4 text-muted-foreground" /> Instant updates (webhook)
        </h2>
        <p className="text-sm text-muted-foreground">
          {!data.webhook.on
            ? 'Off: changes arrive with the daily check.'
            : audience?.lastWebhookAt
              ? `On. Mailchimp last called ${ago(audience.lastWebhookAt)}.`
              : 'Set up in the CRM, but Mailchimp hasn’t called it yet. Until it does, changes arrive with the daily check.'}
        </p>
        {isAdmin && <WebhookSetup />}
      </section>

      {data.toCheck.length > 0 && (
        <section className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <h2 className="font-medium">Opted in again after unsubscribing ({data.toCheck.length})</h2>
          <p>
            These guests unsubscribed in Mailchimp, but their opt-in in the CRM is newer, so they were left opted in.
            Check with them, or change their consent on their profile.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {data.toCheck.map((c) => (
              <li key={c.id}>
                <Link to={`/guests/${c.id}`} className="underline underline-offset-4">
                  {fullName(c) || `Guest #${c.id}`}
                </Link>
                {c.givenAt && <span className="text-muted-foreground"> (opted in {formatDate(c.givenAt)})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border bg-card">
        <h2 className="border-b px-4 py-3 font-medium">Latest from Mailchimp</h2>
        {!data.recent.length ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">When</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead className="pr-4">In the CRM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="pl-4 whitespace-nowrap">{formatDateTime(e.at)}</TableCell>
                    <TableCell className="max-w-64 truncate">{e.email}</TableCell>
                    <TableCell>
                      {what(e)}
                      {e.kind === 'unsubscribe' && e.reason && !['N/A', 'None given', 'manual'].includes(e.reason) && (
                        <span className="text-muted-foreground"> · {e.reason}</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-muted-foreground">{result(e)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
