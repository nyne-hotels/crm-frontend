import { MessagesSquareIcon, PlusIcon, TargetIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGuestInteractions, useGuestLeads } from '@/hooks/use-leads'
import { formatDate } from '@/lib/format'
import { LOST_REASON_LABELS, requestedDates } from '@/lib/leads'
import type { LeadCard } from '@/lib/types'
import type { PickedGuest } from '../stays/guest-picker'
import { FollowUpDate, LeadStatusChip, SourceIcon } from './lead-badges'
import { LogInteractionDialog } from './log-interaction-dialog'
import { NewLeadDialog } from './new-lead-dialog'
import { Timeline } from './timeline'

const SHOWN = 5

// The Leads panel on the guest profile: their leads newest first with status
// chips, then their logged conversations.
export function GuestLeadsPanel({ guest, canEdit }: { guest: PickedGuest; canEdit: boolean }) {
  const { data, isPending, isError } = useGuestLeads(guest.id)
  const { data: talks } = useGuestInteractions(guest.id)
  const [adding, setAdding] = useState(false)
  const [logging, setLogging] = useState(false)
  const [allTalks, setAllTalks] = useState(false)

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TargetIcon className="size-4 text-muted-foreground" /> Leads
        </CardTitle>
        {canEdit && (
          <CardAction className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setLogging(true)}>
              <MessagesSquareIcon /> Log conversation
            </Button>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setAdding(true)}>
              <PlusIcon /> New lead
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-5">
        {isPending ? (
          <Skeleton className="h-16" />
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load leads.</p>
        ) : data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No enquiries on record.</p>
        ) : (
          <ul className="grid">
            {data.rows.map((lead) => (
              <LeadLine key={lead.id} lead={lead} today={data.today} />
            ))}
          </ul>
        )}

        {talks && talks.length > 0 && (
          <section className="grid gap-3">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Conversations</h3>
            <Timeline items={allTalks ? talks : talks.slice(0, SHOWN)} showLead empty="" />
            {talks.length > SHOWN && (
              <Button variant="ghost" size="sm" className="w-fit" onClick={() => setAllTalks((v) => !v)}>
                {allTalks ? 'Show fewer' : `Show all ${talks.length}`}
              </Button>
            )}
          </section>
        )}
      </CardContent>

      <NewLeadDialog open={adding} onOpenChange={setAdding} person={guest} />
      <LogInteractionDialog open={logging} onOpenChange={setLogging} target={{ contactId: guest.id }} />
    </Card>
  )
}

function LeadLine({ lead, today }: { lead: LeadCard; today: string }) {
  const details = [lead.hotel ?? 'Hotel not decided', requestedDates(lead.checkIn, lead.checkOut)].filter(Boolean).join(' · ')
  return (
    <li className="border-b last:border-0">
      <Link
        to={`/leads/${lead.id}`}
        className="flex items-center gap-3 rounded-sm py-2 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <SourceIcon source={lead.source} />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate text-sm font-medium">{details}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>Enquired {formatDate(lead.createdAt)}</span>
            {lead.owner && <span>· {lead.owner.name}</span>}
            {lead.status === 'lost' && lead.lostReason && <span>· {LOST_REASON_LABELS[lead.lostReason]}</span>}
            {lead.status === 'booked' && !lead.stay && <span className="font-medium text-amber-700 dark:text-amber-400">· Stay to link</span>}
            <FollowUpDate status={lead.status} followUpOn={lead.followUpOn} today={today} />
          </span>
        </span>
        <LeadStatusChip status={lead.status} className="shrink-0" />
      </Link>
    </li>
  )
}
