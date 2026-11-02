import { ArrowLeftIcon, DownloadIcon, SearchIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { ResultCount } from '@/components/import-wizard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  fetchContactImportResults,
  useContactImport,
  useContactImportChanges,
  useContactImportSetup,
} from '@/hooks/use-contact-imports'
import { useCountries } from '@/hooks/use-reference-data'
import { errorMessage } from '@/lib/api'
import { CHANGE_FIELD_LABELS, CHANGE_FIELDS, formatChangeValue, matchedColumns, resultSheets, type ChangeField } from '@/lib/contact-imports'
import { formatCount, formatDateTime, plural } from '@/lib/format'
import type { ContactImportChange } from '@/lib/types'
import { ImportedPeople } from './imported-people'

const PAGE = 100
const ALL = 'all'

// One contact import: who, when, the counts, the people and companies it
// created, and its change log, which can be filtered and downloaded.
export function ContactImportDetailPage() {
  const id = Number(useParams().id)
  const { data, isPending, isError } = useContactImport(id)
  const { data: setup } = useContactImportSetup()
  const [downloading, setDownloading] = useState(false)

  // the result file again: the matched columns of every row, with what happened
  async function downloadResults() {
    setDownloading(true)
    try {
      const [{ downloadSheets }, saved] = await Promise.all([import('@/lib/spreadsheet'), fetchContactImportResults(id)])
      const columns = matchedColumns(setup?.fields ?? [], saved.mapping)
      downloadSheets(
        `${saved.fileName.replace(/\.[^.]+$/, '')} - result.xlsx`,
        resultSheets(
          columns.map((c) => c.heading),
          saved.results.map((r) => columns.map((c) => r.values[c.key] ?? '')),
          saved.results,
        ),
      )
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Link
        to="/settings/contact-imports/history"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Import history
      </Link>
      {isPending ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <p className="text-sm text-destructive">Couldn't load this import.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Contact import #{data.id}</CardTitle>
              <CardDescription>
                {data.fileName} · imported {formatDateTime(data.imported.at)} by {data.imported.by ?? 'System'} ·{' '}
                {plural(data.rowsTotal, 'row')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <ResultCount label="New">{data.created}</ResultCount>
                <ResultCount label="Updated">{data.updated}</ResultCount>
                <ResultCount label="Added again">{data.addedAgain}</ResultCount>
                <ResultCount label="Ignored">{data.ignored}</ResultCount>
                <ResultCount label="Errors">{data.errors}</ResultCount>
              </dl>
              <div>
                <Button variant="outline" onClick={downloadResults} disabled={downloading || !setup}>
                  <DownloadIcon /> {downloading ? 'Preparing…' : 'Download result file'}
                </Button>
              </div>
            </CardContent>
          </Card>
          <ChangeLog importId={id} fileName={data.fileName} />
          <ImportedPeople details={data.details} />
        </>
      )}
    </div>
  )
}

function ChangeLog({ importId, fileName }: { importId: number; fileName: string }) {
  const { data = [], isPending, isError } = useContactImportChanges(importId)
  const { data: countries = [] } = useCountries()
  const [q, setQ] = useState('')
  const [field, setField] = useState<ChangeField | typeof ALL>(ALL)
  const [page, setPage] = useState(0)

  const countryName = (code: string) => countries.find((c) => c.code === code)?.name
  const show = (c: ContactImportChange, value: string | null) => formatChangeValue(c.field, value, countryName)
  const contactLabel = (c: ContactImportChange) => c.contactName ?? `Contact #${c.contactId} (merged away)`

  const search = q.trim().toLowerCase().replace(/^#/, '')
  const shown = data.filter(
    (c) =>
      (field === ALL || c.field === field) &&
      (!search || contactLabel(c).toLowerCase().includes(search) || String(c.contactId) === search),
  )
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const pageRows = shown.slice(page * PAGE, (page + 1) * PAGE)
  const fieldsUsed = CHANGE_FIELDS.filter((f) => data.some((c) => c.field === f))

  async function download() {
    const { downloadXlsx } = await import('@/lib/spreadsheet')
    downloadXlsx(
      `${fileName.replace(/\.[^.]+$/, '')} - change log.xlsx`,
      ['Row', 'Contact ID', 'Contact', 'Field', 'Old value', 'New value'],
      shown.map((c) => [
        String(c.row),
        String(c.contactId),
        contactLabel(c),
        CHANGE_FIELD_LABELS[c.field] ?? c.field,
        show(c, c.oldValue) ?? '',
        show(c, c.newValue) ?? '',
      ]),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change log</CardTitle>
        <CardDescription>
          Every field this import changed, with the old value, so it can be put back by hand. New and added-again contacts
          show once, as "Contact".
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
              placeholder="Contact name or ID"
              className="pl-8"
              aria-label="Filter by contact"
            />
          </div>
          <Select
            value={field}
            onValueChange={(v) => {
              setField(v as ChangeField | typeof ALL)
              setPage(0)
            }}
          >
            <SelectTrigger className="w-48" aria-label="Filter by field">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Every field</SelectItem>
              {fieldsUsed.map((f) => (
                <SelectItem key={f} value={f}>
                  {CHANGE_FIELD_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="sm:ml-auto" onClick={download} disabled={!shown.length}>
            <DownloadIcon /> Download {plural(shown.length, 'change')}
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-right">Row</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Old value</TableHead>
                <TableHead>New value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <MessageRow>Loading…</MessageRow>
              ) : isError ? (
                <MessageRow className="text-destructive">Couldn't load the change log.</MessageRow>
              ) : pageRows.length === 0 ? (
                <MessageRow>{data.length ? 'No changes match.' : 'This import changed nothing.'}</MessageRow>
              ) : (
                pageRows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-right align-top tabular-nums">{formatCount(c.row)}</TableCell>
                    <TableCell className="align-top">
                      {c.contactName && !c.contactDeleted ? (
                        <Link to={`/guests/${c.contactId}`} className="font-medium hover:underline">
                          {c.contactName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{contactLabel(c)}</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top whitespace-nowrap">{CHANGE_FIELD_LABELS[c.field] ?? c.field}</TableCell>
                    <TableCell className="max-w-72 align-top whitespace-normal text-muted-foreground">
                      {show(c, c.oldValue) ?? '–'}
                    </TableCell>
                    <TableCell className="max-w-72 align-top whitespace-normal">{show(c, c.newValue) ?? '–'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums">
              {formatCount(page * PAGE + 1)}–{formatCount(Math.min(shown.length, (page + 1) * PAGE))} of {formatCount(shown.length)}
            </span>
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MessageRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={5} className={`h-20 text-center text-muted-foreground ${className ?? ''}`}>
        {children}
      </TableCell>
    </TableRow>
  )
}
