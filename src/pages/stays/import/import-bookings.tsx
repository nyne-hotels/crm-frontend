import { ArrowLeftIcon, DownloadIcon, ExternalLinkIcon, InfoIcon, PencilIcon, TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Field, FormError } from '@/components/field'
import { ColumnMatchTable, FileDrop, ResultCount, Steps } from '@/components/import-wizard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompanyOptions, useOccasionOptions, usePropertyOptions } from '@/hooks/use-reference-data'
import { useImportHistory, useImportMutations, useImportSetup, type ImportRow } from '@/hooks/use-stays'
import { errorMessage } from '@/lib/api'
import { autoMatch, buildRows } from '@/lib/import-matching'
import { formatCount, formatDate, formatDateTime, plural } from '@/lib/format'
import { downloadCsv, downloadSheets, readSpreadsheet, type SpreadsheetData } from '@/lib/spreadsheet'
import { STAY_STATUS_LABELS } from '@/lib/stays'
import type { ImportFieldInfo, ImportOutcome, ImportPreview, ImportResult, ImportRowResult } from '@/lib/types'
import { cn } from '@/lib/utils'

const ALL_HOTELS = '__all'
const PREVIEW_PAGE = 100
const MAX_ROWS = 5000 // the API's limit too
const STEPS = ['Upload', 'Match columns', 'Preview', 'Result'] as const

const OUTCOME_LABELS: Record<ImportOutcome, string> = {
  new_guest: 'New guest + stay',
  existing_guest: 'Existing guest + stay',
  update: 'Update',
  error: 'Error',
  skipped: 'Skipped',
}

const OUTCOME_CLASSES: Record<ImportOutcome, string> = {
  new_guest: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  existing_guest: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  update: 'bg-secondary text-secondary-foreground',
  error: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  skipped: 'bg-muted text-muted-foreground',
}

interface LoadedFile {
  name: string
  data: SpreadsheetData
}

