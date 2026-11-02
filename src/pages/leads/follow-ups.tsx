import { AlarmClockOffIcon, CircleCheckIcon, PhoneIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useFollowUps, useLeadMutations } from '@/hooks/use-leads'
import { errorMessage } from '@/lib/api'
import { fullName } from '@/lib/format'
import { requestedDates } from '@/lib/leads'
import type { LeadCard } from '@/lib/types'
import { FollowUpDate, LeadStatusChip, SourceIcon } from './lead-badges'
import { LogInteractionDialog } from './log-interaction-dialog'

// Leads → My follow-ups: your open leads due today or overdue, oldest first,
// each with one-click Log call and Snooze to tomorrow.
export function FollowUpsPage() {
  const { data, isPending, isError } = useFollowUps()
  const [calling, setCalling] = useState<LeadCard | null>(null)

  if (isPending) return <Skeleton className="h-48" />
  if (isError) return <p className="text-sm text-destructive">Couldn't load your follow-ups.</p>
  if (data.rows.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <CircleCheckIcon className="size-8 text-emerald-600" />
        <p className="font-medium">Nothing due today</p>
        <p className="text-sm text-muted-foreground">Leads you own show here on the day their follow-up is due.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Your open leads due today or overdue, oldest first.</p>
      <ul className="grid gap-2">
        {data.rows.map((lead) => (
          <FollowUpRow key={lead.id} lead={lead} today={data.today} onCall={() => setCalling(lead)} />
        ))}
      </ul>
      {calling && (
        <LogInteractionDialog
          open
          onOpenChange={(open) => !open && setCalling(null)}
          kind="call"
          target={{ leadId: calling.id, openLead: { followUpOn: calling.followUpOn } }}
          title={`Log call with ${fullName(calling) || `lead #${calling.id}`}`}
        />
      )}
    </div>
  )
}

function FollowUpRow({ lead, today, onCall }: { lead: LeadCard; today: string; onCall: () => void }) {
  const { snooze } = useLeadMutations()
  const details = [lead.hotel, requestedDates(lead.checkIn, lead.checkOut)].filter(Boolean).join(' · ')

  async function snoozeIt() {
    try {
      await snooze.mutateAsync(lead.id)
      toast.success(`${fullName(lead) || 'Lead'} snoozed to tomorrow`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/leads/${lead.id}`} className="truncate font-medium hover:underline">
            {fullName(lead) || `Lead #${lead.id}`}
          </Link>
          <LeadStatusChip status={lead.status} />
          <SourceIcon source={lead.source} />
        </div>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <FollowUpDate status={lead.status} followUpOn={lead.followUpOn} today={today} />
          {details && <span>{details}</span>}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onCall}>
          <PhoneIcon /> Log call
        </Button>
        <Button size="sm" variant="outline" onClick={snoozeIt} disabled={snooze.isPending}>
          <AlarmClockOffIcon /> Snooze to tomorrow
        </Button>
      </div>
    </li>
  )
}
