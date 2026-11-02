import { useQuery } from '@tanstack/react-query'
import { CheckIcon, ChevronsUpDownIcon, UserPlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, queryString } from '@/lib/api'
import { fullName } from '@/lib/format'
import type { GuestList } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface PickedGuest {
  id: number
  name: string
  detail: string | null // primary email or phone, to tell namesakes apart
}

// Search guests by name, email or phone, or start a new one with what was typed.
export function GuestPicker({
  id,
  value,
  onChange,
  onNewGuest,
  newLabel = 'New guest',
  invalid,
}: {
  id?: string
  value: PickedGuest | null
  onChange: (guest: PickedGuest) => void
  onNewGuest?: (typed: string) => void
  newLabel?: string // "New person" on the lead form
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim(), 250)
  const { data, isFetching } = useQuery({
    queryKey: ['guests', 'list', { q, pageSize: 8 }],
    queryFn: () => api<GuestList>(`/guests${queryString({ q, pageSize: '8' })}`),
    enabled: open && q.length >= 2,
    placeholderData: (previous) => previous,
  })
  const results = q.length >= 2 ? (data?.rows ?? []) : []

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
          aria-invalid={invalid || undefined}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
        >
          <span className="truncate">
            {value ? (
              <>
                {value.name}
                {value.detail && <span className="text-muted-foreground"> · {value.detail}</span>}
              </>
            ) : (
              'Search by name, email or phone'
            )}
          </span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type at least 2 letters…" value={search} onValueChange={setSearch} />
          <CommandList>
            {/* CommandEmpty never shows while "New guest" is listed, so the hint is drawn here */}
            {results.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {q.length < 2 ? 'Type a name, email or phone.' : isFetching ? 'Searching…' : 'No guest found.'}
              </p>
            )}
            {results.length > 0 && (
              <CommandGroup>
                {results.map((g) => {
                  const name = fullName(g) || g.email || g.phone || `Guest #${g.id}`
                  return (
                    <CommandItem
                      key={g.id}
                      value={String(g.id)}
                      onSelect={() => {
                        onChange({ id: g.id, name, detail: g.email ?? g.phone })
                        setOpen(false)
                        setSearch('')
                      }}
                    >
                      <CheckIcon className={cn(value?.id === g.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="grid min-w-0">
                        <span className="truncate">{name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[g.email, g.phone, g.country].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
            {onNewGuest && (
              <>
                <CommandSeparator />
                <CommandGroup forceMount>
                  <CommandItem
                    value="__new"
                    forceMount
                    onSelect={() => {
                      onNewGuest(search.trim())
                      setOpen(false)
                      setSearch('')
                    }}
                  >
                    <UserPlusIcon /> {newLabel}
                    {search.trim() && ` "${search.trim()}"`}
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
