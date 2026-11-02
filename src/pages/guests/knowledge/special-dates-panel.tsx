import { CakeIcon, CalendarHeartIcon, HeartIcon, PlusIcon, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field, FormError } from '@/components/field'
import { LastUpdated } from '@/components/last-updated'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useSpecialDateMutations, useSpecialDates } from '@/hooks/use-knowledge'
import { errorMessage } from '@/lib/api'
import {
  daysAwayLabel,
  MONTHS,
  SPECIAL_DATE_LABELS,
  SPECIAL_DATE_NAME_HINTS,
  SPECIAL_DATE_OCCASIONS,
  specialDateError,
  specialDateLabel,
  yearsLabel,
  type SpecialDateOccasion,
} from '@/lib/knowledge'
import type { SpecialDate } from '@/lib/types'
import { cn } from '@/lib/utils'

const OCCASION_ICONS: Record<SpecialDateOccasion, LucideIcon> = {
  birthday: CakeIcon,
  wedding_anniversary: HeartIcon,
  partner_birthday: CakeIcon,
  child_birthday: CakeIcon,
  other: CalendarHeartIcon,
}

// Birthdays and anniversaries, the next one first, with "in 12 days" when
// it's within 60 days. Click a line to edit it.
export function SpecialDatesPanel({ guestId, guestName, canEdit }: { guestId: number; guestName: string; canEdit: boolean }) {
  const { data, isPending, isError } = useSpecialDates(guestId)
  const [editing, setEditing] = useState<SpecialDate | 'new' | null>(null)

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CakeIcon className="size-4 text-muted-foreground" /> Special dates
        </CardTitle>
        {canEdit && (
          <CardAction>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditing('new')}>
              <PlusIcon /> Add date
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-16" />
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load special dates.</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No birthdays or anniversaries on record.</p>
        ) : (
          <ul className="grid">
            {data.map((d) => (
              <SpecialDateLine key={d.id} date={d} onClick={canEdit ? () => setEditing(d) : undefined} />
            ))}
          </ul>
        )}
      </CardContent>

      <SpecialDateDialog
        guestId={guestId}
        guestName={guestName}
        target={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </Card>
  )
}

function SpecialDateLine({ date: d, onClick }: { date: SpecialDate; onClick?: () => void }) {
  const Icon = OCCASION_ICONS[d.occasion]
  const years = yearsLabel(d.occasion, d.years)
  const content = (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate text-sm font-medium">
          {SPECIAL_DATE_LABELS[d.occasion]}
          {d.label && <span className="font-normal text-muted-foreground"> · {d.label}</span>}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {specialDateLabel(d)}
          {years && ` · ${years}`}
        </span>
      </span>
      {d.soon && (
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 tabular-nums',
            d.daysAway <= 7 && 'border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300',
          )}
        >
          {daysAwayLabel(d.daysAway)}
        </Badge>
      )}
    </>
  )
  return (
    <li className="border-b last:border-0">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-3 rounded-sm py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-3 py-2">{content}</div>
      )}
    </li>
  )
}

function SpecialDateDialog({
  guestId,
  guestName,
  target,
  onOpenChange,
}: {
  guestId: number
  guestName: string
  target: SpecialDate | 'new' | null
  onOpenChange: (open: boolean) => void
}) {
  const date = target === 'new' ? undefined : (target ?? undefined)
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{date ? 'Edit date' : 'Add a date'}</DialogTitle>
          <DialogDescription>{guestName}</DialogDescription>
        </DialogHeader>
        {target && <SpecialDateForm guestId={guestId} date={date} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function SpecialDateForm({ guestId, date, onClose }: { guestId: number; date?: SpecialDate; onClose: () => void }) {
  const { create, update, remove } = useSpecialDateMutations(guestId)
  const [occasion, setOccasion] = useState<SpecialDateOccasion>(date?.occasion ?? 'birthday')
  const [label, setLabel] = useState(date?.label ?? '')
  const [day, setDay] = useState(date ? String(date.day) : '')
  const [month, setMonth] = useState(date ? String(date.month) : '')
  const [year, setYear] = useState(date?.year ? String(date.year) : '')
  const [dateError, setDateError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const nameHint = SPECIAL_DATE_NAME_HINTS[occasion]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!day.trim()) return setDateError('Enter the day')
    if (!month) return setDateError('Choose a month')
    if (year.trim() && !/^\d{4}$/.test(year.trim())) return setDateError('Enter the year as four digits, or leave it blank')
    const input = {
      occasion,
      label: label.trim() || null,
      day: Number(day),
      month: Number(month),
      year: year.trim() ? Number(year) : null,
    }
    const problem = specialDateError(input.day, input.month, input.year)
    if (problem) return setDateError(problem)
    setDateError(null)
    setSaving(true)
    try {
      if (date) await update.mutateAsync({ id: date.id, ...input })
      else await create.mutateAsync(input)
      toast.success(date ? 'Saved' : `${SPECIAL_DATE_LABELS[occasion]} added`)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form id="special-date-form" onSubmit={submit} className="grid gap-4" noValidate>
        <FormError message={error} />
        <Field label="Occasion" htmlFor="special-date-occasion">
          <Select value={occasion} onValueChange={(v) => setOccasion(v as SpecialDateOccasion)}>
            <SelectTrigger id="special-date-occasion" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPECIAL_DATE_OCCASIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {SPECIAL_DATE_LABELS[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {(nameHint || label) && (
          <Field label={nameHint ? `${nameHint} (optional)` : 'Name (optional)'} htmlFor="special-date-label">
            <Input id="special-date-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} />
          </Field>
        )}
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm leading-none font-medium">Date</legend>
          <div className="grid grid-cols-[5rem_1fr_6rem] gap-2">
            <Input
              inputMode="numeric"
              placeholder="Day"
              aria-label="Day"
              value={day}
              onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
              aria-invalid={!!dateError || undefined}
              autoFocus
            />
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger aria-label="Month" className="w-full" aria-invalid={!!dateError || undefined}>
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              inputMode="numeric"
              placeholder="Year"
              aria-label="Year (optional)"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              aria-invalid={!!dateError || undefined}
            />
          </div>
          {dateError ? (
            <p className="text-xs text-destructive">{dateError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">The year is optional; leave it blank if you don't know it.</p>
          )}
        </fieldset>
        {date && <LastUpdated value={date.lastUpdated} />}
      </form>
      <DialogFooter className="sm:justify-between">
        {date ? (
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
          <Button type="submit" form="special-date-form" disabled={saving}>
            {saving ? 'Saving…' : date ? 'Save' : 'Add'}
          </Button>
        </div>
      </DialogFooter>
      {date && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          title={`Delete this ${SPECIAL_DATE_LABELS[date.occasion].toLowerCase()}?`}
          description="It will be removed from this guest and from Upcoming occasions."
          confirmLabel="Delete"
          destructive
          onConfirm={async () => {
            await remove.mutateAsync(date.id)
            toast.success('Deleted')
            onClose()
          }}
        />
      )}
    </>
  )
}
