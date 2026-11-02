import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCountries } from '@/hooks/use-reference-data'
import { countryFlag } from '@/lib/format'
import type { Country } from '@/lib/types'
import { cn } from '@/lib/utils'

// Ranks a country for a search: type "sri" or "LK" (or "+94") to find Sri Lanka.
// 0 = no match; exact code matches come first, then name starts, then contains.
function score(country: Country, search: string) {
  const s = search.trim().toLowerCase()
  if (!s) return 1
  const name = country.name.toLowerCase()
  if (country.code.toLowerCase() === s) return 1
  if (name.startsWith(s)) return 0.9
  if (name.split(/[\s-]+/).some((word) => word.startsWith(s))) return 0.8
  if (country.dialCode && country.dialCode.replace('+', '') === s.replace('+', '')) return 0.7
  if (name.includes(s)) return 0.5
  return 0
}

interface CountryPickerProps {
  value: string | null // ISO code, e.g. 'LK'
  onChange: (code: string | null) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  // 'dialCode': a compact trigger showing only the flag and code, for phone numbers
  display?: 'name' | 'dialCode'
  'aria-label'?: string
}

// Searchable country drop-down showing the name and dialling code.
export function CountryPicker({
  value,
  onChange,
  placeholder = 'Choose a country',
  disabled,
  id,
  className,
  display = 'name',
  'aria-label': ariaLabel,
}: CountryPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { data: countries = [], isLoading } = useCountries()
  const selected = value ? countries.find((c) => c.code === value) : undefined
  const matches = countries
    .map((country) => ({ country, score: score(country, search) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.country.name.localeCompare(b.country.name))

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate">
            {!selected
              ? placeholder
              : display === 'dialCode'
                ? `${countryFlag(selected.code)} ${selected.dialCode ?? selected.code}`
                : `${countryFlag(selected.code)} ${selected.name}${selected.dialCode ? ` (${selected.dialCode})` : ''}`}
          </span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        {/* filtered and ranked here, so an exact code like "LK" comes first */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search by name or code…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{isLoading ? 'Loading…' : 'No country found.'}</CommandEmpty>
            <CommandGroup>
              {matches.map(({ country }) => (
                <CommandItem
                  key={country.code}
                  value={country.code}
                  onSelect={(code) => {
                    onChange(code === value ? null : code)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  <CheckIcon className={cn(value === country.code ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">
                    {countryFlag(country.code)} {country.name}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {country.code} {country.dialCode}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
