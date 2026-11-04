import { ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon, SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useDeletedItems, useRestore } from '@/hooks/use-deleted-items'
import { errorMessage } from '@/lib/api'
import { formatCount, formatDate, formatDateTime, fullName } from '@/lib/format'
import { COMPANY_TYPE_LABELS } from '@/lib/leads'
import { STAY_STATUS_LABELS } from '@/lib/stays'
import type { DeletedItems, DeletedKind, LastUpdated } from '@/lib/types'
import { cn } from '@/lib/utils'

const KINDS: { kind: DeletedKind; label: string; search: string }[] = [
  { kind: 'guests', label: 'Guests', search: 'Search by name, email or phone' },
  { kind: 'stays', label: 'Stays', search: 'Search by guest name or booking reference' },
  { kind: 'companies', label: 'Companies', search: 'Search by name' },
]

const isKind = (v: string | null): v is DeletedKind => KINDS.some((k) => k.kind === v)

// Settings → Deleted items (admin): guests, stays and companies staff deleted,
// newest first. Restore brings one back with everything still attached to it.
export function DeletedItemsPage() {
  const [params, setParams] = useSearchParams()
  const kindParam = params.get('kind')
  const kind: DeletedKind = isKind(kindParam) ? kindParam : 'guests'
  const page = Number(params.get('page')) || 1
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebouncedValue(search.trim(), 250)
  const { data, isPending, isError, isPlaceholderData } = useDeletedItems({ kind, q: q || undefined, page })
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  const show = (next: { kind?: DeletedKind; q?: string; page?: number }) => {
    const k = next.kind ?? kind
    const text = next.q ?? q
    const p = next.page ?? 1
    setParams({ ...(k !== 'guests' && { kind: k }), ...(text && { q: text }), ...(p > 1 && { page: String(p) }) }, { replace: true })
  }
  useEffect(() => {
    if (q !== (params.get('q') ?? '')) show({ q })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed text settles
  }, [q])

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Guests, stays and companies that staff deleted. Restoring one brings it back to every list, search and report, with
        everything that was attached to it. Merged guests aren't here: see{' '}
        <Link to="/settings/merges" className="underline underline-offset-4 hover:text-foreground">
          Merge history
        </Link>
        .
      </p>

      <nav className="flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm" aria-label="What was deleted">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            aria-pressed={kind === k.kind}
            onClick={() => {
              setSearch('')
              show({ kind: k.kind, q: '' })
            }}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1 font-medium text-muted-foreground hover:text-foreground',
              kind === k.kind && 'bg-background text-foreground shadow-sm',
            )}
          >
            {k.label}
            {data && <span className="text-muted-foreground tabular-nums">{formatCount(data.counts[k.kind])}</span>}
          </button>
        ))}
      </nav>

      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={KINDS.find((k) => k.kind === kind)!.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
          aria-label={`Search deleted ${kind}`}
        />
      </div>

      <div className={cn('rounded-md border transition-opacity', isPlaceholderData && 'opacity-60')}>
        {isPending ? (
          <Message>Loading…</Message>
        ) : isError ? (
          <Message className="text-destructive">Couldn't load the deleted items.</Message>
        ) : data.kind !== kind ? (
          <Message>Loading…</Message>
        ) : data.rows.length === 0 ? (
          <Message>{q ? 'Nothing deleted matches that search.' : `No deleted ${kind}.`}</Message>
        ) : (
          <DeletedTable data={data} />
        )}
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            Page {formatCount(data.page)} of {formatCount(pages)}
          </span>
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => show({ page: page - 1 })} aria-label="Previous page">
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => show({ page: page + 1 })} aria-label="Next page">
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </div>
  )
}

function DeletedTable({ data }: { data: DeletedItems }) {
  if (data.kind === 'guests') {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guest</TableHead>
            <TableHead className="text-right">Stays</TableHead>
            <DeletedHeads />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="max-w-72">
                <span className="block truncate font-medium">{fullName(g) || 'No name'}</span>
                <span className="block truncate text-xs text-muted-foreground">{g.email ?? g.phone}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCount(g.stays)}</TableCell>
              <DeletedCells deleted={g.deleted} />
              <TableCell className="text-right">
                <RestoreButton kind="guests" id={g.id} name={fullName(g) || 'the guest'} opens={`/guests/${g.id}`} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }
  if (data.kind === 'stays') {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guest</TableHead>
            <TableHead>Hotel</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Booking ref</TableHead>
            <TableHead>Status</TableHead>
            <DeletedHeads />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="max-w-56">
                {s.guest.deleted ? (
                  <>
                    <span className="block truncate">{fullName(s.guest) || 'No name'}</span>
                    <Badge variant="outline" className="text-muted-foreground">
                      Guest deleted too
                    </Badge>
                  </>
                ) : (
                  <Link to={`/guests/${s.guest.id}`} className="block truncate font-medium hover:underline">
                    {fullName(s.guest) || 'No name'}
                  </Link>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">{s.hotel}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {s.arrivalDate ? `${formatDate(s.arrivalDate)} – ${formatDate(s.departureDate)}` : ''}
              </TableCell>
              <TableCell className="font-mono text-xs whitespace-nowrap">{s.bookingReference}</TableCell>
              <TableCell className="whitespace-nowrap">{STAY_STATUS_LABELS[s.status]}</TableCell>
              <DeletedCells deleted={s.deleted} />
              <TableCell className="text-right">
                {s.guest.deleted ? (
                  <span className="text-xs whitespace-nowrap text-muted-foreground">Restore the guest first</span>
                ) : (
                  <RestoreButton kind="stays" id={s.id} name="the stay" opens={`/stays?stay=${s.id}`} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Type</TableHead>
          <DeletedHeads />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="max-w-72 truncate font-medium">{c.name}</TableCell>
            <TableCell className="whitespace-nowrap">{COMPANY_TYPE_LABELS[c.companyType]}</TableCell>
            <DeletedCells deleted={c.deleted} />
            <TableCell className="text-right">
              <RestoreButton kind="companies" id={c.id} name={c.name} opens={`/companies/${c.id}`} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DeletedHeads() {
  return (
    <>
      <TableHead>Deleted</TableHead>
      <TableHead>Deleted by</TableHead>
      <TableHead className="w-28">
        <span className="sr-only">Restore</span>
      </TableHead>
    </>
  )
}

function DeletedCells({ deleted }: { deleted: LastUpdated }) {
  return (
    <>
      <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(deleted.at)}</TableCell>
      <TableCell className="whitespace-nowrap">{deleted.by ?? 'System'}</TableCell>
    </>
  )
}

// No confirm step: restoring hides nothing, and the record can be deleted again.
function RestoreButton({ kind, id, name, opens }: { kind: DeletedKind; id: number; name: string; opens: string }) {
  const navigate = useNavigate()
  const restore = useRestore()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={restore.isPending}
      onClick={async () => {
        try {
          await restore.mutateAsync({ kind, id })
          toast.success(`Restored ${name}`, { action: { label: 'Open', onClick: () => navigate(opens) } })
        } catch (err) {
          toast.error(errorMessage(err))
        }
      }}
    >
      <RotateCcwIcon /> {restore.isPending ? 'Restoring…' : 'Restore'}
    </Button>
  )
}

function Message({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('flex h-24 items-center justify-center text-sm text-muted-foreground', className)}>{children}</p>
}
