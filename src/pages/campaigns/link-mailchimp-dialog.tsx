import { CheckIcon, SearchIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useMailchimpEmails } from '@/hooks/use-campaigns'
import { formatCount, formatDate } from '@/lib/format'
import type { Campaign } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MailchimpProblem } from './mailchimp-problem'

// Pick the campaign's email from those sent in Mailchimp, newest first. An
// email already linked to another campaign can't be picked (one each).
export function LinkMailchimpDialog({
  open,
  onOpenChange,
  campaign,
  onPick,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign: Campaign
  onPick: (mailchimpCampaignId: string | null) => void
  saving: boolean
}) {
  const { data: emails, isPending, error, refetch } = useMailchimpEmails(open)
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const shown = (emails ?? []).filter(
    (e) => !q || e.title?.toLowerCase().includes(q) || e.subject?.toLowerCase().includes(q),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[85vh] grid-rows-[auto_auto_1fr_auto] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Link a Mailchimp email</DialogTitle>
          <DialogDescription>
            The email {campaign.name} was sent as. Its figures from Mailchimp then show on this page.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or subject"
            className="pl-8"
            aria-label="Search Mailchimp emails"
          />
        </div>
        <div className="-mx-2 min-h-24 overflow-y-auto px-2">
          {error ? (
            <MailchimpProblem error={error} onRetry={() => refetch()} />
          ) : isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading emails from Mailchimp…</p>
          ) : !shown.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {emails?.length ? 'No sent emails match.' : 'Mailchimp has no sent emails yet.'}
            </p>
          ) : (
            <ul className="grid gap-1" aria-label="Sent Mailchimp emails">
              {shown.map((e) => {
                const current = e.id === campaign.mailchimpCampaignId
                const taken = !!e.linkedTo && e.linkedTo.id !== campaign.id
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      disabled={taken || current || saving}
                      onClick={() => onPick(e.id)}
                      className={cn(
                        'grid w-full gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed',
                        current && 'border-primary bg-primary/5 hover:bg-primary/5',
                        taken && 'opacity-60 hover:bg-transparent',
                      )}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <span className="min-w-0 flex-1 truncate">{e.title ?? e.subject ?? e.id}</span>
                        {current && (
                          <span className="flex shrink-0 items-center gap-1 text-xs font-normal">
                            <CheckIcon className="size-3.5" /> Linked
                          </span>
                        )}
                      </span>
                      {e.subject && e.subject !== e.title && (
                        <span className="truncate text-muted-foreground">Subject: {e.subject}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Sent {formatDate(e.sentAt)} to {formatCount(e.sent)} people
                        {taken && ` · linked to ${e.linkedTo!.name}`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {campaign.mailchimpCampaignId && (
          <div className="flex justify-end border-t pt-3">
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => onPick(null)}>
              Unlink the current email
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
