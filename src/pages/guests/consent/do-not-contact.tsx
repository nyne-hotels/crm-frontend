import { BanIcon, TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { useConsentMutations, useGuestConsent } from '@/hooks/use-consent'
import { useMe } from '@/hooks/use-me'
import { formatDate } from '@/lib/format'
import { can } from '@/lib/permissions'

// The red banner across a do-not-contact guest's profile, with the warning
// when an opt-in (a ticked booking box) arrived while it was on. Admin and
// management can clear it from here.
export function DoNotContactBanner({ guestId, guestName }: { guestId: number; guestName: string }) {
  const { data: me } = useMe()
  const { data } = useGuestConsent(guestId)
  const [clearing, setClearing] = useState(false)
  if (!data?.doNotContact) return null
  const { at, by } = data.doNotContact

  return (
    <div role="status" className="flex flex-wrap items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
      <BanIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="font-medium text-destructive">Do not contact – requested {formatDate(at)}</p>
        <p className="text-sm text-muted-foreground">
          No marketing by email or WhatsApp. {by ? `Marked by ${by}.` : ''}
        </p>
        {data.optInWhileDoNotContact && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
            <TriangleAlertIcon className="size-4 shrink-0" /> Opt-in received while on do not contact – confirm with guest
          </p>
        )}
      </div>
      {can(me?.permissions, 'clearDoNotContact', 'edit') && (
        <Button variant="outline" size="sm" onClick={() => setClearing(true)}>
          Clear
        </Button>
      )}
      <ClearDoNotContactDialog guestId={guestId} guestName={guestName} open={clearing} onOpenChange={setClearing} />
    </div>
  )
}

// Asks before marking a guest do not contact (from the profile's ⋯ menu).
export function MarkDoNotContactDialog({
  guestId,
  guestName,
  open,
  onOpenChange,
}: {
  guestId: number
  guestName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { setDoNotContact } = useConsentMutations(guestId)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Mark ${guestName} do not contact?`}
      description="All marketing stops: email and WhatsApp switch to opted out and they leave the marketing list. Their profile, stays and notes stay as they are. Only an admin or manager can clear it."
      confirmLabel="Do not contact"
      destructive
      onConfirm={async () => {
        await setDoNotContact.mutateAsync()
        toast.success(`${guestName} is marked do not contact`)
      }}
    />
  )
}

export function ClearDoNotContactDialog({
  guestId,
  guestName,
  open,
  onOpenChange,
}: {
  guestId: number
  guestName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { clearDoNotContact } = useConsentMutations(guestId)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Clear do not contact for ${guestName}?`}
      description="Consent stays as it is: they remain opted out unless they've opted in again since. Clear it only once the guest has confirmed they want to hear from Nyne."
      confirmLabel="Clear do not contact"
      onConfirm={async () => {
        await clearDoNotContact.mutateAsync()
        toast.success('Do not contact cleared')
      }}
    />
  )
}
