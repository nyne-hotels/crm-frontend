import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { reviewPath } from '@/lib/duplicates'
import { GuestPicker, type PickedGuest } from '../../stays/guest-picker'

// "Merge with another guest" from the profile's ⋯ menu: find the other
// guest, then compare the two on the merge screen.
export function MergeWithDialog({
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
  const navigate = useNavigate()
  const [other, setOther] = useState<PickedGuest | null>(null)
  const same = other?.id === guestId

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setOther(null)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge {guestName} with another guest</DialogTitle>
          <DialogDescription>
            Find the other profile of the same person. You'll see both side by side and choose which to keep before
            anything changes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="merge-with">Other guest</Label>
          <GuestPicker id="merge-with" value={other} onChange={setOther} invalid={same} />
          {same && <p className="text-sm text-destructive">That's this guest. Choose the other profile.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!other || same}
            onClick={() => navigate(reviewPath(guestId, other!.id), { state: { from: 'profile' } })}
          >
            Compare
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
