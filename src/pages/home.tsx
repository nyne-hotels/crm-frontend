import { AlarmClockIcon, MessageSquareWarningIcon, SearchIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Input } from '@/components/ui/input'
import { useFeedbackList } from '@/hooks/use-feedback'
import { useFollowUps } from '@/hooks/use-leads'
import { useMe } from '@/hooks/use-me'
import { queryString } from '@/lib/api'
import { plural } from '@/lib/format'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'

// A welcome with a contact search, for salespeople the morning's follow-ups,
// and for managers the low ratings waiting for a call.
export function HomePage() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const worksLeads = can(me?.permissions, 'leads', 'edit')
  const followsUpFeedback = can(me?.permissions, 'feedback', 'edit')

  return (
    <div className="mx-auto max-w-3xl py-8">
      <h1 className="font-heading text-2xl font-semibold">Welcome, {me?.firstName}</h1>
      <p className="mt-2 text-muted-foreground">This is the Nyne Hotels CRM.</p>
      <form
        className="relative mt-6"
        onSubmit={(e) => {
          e.preventDefault()
          navigate(`/guests${queryString({ q: search.trim() })}`)
        }}
      >
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Find a contact by name, email or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
          aria-label="Find a contact"
        />
      </form>
      {worksLeads && <FollowUpsToday />}
      {followsUpFeedback && <FeedbackToFollowUp />}
    </div>
  )
}

function FollowUpsToday() {
  const { data } = useFollowUps()
  if (!data) return null
  const overdue = data.rows.filter((l) => l.followUpOn && l.followUpOn < data.today).length
  return (
    <Link
      to="/leads/follow-ups"
      className="mt-6 flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <AlarmClockIcon className={cn('size-5', overdue ? 'text-destructive' : 'text-muted-foreground')} />
      <span className="grid gap-0.5">
        <span className="font-medium">
          {data.rows.length ? `${plural(data.rows.length, 'follow-up')} due` : 'No follow-ups due today'}
        </span>
        <span className="text-sm text-muted-foreground">
          {overdue ? <span className="text-destructive">{plural(overdue, 'lead')} overdue. </span> : null}
          My follow-ups: your leads due today or overdue.
        </span>
      </span>
    </Link>
  )
}

// Responses rated 1 or 2 that nobody has followed up yet.
function FeedbackToFollowUp() {
  const { data } = useFeedbackList({ tab: 'needs_follow_up', pageSize: 1 })
  if (!data) return null
  const waiting = data.counts.needs_follow_up
  return (
    <Link
      to="/feedback?tab=needs_follow_up"
      className="mt-3 flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <MessageSquareWarningIcon className={cn('size-5', waiting ? 'text-destructive' : 'text-muted-foreground')} />
      <span className="grid gap-0.5">
        <span className="font-medium">
          {waiting ? `${plural(waiting, 'low rating')} to follow up` : 'No low ratings waiting'}
        </span>
        <span className="text-sm text-muted-foreground">Feedback rated 1 or 2 stars, until someone marks it followed up.</span>
      </span>
    </Link>
  )
}
