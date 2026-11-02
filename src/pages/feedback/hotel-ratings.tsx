import { useNavigate } from 'react-router'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useHotelRatings } from '@/hooks/use-feedback'
import { formatCount, formatDate } from '@/lib/format'
import type { HotelRating } from '@/lib/types'
import { cn } from '@/lib/utils'

const average = (n: number | null) => (n === null ? '–' : n.toFixed(2))

// Feedback → Hotel ratings: one row per hotel, for the weekly or monthly
// review, and the whole group. A hotel opens its responses in the inbox.
export function HotelRatingsPage() {
  const navigate = useNavigate()
  const { data, isPending, isError } = useHotelRatings()

  return (
    <div className="grid gap-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hotel</TableHead>
              <TableHead className="text-right">Responses</TableHead>
              <TableHead className="text-right">Average</TableHead>
              <TableHead className="text-right" title="Average and responses in the last 90 days">
                Last 90 days
              </TableHead>
              <TableHead className="text-right" title="Ratings of 1 or 2">
                Low ratings
              </TableHead>
              <TableHead className="text-right">Needs follow-up</TableHead>
              <TableHead>Last response</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <MessageRow>Loading…</MessageRow>
            ) : isError ? (
              <MessageRow className="text-destructive">Couldn't load the ratings.</MessageRow>
            ) : (
              data.rows.map((h) => (
                <TableRow key={h.id} className="cursor-pointer" onClick={() => navigate(`/feedback?hotel=${h.id}`)}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <Figures row={h} />
                </TableRow>
              ))
            )}
          </TableBody>
          {data && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">All hotels</TableCell>
                <Figures row={data.group} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Averages are out of 5. Low ratings are 1 or 2 stars; they need follow-up until a manager marks them followed up.
      </p>
    </div>
  )
}

function Figures({ row }: { row: Omit<HotelRating, 'id' | 'name'> }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">{formatCount(row.responses)}</TableCell>
      <TableCell className={cn('text-right font-medium tabular-nums', row.avgRating !== null && row.avgRating < 3 && 'text-destructive')}>
        {average(row.avgRating)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {average(row.avgRating90Days)}
        <span className="text-muted-foreground"> ({formatCount(row.responses90Days)})</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatCount(row.lowRatings)}</TableCell>
      <TableCell className={cn('text-right tabular-nums', row.needsFollowUp > 0 && 'font-medium text-destructive')}>
        {formatCount(row.needsFollowUp)}
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">{row.lastResponse ? formatDate(row.lastResponse) : '–'}</TableCell>
    </>
  )
}

function MessageRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={7} className={cn('h-24 text-center text-muted-foreground', className)}>
        {children}
      </TableCell>
    </TableRow>
  )
}
