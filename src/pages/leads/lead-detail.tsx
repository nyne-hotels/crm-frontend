import {
  ArrowLeftIcon,
  BedDoubleIcon,
  ChevronDownIcon,
  CircleXIcon,
  EllipsisIcon,
  LinkIcon,
  MailIcon,
  MessageCircleIcon,
  NotebookPenIcon,
  PencilIcon,
  PhoneIcon,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CreatedAndUpdated } from '@/components/last-updated'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useLead, useLeadMutations, useLeadTimeline } from '@/hooks/use-leads'
import { useMe } from '@/hooks/use-me'
import { useStayPanel } from '@/hooks/use-stay-panel'
import { ApiError, errorMessage } from '@/lib/api'
import { formatDate, fullName } from '@/lib/format'
import {
  canMoveLead,
  isOpen,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  LOST_REASON_LABELS,
  money,
  needsDetails,
  requestedDates,
  SOURCE_LABELS,
  type InteractionKind,
  type LeadStatus,
} from '@/lib/leads'
import { phoneHref } from '@/lib/phone'
import { can } from '@/lib/permissions'
import { nightsBetween, nightsLabel, partyLabel } from '@/lib/stays'
import type { Lead } from '@/lib/types'
import { StageChip } from '../guests/guest-badges'
import { StayStatusChip } from '../stays/stay-badges'
import { StayDetailSheet } from '../stays/stay-detail-sheet'
import { EditLeadDialog, LinkStayDialog } from './edit-lead-dialog'
import { FollowUpDate, LeadStatusChip, SourceIcon } from './lead-badges'
import { LeadStatusDialog } from './lead-status-dialog'
import { LogInteractionDialog } from './log-interaction-dialog'
import { Timeline } from './timeline'

// /leads/:id – keyed by id, so opening another lead starts afresh
export function LeadDetailPage() {
  const { id } = useParams()
  return <LeadDetail key={id} id={Number(id)} />
}

function LeadDetail({ id }: { id: number }) {
  const { data: me } = useMe()
  const { data: lead, isPending, error } = useLead(id)
  const canEdit = can(me?.permissions, 'leads', 'edit')

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
  if (error || !lead) {
    const missing = error instanceof ApiError && (error.status === 404 || error.status === 400)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-heading text-xl font-semibold">{missing ? 'Lead not found' : "Couldn't load this lead"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{missing ? 'It may have been deleted.' : 'Try again in a moment.'}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/leads">Back to leads</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <Link to="/leads" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Leads
      </Link>
      <Header lead={lead} canEdit={canEdit} />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="grid gap-6">
          <PersonCard lead={lead} />
          <RequestCard lead={lead} />
        </div>
        <TimelineCard lead={lead} canEdit={canEdit} />
      </div>
      <CreatedAndUpdated created={lead.created} lastUpdated={lead.lastUpdated} className="border-t pt-4" />
      <StayDetailSheet />
    </div>
  )
}

const LOG_BUTTONS: { kind: InteractionKind; label: string; icon: LucideIcon }[] = [
  { kind: 'call', label: 'Log call', icon: PhoneIcon },
  { kind: 'whatsapp', label: 'Log WhatsApp', icon: MessageCircleIcon },
  { kind: 'email', label: 'Log email', icon: MailIcon },
]

