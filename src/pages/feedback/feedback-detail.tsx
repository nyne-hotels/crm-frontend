import {
  ArrowLeftIcon,
  BedDoubleIcon,
  CircleCheckIcon,
  EllipsisIcon,
  LinkIcon,
  MailIcon,
  MessageCircleIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field, FormError } from '@/components/field'
import { CreatedAndUpdated } from '@/components/last-updated'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useFeedback, useFeedbackMutations, useFeedbackTimeline } from '@/hooks/use-feedback'
import { useMe } from '@/hooks/use-me'
import { useStayPanel } from '@/hooks/use-stay-panel'
import { ApiError, errorMessage } from '@/lib/api'
import { DEPARTMENT_LABELS, employeeName, LOW_RATING, stayDates } from '@/lib/feedback'
import { formatDate, formatDateTime, fullName } from '@/lib/format'
import type { InteractionKind } from '@/lib/leads'
import { phoneHref } from '@/lib/phone'
import { can } from '@/lib/permissions'
import { nightsLabel } from '@/lib/stays'
import type { Feedback, Mention } from '@/lib/types'
import { StageChip } from '../guests/guest-badges'
import { LogInteractionDialog } from '../leads/log-interaction-dialog'
import { Timeline } from '../leads/timeline'
import { StayDetailSheet } from '../stays/stay-detail-sheet'
import { FollowedUpChip, NeedsFollowUpChip, SentimentChip, Stars } from './feedback-badges'
import { MentionDialog } from './mention-dialog'
import { ResponseDialog } from './response-dialog'

// /feedback/:id – keyed by id, so opening another response starts afresh
export function FeedbackDetailPage() {
  const { id } = useParams()
  return <FeedbackDetail key={id} id={Number(id)} />
}

function FeedbackDetail({ id }: { id: number }) {
  const { data: me } = useMe()
  const { data: feedback, isPending, error } = useFeedback(id)
  const canEdit = can(me?.permissions, 'feedback', 'edit')

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-6xl gap-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      </div>
    )
  }
  if (error || !feedback) {
    const missing = error instanceof ApiError && (error.status === 404 || error.status === 400)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-heading text-xl font-semibold">{missing ? 'Response not found' : "Couldn't load this response"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{missing ? 'It may have been deleted.' : 'Try again in a moment.'}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/feedback">Back to feedback</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <Link to="/feedback" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Feedback
      </Link>
      <Header feedback={feedback} canEdit={canEdit} />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="grid gap-6">
          <ResponseCard feedback={feedback} />
          <StayCard feedback={feedback} />
        </div>
        <div className="grid gap-6 lg:col-span-2">
          {feedback.mentions && <MentionsCard feedback={feedback} canEdit={can(me?.permissions, 'employees', 'edit')} />}
          <FollowUpCard feedback={feedback} canEdit={canEdit} />
        </div>
      </div>
      <CreatedAndUpdated created={feedback.created} lastUpdated={feedback.lastUpdated} className="border-t pt-4" />
      <StayDetailSheet />
    </div>
  )
}

const LOG_BUTTONS: { kind: InteractionKind; label: string; icon: LucideIcon }[] = [
  { kind: 'call', label: 'Log call', icon: PhoneIcon },
  { kind: 'whatsapp', label: 'Log WhatsApp', icon: MessageCircleIcon },
  { kind: 'email', label: 'Log email', icon: MailIcon },
]

function Header({ feedback, canEdit }: { feedback: Feedback; canEdit: boolean }) {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { remove } = useFeedbackMutations()
  const [logging, setLogging] = useState<InteractionKind | null>(null)
  const [following, setFollowing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const name = fullName(feedback.guest) || feedback.guest.email || `Guest #${feedback.guest.id}`
  // conversations are logged in the interaction log (the leads area)
  const canLog = can(me?.permissions, 'leads', 'edit')

  return (
    <header className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-heading text-2xl font-semibold wrap-break-word">
          {name} <span className="text-muted-foreground">· {feedback.stay.hotel}</span>
        </h1>
        <Stars rating={feedback.rating} size="lg" />
        {feedback.needsFollowUp ? <NeedsFollowUpChip /> : feedback.followUp ? <FollowedUpChip /> : null}
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {canLog &&
            LOG_BUTTONS.map(({ kind, label, icon: Icon }) => (
              <Button key={kind} size="sm" variant="outline" onClick={() => setLogging(kind)}>
                <Icon /> {label}
              </Button>
            ))}
          <Button size="sm" variant={feedback.needsFollowUp ? 'default' : 'outline'} onClick={() => setFollowing(true)}>
            <CircleCheckIcon /> {feedback.followUp ? 'Edit outcome' : 'Mark followed up'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-8" aria-label="More">
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <PencilIcon /> Edit response
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                Delete response
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {logging && (
        <LogInteractionDialog
          open
          onOpenChange={(open) => !open && setLogging(null)}
          kind={logging}
          title={`Log ${logging === 'whatsapp' ? 'WhatsApp' : logging} with ${name}`}
          target={{ feedbackId: feedback.id }}
        />
      )}
      <FollowUpDialog feedback={feedback} open={following} onOpenChange={setFollowing} />
      <ResponseDialog open={editing} onOpenChange={setEditing} feedback={feedback} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this response?"
        description="Use this for a response entered on the wrong stay. Its employee mentions go with it."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(feedback.id)
          toast.success('Response deleted')
          navigate('/feedback', { replace: true })
        }}
      />
    </header>
  )
}

