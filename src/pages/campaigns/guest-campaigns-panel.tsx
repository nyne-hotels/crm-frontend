import { SendIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useContactCampaignEmails } from '@/hooks/use-campaigns'
import { formatDate, plural } from '@/lib/format'

// "https://www.tablebynyne.com/menu?x=1" → "tablebynyne.com/menu"
function shortUrl(url: string) {
  try {
    const u = new URL(url)
    return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')}`
  } catch {
    return url
  }
}

// On a guest's profile: the campaign emails they were sent (synced from
// Mailchimp) and what they did with each. Opens include Apple Mail's automatic ones.
export function GuestCampaignsPanel({ guestId }: { guestId: number }) {
  const { data, isPending, isError } = useContactCampaignEmails(guestId, true)
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SendIcon className="size-4 text-muted-foreground" /> Campaign emails
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-12" />
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load campaign emails.</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaign emails synced from Mailchimp.</p>
        ) : (
          <ul className="grid">
            {data.map((e) => (
              <li key={e.campaign.id} className="grid gap-1 border-b py-3 text-sm first:pt-0 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Link to={`/campaigns/${e.campaign.id}`} className="font-medium underline-offset-4 hover:underline">
                    {e.campaign.name}
                  </Link>
                  {e.sentAt && <span className="text-xs text-muted-foreground">sent {formatDate(e.sentAt)}</span>}
                </div>
                <p className="text-muted-foreground">
                  {e.delivery !== 'sent'
                    ? e.delivery === 'hard_bounce'
                      ? 'Bounced: it never arrived.'
                      : 'Soft bounce: it may not have arrived.'
                    : [
                        e.opens ? `Opened ${plural(e.opens, 'time')}, last ${formatDate(e.lastOpen)}` : 'Not opened',
                        e.clicks ? plural(e.clicks, 'click') : null,
                        e.unsubscribedAt ? `unsubscribed ${formatDate(e.unsubscribedAt)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
                {e.links.length > 0 && (
                  <ul className="grid gap-0.5 text-xs">
                    {e.links.map((url) => (
                      <li key={url} className="truncate">
                        Clicked{' '}
                        <a href={url} target="_blank" rel="noreferrer" title={url} className="underline-offset-4 hover:underline">
                          {shortUrl(url)}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
