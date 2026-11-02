import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CheckIcon, GripVerticalIcon, PencilIcon, PlusIcon, XIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { LastUpdated } from '@/components/last-updated'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useOccasionMutations, useOccasions } from '@/hooks/use-settings'
import { errorMessage } from '@/lib/api'
import type { Occasion } from '@/lib/types'
import { cn } from '@/lib/utils'

function OccasionRow({ occasion }: { occasion: Occasion }) {
  const { update } = useOccasionMutations()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(occasion.name)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: occasion.id,
  })

  async function rename(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === occasion.name) {
      setName(occasion.name)
      setEditing(false)
      return
    }
    try {
      await update.mutateAsync({ id: occasion.id, name: trimmed })
      setEditing(false)
      toast.success('Occasion renamed')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function toggle(isActive: boolean) {
    try {
      await update.mutateAsync({ id: occasion.id, isActive })
      toast.success(isActive ? `${occasion.name} is back in drop-downs` : `${occasion.name} retired`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 bg-background px-3 py-2',
        isDragging && 'relative z-10 shadow-md',
        !occasion.isActive && 'text-muted-foreground',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label={`Drag to reorder ${occasion.name}`}
      >
        <GripVerticalIcon className="size-4" />
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={rename} className="flex items-center gap-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="h-8 max-w-xs"
              aria-label="Occasion name"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setName(occasion.name)
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
                setName(occasion.name)
                setEditing(false)
              }}
            >
              <XIcon />
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium">{occasion.name}</span>
            {!occasion.isActive && <span className="text-xs">(retired)</span>}
            <Button size="icon" variant="ghost" className="size-7" onClick={() => { setName(occasion.name); setEditing(true) }} aria-label={`Rename ${occasion.name}`}>
              <PencilIcon className="size-3.5" />
            </Button>
          </div>
        )}
        <LastUpdated value={occasion.lastUpdated} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="hidden sm:inline">Active</span>
        <Switch checked={occasion.isActive} onCheckedChange={toggle} aria-label={`${occasion.name} active`} />
      </label>
    </li>
  )
}

export function OccasionsPage() {
  const { data: occasions, isPending, isError } = useOccasions()
  const { create, reorder } = useOccasionMutations()
  const [newName, setNewName] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!occasions || !over || active.id === over.id) return
    const from = occasions.findIndex((o) => o.id === active.id)
    const to = occasions.findIndex((o) => o.id === over.id)
    reorder.mutate(
      arrayMove(occasions, from, to).map((o) => o.id),
      { onError: (err) => toast.error(errorMessage(err)) },
    )
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <p className="text-sm text-muted-foreground">
        Trip reasons for stays and leads, in drop-down order. Drag to reorder. Retiring one hides it from drop-downs;
        stays that use it keep it.
      </p>
      <form onSubmit={add} className="flex gap-2">
        <Input placeholder="New occasion, e.g. Graduation" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="New occasion" />
        <Button type="submit" disabled={!newName.trim() || create.isPending}>
          <PlusIcon /> Add
        </Button>
      </form>

      {isPending || isError ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{isError ? "Couldn't load occasions." : 'Loading…'}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={occasions.map((o) => o.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y overflow-hidden rounded-md border">
              {occasions.map((occasion) => (
                <OccasionRow key={occasion.id} occasion={occasion} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
