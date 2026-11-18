import { CheckIcon, CopyIcon, ExternalLinkIcon, PencilIcon, PlusIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { LastUpdated } from '@/components/last-updated'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useCampaignMutations, useCampaigns } from '@/hooks/use-campaigns'
import { useLeadOwners } from '@/hooks/use-leads'
import { useMe } from '@/hooks/use-me'
import { errorMessage } from '@/lib/api'
import { fullName, plural } from '@/lib/format'
import { can } from '@/lib/permissions'
import type { Campaign, StaffOption } from '@/lib/types'
import { cn } from '@/lib/utils'

// Who can be given a campaign's leads: active admin and management users.
function OwnerSelect({
  value,
  onChange,
  owners,
  current,
  id,
  className,
}: {
  value: string
  onChange: (value: string) => void
  owners: StaffOption[]
  current?: Campaign['owner'] // kept in the list after they've left, so the select still shows them
  id?: string
  className?: string
}) {
  const active = owners.filter((o) => o.isActive)
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className={className} aria-label="Owner of the campaign's leads">
        <SelectValue placeholder="Owner" />
      </SelectTrigger>
      <SelectContent>
        {current && !current.isActive && (
          <SelectItem value={String(current.id)} disabled>
            {current.name} (left)
          </SelectItem>
        )}
        {active.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {fullName(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function CampaignRow({ campaign, owners, canEdit }: { campaign: Campaign; owners: StaffOption[]; canEdit: boolean }) {
  const { update } = useCampaignMutations()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(campaign.name)
  const [editingLink, setEditingLink] = useState(false)
  const [slug, setSlug] = useState(campaign.slug)
  // the campaign site's address, in front of the slug
  const linkBase = campaign.link.slice(0, campaign.link.length - campaign.slug.length)

  async function save(input: { name?: string; slug?: string; ownerId?: number; isActive?: boolean }, message: string) {
    try {
      await update.mutateAsync({ id: campaign.id, ...input })
      toast.success(message)
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  async function rename(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === campaign.name) {
      setName(campaign.name)
      setEditing(false)
      return
    }
    if (await save({ name: trimmed }, 'Campaign renamed; its link stays the same')) setEditing(false)
  }

  async function changeLink(e: FormEvent) {
    e.preventDefault()
    const trimmed = slug.trim().toLowerCase()
    if (!trimmed || trimmed === campaign.slug) {
      cancelLink()
      return
    }
    if (await save({ slug: trimmed }, 'Link changed. Use the new one in campaign emails.')) setEditingLink(false)
  }

  function cancelLink() {
    setSlug(campaign.slug)
    setEditingLink(false)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(campaign.link)
      toast.success('Link copied')
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.")
    }
  }

  const leadsLink = `/leads/list?campaignId=${campaign.id}`
  return (
    <li className={cn('grid gap-2 bg-background px-3 py-3', !campaign.isActive && 'text-muted-foreground')}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={rename} className="flex items-center gap-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={80}
                className="h-8 max-w-xs"
                aria-label="Campaign name"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setName(campaign.name)
                    setEditing(false)
                  }
                }}
              />
              <Button type="submit" size="icon" variant="ghost" aria-label="Save" disabled={update.isPending}>
                <CheckIcon />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Cancel"
                onClick={() => {
                  setName(campaign.name)
                  setEditing(false)
                }}
              >
                <XIcon />
              </Button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="font-medium">{campaign.name}</span>
              {!campaign.isActive && <span className="text-xs">(archived)</span>}
              {canEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => {
                    setName(campaign.name)
                    setEditing(true)
                  }}
                  aria-label={`Rename ${campaign.name}`}
                >
                  <PencilIcon className="size-3.5" />
                </Button>
              )}
            </div>
          )}
          {editingLink ? (
            <form onSubmit={changeLink} className="mt-1 grid gap-1">
              <div className="flex min-w-0 items-center gap-1">
                <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">{linkBase}</span>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  autoFocus
                  maxLength={60}
                  className="h-8 max-w-xs"
                  aria-label="The form's link"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') cancelLink()
                  }}
                />
                <Button type="submit" size="icon" variant="ghost" aria-label="Save" disabled={update.isPending}>
                  <CheckIcon />
                </Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Cancel" onClick={cancelLink}>
                  <XIcon />
                </Button>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <TriangleAlertIcon className="size-3.5 shrink-0" />
                Links already sent in emails stop working. Use letters, numbers and dashes.
              </p>
            </form>
          ) : (
            <div className="mt-1 flex min-w-0 items-center gap-1">
              <a
                href={campaign.link}
                target="_blank"
                rel="noreferrer"
                className="truncate text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {campaign.link}
              </a>
              {canEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  onClick={() => {
                    setSlug(campaign.slug)
                    setEditingLink(true)
                  }}
                  aria-label="Change the form's link"
                >
                  <PencilIcon className="size-3.5" />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={copyLink} aria-label="Copy the form's link">
                <CopyIcon className="size-3.5" />
              </Button>
              <Button asChild size="icon" variant="ghost" className="size-7 shrink-0">
                <a href={campaign.link} target="_blank" rel="noreferrer" aria-label="Open the form">
                  <ExternalLinkIcon className="size-3.5" />
                </a>
              </Button>
            </div>
          )}
        </div>
        {canEdit && (
          <label className="flex items-center gap-2 pt-1 text-sm">
            <span className="hidden sm:inline">Active</span>
            <Switch
              checked={campaign.isActive}
              onCheckedChange={(isActive) =>
                save(
                  { isActive },
                  isActive
                    ? `${campaign.name} is active again; it's back in Active`
                    : `${campaign.name} archived; its form says it has ended`,
                )
              }
              aria-label={`${campaign.name} active`}
            />
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Leads go to</span>
          {canEdit ? (
            <OwnerSelect
              value={String(campaign.owner.id)}
              onChange={(v) => save({ ownerId: Number(v) }, 'New leads from this campaign go to the new owner')}
              owners={owners}
              current={campaign.owner}
              className="h-8 w-44"
            />
          ) : (
            <span>{campaign.owner.name}</span>
          )}
        </div>
        {campaign.leads > 0 ? (
          <Link to={leadsLink} className="text-muted-foreground tabular-nums hover:underline">
            {plural(campaign.leads, 'lead')} · {campaign.open} open · {campaign.booked} booked
          </Link>
        ) : (
          <span className="text-muted-foreground">No leads yet</span>
        )}
      </div>
      {!campaign.owner.isActive && (
        <p className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlertIcon className="size-4 shrink-0" />
          {campaign.owner.name} has left, but still gets this campaign's new leads. Choose another owner.
        </p>
      )}
      <LastUpdated value={campaign.lastUpdated} />
    </li>
  )
}

