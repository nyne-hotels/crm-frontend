import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCountries } from '@/hooks/use-reference-data'
import { countryFlag } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
}

// A drop-down where several options can be ticked; any of them may match.
// Nothing ticked shows `anyLabel`; one shows its name; more show the first
// and how many others ("Rock Villa +2"). Long lists can be searched.
export function MultiSelect({
  values,
  onChange,
  options,
  anyLabel,
  search = options.length > 8,
  id,
  className,
  'aria-label': ariaLabel,
}: {
  values: string[]
  onChange: (values: string[]) => void
  options: readonly MultiSelectOption[]
  anyLabel: string
  search?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  // a value from an old link that's no longer offered (a retired tag) still shows
  const all = [...options, ...values.filter((v) => !options.some((o) => o.value === v)).map((v) => ({ value: v, label: v }))]
  const chosen = all.filter((o) => values.includes(o.value))
  const label = !chosen.length ? anyLabel : chosen.length === 1 ? chosen[0].label : `${chosen[0].label} +${chosen.length - 1}`

  // kept in the order of the list, so the address doesn't change with the clicking order
  function toggle(value: string) {
    const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
    onChange(all.map((o) => o.value).filter((v) => next.includes(v)))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          title={chosen.length > 1 ? chosen.map((o) => o.label).join(', ') : undefined}
          className={cn('justify-between px-3 font-normal', className)}
        >
          <span className="truncate">{label}</span>
          <ChevronDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0" align="start">
        {/* plain "contains" matching: fuzzy matching finds Dominica for "ind" */}
        <Command filter={(value, typed) => (value.toLowerCase().includes(typed.trim().toLowerCase()) ? 1 : 0)}>
          {search && <CommandInput placeholder="Search…" />}
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {all.map((o) => {
                const ticked = values.includes(o.value)
                return (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.value}`}
                    onSelect={() => toggle(o.value)}
                    aria-checked={ticked}
                    role="menuitemcheckbox"
                  >
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input',
                        ticked && 'border-primary bg-primary text-primary-foreground',
                      )}
                    >
                      {ticked && <CheckIcon className="size-3 text-current" />}
                    </span>
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {values.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem value="__clear__" onSelect={() => onChange([])} className="text-muted-foreground">
                    <XIcon /> Clear ({values.length})
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// Several countries, searchable by name or code.
export function CountryMultiSelect(props: Omit<React.ComponentProps<typeof MultiSelect>, 'options' | 'anyLabel' | 'search'>) {
  const { data: countries = [] } = useCountries()
  const options = countries.map((c) => ({ value: c.code, label: `${countryFlag(c.code)} ${c.name}` }))
  return <MultiSelect {...props} options={options} anyLabel="Any country" search />
}
