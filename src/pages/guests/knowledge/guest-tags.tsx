import { PlusIcon, TagIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useGuestMutations } from '@/hooks/use-guests'
import { useTagOptions } from '@/hooks/use-reference-data'
import { errorMessage } from '@/lib/api'
import type { Guest } from '@/lib/types'
import { cn } from '@/lib/utils'

// Tags in the profile header. Picked from the admin's list only; × removes
// one. A retired tag stays on the guests who have it, marked as retired.
export function GuestTags({ guest, canEdit }: { guest: Guest; canEdit: boolean }) {
  const { addTag, removeTag } = useGuestMutations()
  const { data: options = [] } = useTagOptions()
  const [open, setOpen] = useState(false)
  const available = options.filter((o) => !guest.tags.some((t) => t.id === o.id))

  async function add(tagId: number, name: string) {
    setOpen(false)
    try {
      await addTag.mutateAsync({ guestId: guest.id, tagId })
      toast.success(`Tagged ${name}`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function remove(tagId: number, name: string) {
    try {
      await removeTag.mutateAsync({ guestId: guest.id, tagId })
      toast.success(`${name} tag removed`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  if (!guest.tags.length && !canEdit) return null

  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Tags">
      {guest.tags.map((t) => (
        <li key={t.id}>
          <Badge
            variant="secondary"
            className={cn('gap-1 pr-1', !t.isActive && 'text-muted-foreground', !canEdit && 'pr-2')}
            title={t.isActive ? undefined : 'This tag has been retired'}
          >
            <TagIcon /> {t.name}
            {!t.isActive && <span className="font-normal">(retired)</span>}
            {canEdit && (
              <button
                type="button"
                onClick={() => remove(t.id, t.name)}
                disabled={removeTag.isPending}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`Remove tag ${t.name}`}
              >
                <XIcon className="size-3" />
              </button>
            )}
          </Badge>
        </li>
      ))}
      {canEdit && (
        <li>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground">
                <PlusIcon className="size-3" /> Add tag
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
              <Command>
                <CommandInput placeholder="Find a tag…" />
                <CommandList>
                  <CommandEmpty>{options.length ? 'No other tags.' : 'No tags yet. An admin adds them in Settings.'}</CommandEmpty>
                  <CommandGroup>
                    {available.map((o) => (
                      <CommandItem key={o.id} value={o.name} onSelect={() => add(o.id, o.name)}>
                        <TagIcon /> {o.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </li>
      )}
    </ul>
  )
}
