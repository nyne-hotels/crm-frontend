import { ChevronRightIcon, PlusIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCampaignMutations, useCampaigns, useEmailSummaries } from '@/hooks/use-campaigns'
import { useLeadOwners } from '@/hooks/use-leads'
import { useMe } from '@/hooks/use-me'
import { errorMessage } from '@/lib/api'
import { formatCount, formatDate, plural } from '@/lib/format'
import { can } from '@/lib/permissions'
import type { Campaign, EmailSummary } from '@/lib/types'
import { cn } from '@/lib/utils'
import { OwnerSelect } from './campaign-setup'
import { MailchimpProblem } from './mailchimp-problem'

const SHOW_TABS = ['active', 'archived'] as const
type Show = (typeof SHOW_TABS)[number]
const SHOW_LABELS: Record<Show, string> = { active: 'Active', archived: 'Archived' }

const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 })

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid text-right">
      <span className="font-medium tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

// One campaign: its Mailchimp email's headline figures (opens without Apple
// Mail's automatic ones) and its form leads. Opens the campaign's page.
function CampaignRow({ campaign, email, loadingEmail }: { campaign: Campaign; email: EmailSummary | undefined; loadingEmail: boolean }) {
  return (
    <li>
      <Link
        to={`/campaigns/${campaign.id}`}
        className={cn(
          'flex flex-wrap items-center gap-x-6 gap-y-2 bg-background px-4 py-3 transition-colors hover:bg-muted/50',
          !campaign.isActive && 'text-muted-foreground',
        )}
      >
        <div className="min-w-0 flex-1 basis-60">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{campaign.name}</span>
            {!campaign.isActive && <span className="shrink-0 text-xs">(archived)</span>}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {!campaign.mailchimpCampaignId
              ? 'No Mailchimp email linked'
              : email
                ? `${email.subject ?? email.title ?? 'Mailchimp email'} · sent ${formatDate(email.sentAt)}`
                : loadingEmail
                  ? 'Loading from Mailchimp…'
                  : 'Mailchimp email linked'}
          </p>
        </div>
        <div className="flex items-center gap-6">
          {email && (
            <>
              <Figure label="sent" value={formatCount(email.sent)} />
              <Figure label="opened" value={percent.format(email.openRate)} />
              <Figure label="clicked" value={percent.format(email.clickRate)} />
            </>
          )}
          <Figure label={campaign.leads === 1 ? 'form lead' : 'form leads'} value={formatCount(campaign.leads)} />
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </div>
      </Link>
    </li>
  )
}

// Campaigns (/campaigns): each campaign is a Mailchimp email and its enquiry
// form. A campaign's page shows how the email did and the form's leads.
export function CampaignsPage() {
  const { data: me } = useMe()
  const canEdit = can(me?.permissions, 'campaigns', 'edit')
  const navigate = useNavigate()
  const { data: campaigns, isPending, isError } = useCampaigns()
  const anyLinked = !!campaigns?.some((c) => c.mailchimpCampaignId)
  const summaries = useEmailSummaries(anyLinked)
  const emails = new Map((summaries.data ?? []).map((e) => [e.id, e]))
  const { data: owners = [] } = useLeadOwners()
  const { create } = useCampaignMutations()
  const [newName, setNewName] = useState('')
  // the signed-in person when they can own leads, otherwise chosen
  const [ownerId, setOwnerId] = useState<string>('')
  // Active or Archived (closed) campaigns, kept in the URL so a refresh stays on the tab
  const [params, setParams] = useSearchParams()
  const show: Show = params.get('show') === 'archived' ? 'archived' : 'active'
  const counts = {
    active: campaigns?.filter((c) => c.isActive).length,
    archived: campaigns?.filter((c) => !c.isActive).length,
  }
  // newest Mailchimp email first; campaigns without one after, newest first
  const sentAt = (c: Campaign) => (c.mailchimpCampaignId && emails.get(c.mailchimpCampaignId)?.sentAt) || ''
  const shown = (campaigns?.filter((c) => c.isActive === (show === 'active')) ?? []).sort(
    (a, b) => sentAt(b).localeCompare(sentAt(a)) || b.createdAt.localeCompare(a.createdAt),
  )
  const owner = ownerId || (owners.some((o) => o.id === me?.id && o.isActive) ? String(me!.id) : '')

  async function add(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (!owner) return toast.error("Choose who gets the campaign's leads")
    try {
      const created = await create.mutateAsync({ name, ownerId: Number(owner) })
      setNewName('')
      toast.success(`${name} added. Link its Mailchimp email to see how it does.`)
      navigate(`/campaigns/${created.id}`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  function selectTab(tab: Show) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (tab === 'active') next.delete('show')
        else next.set('show', tab)
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <h1 className="font-heading text-2xl font-semibold">Campaigns</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Each campaign is a Mailchimp email and its enquiry form. Open one to see how the email did (opens, clicks,
        links) and the leads its form brought in. Each form sent becomes a lead for the campaign's owner, due for
        follow-up that day. Switching a campaign off archives it and stops its form.
      </p>
      {canEdit && (
        <form onSubmit={add} className="flex max-w-3xl flex-wrap gap-2">
          <Input
            placeholder="New campaign, e.g. Halloween 2026"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={80}
            aria-label="New campaign"
            className="min-w-48 flex-1"
          />
          <OwnerSelect value={owner} onChange={setOwnerId} owners={owners} className="w-48" />
          <Button type="submit" disabled={!newName.trim() || create.isPending}>
            <PlusIcon /> Add
          </Button>
        </form>
      )}

      {summaries.error && <MailchimpProblem error={summaries.error} onRetry={() => summaries.refetch()} />}

      <div role="tablist" aria-label="Show" className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        {SHOW_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={show === tab}
            onClick={() => selectTab(tab)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              show === tab && 'bg-background text-foreground shadow-sm',
            )}
          >
            {SHOW_LABELS[tab]}
            {counts[tab] !== undefined && <span className="text-xs tabular-nums">{counts[tab]}</span>}
          </button>
        ))}
      </div>

      {isPending || isError ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{isError ? "Couldn't load campaigns." : 'Loading…'}</p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {campaigns.length === 0
            ? 'No campaigns yet.'
            : show === 'active'
              ? 'No active campaigns. Switch one back on from Archived, or add a new one.'
              : 'No archived campaigns. Switching a campaign off moves it here.'}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-md border" aria-label={`${SHOW_LABELS[show]} campaigns`}>
          {shown.map((c) => (
            <CampaignRow
              key={c.id}
              campaign={c}
              email={c.mailchimpCampaignId ? emails.get(c.mailchimpCampaignId) : undefined}
              loadingEmail={summaries.isPending && anyLinked}
            />
          ))}
        </ul>
      )}
      {!!shown.length && (
        <p className="text-xs text-muted-foreground">
          Open rates leave out Apple Mail’s automatic opens. {plural(shown.length, 'campaign')}.
        </p>
      )}
    </div>
  )
}
