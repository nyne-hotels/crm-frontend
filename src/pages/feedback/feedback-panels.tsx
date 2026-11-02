import { MessageSquareHeartIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGuestFeedback, useStayFeedback } from '@/hooks/use-feedback'
import { stayDates } from '@/lib/feedback'
import { formatDate, fullName } from '@/lib/format'
import type { FeedbackPanelRow, Stay } from '@/lib/types'
import { FollowedUpChip, NeedsFollowUpChip, Stars } from './feedback-badges'
import { ResponseDialog } from './response-dialog'

// The Feedback panel on the guest profile: the rating and review for each
// stay that has one, newest first.
export function GuestFeedbackPanel({ guestId }: { guestId: number }) {
  const { data, isPending, isError } = useGuestFeedback(guestId)
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareHeartIcon className="size-4 text-muted-foreground" /> Feedback
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-16" />
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load feedback.</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback forms returned.</p>
        ) : (
          <ul className="grid">
            {data.map((f) => (
              <li key={f.id} className="border-b py-3 first:pt-0 last:border-0 last:pb-0">
                <Response feedback={f} heading={`${f.hotel} · ${stayDates(f)}`} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Response({ feedback: f, heading }: { feedback: FeedbackPanelRow; heading?: string }) {
  return (
    <Link
      to={`/feedback/${f.id}`}
      className="grid gap-1 rounded-sm hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex flex-wrap items-center gap-2">
        <Stars rating={f.rating} />
        {heading && <span className="text-sm font-medium">{heading}</span>}
        {f.needsFollowUp ? <NeedsFollowUpChip /> : f.followedUpAt ? <FollowedUpChip /> : null}
      </span>
      {f.review && <span className="line-clamp-4 text-sm whitespace-pre-wrap wrap-break-word">{f.review}</span>}
      <span className="text-xs text-muted-foreground">Received {formatDate(f.submittedAt)}</span>
    </Link>
  )
}

// The Feedback section on the stay detail: its response, or Add response
// once the stay is checked out.
export function StayFeedback({ stay, canEdit }: { stay: Stay; canEdit: boolean }) {
  const { data, isPending } = useStayFeedback(stay.id)
  const [adding, setAdding] = useState(false)
  const over = stay.status === 'checked_out'
  if (isPending) return <Skeleton className="h-12" />
  const feedback = data?.feedback
  if (!feedback && !over) return null
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Feedback</h3>
        {!feedback && canEdit && (
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setAdding(true)}>
            <PlusIcon /> Add response
          </Button>
        )}
      </div>
      {feedback ? <Response feedback={feedback} /> : <p className="text-sm text-muted-foreground">No feedback form returned.</p>}
      <ResponseDialog
        open={adding}
        onOpenChange={setAdding}
        stay={{
          id: stay.id,
          label: `${fullName(stay.guest) || stay.guest.email || 'Guest'} · ${stay.hotel}`,
          detail: [stayDates(stay), stay.bookingReference].filter(Boolean).join(' · '),
          feedbackId: null,
        }}
      />
    </section>
  )
}
