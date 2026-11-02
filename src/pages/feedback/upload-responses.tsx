import { ArrowLeftIcon, DownloadIcon, FileSpreadsheetIcon, UploadIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Field, FormError } from '@/components/field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useFeedbackMutations } from '@/hooks/use-feedback'
import { errorMessage } from '@/lib/api'
import { firstLine, matchColumns, RESPONSE_FIELDS, rowsFor, stayDates } from '@/lib/feedback'
import { formatCount, formatDate, fullName, plural } from '@/lib/format'
import type { ResponseUpload, ResponseUploadRow, UploadOutcome } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Stars } from './feedback-badges'

const PREVIEW_ROWS = 300
const NOT_USED = 'none'
type FieldKey = (typeof RESPONSE_FIELDS)[number]['key']
type Columns = Partial<Record<FieldKey, number>>

interface LoadedFile {
  name: string
  headers: string[]
  rows: string[][]
}

const OUTCOME_LABELS: Record<UploadOutcome, string> = {
  new: 'Will be saved',
  exists: 'Already has a response',
  unmatched: 'No stay found',
  error: 'Problem',
}

// What's missing before the file can be checked.
function missing(columns: Columns) {
  if (columns.bookingReference === undefined && columns.email === undefined) return 'Choose the booking reference or the email column'
  if (columns.rating === undefined && columns.review === undefined) return 'Choose the rating or the review column'
  return null
}