function Header({ lead, canEdit }: { lead: Lead; canEdit: boolean }) {
  const navigate = useNavigate()
  const { changeStatus, remove } = useLeadMutations()
  const [logging, setLogging] = useState<InteractionKind | null>(null)
  const [moving, setMoving] = useState<LeadStatus | null>(null)
  const [editing, setEditing] = useState(false)
  const [linking, setLinking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const name = fullName(lead.person) || lead.person.email || lead.person.phone || `Lead #${lead.id}`
  const moves = LEAD_STATUSES.filter((s) => canMoveLead(lead.status, s))

  async function move(to: LeadStatus) {
    if (needsDetails(lead, to)) return setMoving(to)
    try {
      await changeStatus.mutateAsync({ id: lead.id, status: to })
      toast.success(`Moved to ${LEAD_STATUS_LABELS[to].toLowerCase()}`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <header className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-2xl font-semibold wrap-break-word">{name}</h1>
        <LeadStatusChip status={lead.status} />
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <SourceIcon source={lead.source} /> {SOURCE_LABELS[lead.source]}
        </span>
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {LOG_BUTTONS.map(({ kind, label, icon: Icon }) => (
            <Button key={kind} size="sm" variant="outline" onClick={() => setLogging(kind)}>
              <Icon /> {label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => document.getElementById('lead-note')?.focus()}>
            <NotebookPenIcon /> Add note
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                {isOpen(lead.status) || lead.status === 'booked' ? 'Change status' : 'Reopen'} <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="font-normal text-muted-foreground">Move to</DropdownMenuLabel>
              {moves.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => move(s)} variant={s === 'lost' ? 'destructive' : 'default'}>
                  {LEAD_STATUS_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {lead.status !== 'lost' && (
            <Button size="sm" variant="outline" onClick={() => setLinking(true)}>
              <LinkIcon /> {lead.stay ? 'Change linked stay' : 'Link stay'}
            </Button>
          )}
          {lead.status !== 'lost' && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setMoving('lost')}>
              <CircleXIcon /> Mark lost
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-8" aria-label="More">
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <PencilIcon /> Edit lead
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setLogging('meeting')}>Log meeting, visit or DM</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                Delete lead
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
          target={{ leadId: lead.id, ...(isOpen(lead.status) ? { openLead: { followUpOn: lead.followUpOn } } : {}) }}
        />
      )}
      <LeadStatusDialog lead={lead} to={moving} onClose={() => setMoving(null)} />
      <EditLeadDialog lead={lead} open={editing} onOpenChange={setEditing} />
      <LinkStayDialog lead={lead} open={linking} onOpenChange={setLinking} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this lead?"
        description="Use this for a lead added by mistake. A lead that didn't book is marked lost instead, so it counts in the reports."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(lead.id)
          toast.success('Lead deleted')
          navigate('/leads', { replace: true })
        }}
      />
    </header>
  )
}

function PersonCard({ lead }: { lead: Lead }) {
  const p = lead.person
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Person</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/guests/${p.id}`} className="font-medium underline-offset-4 hover:underline">
            {fullName(p) || p.email || p.phone || `Contact #${p.id}`}
          </Link>
          <StageChip stage={p.lifecycleStage} />
        </div>
        {p.email && (
          <a href={`mailto:${p.email}`} className="w-fit text-sm text-muted-foreground hover:underline">
            {p.email}
          </a>
        )}
        {p.phone && (
          <a href={phoneHref(p.phone)} className="w-fit text-sm text-muted-foreground tabular-nums hover:underline">
            {p.phone}
          </a>
        )}
      </CardContent>
    </Card>
  )
}

function RequestCard({ lead }: { lead: Lead }) {
  const { open } = useStayPanel()
  const nights = lead.checkIn && lead.checkOut ? nightsBetween(lead.checkIn, lead.checkOut) : null
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Request</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <Detail label="Hotel">{lead.hotel ?? <Muted>Not decided</Muted>}</Detail>
          <Detail label="Dates">
            {requestedDates(lead.checkIn, lead.checkOut) || <Muted>Not given</Muted>}
            {nights != null && nights >= 0 && <span className="text-muted-foreground"> · {nightsLabel(nights)}</span>}
          </Detail>
          <Detail label="Guests">{partyLabel(lead.adults, lead.children) || <Muted>Not given</Muted>}</Detail>
          <Detail label="Occasion">{lead.occasion ?? <Muted>None</Muted>}</Detail>
          <Detail label="Status">
            <LeadStatusChip status={lead.status} />
            {lead.status === 'lost' && lead.lostReason && <span className="ml-2">{LOST_REASON_LABELS[lead.lostReason]}</span>}
          </Detail>
          <Detail label="Owner">{lead.owner?.name ?? <Muted>No owner</Muted>}</Detail>
          <Detail label="Follow-up">
            {isOpen(lead.status) ? <FollowUpDate status={lead.status} followUpOn={lead.followUpOn} today={lead.today} /> : <Muted>–</Muted>}
          </Detail>
          <Detail label="Quote">{lead.quotedValue != null ? money(lead.quotedValue, lead.currency) : <Muted>No quote yet</Muted>}</Detail>
          <Detail label="Linked stay">
            {lead.stay ? (
              <span className="inline-flex flex-wrap items-center gap-x-2">
                <button type="button" onClick={() => open(lead.stay!.id)} className="inline-flex items-center gap-1 text-left underline-offset-4 hover:underline">
                  <BedDoubleIcon className="size-3.5 text-muted-foreground" /> {lead.stay.hotel}, {formatDate(lead.stay.arrivalDate)}
                </button>
                {lead.stay.status && <StayStatusChip status={lead.stay.status} />}
              </span>
            ) : lead.status === 'booked' ? (
              <span className="font-medium text-amber-700 dark:text-amber-400">Stay to link</span>
            ) : (
              <Muted>None</Muted>
            )}
          </Detail>
        </dl>
      </CardContent>
    </Card>
  )
}

function TimelineCard({ lead, canEdit }: { lead: Lead; canEdit: boolean }) {
  const { data, isPending, isError } = useLeadTimeline(lead.id)
  const { addNote } = useLeadMutations()
  const [body, setBody] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    try {
      await addNote.mutateAsync({ id: lead.id, body: body.trim() })
      setBody('')
      toast.success('Note added')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Card className="gap-4 lg:col-span-2">
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {canEdit && (
          <form onSubmit={submit} className="grid gap-2">
            <Textarea
              id="lead-note"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a note, e.g. Budget around USD 400 a night"
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
          <Skeleton className="h-40" />
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load the timeline.</p>
        ) : (
          <Timeline items={data} empty="Nothing yet." />
        )}
      </CardContent>
    </Card>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

const Muted = ({ children }: { children: React.ReactNode }) => <span className="text-muted-foreground">{children}</span>
