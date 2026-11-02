import { Link, useNavigate } from 'react-router'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useContactImportHistory } from '@/hooks/use-contact-imports'
import { formatCount, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ContactImportsNav } from './import-guide'

// Settings → Import contacts → History (admin): every import, newest first.
// Open one to see every change it made.
export function ContactImportHistoryPage() {
  const navigate = useNavigate()
  const { data, isPending, isError } = useContactImportHistory()

  return (
    <div className="grid gap-4">
      <ContactImportsNav />
      <p className="text-sm text-muted-foreground">
        Every contact list imported, with who imported it. Open one for its change log: each field it changed, with the old value.
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imported</TableHead>
              <TableHead>By</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead className="text-right">Updated</TableHead>
              <TableHead className="text-right">Added again</TableHead>
              <TableHead className="text-right">Ignored</TableHead>
              <TableHead className="text-right">Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <MessageRow>Loading…</MessageRow>
            ) : isError ? (
              <MessageRow className="text-destructive">Couldn't load the import history.</MessageRow>
            ) : data.length === 0 ? (
              <MessageRow>No contact lists imported yet.</MessageRow>
            ) : (
              data.map((h) => (
                <TableRow key={h.id} className="cursor-pointer" onClick={() => navigate(`/settings/contact-imports/${h.id}`)}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    <Link
                      to={`/settings/contact-imports/${h.id}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      #{h.id} · {formatDateTime(h.imported.at)}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{h.imported.by ?? 'System'}</TableCell>
                  <TableCell className="max-w-64">
                    <span className="block truncate" title={h.fileName}>
                      {h.fileName}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(h.rowsTotal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(h.created)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(h.updated)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(h.addedAgain)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(h.ignored)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(h.errors)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function MessageRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={9} className={cn('h-24 text-center text-muted-foreground', className)}>
        {children}
      </TableCell>
    </TableRow>
  )
}
