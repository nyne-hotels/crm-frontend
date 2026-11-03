import { CheckIcon, CopyIcon, ExternalLinkIcon, PencilIcon, PlusIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
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

  async function save(input: { name?: string; ownerId?: number; isActive?: boolean }, message: string) {
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
              {!campaign.isActive && <span className="text-xs">(closed)</span>}
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
          <div className="mt-1 flex min-w-0 items-center gap-1">
            <a
              href={campaign.link}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {campaign.link}
            </a>
            <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={copyLink} aria-label="Copy the form's link">
              <CopyIcon className="size-3.5" />
            </Button>
            <Button asChild size="icon" variant="ghost" className="size-7 shrink-0">
              <a href={campaign.link} target="_blank" rel="noreferrer" aria-label="Open the form">
                <ExternalLinkIcon className="size-3.5" />
              </a>
            </Button>
          </div>
        </div>
        {canEdit && (
          <label className="flex items-center gap-2 pt-1 text-sm">
            <span className="hidden sm:inline">Open</span>
            <Switch
              checked={campaign.isActive}
              onCheckedChange={(isActive) =>
                save({ isActive }, isActive ? `${campaign.name} is open again` : `${campaign.name} closed; its form says it has ended`)
              }
              aria-label={`${campaign.name} open`}
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
  const owner = ownerId || (owners.some((o) => o.id === me?.id && o.isActive) ? String(me!.id) : '')

  async function add(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (!owner) return toast.error("Choose who gets the campaign's leads")
    try {
      await create.mutateAsync({ name, ownerId: Number(owner) })
      setNewName('')
      toast.success(`${name} added. Copy its link into the campaign email.`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <p className="text-sm text-muted-foreground">
        Put a campaign's link on the button in its email. Each form sent becomes a lead on the Leads board for the
        campaign's owner, due for follow-up that day, and guests who tick the box are opted in to marketing emails.
        Closing a campaign stops its form; renaming it keeps the same link.
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

      {isPending || isError ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{isError ? "Couldn't load campaigns." : 'Loading…'}</p>
      ) : campaigns.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No campaigns yet.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-md border">
          {campaigns.map((c) => (
            <CampaignRow key={c.id} campaign={c} owners={owners} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </div>
  )
}
