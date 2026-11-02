import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { BedDoubleIcon, LinkIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useFilterParams } from '@/hooks/use-filter-params'
import { LEAD_MORE_FILTERS, useLeadBoard, useLeadMutations } from '@/hooks/use-leads'
import { useMe } from '@/hooks/use-me'
import { errorMessage } from '@/lib/api'
import { pickParams } from '@/lib/filters'
import { formatCount, formatDate, fullName } from '@/lib/format'
import { canMoveLead, LEAD_STATUS_LABELS, LEAD_STATUSES, needsDetails, requestedDates, type LeadStatus } from '@/lib/leads'
import { can } from '@/lib/permissions'
import { didNotHappen, STAY_STATUS_LABELS } from '@/lib/stays'
import type { LeadCard } from '@/lib/types'
import { cn } from '@/lib/utils'
import { FollowUpDate, SourceIcon } from './lead-badges'
import { LeadFilterBar } from './lead-filter-bar'
import { LeadStatusDialog } from './lead-status-dialog'

const COLUMN_ACCENTS: Record<LeadStatus, string> = {
  new: 'bg-sky-500',
  contacted: 'bg-indigo-500',
  quoted: 'bg-amber-500',
  booked: 'bg-violet-500',
  lost: 'bg-red-500',
}

// Leads → Board: five columns. Drag a card to move the lead; moves that need
// something (a lost reason, a quote, the stay) ask for it first.
export function LeadsBoardPage() {
  const { data: me } = useMe()
  const canEdit = can(me?.permissions, 'leads', 'edit')
  const { params, update } = useFilterParams()
  const filter = {
    q: params.get('q') ?? undefined,
    owner: params.get('owner') ?? undefined,
    propertyId: params.get('hotel') ?? undefined,
    source: params.get('source') ?? undefined,
    ...pickParams(params, LEAD_MORE_FILTERS),
  }
  const { data, isPending, isError, isPlaceholderData } = useLeadBoard(filter)
  const { changeStatus } = useLeadMutations()
  const [dragging, setDragging] = useState<LeadCard | null>(null)
  const [asking, setAsking] = useState<{ lead: LeadCard; to: LeadStatus } | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  function onDragStart(e: DragStartEvent) {
    setDragging((e.active.data.current as { lead: LeadCard }).lead)
  }

  async function onDragEnd(e: DragEndEvent) {
    setDragging(null)
    const lead = (e.active.data.current as { lead: LeadCard }).lead
    const to = e.over?.id as LeadStatus | undefined
    if (!to || to === lead.status) return
    if (!canMoveLead(lead.status, to)) {
      toast.error('A lost lead is reopened to new, contacted or quoted first')
      return
    }
    if (needsDetails(lead, to)) return setAsking({ lead, to })
    try {
      await changeStatus.mutateAsync({ id: lead.id, status: to })
      toast.success(`${fullName(lead) || 'Lead'} moved to ${LEAD_STATUS_LABELS[to].toLowerCase()}`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <LeadFilterBar params={params} update={update} />
      {isPending ? (
        <div className="grid grid-cols-5 gap-3">
          {LEAD_STATUSES.map((s) => (
            <Skeleton key={s} className="h-64" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Couldn't load the board.</p>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className={cn('relative -mx-4 overflow-x-auto px-4 pb-2 transition-opacity md:mx-0 md:px-0', isPlaceholderData && 'opacity-60')}>
            <div className="grid min-w-[72rem] grid-cols-5 gap-3">
              {LEAD_STATUSES.map((status) => (
                <Column
                  key={status}
                  status={status}
                  leads={data.columns[status]}
                  today={data.today}
                  canEdit={canEdit}
                  dropAllowed={!dragging || canMoveLead(dragging.status, status) || dragging.status === status}
                  closedDays={status === 'booked' || status === 'lost' ? data.closedDays : null}
                />
              ))}
            </div>
          </div>
          <DragOverlay>{dragging && <CardBody lead={dragging} today={data.today} lifted />}</DragOverlay>
        </DndContext>
      )}
      {asking && <LeadStatusDialog lead={asking.lead} to={asking.to} onClose={() => setAsking(null)} />}
    </div>
  )
}

function Column({
  status,
  leads,
  today,
  canEdit,
  dropAllowed,
  closedDays,
}: {
  status: LeadStatus
  leads: LeadCard[]
  today: string
  canEdit: boolean
  dropAllowed: boolean
  closedDays: number | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !canEdit || !dropAllowed })
  return (
    <section
      ref={setNodeRef}
      aria-label={LEAD_STATUS_LABELS[status]}
      className={cn(
        'flex min-h-64 flex-col gap-2 rounded-lg border bg-muted/40 p-2 transition-colors',
        isOver && 'border-primary bg-primary/5',
        !dropAllowed && 'opacity-50',
      )}
    >
      <header className="flex items-center gap-2 px-1 pt-1">
        <span className={cn('size-2 rounded-full', COLUMN_ACCENTS[status])} aria-hidden />
        <h2 className="text-sm font-semibold">{LEAD_STATUS_LABELS[status]}</h2>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{formatCount(leads.length)}</span>
      </header>
      {closedDays && <p className="px-1 text-xs text-muted-foreground">Last {closedDays} days</p>}
      <ul className="grid gap-2">
        {leads.map((lead) => (
          <DraggableCard key={lead.id} lead={lead} today={today} canEdit={canEdit} />
        ))}
      </ul>
      {leads.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">No leads</p>}
    </section>
  )
}

function DraggableCard({ lead, today, canEdit }: { lead: LeadCard; today: string; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, data: { lead }, disabled: !canEdit })
  return (
    <li ref={setNodeRef} {...attributes} {...listeners} className={cn('touch-manipulation', isDragging && 'opacity-30')}>
      <CardBody lead={lead} today={today} />
    </li>
  )
}

// The person, hotel, dates, owner, follow-up date (red when overdue) and source.
function CardBody({ lead, today, lifted }: { lead: LeadCard; today: string; lifted?: boolean }) {
  const name = fullName(lead) || `Lead #${lead.id}`
  const dates = requestedDates(lead.checkIn, lead.checkOut)
  return (
    <div className={cn('grid gap-1.5 rounded-md border bg-card p-3 text-sm shadow-xs', lifted && 'rotate-1 shadow-lg')}>
      <div className="flex items-start gap-2">
        <Link
          to={`/leads/${lead.id}`}
          className="min-w-0 flex-1 truncate font-medium hover:underline"
          // a click opens the lead; a drag (6px or more) moves it
          draggable={false}
        >
          {name}
        </Link>
        <SourceIcon source={lead.source} className="mt-0.5" />
      </div>
      {(lead.hotel || dates) && (
        <p className="text-xs text-muted-foreground">
          {[lead.hotel ?? 'Hotel not decided', dates].filter(Boolean).join(' · ')}
        </p>
      )}
      {lead.status === 'booked' && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {lead.stay ? (
            <>
              <BedDoubleIcon className="size-3.5" />
              <span className={cn(lead.stay.status && didNotHappen(lead.stay.status) && 'line-through')}>
                {lead.stay.hotel}, {formatDate(lead.stay.arrivalDate)}
              </span>
              {lead.stay.status && didNotHappen(lead.stay.status) && (
                <span className="font-medium text-destructive">{STAY_STATUS_LABELS[lead.stay.status].toLowerCase()}</span>
              )}
            </>
          ) : (
            <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
              <LinkIcon className="size-3.5" /> Stay to link
            </span>
          )}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
        <span className="truncate text-muted-foreground">{lead.owner?.name ?? 'No owner'}</span>
        <FollowUpDate status={lead.status} followUpOn={lead.followUpOn} today={today} />
      </div>
    </div>
  )
}
