import { HeartIcon, PlusIcon, ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field, FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentStayId, usePreferenceMutations, usePreferences } from '@/hooks/use-knowledge'
import { errorMessage } from '@/lib/api'
import { formatDate } from '@/lib/format'
import {
  PREFERENCE_CATEGORIES,
  PREFERENCE_CATEGORY_ICONS,
  PREFERENCE_CATEGORY_LABELS,
  PREFERENCE_CHIP_CLASSES,
  PREFERENCE_KIND_LABELS,
  PREFERENCE_KINDS,
  stayChipLabel,
  type PreferenceCategory,
  type PreferenceKind,
} from '@/lib/knowledge'
import type { Preference } from '@/lib/types'
import { cn } from '@/lib/utils'
import { StayLinkSelect } from './stay-link-select'

const NO_CATEGORY = 'none'

// Likes (green) and dislikes (red) as chips with their category icon. They
// belong to the guest, so every hotel sees them. Hover for who added it, when
// and on which stay; click to edit.
export function PreferencesPanel({ guestId, guestName, canEdit }: { guestId: number; guestName: string; canEdit: boolean }) {
  const { data, isPending, isError } = usePreferences(guestId)
  const [editing, setEditing] = useState<Preference | 'new' | null>(null)

  const group = (kind: PreferenceKind) => {
    const items = data?.filter((p) => p.kind === kind) ?? []
    const Icon = kind === 'like' ? ThumbsUpIcon : ThumbsDownIcon
    return (
      <section className="grid gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Icon className="size-3.5" /> {kind === 'like' ? 'Likes' : 'Dislikes'}
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">None noted.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {items.map((p) => (
              <li key={p.id}>
                <PreferenceChip preference={p} onClick={canEdit ? () => setEditing(p) : undefined} />
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartIcon className="size-4 text-muted-foreground" /> Likes and dislikes
        </CardTitle>
        {canEdit && (
          <CardAction>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditing('new')}>
              <PlusIcon /> Add
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {isPending ? (
          <Skeleton className="h-16" />
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load likes and dislikes.</p>
        ) : (
          <>
            {group('like')}
            {group('dislike')}
          </>
        )}
      </CardContent>

      <PreferenceDialog
        guestId={guestId}
        guestName={guestName}
        target={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </Card>
  )
}

function PreferenceChip({ preference: p, onClick }: { preference: Preference; onClick?: () => void }) {
  const Icon = p.category ? PREFERENCE_CATEGORY_ICONS[p.category] : null
  const hover = [
    p.category && PREFERENCE_CATEGORY_LABELS[p.category],
    `Added by ${p.created.by ?? 'System'}, ${formatDate(p.created.at)}`,
    p.stay && `Stay: ${stayChipLabel(p.stay)}`,
  ]
    .filter(Boolean)
    .join('\n')
  const className = cn(
    'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-left text-sm',
    PREFERENCE_CHIP_CLASSES[p.kind],
  )
  const content = (
    <>
      {Icon && <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden />}
      <span className="min-w-0 wrap-break-word">{p.body}</span>
    </>
  )
  return onClick ? (
    <button
      type="button"
      title={hover}
      onClick={onClick}
      className={cn(className, 'hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}
    >
      {content}
    </button>
  ) : (
    <span title={hover} className={className}>
      {content}
    </span>
  )
}

function PreferenceDialog({
  guestId,
  guestName,
  target,
  onOpenChange,
}: {
  guestId: number
  guestName: string
  target: Preference | 'new' | null
  onOpenChange: (open: boolean) => void
}) {
  const preference = target === 'new' ? undefined : (target ?? undefined)
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{preference ? 'Edit like or dislike' : 'Add a like or dislike'}</DialogTitle>
          <DialogDescription>{guestName}. Every hotel sees it.</DialogDescription>
        </DialogHeader>
        {/* mounted only while open, so each opening starts afresh */}
        {target && (
          <PreferenceForm guestId={guestId} preference={preference} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PreferenceForm({ guestId, preference, onClose }: { guestId: number; preference?: Preference; onClose: () => void }) {
  const { create, update, remove } = usePreferenceMutations(guestId)
  const currentStayId = useCurrentStayId(guestId)
  const [kind, setKind] = useState<PreferenceKind>(preference?.kind ?? 'like')
  const [category, setCategory] = useState<PreferenceCategory | null>(preference?.category ?? null)
  const [body, setBody] = useState(preference?.body ?? '')
  // undefined until picked: a new one links to the stay the guest is in house for
  const [stayId, setStayId] = useState<number | null | undefined>(preference ? (preference.stay?.id ?? null) : undefined)
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const linkedStay = stayId === undefined ? currentStayId : stayId

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!body.trim()) return setBodyError('Describe the like or dislike')
    setBodyError(null)
    const input = { kind, category, body: body.trim(), stayId: linkedStay }
    setSaving(true)
    try {
      if (preference) await update.mutateAsync({ id: preference.id, ...input })
      else await create.mutateAsync(input)
      toast.success(preference ? 'Saved' : `${PREFERENCE_KIND_LABELS[kind]} added`)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form id="preference-form" onSubmit={submit} className="grid gap-4" noValidate>
        <FormError message={error} />
        <div className="grid gap-1.5">
          <Label id="preference-kind">Kind</Label>
          <div role="radiogroup" aria-labelledby="preference-kind" className="grid grid-cols-2 gap-2">
            {PREFERENCE_KINDS.map((k) => {
              const Icon = k === 'like' ? ThumbsUpIcon : ThumbsDownIcon
              return (
                <Button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  variant="outline"
                  className={cn(kind === k && PREFERENCE_CHIP_CLASSES[k])}
                  onClick={() => setKind(k)}
                >
                  <Icon /> {PREFERENCE_KIND_LABELS[k]}
                </Button>
              )
            })}
          </div>
        </div>
        <Field label="Category" htmlFor="preference-category" hint="Optional, but it helps the next team find it.">
          <Select
            value={category ?? NO_CATEGORY}
            onValueChange={(v) => setCategory(v === NO_CATEGORY ? null : (v as PreferenceCategory))}
          >
            <SelectTrigger id="preference-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>No category</SelectItem>
              {PREFERENCE_CATEGORIES.map((c) => {
                const Icon = PREFERENCE_CATEGORY_ICONS[c]
                return (
                  <SelectItem key={c} value={c}>
                    <Icon /> {PREFERENCE_CATEGORY_LABELS[c]}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Detail" htmlFor="preference-body" error={bodyError ?? undefined}>
          <Input
            id="preference-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={kind === 'like' ? "e.g. Only drinks Jacob's Creek red" : 'e.g. No feather pillows'}
            maxLength={500}
            autoFocus
            aria-invalid={!!bodyError || undefined}
          />
        </Field>
        <Field label="Noticed on" htmlFor="preference-stay">
          <StayLinkSelect id="preference-stay" guestId={guestId} value={linkedStay} onChange={setStayId} />
        </Field>
        {preference && (
          <p className="text-xs text-muted-foreground">
            Added by {preference.created.by ?? 'System'}, {formatDate(preference.created.at)}
          </p>
        )}
      </form>
      <DialogFooter className="sm:justify-between">
        {preference ? (
          <Button variant="ghost" className="text-destructive" onClick={() => setDeleting(true)}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="preference-form" disabled={saving}>
            {saving ? 'Saving…' : preference ? 'Save' : 'Add'}
          </Button>
        </div>
      </DialogFooter>
      {preference && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          title={`Delete "${preference.body}"?`}
          description="It will be removed from this guest's likes and dislikes."
          confirmLabel="Delete"
          destructive
          onConfirm={async () => {
            await remove.mutateAsync(preference.id)
            toast.success('Deleted')
            onClose()
          }}
        />
      )}
    </>
  )
}
