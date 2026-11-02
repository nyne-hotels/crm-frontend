import { BedDoubleIcon, EllipsisIcon, NotebookPenIcon, TargetIcon } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentStayId, useGuestNotes, useNoteMutations, useStayNotes } from '@/hooks/use-knowledge'
import { useMe } from '@/hooks/use-me'
import { useStayPanel } from '@/hooks/use-stay-panel'
import { errorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { mayChangeNote, stayChipLabel } from '@/lib/knowledge'
import type { Note } from '@/lib/types'
import { StayLinkSelect } from './stay-link-select'

// The Notes panel on the guest profile: a box to write a new note (optionally
// linked to a stay), then every note newest first – including the ones
// written on the guest's stays.
export function GuestNotesPanel({ guestId, canEdit }: { guestId: number; canEdit: boolean }) {
  const { data, isPending, isError } = useGuestNotes(guestId)
  const { addToGuest } = useNoteMutations()
  const currentStayId = useCurrentStayId(guestId)
  // undefined until picked: a new note links to the stay the guest is in house for
  const [stayId, setStayId] = useState<number | null | undefined>(undefined)
  const linkedStay = stayId === undefined ? currentStayId : stayId

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <NotebookPenIcon className="size-4 text-muted-foreground" /> Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {canEdit && (
          <NoteComposer
            id="guest-note"
            onAdd={(body) => addToGuest.mutateAsync({ guestId, body, stayId: linkedStay })}
            extra={
              <div className="grid min-w-56 flex-1 gap-1.5 sm:max-w-72">
                <Label htmlFor="guest-note-stay" className="text-xs text-muted-foreground">
                  Link to stay
                </Label>
                <StayLinkSelect id="guest-note-stay" guestId={guestId} value={linkedStay} onChange={setStayId} />
              </div>
            }
          />
        )}
        {isPending ? (
          <Skeleton className="h-24" />
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load notes.</p>
        ) : (
          <NoteList notes={data} showStay empty="No notes yet." />
        )}
      </CardContent>
    </Card>
  )
}

// Notes on the stay detail. They are the guest's notes too, and show on the profile.
export function StayNotes({ stayId, canEdit }: { stayId: number; canEdit: boolean }) {
  const { data, isPending, isError } = useStayNotes(stayId)
  const { addToStay } = useNoteMutations()
  return (
    <section className="grid gap-3">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Notes</h3>
      {canEdit && <NoteComposer id="stay-note" onAdd={(body) => addToStay.mutateAsync({ stayId, body })} />}
      {isPending ? (
        <Skeleton className="h-16" />
      ) : isError ? (
        <p className="text-sm text-destructive">Couldn't load notes.</p>
      ) : (
        <NoteList notes={data} empty="No notes on this stay." />
      )}
    </section>
  )
}

function NoteComposer({
  id,
  onAdd,
  extra,
}: {
  id: string
  onAdd: (body: string) => Promise<unknown>
  extra?: React.ReactNode
}) {
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    try {
      await onAdd(body.trim())
      setBody('')
      toast.success('Note added')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <Label htmlFor={id} className="sr-only">
        New note
      </Label>
      <Textarea
        id={id}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a note, e.g. Asked for late checkout"
        maxLength={5000}
        className="min-h-16"
        onKeyDown={(e) => {
          // Ctrl/⌘ + Enter saves
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
        }}
      />
      <div className="flex flex-wrap items-end justify-between gap-2">
        {extra}
        <Button type="submit" size="sm" disabled={!body.trim() || saving} className="ml-auto">
          {saving ? 'Saving…' : 'Add note'}
        </Button>
      </div>
    </form>
  )
}

function NoteList({ notes, showStay, empty }: { notes: Note[]; showStay?: boolean; empty: string }) {
  if (notes.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="grid">
      {notes.map((n) => (
        <NoteItem key={n.id} note={n} showStay={showStay} />
      ))}
    </ul>
  )
}

function NoteItem({ note, showStay }: { note: Note; showStay?: boolean }) {
  const { data: me } = useMe()
  const { open } = useStayPanel()
  const { update, remove } = useNoteMutations()
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(note.body)
  const [deleting, setDeleting] = useState(false)
  const canChange = mayChangeNote(note, me)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    if (trimmed === note.body) return setEditing(false)
    try {
      await update.mutateAsync({ id: note.id, body: trimmed })
      setEditing(false)
      toast.success('Note saved')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <li className="grid gap-1.5 border-b py-3 first:pt-0 last:border-0 last:pb-0">
      {editing ? (
        <form onSubmit={save} className="grid gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            autoFocus
            aria-label="Note"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setBody(note.body)
                setEditing(false)
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setBody(note.body)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!body.trim() || update.isPending}>
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap wrap-break-word">{note.body}</p>
          {canChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="-mt-1 size-7 shrink-0" aria-label="Note actions">
                  <EllipsisIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setBody(note.body)
                    setEditing(true)
                  }}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{note.created.by ?? 'System'}</span>
        <span className="tabular-nums">{formatDateTime(note.created.at)}</span>
        {note.editedAt && <span title={`Edited ${formatDateTime(note.editedAt)}`}>· edited</span>}
        {showStay && note.stay && (
          <Badge variant="outline" asChild>
            <button type="button" onClick={() => open(note.stay!.id)} className="cursor-pointer font-normal">
              <BedDoubleIcon /> {stayChipLabel(note.stay)}
            </button>
          </Badge>
        )}
        {note.leadId && (
          <Badge variant="outline" className="font-normal">
            <TargetIcon /> Lead
          </Badge>
        )}
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this note?"
        description="It will be hidden from the guest's profile and the stay, but kept on record."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(note.id)
          toast.success('Note deleted')
        }}
      />
    </li>
  )
}
