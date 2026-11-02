import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, UserXIcon } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDuplicates } from '@/hooks/use-duplicates'
import { DUPLICATE_REASONS, REASON_CHIP_CLASSES, REASON_LABELS, reviewPath, type DuplicateReason } from '@/lib/duplicates'
import { formatCount, formatDate, fullName, plural } from '@/lib/format'
import type { DuplicateSide } from '@/lib/types'
import { cn } from '@/lib/utils'
import { StageChip } from '../guest-badges'
import { useNotDuplicate } from './use-not-duplicate'

// Guests → Possible duplicates: pairs that may be the same person, for staff
// to review. Email and phone matches come first. Nothing is merged without a
// person deciding; "Not a duplicate" takes a pair off the list for good.
export function PossibleDuplicatesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const reason = (params.get('reason') as DuplicateReason) ?? undefined
  const page = Number(params.get('page')) || 1
  const { data, isPending, isError, isPlaceholderData } = useDuplicates({ reason, page })
  const markNotDuplicate = useNotDuplicate()

  function update(changes: Record<string, string | undefined>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!('page' in changes)) next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <Link to="/guests" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Contacts
      </Link>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-heading text-2xl font-semibold">Possible duplicates</h1>
        {data && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {data.counts.all ? `${plural(data.counts.all, 'pair')} to review` : 'Nothing to review'}
          </span>
        )}
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Guests who share a name, a personal email or a phone. Two different people can share a name or a family phone,
        so open each pair and decide: merge them, mark them not a duplicate, or skip for now.
      </p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by reason">
        <FilterButton active={!reason} onClick={() => update({ reason: undefined })}>
          All {data && <Count n={data.counts.all} />}
        </FilterButton>
        {DUPLICATE_REASONS.map((r) => (
          <FilterButton key={r} active={reason === r} onClick={() => update({ reason: r })}>
            {REASON_LABELS[r]} {data && <Count n={data.counts[r]} />}
          </FilterButton>
        ))}
      </div>

      <div className={cn('rounded-md border transition-opacity', isPlaceholderData && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Possible duplicate</TableHead>
              <TableHead>Why</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <MessageRow>Loading…</MessageRow>
            ) : isError ? (
              <MessageRow className="text-destructive">Couldn't load possible duplicates.</MessageRow>
            ) : data.rows.length === 0 ? (
              <MessageRow>{reason ? 'No pairs for this reason.' : 'No possible duplicates. All clear.'}</MessageRow>
            ) : (
              data.rows.map((pair) => (
                <TableRow
                  key={`${pair.a.id}-${pair.b.id}`}
                  className="cursor-pointer"
                  onClick={() => navigate(reviewPath(pair.a.id, pair.b.id))}
                >
                  <TableCell className="max-w-72 align-top">
                    <GuestCell guest={pair.a} />
                  </TableCell>
                  <TableCell className="max-w-72 align-top">
                    <GuestCell guest={pair.b} />
                  </TableCell>
                  <TableCell className="align-top">
                    <ReasonBadges reasons={pair.reasons} />
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button asChild size="sm">
                        <Link to={reviewPath(pair.a.id, pair.b.id)}>Review</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markNotDuplicate(pair.a.id, pair.b.id, [sideName(pair.a), sideName(pair.b)])}
                      >
                        <UserXIcon /> Not a duplicate
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {formatCount(from)}–{formatCount(to)} of {formatCount(data.total)}
          </span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              Page {formatCount(data.page)} of {formatCount(pages)}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={data.page <= 1}
              onClick={() => update({ page: data.page > 2 ? String(data.page - 1) : undefined })}
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={data.page >= pages}
              onClick={() => update({ page: String(data.page + 1) })}
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

const sideName = (g: DuplicateSide) => fullName(g) || g.email || g.phone || `Guest #${g.id}`

function GuestCell({ guest }: { guest: DuplicateSide }) {
  const history = guest.stayCount
    ? `${plural(guest.stayCount, 'stay')} · last ${formatDate(guest.lastStay)}`
    : 'No stays'
  return (
    <div className="grid min-w-0 gap-0.5">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          to={`/guests/${guest.id}`}
          className={cn('truncate font-medium hover:underline', !fullName(guest) && 'text-muted-foreground italic')}
          onClick={(e) => e.stopPropagation()}
        >
          {fullName(guest) || 'No name'}
        </Link>
        <StageChip stage={guest.lifecycleStage} />
      </div>
      <span className="truncate text-xs text-muted-foreground">{[guest.email, guest.phone].filter(Boolean).join(' · ')}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{history}</span>
    </div>
  )
}

export function ReasonBadges({ reasons }: { reasons: DuplicateReason[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {reasons.map((r) => (
        <Badge key={r} className={cn('border-transparent', REASON_CHIP_CLASSES[r])}>
          {REASON_LABELS[r]}
        </Badge>
      ))}
    </div>
  )
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button size="sm" variant={active ? 'default' : 'outline'} aria-pressed={active} onClick={onClick}>
      {children}
    </Button>
  )
}

const Count = ({ n }: { n: number }) => <span className="tabular-nums opacity-70">{formatCount(n)}</span>

function MessageRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={4} className={cn('h-24 text-center text-muted-foreground', className)}>
        {children}
      </TableCell>
    </TableRow>
  )
}
