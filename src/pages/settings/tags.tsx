import { CheckIcon, PencilIcon, PlusIcon, XIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { LastUpdated } from '@/components/last-updated'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useTagMutations, useTags } from '@/hooks/use-settings'
import { errorMessage } from '@/lib/api'
import { plural } from '@/lib/format'
import type { Tag } from '@/lib/types'
import { cn } from '@/lib/utils'

function TagRow({ tag }: { tag: Tag }) {
  const { update } = useTagMutations()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tag.name)

  async function rename(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === tag.name) {
      setName(tag.name)
      setEditing(false)
      return
    }
    try {
      await update.mutateAsync({ id: tag.id, name: trimmed })
      setEditing(false)
      toast.success('Tag renamed')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function toggle(isActive: boolean) {
    try {
      await update.mutateAsync({ id: tag.id, isActive })
      toast.success(isActive ? `${tag.name} is back in the tag picker` : `${tag.name} retired`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <li className={cn('flex items-center gap-3 bg-background px-3 py-2', !tag.isActive && 'text-muted-foreground')}>
      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={rename} className="flex items-center gap-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={40}
              className="h-8 max-w-xs"
              aria-label="Tag name"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setName(tag.name)
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
                setName(tag.name)
                setEditing(false)
              }}
            >
              <XIcon />
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-medium">{tag.name}</span>
            {!tag.isActive && <span className="text-xs">(retired)</span>}
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => {
                setName(tag.name)
                setEditing(true)
              }}
              aria-label={`Rename ${tag.name}`}
            >
              <PencilIcon className="size-3.5" />
            </Button>
            {tag.guests > 0 ? (
              <Link to={`/guests?tag=${tag.id}`} className="text-sm text-muted-foreground tabular-nums hover:underline">
                {plural(tag.guests, 'guest')}
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">No guests</span>
            )}
          </div>
        )}
        <LastUpdated value={tag.lastUpdated} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="hidden sm:inline">Active</span>
        <Switch checked={tag.isActive} onCheckedChange={toggle} aria-label={`${tag.name} active`} />
      </label>
    </li>
  )
}

export function TagsPage() {
  const { data: tags, isPending, isError } = useTags()
  const { create } = useTagMutations()
  const [newName, setNewName] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    try {
      await create.mutateAsync(name)
      setNewName('')
      toast.success(`${name} added`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <p className="text-sm text-muted-foreground">
        Labels for grouping guests, picked in the profile header and used as a filter in the guest list. Retiring a tag
        hides it from the picker; guests who have it keep it.
      </p>
      <form onSubmit={add} className="flex gap-2">
        <Input
          placeholder="New tag, e.g. Press"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={40}
          aria-label="New tag"
        />
        <Button type="submit" disabled={!newName.trim() || create.isPending}>
          <PlusIcon /> Add
        </Button>
      </form>

      {isPending || isError ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{isError ? "Couldn't load tags." : 'Loading…'}</p>
      ) : tags.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No tags yet.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-md border">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
        </ul>
      )}
    </div>
  )
}
