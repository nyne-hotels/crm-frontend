import { ArrowLeftIcon, GitMergeIcon, PencilIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DeleteButton } from '@/components/confirm-dialog'
import { CreatedAndUpdated } from '@/components/last-updated'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useGuest, useGuestMutations } from '@/hooks/use-guests'
import { useMe } from '@/hooks/use-me'
import { ApiError } from '@/lib/api'
import { countryFlag, formatDate, fullName } from '@/lib/format'
import { CONTACT_TYPE_LABELS, MARKET_LABELS } from '@/lib/guests'
import { can } from '@/lib/permissions'
import type { Guest } from '@/lib/types'
import { ConsentPanel } from './consent/consent-panel'
import { ContactImportNote } from './contact-import-note'
import { DoNotContactBanner } from './consent/do-not-contact'
import { ContactDetailsPanel } from './contact-details-panel'
import { StageChip, VipTag } from './guest-badges'
import { GuestFeedbackPanel } from '../feedback/feedback-panels'
import { GuestLeadsPanel } from '../leads/guest-leads-panel'
import { GuestStaysPanel } from '../stays/guest-stays-panel'
import { GuestActionsMenu } from './guest-actions-menu'
import { GuestFormDialog } from './guest-form-dialog'
import { GuestTags } from './knowledge/guest-tags'
import { GuestNotesPanel } from './knowledge/notes'
import { PreferencesPanel } from './knowledge/preferences-panel'
import { SpecialDatesPanel } from './knowledge/special-dates-panel'

// What a guest without a name is called: their primary email or phone.
const guestTitle = (g: Pick<Guest, 'firstName' | 'lastName' | 'emails' | 'phones'>) =>
  fullName(g) || g.emails[0]?.value || g.phones[0]?.value || 'Unnamed guest'

// /guests/:id – keyed by id, so opening another guest starts afresh
export function GuestProfilePage() {
  const { id } = useParams()
  return <GuestProfile key={id} id={Number(id)} />
}

function GuestProfile({ id }: { id: number }) {
  const { data: me } = useMe()
  const { data: guest, isPending, error } = useGuest(id)
  const canEdit = can(me?.permissions, 'guests', 'edit')

  if (isPending) return <ProfileSkeleton />
  if (error || !guest) {
    const missing = error instanceof ApiError && (error.status === 404 || error.status === 400)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-heading text-xl font-semibold">{missing ? 'Guest not found' : "Couldn't load this guest"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {missing ? 'They may have been deleted or merged with another guest.' : 'Try again in a moment.'}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/guests">Back to contacts</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <Link to="/guests" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Contacts
      </Link>
      <ProfileHeader guest={guest} canEdit={canEdit} />
      <MergedNote merges={guest.merges} canSeeHistory={can(me?.permissions, 'settings', 'edit')} />
      <DoNotContactBanner guestId={guest.id} guestName={guestTitle(guest)} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="grid gap-6">
          <ContactDetailsPanel guest={guest} canEdit={canEdit} />
          <SpecialDatesPanel guestId={guest.id} guestName={guestTitle(guest)} canEdit={canEdit} />
          <ConsentPanel
            guestId={guest.id}
            guestName={guestTitle(guest)}
            canEdit={can(me?.permissions, 'guestConsent', 'edit')}
            canOpenImports={can(me?.permissions, 'settings', 'edit')}
          />
        </div>
        <div className="grid gap-6 lg:col-span-2">
          {can(me?.permissions, 'stays') && (
            <GuestStaysPanel guest={guest} canEdit={can(me?.permissions, 'stays', 'edit')} />
          )}
          <PreferencesPanel guestId={guest.id} guestName={guestTitle(guest)} canEdit={canEdit} />
          <GuestNotesPanel guestId={guest.id} canEdit={canEdit} />
          {can(me?.permissions, 'leads') && (
            <GuestLeadsPanel
              guest={{ id: guest.id, name: guestTitle(guest), detail: guest.emails[0]?.value ?? guest.phones[0]?.value ?? null }}
              canEdit={can(me?.permissions, 'leads', 'edit')}
            />
          )}
          {can(me?.permissions, 'feedback') && <GuestFeedbackPanel guestId={guest.id} />}
        </div>
      </div>

      <footer className="grid gap-1 border-t pt-4">
        <CreatedAndUpdated created={guest.created} lastUpdated={guest.lastUpdated} />
        {guest.contactImport && (
          <ContactImportNote
            contactImport={{ id: guest.contactImport.id, ...guest.contactImport.imported }}
            canOpen={can(me?.permissions, 'settings', 'edit')}
            className="text-xs"
          />
        )}
      </footer>
    </div>
  )
}