// Stays → Import bookings. The file is read in the browser; its rows go to
// the API with the columns already matched to CRM fields. Nothing is saved
// until step 3's Import button.
export function ImportBookingsPage() {
  const { data: setup } = useImportSetup()
  const { saveMapping, preview: previewRows, commit } = useImportMutations()
  const [step, setStep] = useState(0)
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<ImportRow[]>([])
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [skip, setSkip] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function loaded(next: LoadedFile) {
    setFile(next)
    setMapping(autoMatch(setup?.fields ?? [], next.data.headers, setup?.mapping ?? {}))
    setPreview(null)
    setSkip(new Set())
    setResult(null)
    setStep(1)
  }

  async function runPreview(nextRows: ImportRow[]) {
    setError(null)
    try {
      const result = await previewRows.mutateAsync({ fileName: file!.name, propertyId, rows: nextRows })
      setRows(nextRows)
      setPreview(result)
      setStep(2)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function matched() {
    // remembered for next time, whether or not this file is imported
    saveMapping.mutate(mapping)
    await runPreview(buildRows(file!.data, mapping))
  }

  async function runImport() {
    setError(null)
    try {
      const saved = await commit.mutateAsync({ fileName: file!.name, propertyId, rows, skip: [...skip] })
      setResult(saved)
      setStep(3)
      toast.success(`Imported: ${plural(saved.added, 'stay')} added, ${formatCount(saved.updated)} updated`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  function restart() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setRows([])
    setSkip(new Set())
    setError(null)
    setStep(0)
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6">
      <Link to="/stays" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Stays
      </Link>
      <div className="grid gap-3">
        <h1 className="font-heading text-2xl font-semibold">Import bookings</h1>
        <Steps steps={STEPS} current={step} />
      </div>
      <FormError message={error} />

      {step === 0 && (
        <>
          <UploadStep propertyId={propertyId} onPropertyChange={setPropertyId} onLoaded={loaded} ready={!!setup} />
          <ImportHistory />
        </>
      )}
      {step === 1 && file && setup && (
        <MatchStep
          file={file}
          fields={setup.fields}
          mapping={mapping}
          onChange={setMapping}
          hotelPicked={!!propertyId}
          busy={previewRows.isPending}
          onBack={restart}
          onNext={matched}
        />
      )}
      {step === 2 && preview && (
        <PreviewStep
          preview={preview}
          rows={rows}
          fields={setup?.fields ?? []}
          skip={skip}
          onSkipChange={setSkip}
          busy={commit.isPending || previewRows.isPending}
          onFix={(index, values) => runPreview(rows.map((r, i) => (i === index ? values : r)))}
          onBack={() => setStep(1)}
          onImport={runImport}
        />
      )}
      {step === 3 && result && file && <ResultStep result={result} file={file} onAgain={restart} />}
    </div>
  )
}

// =====================================================================
// Step 1 – upload
// =====================================================================
function UploadStep({
  propertyId,
  onPropertyChange,
  onLoaded,
  ready,
}: {
  propertyId: string | null
  onPropertyChange: (id: string | null) => void
  onLoaded: (file: LoadedFile) => void
  ready: boolean
}) {
  const { data: setup } = useImportSetup()
  const { data: hotels = [] } = usePropertyOptions()
  const { data: occasions = [] } = useOccasionOptions()
  const { data: companies = [] } = useCompanyOptions()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload the booking file</CardTitle>
        <CardDescription>Export the bookings from the booking system as a spreadsheet. Nothing is saved until you click Import.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FileGuide />
        <div>
          <Button
            variant="outline"
            disabled={!setup}
            onClick={() =>
              setup &&
              downloadSheets('Nyne CRM - booking import example.xlsx', exampleSheets(setup.fields, hotels, occasions, companies))
            }
          >
            <DownloadIcon /> Download an example file
          </Button>
        </div>
        <Field label="Hotel" htmlFor="import-hotel" hint="Pick a hotel if the whole file is for one hotel and has no hotel column.">
          <Select value={propertyId ?? ALL_HOTELS} onValueChange={(v) => onPropertyChange(v === ALL_HOTELS ? null : v)}>
            <SelectTrigger id="import-hotel" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_HOTELS}>The file has a hotel column</SelectItem>
              {hotels.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  Only {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <FileDrop
          hint={`.xlsx, .xls or .csv, up to ${formatCount(MAX_ROWS)} bookings`}
          disabled={!ready}
          onFile={async (file) => onLoaded({ name: file.name, data: await readSpreadsheet(file) })}
        />
      </CardContent>
    </Card>
  )
}

const FILE_NEEDS = [
  'One row per booking, on the first sheet. Title lines above the headings are fine.',
  'Every row needs a booking reference, an arrival date and a departure date, and a guest name, email or phone.',
  'A hotel for every row: a Hotel column (the hotel name or its ID, e.g. P02), or pick the hotel above if the whole file is for one hotel.',
  'The headings don’t have to match the example. In the next step you pair each column with a CRM field; common headings are paired for you, and the CRM remembers your choice for the next file.',
  `Up to ${formatCount(MAX_ROWS)} bookings per file. Split a bigger export into several files.`,
]

const HOW_READ = [
  'Dates: 21/10/2026, 2026-10-21, 21 Oct 2026 or Excel date cells. Numbers are read day first, as in Sri Lanka.',
  'Room revenue needs a currency: a Currency column (USD, LKR …) or in the same cell, like “USD 450”.',
  'Status: Confirmed, Checked in, Checked out, Cancelled or No show (and similar words). A status the CRM doesn’t know stops that row.',
  'Phone numbers without a country code are read as from the guest’s country, else Sri Lanka.',
  'Guests are found by email, then phone, never by name. Anyone not found becomes a new guest.',
  'Importing the same booking reference for the same hotel again updates that stay instead of adding it twice.',
]

// "What the file needs" and "How values are read", above the file drop.
function FileGuide() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border bg-muted/30 p-4">
        <h2 className="mb-2 flex items-center gap-2 font-medium">
          <InfoIcon className="size-4 text-muted-foreground" /> What the file needs
        </h2>
        <ul className="grid list-disc gap-1.5 pl-5 text-sm">
          {FILE_NEEDS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
      <section className="rounded-lg border bg-muted/30 p-4">
        <h2 className="mb-2 flex items-center gap-2 font-medium">
          <InfoIcon className="size-4 text-muted-foreground" /> How values are read
        </h2>
        <ul className="grid list-disc gap-1.5 pl-5 text-sm">
          {HOW_READ.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// The example file: two made-up bookings under the CRM's own field names (so
// step 2 pairs every column), a Columns tab saying what goes in each, and the
// hotels, statuses, channels, occasions and agents the CRM knows. The first
// booking fills every column; the second leaves the optional ones out and
// shows other date, money and phone styles.
const EXAMPLE_ROWS: Record<string, string>[] = [
  {
    bookingReference: 'RES-10482',
    arrivalDate: '20/12/2026',
    departureDate: '24/12/2026',
    guestName: 'Mr John Smith',
    email: 'john.smith@example.com',
    phone: '+44 7911 123456',
    country: 'United Kingdom',
    adults: '2',
    children: '1',
    roomType: 'Deluxe Double',
    roomRevenue: '850',
    currency: 'USD',
    channel: 'Travel agent',
    status: 'Confirmed',
    marketingConsent: 'Yes',
    specialRequests: 'Late check-in',
    bookedAt: '01/10/2026 14:20',
  },
  {
    bookingReference: 'RES-10517',
    arrivalDate: '2027-01-21',
    departureDate: '2027-01-25',
    guestName: 'Anjali Perera',
    phone: '077 123 4567',
    country: 'Sri Lanka',
    adults: '2',
    children: '0',
    roomType: 'Garden Villa',
    roomRevenue: 'LKR 120000',
    channel: 'Website',
    status: 'Confirmed',
    bookedAt: '15 Oct 2026',
  },
]

// What to write in each column, for the Columns tab. A field without an
// entry here falls back to its hint from the API.
const COLUMN_HELP: Record<string, string> = {
  bookingReference: 'The reservation or confirmation number from the booking system. A booking imported again is found by it.',
  hotel: 'The hotel’s name or ID, as on the Allowed values tab.',
  arrivalDate: 'The check-in date: 20/12/2026, 2026-12-20 or 20 Dec 2026. Numbers are read day first.',
  departureDate: 'The check-out date, written the same way. Not before the arrival.',
  guestName: 'The guest’s full name. Titles (Mr, Mrs, Dr) are dropped; “Smith, John” works too.',
  firstName: 'Instead of Guest name (full): the first name on its own.',
  lastName: 'Instead of Guest name (full): the surname on its own.',
  email: 'The guest’s email address. A guest already in the CRM is found by it.',
  phone: 'With the country code (+44 7911 123456). Without one, it’s read as from the guest’s country, else Sri Lanka.',
  country: 'Where the guest lives: the country name or its 2-letter code (United Kingdom, GB, UK).',
  adults: 'The number of adults, e.g. 2.',
  children: 'The number of children, 0 if none.',
  roomType: 'The room as the booking system names it, e.g. Deluxe Double.',
  roomRevenue: 'The amount for the stay, e.g. 850 or 1,250.50. The currency can be in the same cell: USD 850.',
  currency: 'A 3-letter code: USD, EUR, GBP, LKR … Needed with the revenue, unless it is in the revenue cell.',
  channel: 'How it was booked: Direct, Travel agent, OTA, Owner guest, Website or Walk-in. Other words are saved as unknown.',
  agent: 'The travel agent, DMC or OTA, as named on the Allowed values tab. A name the CRM doesn’t have is left blank.',
  occasion: 'Why they are staying, as on the Allowed values tab (e.g. Honeymoon). Others are left blank.',
  status: 'Confirmed, Checked in, Checked out, Cancelled or No show. Empty means confirmed.',
  marketingConsent: 'Yes if the guest ticked the marketing box: they are opted in to email. Empty or No changes nothing.',
  specialRequests: 'Remarks for the stay, e.g. Late check-in. Importing the booking again replaces them.',
  bookedAt: 'When the booking was made, with or without a time: 01/10/2026 14:20. Used as the date of a marketing opt-in.',
}

const GUEST_KEYS = ['guestName', 'firstName', 'lastName', 'email', 'phone']

function exampleSheets(
  fields: ImportFieldInfo[],
  hotels: { id: string; name: string }[],
  occasions: { name: string }[],
  companies: { name: string; companyType: string }[],
) {
  // one name column is enough; First name / Last name are the alternative
  const columns = fields.filter((f) => f.key !== 'firstName' && f.key !== 'lastName')
  // the CRM's own names where it has them, so the example imports without warnings
  const agent = companies.find((c) => c.companyType !== 'corporate' && c.companyType !== 'media') ?? companies[0]
  const value = (row: Record<string, string>, i: number, key: string) => {
    if (key === 'hotel') return hotels[i % Math.max(1, hotels.length)]?.name ?? 'Your hotel'
    if (i === 0 && key === 'agent') return agent?.name ?? 'Example Travels'
    if (i === 0 && key === 'occasion') return occasions[0]?.name ?? 'Honeymoon'
    return row[key] ?? ''
  }
  const needed = (f: ImportFieldInfo) =>
    f.required
      ? 'Required'
      : f.key === 'hotel'
        ? 'Required, unless you pick the hotel when uploading'
        : GUEST_KEYS.includes(f.key)
          ? 'At least one of name, email or phone'
          : 'Optional'
  const example = (key: string) =>
    key === 'firstName' ? 'John' : key === 'lastName' ? 'Smith' : value(EXAMPLE_ROWS[0], 0, key)

  const lists: [string, string[]][] = [
    ['Hotel', hotels.map((h) => h.name)],
    ['Hotel ID', hotels.map((h) => h.id)],
    ['Booking status', ['Confirmed', 'Checked in', 'Checked out', 'Cancelled', 'No show']],
    ['Channel', ['Direct', 'Travel agent', 'OTA', 'Owner guest', 'Website', 'Walk-in']],
    ['Marketing tick box', ['Yes', '(empty: no change)']],
    ['Occasion', occasions.map((o) => o.name)],
    ['Agent or OTA', companies.map((c) => c.name)],
  ]
  const longest = Math.max(...lists.map(([, values]) => values.length))
  return [
    {
      name: 'Bookings',
      headers: columns.map((f) => f.label),
      rows: EXAMPLE_ROWS.map((row, i) => columns.map((f) => value(row, i, f.key))),
      widths: columns.map((f) => Math.max(14, f.label.length + 2)),
    },
    {
      name: 'Columns',
      headers: ['Column', 'Needed?', 'What to write', 'Example'],
      rows: fields.map((f) => [f.label, needed(f), COLUMN_HELP[f.key] ?? f.hint ?? '', example(f.key)]),
      widths: [20, 30, 90, 24],
    },
    {
      name: 'Allowed values',
      headers: lists.map(([name]) => name),
      rows: Array.from({ length: longest }, (_, i) => lists.map(([, values]) => values[i] ?? '')),
      widths: [28, 10, 16, 14, 20, 20, 30],
    },
  ]
}

// =====================================================================
// Step 2 – match columns
// =====================================================================
function MatchStep({
  file,
  fields,
  mapping,
  onChange,
  hotelPicked,
  busy,
  onBack,
  onNext,
}: {
  file: LoadedFile
  fields: ImportFieldInfo[]
  mapping: Record<string, string>
  onChange: (mapping: Record<string, string>) => void
  hotelPicked: boolean
  busy: boolean
  onBack: () => void
  onNext: () => void
}) {
  const used = new Set(Object.values(mapping))
  const unmatched = file.data.headers.filter((h) => !used.has(h))

  const problems: string[] = []
  for (const f of fields) if (f.required && !mapping[f.key]) problems.push(`Match a column to ${f.label}.`)
  if (!mapping.hotel && !hotelPicked) problems.push('Match the Hotel column, or go back and pick the hotel for the file.')
  if (!['guestName', 'firstName', 'lastName', 'email', 'phone'].some((k) => mapping[k])) {
    problems.push('Match at least one guest column: name, email or phone.')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match the columns</CardTitle>
        <CardDescription>
          {file.name}: {plural(file.data.rows.length, 'booking')}, {plural(file.data.headers.length, 'column')}. Pair each CRM
          field with a column in the file; the CRM remembers this for next time.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ColumnMatchTable fields={fields} data={file.data} mapping={mapping} onChange={onChange} />
        {mapping.guestName && (mapping.firstName || mapping.lastName) && (
          <p className="text-sm text-muted-foreground">First name and Last name are used; Guest name (full) is ignored.</p>
        )}
        {unmatched.length > 0 && (
          <p className="text-sm text-muted-foreground">Not imported: {unmatched.join(', ')}.</p>
        )}
        {problems.length > 0 && (
          <ul className="grid gap-1 text-sm text-destructive">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={onBack} disabled={busy}>
            Choose another file
          </Button>
          <Button onClick={onNext} disabled={busy || problems.length > 0}>
            {busy ? 'Checking every row…' : 'Preview'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// =====================================================================
// Step 3 – preview
// =====================================================================
function PreviewStep({
  preview,
  rows,
  fields,
  skip,
  onSkipChange,
  busy,
  onFix,
  onBack,
  onImport,
}: {
  preview: ImportPreview
  rows: ImportRow[]
  fields: ImportFieldInfo[]
  skip: Set<number>
  onSkipChange: (skip: Set<number>) => void
  busy: boolean
  onFix: (index: number, values: ImportRow) => Promise<void>
  onBack: () => void
  onImport: () => void
}) {
  const [filter, setFilter] = useState<ImportOutcome | 'all'>('all')
  const [page, setPage] = useState(0)
  const [fixing, setFixing] = useState<number | null>(null)

  const shown = preview.rows.filter((r) => filter === 'all' || r.outcome === filter)
  const pageRows = shown.slice(page * PREVIEW_PAGE, (page + 1) * PREVIEW_PAGE)
  const pages = Math.max(1, Math.ceil(shown.length / PREVIEW_PAGE))
  const importable = preview.rows.filter((r) => r.outcome !== 'error' && !skip.has(r.index))
  const willAddGuests = new Set(importable.map((r) => r.guest?.newKey).filter((k) => k != null)).size

  function toggle(index: number, include: boolean) {
    const next = new Set(skip)
    if (include) next.delete(index)
    else next.add(index)
    onSkipChange(next)
  }

  const filters: (ImportOutcome | 'all')[] = ['all', 'new_guest', 'existing_guest', 'update', 'error']

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check before saving</CardTitle>
        <CardDescription>
          Every row has been checked against the CRM; nothing is saved yet. Untick a row to skip it, fix error rows, or open a
          matched guest to check them.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by outcome">
          {filters.map((f) => {
            const n = f === 'all' ? preview.rows.length : preview.counts[f]
            if (f !== 'all' && n === 0) return null
            return (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'default' : 'outline'}
                aria-pressed={filter === f}
                onClick={() => {
                  setFilter(f)
                  setPage(0)
                }}
              >
                {f === 'all' ? 'All rows' : OUTCOME_LABELS[f]}
                <span className={cn('tabular-nums', filter === f ? 'opacity-80' : 'text-muted-foreground')}>{formatCount(n)}</span>
              </Button>
            )
          })}
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <span className="sr-only">Import</span>
                </TableHead>
                <TableHead className="w-12 text-right">Row</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Hotel</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Booking ref</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-64">Notes</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-20 text-center text-muted-foreground">
                    No rows.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => (
                  <PreviewRow
                    key={r.index}
                    row={r}
                    included={r.outcome !== 'error' && !skip.has(r.index)}
                    onInclude={(include) => toggle(r.index, include)}
                    onFix={() => setFixing(r.index)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums">
              Rows {formatCount(page * PREVIEW_PAGE + 1)}–{formatCount(Math.min(shown.length, (page + 1) * PREVIEW_PAGE))} of{' '}
              {formatCount(shown.length)}
            </span>
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button variant="outline" onClick={onBack} disabled={busy}>
            Back to columns
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {plural(importable.length, 'booking')} to import
              {willAddGuests > 0 && `, ${plural(willAddGuests, 'new guest')}`}
              {preview.counts.error > 0 && ` · ${plural(preview.counts.error, 'error row')} left out`}
            </span>
            <Button onClick={onImport} disabled={busy || importable.length === 0}>
              {busy ? 'Saving…' : `Import ${plural(importable.length, 'booking')}`}
            </Button>
          </div>
        </div>
      </CardContent>

      <FixRowDialog
        index={fixing}
        row={fixing != null ? rows[fixing] : null}
        result={fixing != null ? preview.rows[fixing] : null}
        fields={fields}
        onOpenChange={(open) => !open && setFixing(null)}
        onSave={async (values) => {
          await onFix(fixing!, values)
          setFixing(null)
        }}
      />
    </Card>
  )
}

function PreviewRow({
  row,
  included,
  onInclude,
  onFix,
}: {
  row: ImportRowResult
  included: boolean
  onInclude: (include: boolean) => void
  onFix: () => void
}) {
  const s = row.summary
  const isError = row.outcome === 'error'
  return (
    <TableRow className={cn(!included && 'text-muted-foreground')}>
      <TableCell>
        <Checkbox
          checked={included}
          disabled={isError}
          onCheckedChange={(c) => onInclude(c === true)}
          aria-label={`Import row ${row.index + 1}`}
        />
      </TableCell>
      <TableCell className="text-right tabular-nums">{row.index + 1}</TableCell>
      <TableCell>
        <Badge className={cn('border-transparent', OUTCOME_CLASSES[included || isError ? row.outcome : 'skipped'])}>
          {OUTCOME_LABELS[included || isError ? row.outcome : 'skipped']}
        </Badge>
      </TableCell>
      <TableCell className="max-w-52">
        {row.guest?.id ? (
          <a
            href={`/guests/${row.guest.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1 truncate font-medium hover:underline"
            title="Open this guest in a new tab"
          >
            <span className="truncate">{row.guest.name}</span>
            <ExternalLinkIcon className="size-3 shrink-0" />
          </a>
        ) : (
          <span className="block truncate">{row.guest?.name || s.guest || '–'}</span>
        )}
        <span className="block truncate text-xs text-muted-foreground">{s.email ?? s.phone}</span>
      </TableCell>
      <TableCell className="whitespace-nowrap">{s.hotel}</TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        {s.arrival ? `${formatDate(s.arrival)} – ${formatDate(s.departure)}` : ''}
      </TableCell>
      <TableCell className="font-mono text-xs whitespace-nowrap">{s.reference}</TableCell>
      <TableCell className="whitespace-nowrap">{s.status ? STAY_STATUS_LABELS[s.status] : ''}</TableCell>
      <TableCell className="text-xs whitespace-normal">
        <ul className="grid gap-0.5">
          {row.errors.map((e) => (
            <li key={e} className="text-destructive">
              {e}
            </li>
          ))}
          {row.warnings.map((w) => (
            <li key={w} className="text-amber-700 dark:text-amber-400">
              {w}
            </li>
          ))}
        </ul>
      </TableCell>
      <TableCell>
        {isError && (
          <Button variant="ghost" size="icon" className="size-8" onClick={onFix} aria-label={`Fix row ${row.index + 1}`}>
            <PencilIcon />
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

// Edit an error row's values here instead of in the file; the whole file is
// checked again afterwards (a fix can change other rows, e.g. a duplicate).
function FixRowDialog({
  index,
  row,
  result,
  fields,
  onOpenChange,
  onSave,
}: {
  index: number | null
  row: ImportRow | null
  result: ImportRowResult | null
  fields: ImportFieldInfo[]
  onOpenChange: (open: boolean) => void
  onSave: (values: ImportRow) => Promise<void>
}) {
  return (
    <Dialog open={index != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fix row {index != null ? index + 1 : ''}</DialogTitle>
          <DialogDescription>Changes apply to this import only, not to the file.</DialogDescription>
        </DialogHeader>
        {row && result && <FixRowForm row={row} result={result} fields={fields} onCancel={() => onOpenChange(false)} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  )
}

function FixRowForm({
  row,
  result,
  fields,
  onCancel,
  onSave,
}: {
  row: ImportRow
  result: ImportRowResult
  fields: ImportFieldInfo[]
  onCancel: () => void
  onSave: (values: ImportRow) => Promise<void>
}) {
  const [values, setValues] = useState<ImportRow>(row)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // the matched fields, plus Hotel and Booking reference, which errors often need
  const keys = fields.filter((f) => f.key in row || f.key === 'hotel' || f.key === 'bookingReference')

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          await onSave(values)
        } catch (err) {
          setError(errorMessage(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <ul className="grid gap-1 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {result.errors.map((e) => (
          <li key={e} className="flex gap-2">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" /> {e}
          </li>
        ))}
      </ul>
      <FormError message={error} />
      {keys.map((f) => (
        <Field key={f.key} label={f.label} htmlFor={`fix-${f.key}`} hint={f.key === 'hotel' ? 'The hotel name or its ID, e.g. P02' : undefined}>
          <Input
            id={`fix-${f.key}`}
            value={values[f.key] ?? ''}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
          />
        </Field>
      ))}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Save and check again'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// =====================================================================
// Step 4 – result
// =====================================================================
function ResultStep({ result, file, onAgain }: { result: ImportResult; file: LoadedFile; onAgain: () => void }) {
  const errorRows = result.rows.filter((r) => r.outcome === 'error')

  function downloadErrors() {
    downloadCsv(
      file.name.replace(/\.[^.]+$/, '') + ' - not imported.csv',
      [...file.data.headers, 'Why it was not imported'],
      errorRows.map((r) => [...file.data.rows[r.index], r.errors.join('; ')]),
    )
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Import finished</CardTitle>
          <CardDescription>{file.name}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <dl className="grid grid-cols-3 gap-4 sm:max-w-lg">
            <ResultCount label="Added">{result.added}</ResultCount>
            <ResultCount label="Updated">{result.updated}</ResultCount>
            <ResultCount label="Skipped">{result.skipped}</ResultCount>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/stays">Go to stays</Link>
            </Button>
            <Button variant="outline" onClick={onAgain}>
              Import another file
            </Button>
            {errorRows.length > 0 && (
              <Button variant="outline" onClick={downloadErrors}>
                <DownloadIcon /> Download {plural(errorRows.length, 'error row')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {result.doNotContact.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TriangleAlertIcon className="size-4 text-amber-600" /> Opted in while on do not contact
            </CardTitle>
            <CardDescription>
              These guests ticked the marketing box but are marked do not contact, so they stay off the email list. Confirm
              with each guest before clearing it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GuestLinks guests={result.doNotContact} />
          </CardContent>
        </Card>
      )}

      {result.leadsBooked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Leads booked ({formatCount(result.leadsBooked.length)})</CardTitle>
            <CardDescription>
              These guests had an open lead at the same hotel (or with no hotel), so it is now booked and linked to the new stay.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GuestLinks guests={result.leadsBooked} to={(id) => `/leads/${id}`} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New guests created ({formatCount(result.newGuests.length)})</CardTitle>
          <CardDescription>
            No existing guest had their email or phone. Check them for duplicates, e.g. the same person under another email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result.newGuests.length ? <GuestLinks guests={result.newGuests} /> : <p className="text-sm text-muted-foreground">None.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

function GuestLinks({
  guests,
  to = (id) => `/guests/${id}`,
}: {
  guests: { id: number; name: string }[]
  to?: (id: number) => string
}) {
  return (
    <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {guests.map((g) => (
        <li key={g.id} className="truncate">
          <Link to={to(g.id)} className="underline-offset-4 hover:underline">
            {g.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}

// =====================================================================
// Import history
// =====================================================================
function ImportHistory() {
  const { data = [], isPending } = useImportHistory()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import history</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files imported yet.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imported</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Added</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                  <TableHead className="text-right">New guests</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(h.importedAt)}</TableCell>
                    <TableCell className="max-w-64">
                      <span className="block truncate" title={h.fileName}>
                        {h.fileName}
                      </span>
                      {h.hotel && <span className="text-xs text-muted-foreground">{h.hotel}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{h.importedBy ?? 'System'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(h.rowsTotal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(h.added)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(h.updated)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(h.skipped)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(h.newGuests)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
