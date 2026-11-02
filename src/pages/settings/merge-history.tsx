import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMergeHistory } from '@/hooks/use-duplicates'
import { formatCount, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

// Settings → Merge history (admin): every merge, newest first. Open one to
// see a read-only copy of the removed profile and what moved.
export function MergeHistoryPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const { data, isPending, isError, isPlaceholderData } = useMergeHistory(page)
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const goTo = (p: number) => setParams(p > 1 ? { page: String(p) } : {}, { replace: true })

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Guests merged by staff. There's no undo button: a wrong merge can be rebuilt from the copy kept here.
      </p>
      <div className={cn('rounded-md border transition-opacity', isPlaceholderData && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Merged by</TableHead>
              <TableHead>Kept guest</TableHead>
              <TableHead>Removed guest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <MessageRow>Loading…</MessageRow>
            ) : isError ? (
              <MessageRow className="text-destructive">Couldn't load the merge history.</MessageRow>
            ) : data.rows.length === 0 ? (
              <MessageRow>No guests have been merged yet.</MessageRow>
            ) : (
              data.rows.map((m) => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/settings/merges/${m.id}`)}>
                  <TableCell className="tabular-nums">
                    <Link to={`/settings/merges/${m.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                      {formatDateTime(m.merged.at)}
                    </Link>
                  </TableCell>
                  <TableCell>{m.merged.by ?? 'System'}</TableCell>
                  <TableCell>
                    {m.keptId ? (
                      <Link to={`/guests/${m.keptId}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {m.keptName ?? 'No name'}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">No longer in the CRM</span>
                    )}
                  </TableCell>
                  <TableCell>{m.removedName ?? <span className="text-muted-foreground italic">No name</span>}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            Page {formatCount(data.page)} of {formatCount(pages)}
          </span>
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => goTo(page - 1)} aria-label="Previous page">
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => goTo(page + 1)} aria-label="Next page">
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </div>
  )
}

function MessageRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={4} className={cn('h-24 text-center text-muted-foreground', className)}>
        {children}
      </TableCell>
    </TableRow>
  )
}
