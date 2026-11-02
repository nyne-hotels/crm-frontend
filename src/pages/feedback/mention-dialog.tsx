import { CheckIcon, ChevronsUpDownIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { useEmployeeOptions } from '@/hooks/use-employees'
import { useFeedbackMutations } from '@/hooks/use-feedback'
import { errorMessage } from '@/lib/api'
import { DEPARTMENT_LABELS, employeeName, SENTIMENT_LABELS, SENTIMENTS, type Sentiment } from '@/lib/feedback'
import type { EmployeeOption, Feedback, Mention } from '@/lib/types'
import { cn } from '@/lib/utils'

interface PickedEmployee {
  id: number
  name: string
  detail: string
}

const picked = (e: EmployeeOption | NonNullable<Mention['employee']>): PickedEmployee => ({
  id: e.id,
  name: employeeName(e),
  detail: [e.jobTitle ?? DEPARTMENT_LABELS[e.department], e.hotel ?? 'Group-wide'].join(' · '),
})

// Add mention, Edit, and Link to employee (the same form, focused on who).
// The guest's review is shown above, to copy their words from.
export function MentionDialog({
  feedback,
  mention,
  open,
  onOpenChange,
}: {
  feedback: Feedback
  mention?: Mention
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const linking = !!mention && !mention.employee
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{!mention ? 'Add mention' : linking ? 'Link to employee' : 'Edit mention'}</DialogTitle>
          <DialogDescription>
            {linking
              ? `The guest wrote "${mention.nameAsWritten}". Choose who they meant.`
              : 'Who the guest praised or criticised, and what they said.'}
          </DialogDescription>
        </DialogHeader>
        {open && <MentionForm feedback={feedback} mention={mention} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function MentionForm({ feedback, mention, onClose }: { feedback: Feedback; mention?: Mention; onClose: () => void }) {
  const { addMention, updateMention } = useFeedbackMutations()
  const [employee, setEmployee] = useState<PickedEmployee | null>(mention?.employee ? picked(mention.employee) : null)
  const [nameAsWritten, setNameAsWritten] = useState(mention?.nameAsWritten ?? '')
  const [sentiment, setSentiment] = useState<Sentiment>(mention?.sentiment ?? 'positive')
  const [comment, setComment] = useState(mention?.comment ?? '')
  const [error, setError] = useState<string | null>(null)
  const busy = addMention.isPending || updateMention.isPending
  const taken = new Set((feedback.mentions ?? []).filter((m) => m.employee && m.id !== mention?.id).map((m) => m.employee!.id))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!employee && !nameAsWritten.trim()) return setError("Choose the employee, or type the name as the guest wrote it if you can't tell")
    const input = {
      employeeId: employee?.id ?? null,
      nameAsWritten: nameAsWritten.trim() || null,
      sentiment,
      comment: comment.trim() || null,
    }
    try {
      if (mention) await updateMention.mutateAsync({ id: mention.id, feedbackId: feedback.id, ...input })
      else await addMention.mutateAsync({ feedbackId: feedback.id, ...input })
      toast.success(mention && !mention.employee && employee ? `Linked to ${employee.name}` : 'Mention saved')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormError message={error} />
      {feedback.review && (
        <blockquote className="max-h-32 overflow-y-auto rounded-md border-l-2 bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap text-muted-foreground select-text">
          {feedback.review}
        </blockquote>
      )}
      <Field label="Employee" htmlFor="mention-employee" hint={`${feedback.stay.hotel} first, then the rest of the group`}>
        <EmployeePicker
          id="mention-employee"
          propertyId={feedback.stay.propertyId}
          value={employee}
          taken={taken}
          onChange={setEmployee}
        />
      </Field>
      <Field
        label="Name as the guest wrote it"
        htmlFor="mention-name"
        hint={employee ? 'Optional' : 'If you can\'t tell who it was, e.g. "the waiter with glasses". Link the employee later.'}
      >
        <Input id="mention-name" value={nameAsWritten} onChange={(e) => setNameAsWritten(e.target.value)} maxLength={200} />
      </Field>
      <Field label="Praise or criticism" htmlFor="mention-sentiment">
        <div id="mention-sentiment" role="radiogroup" className="grid w-full grid-cols-2 gap-2 sm:w-72">
          {SENTIMENTS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sentiment === s}
              onClick={() => setSentiment(s)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                sentiment === s &&
                  (s === 'positive'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'border-red-600 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300'),
              )}
            >
              {SENTIMENT_LABELS[s]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="The guest's words" htmlFor="mention-comment" hint="Copy what they said about this person">
        <Textarea id="mention-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={5000} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// Active employees: the stay's hotel, then group-wide, then the other hotels.
// Someone already mentioned on this response can't be picked again.
function EmployeePicker({
  id,
  propertyId,
  value,
  taken,
  onChange,
}: {
  id?: string
  propertyId: string
  value: PickedEmployee | null
  taken: Set<number>
  onChange: (employee: PickedEmployee | null) => void
}) {
  const [open, setOpen] = useState(false)
  const { data: options = [], isPending } = useEmployeeOptions(propertyId)
  const groups = [
    { heading: options.find((o) => o.propertyId === propertyId)?.hotel ?? 'This hotel', rows: options.filter((o) => o.propertyId === propertyId) },
    { heading: 'Group-wide', rows: options.filter((o) => !o.propertyId) },
    { heading: 'Other hotels', rows: options.filter((o) => o.propertyId && o.propertyId !== propertyId) },
  ].filter((g) => g.rows.length)

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('h-auto min-h-9 min-w-0 flex-1 justify-between py-1.5 font-normal', !value && 'text-muted-foreground')}
          >
            {value ? (
              <span className="grid min-w-0 text-left">
                <span className="truncate">{value.name}</span>
                <span className="truncate text-xs text-muted-foreground">{value.detail}</span>
              </span>
            ) : (
              'Choose the employee'
            )}
            <ChevronsUpDownIcon className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search by name or job title…" />
            <CommandList>
              <CommandEmpty>{isPending ? 'Loading…' : 'No one found. Add them under Feedback → Employees.'}</CommandEmpty>
              {groups.map((g) => (
                <CommandGroup key={g.heading} heading={g.heading}>
                  {g.rows.map((o) => {
                    const option = picked(o)
                    const already = taken.has(o.id)
                    return (
                      <CommandItem
                        key={o.id}
                        value={`${option.name} ${o.jobTitle ?? ''} ${o.hotel ?? ''} #${o.id}`}
                        disabled={already}
                        onSelect={() => {
                          onChange(option)
                          setOpen(false)
                        }}
                      >
                        <CheckIcon className={cn(value?.id === o.id ? 'opacity-100' : 'opacity-0')} />
                        <span className="grid min-w-0 flex-1">
                          <span className="truncate">{option.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{option.detail}</span>
                        </span>
                        {already && <span className="shrink-0 text-xs text-muted-foreground">Already mentioned</span>}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Clear the employee">
          <XIcon />
        </Button>
      )}
    </div>
  )
}
