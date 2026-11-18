import { CheckIcon, CopyIcon, ExternalLinkIcon, MailIcon, PencilIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { LastUpdated } from '@/components/last-updated'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useCampaignMutations, type CampaignChanges } from '@/hooks/use-campaigns'
import { errorMessage } from '@/lib/api'
import { formatDate, fullName } from '@/lib/format'
import type { Campaign, EmailSummary, StaffOption } from '@/lib/types'
import { LinkMailchimpDialog } from './link-mailchimp-dialog'

// Who can be given a campaign's leads: active admin and management users.
export function OwnerSelect({
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

// Saves a change to the campaign, with a toast either way.
function useSave(campaign: Campaign) {
  const { update } = useCampaignMutations()
  async function save(input: CampaignChanges, message: string) {
    try {
      await update.mutateAsync({ id: campaign.id, ...input })
      toast.success(message)
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }
  return { save, saving: update.isPending }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Link copied')
  } catch {
    toast.error("Couldn't copy. Select the link and copy it instead.")
  }
}

// The campaign's name (renamed in place) and its Active switch.
export function CampaignHeader({ campaign, canEdit }: { campaign: Campaign; canEdit: boolean }) {
  const { save, saving } = useSave(campaign)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(campaign.name)

  function cancel() {
    setName(campaign.name)
    setEditing(false)
  }

  async function rename(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === campaign.name) return cancel()
    if (await save({ name: trimmed }, 'Campaign renamed; its form link stays the same')) setEditing(false)
  }

  return (
    <header className="flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={rename} className="flex items-center gap-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={80}
              className="h-9 max-w-sm text-lg"
              aria-label="Campaign name"
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancel()
              }}
            />
            <Button type="submit" size="icon" variant="ghost" aria-label="Save" disabled={saving}>
              <CheckIcon />
            </Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Cancel" onClick={cancel}>
              <XIcon />
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold wrap-break-word">{campaign.name}</h1>
            {!campaign.isActive && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Archived</span>}
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={() => {
                  setName(campaign.name)
                  setEditing(true)
                }}
                aria-label={`Rename ${campaign.name}`}
              >
                <PencilIcon className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>
      {canEdit && (
        <label className="flex items-center gap-2 pt-1.5 text-sm">
          Active
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
    </header>
  )
}

function SetupRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// How the campaign is set up: its Mailchimp email, its enquiry form's link,
// and who gets the form's leads.
export function CampaignSetup({
  campaign,
  owners,
  email,
  canEdit,
}: {
  campaign: Campaign
  owners: StaffOption[]
  email: Pick<EmailSummary, 'title' | 'subject' | 'sentAt'> | undefined // the linked email, once its report has loaded
  canEdit: boolean
}) {
  const { save, saving } = useSave(campaign)
  const [editingLink, setEditingLink] = useState(false)
  const [slug, setSlug] = useState(campaign.slug)
  const [picking, setPicking] = useState(false)
  // the campaign site's address, in front of the slug
  const linkBase = campaign.link.slice(0, campaign.link.length - campaign.slug.length)

  function cancelLink() {
    setSlug(campaign.slug)
    setEditingLink(false)
  }

  async function changeLink(e: FormEvent) {
    e.preventDefault()
    const trimmed = slug.trim().toLowerCase()
    if (!trimmed || trimmed === campaign.slug) return cancelLink()
    if (await save({ slug: trimmed }, 'Link changed. Use the new one in campaign emails.')) setEditingLink(false)
  }

  return (
    <section className="divide-y rounded-lg border bg-card" aria-label="Setup">
      <SetupRow label="Mailchimp email">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {campaign.mailchimpCampaignId ? (
            <span className="flex min-w-0 items-center gap-1.5 text-sm">
              <MailIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {email ? (email.title ?? email.subject ?? campaign.mailchimpCampaignId) : campaign.mailchimpCampaignId}
              </span>
              {email?.sentAt && <span className="shrink-0 text-muted-foreground">· sent {formatDate(email.sentAt)}</span>}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Not linked yet</span>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" className="h-7" onClick={() => setPicking(true)}>
              {campaign.mailchimpCampaignId ? 'Change' : 'Link a Mailchimp email'}
            </Button>
          )}
        </div>
        {canEdit && (
          <LinkMailchimpDialog
            open={picking}
            onOpenChange={setPicking}
            campaign={campaign}
            onPick={async (mailchimpCampaignId) => {
              const ok = await save(
                { mailchimpCampaignId },
                mailchimpCampaignId ? 'Mailchimp email linked' : 'Mailchimp email unlinked',
              )
              if (ok) setPicking(false)
            }}
            saving={saving}
          />
        )}
      </SetupRow>

      <SetupRow label="Enquiry form">
        {editingLink ? (
          <form onSubmit={changeLink} className="grid gap-1">
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
              <Button type="submit" size="icon" variant="ghost" aria-label="Save" disabled={saving}>
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
          <div className="flex min-w-0 items-center gap-1">
            <a
              href={campaign.link}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm underline-offset-4 hover:underline"
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
            <Button
              size="icon"
              variant="ghost"
              className="size-7 shrink-0"
              onClick={() => copy(campaign.link)}
              aria-label="Copy the form's link"
            >
              <CopyIcon className="size-3.5" />
            </Button>
            <Button asChild size="icon" variant="ghost" className="size-7 shrink-0">
              <a href={campaign.link} target="_blank" rel="noreferrer" aria-label="Open the form">
                <ExternalLinkIcon className="size-3.5" />
              </a>
            </Button>
          </div>
        )}
      </SetupRow>

      <SetupRow label="Form leads go to">
        <div className="grid gap-1">
          {canEdit ? (
            <OwnerSelect
              value={String(campaign.owner.id)}
              onChange={(v) => save({ ownerId: Number(v) }, 'New leads from this campaign go to the new owner')}
              owners={owners}
              current={campaign.owner}
              className="h-8 w-52"
            />
          ) : (
            <span className="text-sm">{campaign.owner.name}</span>
          )}
          {!campaign.owner.isActive && (
            <p className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
              <TriangleAlertIcon className="size-4 shrink-0" />
              {campaign.owner.name} has left, but still gets this campaign's new leads. Choose another owner.
            </p>
          )}
        </div>
      </SetupRow>

      <div className="px-4 py-2">
        <LastUpdated value={campaign.lastUpdated} />
      </div>
    </section>
  )
}