function ProfileHeader({ guest, canEdit }: { guest: Guest; canEdit: boolean }) {
  const navigate = useNavigate()
  const { remove } = useGuestMutations()
  const [editing, setEditing] = useState(false)
  const name = guestTitle(guest)
  // job title and company (a link to it), mostly for agent contacts

  return (
    <header className="flex flex-wrap items-start gap-4">
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className={`font-heading text-2xl font-semibold wrap-break-word ${fullName(guest) ? '' : 'text-muted-foreground'}`}>
            {name}
          </h1>
          <StageChip stage={guest.lifecycleStage} labelled />
          {guest.vipReason && <VipTag reason={guest.vipReason} />}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{CONTACT_TYPE_LABELS[guest.contactType]}</span>
          <span aria-hidden>·</span>
          <span>{guest.countryName ? `${countryFlag(guest.countryCode)} ${guest.countryName}` : 'Country not known'}</span>
          <span aria-hidden>·</span>
          <span>{MARKET_LABELS[guest.market]}</span>
          {(guest.designation || guest.companyName) && (
            <>
              <span aria-hidden>·</span>
              <span>
                {guest.designation}
                {guest.designation && guest.companyName && ', '}
                {guest.companyId && guest.companyName && (
                  <Link to={`/companies/${guest.companyId}`} className="underline-offset-4 hover:text-foreground hover:underline">
                    {guest.companyName}
                  </Link>
                )}
              </span>
            </>
          )}
        </p>
        {guest.vipReason && <p className="text-sm">VIP: {guest.vipReason}</p>}
        <GuestTags guest={guest} canEdit={canEdit} />
      </div>
      <div className="flex gap-2">
        {canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <PencilIcon /> Edit
            </Button>
            <DeleteButton
              what={name}
              onDelete={async () => {
                await remove.mutateAsync(guest.id)
                navigate('/guests', { replace: true })
              }}
            />
          </>
        )}
        <GuestActionsMenu guestId={guest.id} guestName={name} />
      </div>
      <GuestFormDialog open={editing} onOpenChange={setEditing} guest={guest} />
    </header>
  )
}

// "Merged with a duplicate on 21 Oct 2026 by Nisha Silva." Admins can open
// the merge in Settings → Merge history.
function MergedNote({ merges, canSeeHistory }: { merges: Guest['merges']; canSeeHistory: boolean }) {
  if (!merges.length) return null
  const [latest] = merges
  const earlier = merges.length - 1
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/40 px-4 py-2 text-sm">
      <GitMergeIcon className="size-4 shrink-0 text-muted-foreground" />
      <span>
        Merged with a duplicate on {formatDate(latest.merged.at)} by {latest.merged.by ?? 'System'}.
        {earlier > 0 && ` ${earlier === 1 ? 'One earlier merge' : `${earlier} earlier merges`} too.`}
      </span>
      {canSeeHistory && (
        <Link to={`/settings/merges/${latest.id}`} className="text-muted-foreground underline-offset-4 hover:underline">
          See what moved
        </Link>
      )}
    </p>
  )
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <Skeleton className="h-4 w-16" />
      <div className="grid gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64 lg:col-span-2" />
      </div>
    </div>
  )
}
