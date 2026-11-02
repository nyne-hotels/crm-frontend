import { ArrowRightIcon, BedDoubleIcon, EllipsisIcon, NotebookPenIcon, SparklesIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { useNoteMutations } from '@/hooks/use-knowledge'
import { useInteractionMutations } from '@/hooks/use-leads'
import { useMe } from '@/hooks/use-me'
import { errorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { mayChangeNote, stayChipLabel } from '@/lib/knowledge'
import { DIRECTION_LABELS, INTERACTION_ICONS, INTERACTION_KIND_LABELS, LEAD_STATUS_LABELS, LOST_REASON_LABELS } from '@/lib/leads'
import type { InteractionItem, NoteItem, StatusItem, TimelineItem } from '@/lib/types'
import { cn } from '@/lib/utils'

// One list of everything on a lead or a company, newest first: logged
// conversations, notes and (on a lead) status changes. `showPerson` names
// who the conversation was with (on a company, where it may be one of its people).
export function Timeline({
  items,
  showPerson,
  showLead,
  empty,
}: {
  items: TimelineItem[]
  showPerson?: boolean
  showLead?: boolean
  empty: string
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ol className="relative grid gap-4 border-l pl-5">
      {items.map((item) => (
        <li key={`${item.type}-${item.id}`} className="relative">
          {item.type === 'interaction' ? (
            <InteractionEntry item={item} showPerson={showPerson} showLead={showLead} />
          ) : item.type === 'note' ? (
            <NoteEntry item={item} />
          ) : (
            <StatusEntry item={item} />
          )}
        </li>
      ))}
    </ol>
  )
}

function Dot({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'absolute top-0 -left-[1.95rem] flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground [&_svg]:size-3.5',
        className,
      )}
      aria-hidden
    >
      {children}
    </span>
  )
}

function Meta({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">{children}</div>
}

function InteractionEntry({ item, showPerson, showLead }: { item: InteractionItem; showPerson?: boolean; showLead?: boolean }) {
  const { data: me } = useMe()
  const { update, remove } = useInteractionMutations()
  const [editing, setEditing] = useState(false)
  const [summary, setSummary] = useState(item.summary ?? '')
  const [deleting, setDeleting] = useState(false)
  const Icon = INTERACTION_ICONS[item.kind]
  const canChange = mayChangeNote(item, me)
  // "logged by" only when someone else logged it
  const loggedBySomeoneElse = item.logged.by && item.logged.by !== item.staffName

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim()) return
    try {
      await update.mutateAsync({ id: item.id, summary: summary.trim() })
      setEditing(false)
      toast.success('Saved')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="grid gap-1">
      <Dot>
        <Icon />
      </Dot>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">{INTERACTION_KIND_LABELS[item.kind]}</span>
          {item.direction && <span className="text-muted-foreground"> · {DIRECTION_LABELS[item.direction]}</span>}
          {showPerson && item.person && (
            <>
              {' '}
              with{' '}
              <Link to={`/guests/${item.contactId}`} className="underline-offset-4 hover:underline">
                {item.person}
              </Link>
            </>
          )}
          {showPerson && !item.person && item.company && <span className="text-muted-foreground"> with {item.company}</span>}
        </p>
        {canChange && !editing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mt-1 size-7 shrink-0" aria-label="Conversation actions">
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>Edit summary</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} className="grid gap-2">
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} autoFocus aria-label="Summary" />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!summary.trim() || update.isPending}>
              Save
            </Button>
          </div>
        </form>
      ) : (
        item.summary && <p className="text-sm whitespace-pre-wrap wrap-break-word">{item.summary}</p>
      )}
      <Meta>
        {item.staffName && <span className="font-medium text-foreground/80">{item.staffName}</span>}
        <span className="tabular-nums">{formatDateTime(item.at)}</span>
        {loggedBySomeoneElse && <span>· logged by {item.logged.by}</span>}
        {showLead && item.leadId && (
          <Link to={`/leads/${item.leadId}`} className="underline-offset-4 hover:underline">
            · Lead #{item.leadId}
          </Link>
        )}
        {showLead && item.feedbackId && (
          <Link to={`/feedback/${item.feedbackId}`} className="underline-offset-4 hover:underline">
            · Feedback follow-up
          </Link>
        )}
      </Meta>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this conversation?"
        description="It will be hidden from the timeline, but kept on record."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(item.id)
          toast.success('Deleted')
        }}
      />
    </div>
  )
}

function NoteEntry({ item }: { item: NoteItem }) {
  const { data: me } = useMe()
  const { update, remove } = useNoteMutations()
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(item.body)
  const [deleting, setDeleting] = useState(false)
  const canChange = mayChangeNote(item, me)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    try {
      await update.mutateAsync({ id: item.id, body: body.trim() })
      setEditing(false)
      toast.success('Note saved')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="grid gap-1">
      <Dot>
        <NotebookPenIcon />
      </Dot>
      {editing ? (
        <form onSubmit={save} className="grid gap-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} autoFocus aria-label="Note" />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!body.trim() || update.isPending}>
              Save
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap wrap-break-word">{item.body}</p>
          {canChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="-mt-1 size-7 shrink-0" aria-label="Note actions">
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
          )}
        </div>
      )}
      <Meta>
        <Badge variant="outline" className="font-normal">
          Note
        </Badge>
        <span className="font-medium text-foreground/80">{item.created.by ?? 'System'}</span>
        <span className="tabular-nums">{formatDateTime(item.at)}</span>
        {item.editedAt && <span title={`Edited ${formatDateTime(item.editedAt)}`}>· edited</span>}
      </Meta>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this note?"
        description="It will be hidden, but kept on record."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(item.id)
          toast.success('Note deleted')
        }}
      />
    </div>
  )
}

function StatusEntry({ item }: { item: StatusItem }) {
  const stay = item.stay && (
    <Badge variant="outline" className="font-normal">
      <BedDoubleIcon /> {stayChipLabel(item.stay)}
    </Badge>
  )
  let text: React.ReactNode
  if (item.from === null) text = 'Lead created'
  else if (item.from === 'booked' && item.to === 'booked') text = 'Stay linked'
  else if (item.automatic) text = 'Booked automatically when the booking arrived'
  else if (item.to === 'lost') text = <>Marked lost{item.lostReason && `: ${LOST_REASON_LABELS[item.lostReason]}`}</>
  else if (item.from === 'lost') text = <>Reopened as {LEAD_STATUS_LABELS[item.to].toLowerCase()}</>
  else
    text = (
      <span className="inline-flex flex-wrap items-center gap-1">
        {LEAD_STATUS_LABELS[item.from]} <ArrowRightIcon className="size-3.5" aria-label="to" /> {LEAD_STATUS_LABELS[item.to]}
      </span>
    )
  return (
    <div className="grid gap-1">
      <Dot className={item.automatic ? 'text-violet-600 dark:text-violet-400' : undefined}>
        {item.automatic ? <SparklesIcon /> : <ArrowRightIcon />}
      </Dot>
      <p className="text-sm text-muted-foreground">
        <span className="text-foreground">{text}</span>
        {item.to === 'booked' && !item.stay && item.from !== null && ' – stay to link'}
      </p>
      <Meta>
        <span className="font-medium text-foreground/80">{item.by ?? 'System'}</span>
        <span className="tabular-nums">{formatDateTime(item.at)}</span>
        {stay}
      </Meta>
    </div>
  )
}