const SHOW_TABS = ['active', 'archived'] as const
type Show = (typeof SHOW_TABS)[number]
const SHOW_LABELS: Record<Show, string> = { active: 'Active', archived: 'Archived' }

// Marketing → Campaigns: each campaign's email links to its form; every form
// sent becomes a lead for the owner, due for follow-up the day it arrives.
export function CampaignsPage() {
  const { data: me } = useMe()
  const canEdit = can(me?.permissions, 'campaigns', 'edit')
  const { data: campaigns, isPending, isError } = useCampaigns()
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
  const shown = campaigns?.filter((c) => c.isActive === (show === 'active')) ?? []
  const owner = ownerId || (owners.some((o) => o.id === me?.id && o.isActive) ? String(me!.id) : '')

  async function add(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (!owner) return toast.error("Choose who gets the campaign's leads")
    try {
      await create.mutateAsync({ name, ownerId: Number(owner) })
      setNewName('')
      if (show !== 'active') selectTab('active') // new campaigns start active
      toast.success(`${name} added. Copy its link into the campaign email.`)
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
    <div className="grid max-w-3xl gap-4">
      <p className="text-sm text-muted-foreground">
        Put a campaign's link on the button in its email. Each form sent becomes a lead on the Leads board for the
        campaign's owner, due for follow-up that day, and guests who tick the box are opted in to marketing emails.
        Switching a campaign off archives it and stops its form; renaming it keeps the same link. Changing the link breaks links already sent.
      </p>
      {canEdit && (
        <form onSubmit={add} className="flex flex-wrap gap-2">
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
        <ul className="divide-y overflow-hidden rounded-md border">
          {shown.map((c) => (
            <CampaignRow key={c.id} campaign={c} owners={owners} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </div>
  )
}