// Feedback → Upload responses: a file exported from the form tool. Each row
// is matched to its stay by booking reference (or the guest's email); the
// preview shows which stay each matched and which could not be matched.
// Nothing is saved until Save.
export function UploadResponsesPage() {
  const { previewUpload, upload } = useFeedbackMutations()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [columns, setColumns] = useState<Columns>({})
  const [preview, setPreview] = useState<ResponseUpload | null>(null)
  const [result, setResult] = useState<ResponseUpload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)

  async function check(loaded: LoadedFile, cols: Columns) {
    setPreview(null)
    const problem = missing(cols)
    if (problem) return setError(problem)
    setError(null)
    try {
      setPreview(await previewUpload.mutateAsync(rowsFor(loaded.rows, cols) as Record<string, string>[]))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function read(chosen: File | undefined) {
    if (!chosen) return
    setError(null)
    if (!/\.(xlsx|xls|csv)$/i.test(chosen.name)) return setError('Choose a spreadsheet: .xlsx, .xls or .csv.')
    setReading(true)
    try {
      // SheetJS is large, so it loads only when a file is chosen
      const { readSpreadsheet } = await import('@/lib/spreadsheet')
      const sheet = await readSpreadsheet(chosen)
      const loaded = { name: chosen.name, headers: sheet.headers, rows: sheet.rows }
      const found = matchColumns(RESPONSE_FIELDS, sheet.headers)
      setFile(loaded)
      setColumns(found)
      setResult(null)
      await check(loaded, found)
    } catch (err) {
      setError(err instanceof Error ? err.message.replace('no bookings', 'no responses') : "Couldn't read that file.")
    } finally {
      setReading(false)
      if (input.current) input.current.value = ''
    }
  }

  async function save() {
    if (!file) return
    setError(null)
    try {
      const saved = await upload.mutateAsync(rowsFor(file.rows, columns) as Record<string, string>[])
      setResult(saved)
      setPreview(null)
      toast.success(`${plural(saved.counts.new, 'response')} saved`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  function restart() {
    setFile(null)
    setColumns({})
    setPreview(null)
    setResult(null)
    setError(null)
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <Link to="/feedback" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Feedback
      </Link>
      <h1 className="font-heading text-2xl font-semibold">Upload responses</h1>
      <FormError message={error} />

      {result && file ? (
        <ResultCard result={result} file={file} onAgain={restart} />
      ) : !file ? (
        <Card>
          <CardHeader>
            <CardTitle>The file from the form tool</CardTitle>
            <CardDescription>
              Export the responses as a spreadsheet. Each needs a booking reference (or the guest's email) to find the stay,
              and a rating, a review or both.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                read(e.dataTransfer.files[0])
              }}
              className={cn(
                'grid place-items-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
                dragging && 'border-primary bg-primary/5',
              )}
            >
              <FileSpreadsheetIcon className="size-10 text-muted-foreground" />
              <div className="grid gap-1">
                <p className="font-medium">Drop the responses file here</p>
                <p className="text-sm text-muted-foreground">.xlsx, .xls or .csv; the columns are matched by their headings</p>
              </div>
              <Button type="button" variant="outline" disabled={reading} onClick={() => input.current?.click()}>
                <UploadIcon /> {reading ? 'Reading…' : 'Choose file'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Match the columns</CardTitle>
              <CardDescription>
                {file.name} · {plural(file.rows.length, 'row')}. Check each field reads the right column.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {RESPONSE_FIELDS.map((f) => (
                  <Field key={f.key} label={f.label} htmlFor={`col-${f.key}`} hint={f.hint}>
                    <Select
                      value={columns[f.key] !== undefined ? String(columns[f.key]) : NOT_USED}
                      onValueChange={(v) => {
                        const next = { ...columns, [f.key]: v === NOT_USED ? undefined : Number(v) }
                        setColumns(next)
                        check(file, next)
                      }}
                    >
                      <SelectTrigger id={`col-${f.key}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NOT_USED}>Not in the file</SelectItem>
                        {file.headers.map((h, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={save} disabled={!preview || preview.counts.new === 0 || upload.isPending}>
                  {upload.isPending
                    ? 'Saving…'
                    : preview
                      ? preview.counts.new
                        ? `Save ${plural(preview.counts.new, 'response')}`
                        : 'Nothing to save'
                      : previewUpload.isPending
                        ? 'Checking…'
                        : 'Save'}
                </Button>
                <Button variant="outline" onClick={restart} disabled={upload.isPending}>
                  Choose another file
                </Button>
              </div>
            </CardContent>
          </Card>
          {preview && <RowsCard upload={preview} file={file} saved={false} />}
        </>
      )}
      <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="sr-only" tabIndex={-1} onChange={(e) => read(e.target.files?.[0])} />
    </div>
  )
}

function ResultCard({ result, file, onAgain }: { result: ResponseUpload; file: LoadedFile; onAgain: () => void }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Responses saved</CardTitle>
          <CardDescription>{file.name}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/feedback?tab=needs_follow_up">Go to Needs follow-up</Link>
          </Button>
          <Button variant="outline" onClick={onAgain}>
            Upload another file
          </Button>
        </CardContent>
      </Card>
      <RowsCard upload={result} file={file} saved />
    </>
  )
}

// The counts and every row, with the stay it matched or why it won't be saved.
function RowsCard({ upload, file, saved }: { upload: ResponseUpload; file: LoadedFile; saved: boolean }) {
  const [show, setShow] = useState<UploadOutcome | 'all'>('all')
  const rows = upload.rows.filter((r) => show === 'all' || r.outcome === show)
  const notSaved = upload.rows.filter((r) => r.outcome !== 'new')

  async function download() {
    const { downloadCsv } = await import('@/lib/spreadsheet')
    downloadCsv(
      file.name.replace(/\.[^.]+$/, '') + ' - not saved.csv',
      ['Row', ...file.headers, 'Why'],
      notSaved.map((r) => [String(r.row), ...file.rows[r.row - 1], r.problem ?? '']),
    )
  }

  const tabs: { key: UploadOutcome | 'all'; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: upload.total },
    { key: 'new', label: saved ? 'Saved' : 'To save', count: upload.counts.new },
    { key: 'exists', label: 'Already on file', count: upload.counts.exists },
    { key: 'unmatched', label: 'No stay found', count: upload.counts.unmatched },
    { key: 'error', label: 'Problems', count: upload.counts.error },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Show" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={show === t.key}
              onClick={() => setShow(t.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground hover:text-foreground',
                show === t.key && 'bg-background text-foreground shadow-sm',
              )}
            >
              {t.label} <span className="text-xs tabular-nums">{formatCount(t.count)}</span>
            </button>
          ))}
        </div>
        {notSaved.length > 0 && (
          <Button variant="outline" size="sm" onClick={download}>
            <DownloadIcon /> Download the rows not {saved ? 'saved' : 'to be saved'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Row</TableHead>
                <TableHead>Stay</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="w-full min-w-48">Review</TableHead>
                <TableHead>Received</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, PREVIEW_ROWS).map((r) => (
                <UploadRow key={r.row} row={r} />
              ))}
            </TableBody>
          </Table>
        </div>
        {rows.length > PREVIEW_ROWS && (
          <p className="text-sm text-muted-foreground">
            Showing the first {formatCount(PREVIEW_ROWS)} of {formatCount(rows.length)} rows.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function UploadRow({ row: r }: { row: ResponseUploadRow }) {
  return (
    <TableRow className={r.outcome === 'new' ? undefined : 'text-muted-foreground'}>
      <TableCell className="tabular-nums">{r.row}</TableCell>
      <TableCell className="max-w-64">
        {r.stay ? (
          <span className="grid">
            <Link to={`/guests/${r.stay.contactId}`} target="_blank" className="truncate font-medium underline-offset-4 hover:underline">
              {fullName(r.stay) || `Guest #${r.stay.contactId}`}
            </Link>
            <span className="truncate text-xs text-muted-foreground">
              {r.stay.hotel} · {stayDates(r.stay)}
              {r.stay.bookingReference && ` · ${r.stay.bookingReference}`}
            </span>
          </span>
        ) : (
          <span className="truncate">{r.raw.bookingReference || r.raw.email || '–'}</span>
        )}
      </TableCell>
      <TableCell>{r.rating !== null ? <Stars rating={r.rating} /> : <span className="text-xs">{r.raw.rating || ''}</span>}</TableCell>
      <TableCell className="max-w-0">
        <span className="block truncate">{firstLine(r.review)}</span>
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">{r.submittedAt ? formatDate(r.submittedAt) : ''}</TableCell>
      <TableCell className="text-right">
        {r.outcome === 'new' ? (
          r.stay?.feedbackId ? (
            <Link to={`/feedback/${r.stay.feedbackId}`} className="text-sm underline-offset-4 hover:underline">
              Open
            </Link>
          ) : (
            <Badge variant="outline">{OUTCOME_LABELS.new}</Badge>
          )
        ) : (
          <span className={cn('text-xs', r.outcome !== 'exists' && 'text-destructive')} title={r.problem ?? undefined}>
            {r.outcome === 'exists' && r.stay?.feedbackId ? (
              <Link to={`/feedback/${r.stay.feedbackId}`} className="underline-offset-4 hover:underline">
                {OUTCOME_LABELS.exists}
              </Link>
            ) : (
              r.problem
            )}
          </span>
        )}
      </TableCell>
    </TableRow>
  )
}