function ResponseCard({ feedback }: { feedback: Feedback }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Response</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Stars rating={feedback.rating} size="lg" />
          {feedback.rating !== null && <span className="text-sm text-muted-foreground">{feedback.rating} of 5</span>}
        </div>
        {feedback.review ? (
          <p className="text-sm whitespace-pre-wrap wrap-break-word">{feedback.review}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No written review.</p>
        )}
        <p className="text-xs text-muted-foreground">Received {formatDate(feedback.submittedAt)}</p>
      </CardContent>
    </Card>
  )
}

function StayCard({ feedback }: { feedback: Feedback }) {
  const { open } = useStayPanel()
  const { guest, stay } = feedback
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Stay and guest</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <button
          type="button"
          onClick={() => open(stay.id)}
          className="flex w-fit items-start gap-2 text-left text-sm underline-offset-4 hover:underline"
        >
          <BedDoubleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="grid">
            <span className="font-medium">{stay.hotel}</span>
            <span className="text-muted-foreground tabular-nums">
              {stayDates(stay)}
              {stay.nights != null && ` · ${nightsLabel(stay.nights)}`}
            </span>
            {stay.bookingReference && <span className="text-muted-foreground">Ref {stay.bookingReference}</span>}
          </span>
        </button>
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/guests/${guest.id}`} className="font-medium underline-offset-4 hover:underline">
              {fullName(guest) || guest.email || `Guest #${guest.id}`}
            </Link>
            <StageChip stage={guest.lifecycleStage} />
          </div>
          {guest.email && (
            <a href={`mailto:${guest.email}`} className="w-fit text-sm text-muted-foreground hover:underline">
              {guest.email}
            </a>
          )}
          {guest.phone && (
            <a href={phoneHref(guest.phone)} className="w-fit text-sm text-muted-foreground tabular-nums hover:underline">
              {guest.phone}
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// What the guest said about named employees. Management and admin only.
function MentionsCard({ feedback, canEdit }: { feedback: Feedback; canEdit: boolean }) {
  const [adding, setAdding] = useState(false)
  const mentions = feedback.mentions!
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersIcon className="size-4 text-muted-foreground" /> Employee mentions
        </CardTitle>
        {canEdit && (
          <CardAction>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setAdding(true)}>
              <PlusIcon /> Add mention
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {mentions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {canEdit ? 'No one mentioned yet. Add each employee the guest names, with their words.' : 'No one mentioned.'}
          </p>
        ) : (
          <ul className="grid">
            {mentions.map((m) => (
              <MentionLine key={m.id} feedback={feedback} mention={m} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </CardContent>
      <MentionDialog feedback={feedback} open={adding} onOpenChange={setAdding} />
    </Card>
  )
}

function MentionLine({ feedback, mention, canEdit }: { feedback: Feedback; mention: Mention; canEdit: boolean }) {
  const { removeMention } = useFeedbackMutations()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const e = mention.employee
  return (
    <li className="grid gap-1 border-b py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          {e ? (
            <>
              <Link to={`/feedback/employees/${e.id}`} className="font-medium underline-offset-4 hover:underline">
                {employeeName(e)}
              </Link>
              <span className="text-sm text-muted-foreground">
                {[e.jobTitle ?? DEPARTMENT_LABELS[e.department], e.hotel ?? 'Group-wide'].join(' · ')}
                {!e.isActive && ' · left'}
              </span>
            </>
          ) : (
            <>
              <span className="font-medium">"{mention.nameAsWritten}"</span>
              <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
                Not linked
              </Badge>
            </>
          )}
          <SentimentChip sentiment={mention.sentiment} />
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            {!e && (
              <Button variant="outline" size="sm" className="h-7" onClick={() => setEditing(true)}>
                <LinkIcon /> Link to employee
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" aria-label="Mention actions">
                  <EllipsisIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {e && mention.nameAsWritten && <p className="text-xs text-muted-foreground">The guest wrote "{mention.nameAsWritten}"</p>}
      {mention.comment && <p className="text-sm whitespace-pre-wrap wrap-break-word">"{mention.comment}"</p>}
      <MentionDialog feedback={feedback} mention={mention} open={editing} onOpenChange={setEditing} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this mention?"
        description="It no longer counts on the employee's page. The guest's review is kept."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await removeMention.mutateAsync({ id: mention.id, feedbackId: feedback.id })
          toast.success('Mention deleted')
        }}
      />
    </li>
  )
}

// The follow-up: status and outcome, logged conversations and notes on the stay.
function FollowUpCard({ feedback, canEdit }: { feedback: Feedback; canEdit: boolean }) {
  const { data, isPending, isError } = useFeedbackTimeline(feedback.id)
  const { addNote, clearFollowUp } = useFeedbackMutations()
  const [body, setBody] = useState('')
  const low = feedback.rating !== null && feedback.rating <= LOW_RATING

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    try {
      await addNote.mutateAsync({ id: feedback.id, body: body.trim() })
      setBody('')
      toast.success('Note added to the stay')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function undo() {
    try {
      await clearFollowUp.mutateAsync(feedback.id)
      toast.success(low ? 'Back on Needs follow-up' : 'Follow-up cleared')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Follow-up</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {feedback.followUp ? (
          <div className="grid gap-1 rounded-md border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/40">
            <p className="flex flex-wrap items-center gap-x-2 font-medium text-emerald-800 dark:text-emerald-300">
              <CircleCheckIcon className="size-4" /> Followed up by {feedback.followUp.by ?? 'System'},{' '}
              {formatDateTime(feedback.followUp.at)}
              {canEdit && (
                <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-muted-foreground" onClick={undo} disabled={clearFollowUp.isPending}>
                  Undo
                </Button>
              )}
            </p>
            <p className="whitespace-pre-wrap">{feedback.followUp.outcome}</p>
          </div>
        ) : feedback.needsFollowUp ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
            A rating of {feedback.rating} needs a manager to call or message the guest. Log the conversation, then mark it
            followed up with the outcome.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No follow-up needed for this rating, though you can still log one.</p>
        )}

        {canEdit && (
          <form onSubmit={submit} className="grid gap-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Internal note on the stay, e.g. Maintenance to check the AC in room 4"
              maxLength={5000}
              className="min-h-16"
              aria-label="New note"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
              }}
            />
            <Button type="submit" size="sm" className="ml-auto" disabled={!body.trim() || addNote.isPending}>
              {addNote.isPending ? 'Saving…' : 'Add note'}
            </Button>
          </form>
        )}
        {isPending ? (
          <Skeleton className="h-24" />
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load the follow-up.</p>
        ) : (
          <Timeline items={data} empty="No calls, messages or notes yet." />
        )}
      </CardContent>
    </Card>
  )
}

// Mark followed up: the outcome is required. Marking again replaces it.
function FollowUpDialog({ feedback, open, onOpenChange }: { feedback: Feedback; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{feedback.followUp ? 'Edit the outcome' : 'Mark followed up'}</DialogTitle>
          <DialogDescription>A line or two on how it ended. It leaves the Needs follow-up list.</DialogDescription>
        </DialogHeader>
        {open && <FollowUpForm feedback={feedback} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function FollowUpForm({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  const { followUp } = useFeedbackMutations()
  const [outcome, setOutcome] = useState(feedback.followUp?.outcome ?? '')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!outcome.trim()) return setError('Write the outcome')
    try {
      await followUp.mutateAsync({ id: feedback.id, outcome: outcome.trim() })
      toast.success('Marked followed up')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormError message={error} />
      <Field label="Outcome" htmlFor="follow-up-outcome">
        <Textarea
          id="follow-up-outcome"
          autoFocus
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          placeholder="e.g. Called and apologised; offered a room upgrade on the next stay"
          maxLength={2000}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={followUp.isPending}>
          {followUp.isPending ? 'Saving…' : 'Mark followed up'}
        </Button>
      </DialogFooter>
    </form>
  )
}
