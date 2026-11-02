import { BanIcon, EllipsisIcon, GitMergeIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useGuestConsent } from '@/hooks/use-consent'
import { useMe } from '@/hooks/use-me'
import { can } from '@/lib/permissions'
import { ClearDoNotContactDialog, MarkDoNotContactDialog } from './consent/do-not-contact'
import { MergeWithDialog } from './duplicates/merge-with-dialog'

// The profile's ⋯ menu: "Merge with another guest" for admin and management;
// "Do not contact" for anyone who records consent; "Clear do not contact"
// for admin and management only.
export function GuestActionsMenu({ guestId, guestName }: { guestId: number; guestName: string }) {
  const { data: me } = useMe()
  const { data: consent } = useGuestConsent(guestId)
  const [open, setOpen] = useState<'merge' | 'mark' | 'clear' | null>(null)

  const canMerge = can(me?.permissions, 'mergeGuests', 'edit')
  const canMark = !!consent && !consent.doNotContact && can(me?.permissions, 'guestConsent', 'edit')
  const canClear = !!consent?.doNotContact && can(me?.permissions, 'clearDoNotContact', 'edit')
  if (!canMerge && !canMark && !canClear) return null

  const setOpenFor = (dialog: typeof open) => (next: boolean) => setOpen(next ? dialog : null)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="size-8" aria-label="More actions">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canMerge && (
            <DropdownMenuItem onSelect={() => setOpen('merge')}>
              <GitMergeIcon /> Merge with another guest
            </DropdownMenuItem>
          )}
          {canMark && (
            <DropdownMenuItem variant="destructive" onSelect={() => setOpen('mark')}>
              <BanIcon /> Do not contact
            </DropdownMenuItem>
          )}
          {canClear && <DropdownMenuItem onSelect={() => setOpen('clear')}>Clear do not contact</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      {canMerge && (
        <MergeWithDialog guestId={guestId} guestName={guestName} open={open === 'merge'} onOpenChange={setOpenFor('merge')} />
      )}
      <MarkDoNotContactDialog guestId={guestId} guestName={guestName} open={open === 'mark'} onOpenChange={setOpenFor('mark')} />
      <ClearDoNotContactDialog guestId={guestId} guestName={guestName} open={open === 'clear'} onOpenChange={setOpenFor('clear')} />
    </>
  )
}
