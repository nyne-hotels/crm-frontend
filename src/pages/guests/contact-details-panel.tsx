import { EllipsisIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useGuestMutations } from '@/hooks/use-guests'
import { errorMessage } from '@/lib/api'
import { KIND_LABELS, type ContactMethodKind } from '@/lib/guests'
import { phoneHref } from '@/lib/phone'
import type { ContactMethod, Guest } from '@/lib/types'
import { ContactMethodDialog, type ContactMethodTarget } from './contact-method-dialog'
import { MethodStatusBadge, PrimaryStar, WhatsappIcon } from './guest-badges'

// Every email and phone, with primary, shared, status and WhatsApp.
export function ContactDetailsPanel({ guest, canEdit }: { guest: Guest; canEdit: boolean }) {
  const { updateContactMethod, removeContactMethod } = useGuestMutations()
  const [target, setTarget] = useState<ContactMethodTarget | null>(null)
  const [deleting, setDeleting] = useState<ContactMethod | null>(null)

  async function makePrimary(method: ContactMethod) {
    try {
      await updateContactMethod.mutateAsync({ guestId: guest.id, id: method.id, isPrimary: true })
      toast.success(`${method.value} is now the primary ${KIND_LABELS[method.kind]}`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const section = (kind: ContactMethodKind, methods: ContactMethod[]) => (
    <section className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {kind === 'email' ? 'Emails' : 'Phones'}
        </h3>
        {canEdit && (
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setTarget({ kind })}>
            <PlusIcon /> {kind === 'email' ? 'Add email' : 'Add phone'}
          </Button>
        )}
      </div>
      {methods.length === 0 ? (
        <p className="py-1 text-sm text-muted-foreground">No {kind === 'email' ? 'email' : 'phone'} on file.</p>
      ) : (
        <ul className="grid">
          {methods.map((m) => (
            <li key={m.id} className="flex items-center gap-2 border-b py-2 last:border-0">
              <PrimaryStar primary={m.isPrimary} />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <a
                  href={kind === 'email' ? `mailto:${m.value}` : phoneHref(m.value)}
                  className="truncate text-sm underline-offset-4 hover:underline"
                >
                  {m.value}
                </a>
                {m.isWhatsapp && <WhatsappIcon />}
                <span className="flex flex-wrap gap-1">
                  {m.isShared && <Badge variant="secondary">Shared</Badge>}
                  <MethodStatusBadge kind={kind} status={m.status} />
                </span>
              </div>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${m.value}`}>
                      <EllipsisIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={m.isPrimary} onSelect={() => makePrimary(m)}>
                      Make primary
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setTarget({ kind, method: m })}>Edit</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(m)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  const otherOfKind = deleting && (deleting.kind === 'email' ? guest.emails : guest.phones).length > 1

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Contact details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {section('email', guest.emails)}
        {section('phone', guest.phones)}
      </CardContent>

      <ContactMethodDialog guest={guest} target={target} onOpenChange={(open) => !open && setTarget(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.value}?`}
        description={
          deleting?.isPrimary && otherOfKind
            ? `It's the primary ${KIND_LABELS[deleting.kind]}; the newest other one becomes primary.`
            : 'It will be removed from this guest. It can be added again later.'
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await removeContactMethod.mutateAsync({ guestId: guest.id, id: deleting!.id })
          toast.success('Deleted')
        }}
      />
    </Card>
  )
}
