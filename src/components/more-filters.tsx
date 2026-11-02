import { SlidersHorizontalIcon } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { CountryMultiSelect, MultiSelect, type MultiSelectOption } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { countFilters, isBackwards } from '@/lib/filters'

// "Any" in a drop-down; not 'any', which some filters use as a value ("works for any company")
const ANY = '__any__'
type Update = (changes: Record<string, string | undefined>) => void

// The "More filters" button and its side panel. The button shows how many of
// the panel's filters are on; results update as they're chosen.
export function MoreFilters({
  params,
  keys,
  update,
  total,
  children,
}: {
  params: URLSearchParams
  keys: readonly string[]
  update: Update
  total?: string // "1,204 contacts", for the button that closes the panel
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const count = countFilters(params, keys)
  return (
    <>
      <Button variant={count ? 'secondary' : 'outline'} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <SlidersHorizontalIcon /> More filters
        {count > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-xs leading-5 text-primary-foreground tabular-nums">{count}</span>
        )}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        {/* opening shouldn't focus the first field: on a phone that pops up its keyboard or calendar */}
        <SheetContent className="w-full gap-0 sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader className="border-b">
            <SheetTitle>More filters</SheetTitle>
            <SheetDescription>Results update as you choose.</SheetDescription>
          </SheetHeader>
          <div className="grid flex-1 content-start gap-6 overflow-y-auto p-4">{children}</div>
          <SheetFooter className="flex-row justify-between border-t">
            <Button
              variant="ghost"
              disabled={!count}
              onClick={() => update(Object.fromEntries(keys.map((k) => [k, undefined])))}
            >
              Clear these
            </Button>
            <Button onClick={() => setOpen(false)}>{total ? `Show ${total}` : 'Done'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

// A titled group of fields in the panel.
export function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  anyLabel = 'Any',
}: {
  label: string
  value: string | undefined
  onChange: (value: string | undefined) => void
  options: readonly { value: string; label: string }[]
  anyLabel?: string
}) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value ?? ANY} onValueChange={(v) => onChange(v === ANY ? undefined : v)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
          {/* a value from an old link that's no longer offered still shows */}
          {value && !options.some((o) => o.value === value) && <SelectItem value={value}>{value}</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  )
}

// Any / yes / no, with the words for each answer.
export function YesNoSelect({
  label,
  yes,
  no,
  ...props
}: {
  label: string
  yes: string
  no: string
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  return (
    <FilterSelect
      label={label}
      options={[
        { value: 'yes', label: yes },
        { value: 'no', label: no },
      ]}
      {...props}
    />
  )
}

// From / to: two days, or two numbers (typed numbers apply once typing pauses).
export function RangeFilter({
  label,
  type,
  from,
  to,
  onFromChange,
  onToChange,
  min,
  max,
  step,
  hint,
}: {
  label: string
  type: 'date' | 'number'
  from: string | undefined
  to: string | undefined
  onFromChange: (value: string | undefined) => void
  onToChange: (value: string | undefined) => void
  min?: number
  max?: number
  step?: number
  hint?: string
}) {
  const id = useId()
  const backwards = !!from && !!to && isBackwards(from, to)
  const Box = type === 'date' ? DateBox : NumberBox
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-1.5">
        <Box id={id} value={from} onChange={onFromChange} min={min} max={max} step={step} aria-label={`${label}: from`} placeholder="From" />
        <span className="text-sm text-muted-foreground">to</span>
        <Box value={to} onChange={onToChange} min={from ? Number(from) || min : min} max={max} step={step} aria-label={`${label}: to`} placeholder="To" dateMin={from} />
      </div>
      {backwards ? (
        <p className="text-xs text-destructive">The end is before the start.</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

interface BoxProps {
  id?: string
  value: string | undefined
  onChange: (value: string | undefined) => void
  min?: number
  max?: number
  step?: number
  placeholder: string
  dateMin?: string
  'aria-label': string
}

function DateBox({ id, value, onChange, dateMin, 'aria-label': ariaLabel }: BoxProps) {
  return (
    <Input
      id={id}
      type="date"
      className="min-w-0 flex-1"
      value={value ?? ''}
      min={dateMin}
      onChange={(e) => onChange(e.target.value || undefined)}
      aria-label={ariaLabel}
    />
  )
}

// What's typed in a box, sent on once typing pauses. Follows the address
// when the filter changes elsewhere (Clear these, Back).
function useTyped(value: string | undefined, onChange: (value: string | undefined) => void, valid?: (text: string) => boolean) {
  const [text, setText] = useState(value ?? '')
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    setText(value ?? '')
  }
  const typed = useDebouncedValue(text.trim(), 350)
  useEffect(() => {
    if (typed !== (value ?? '') && (typed === '' || !valid || valid(typed))) onChange(typed || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed text settles
  }, [typed])
  return [text, setText] as const
}

const isNumber = (text: string) => !Number.isNaN(Number(text))

function NumberBox({ id, value, onChange, min, max, step, placeholder, 'aria-label': ariaLabel }: BoxProps) {
  const [text, setText] = useTyped(value, onChange, isNumber)
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      className="min-w-0 flex-1"
      value={text}
      min={min}
      max={max}
      step={step ?? 1}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      aria-label={ariaLabel}
    />
  )
}

// Part of a word or phrase, applied once typing pauses.
export function TextFilter({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string | undefined
  onChange: (value: string | undefined) => void
  placeholder?: string
}) {
  const id = useId()
  const [text, setText] = useTyped(value, onChange)
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

// Several countries; any of them may match.
export function CountryFilter({
  label,
  values,
  onChange,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
}) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <CountryMultiSelect id={id} values={values} onChange={onChange} className="w-full" />
    </div>
  )
}

// Several options can be ticked; any of them may match.
export function FilterMultiSelect({
  label,
  values,
  onChange,
  options,
  anyLabel = 'Any',
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  options: readonly MultiSelectOption[]
  anyLabel?: string
}) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <MultiSelect id={id} values={values} onChange={onChange} options={options} anyLabel={anyLabel} className="w-full" />
    </div>
  )
}
