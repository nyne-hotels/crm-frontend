import { DownloadIcon, FileSpreadsheetIcon, InfoIcon, MailMinusIcon, MailWarningIcon, UploadIcon, type LucideIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { FormError } from '@/components/field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMarketingMutations } from '@/hooks/use-marketing'
import { errorMessage } from '@/lib/api'
import { emailsFromGrid } from '@/lib/consent'
import { formatCount, fullName, plural } from '@/lib/format'
import type { UploadKind, UploadPreview, UploadResult } from '@/lib/types'
import { cn } from '@/lib/utils'

const PREVIEW_ROWS = 200

const KINDS: Record<UploadKind, { label: string; icon: LucideIcon; description: string }> = {
  unsubscribes: {
    label: 'Unsubscribes',
    icon: MailMinusIcon,
    description: 'Every guest with one of these emails is opted out of email marketing (source: email unsubscribe).',
  },
  bounces: {
    label: 'Bounces',
    icon: MailWarningIcon,
    description: 'These email addresses are marked bounced and drop off the email list.',
  },
}

interface LoadedFile {
  name: string
  column: string // the column the emails were read from
  emails: string[]
}

// Marketing → Upload unsubscribes or bounces: the file from the email tool.
// The emails are read in the browser; nothing changes until Confirm.
export function EmailUploadsPage() {
  const { previewUpload, upload } = useMarketingMutations()
  const [kind, setKind] = useState<UploadKind>('unsubscribes')
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [preview, setPreview] = useState<UploadPreview | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loaded(next: LoadedFile) {
    setError(null)
    try {
      setPreview(await previewUpload.mutateAsync({ kind, emails: next.emails }))
      setFile(next)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function confirm() {
    setError(null)
    try {
      const saved = await upload.mutateAsync({ kind, emails: file!.emails, fileName: file!.name })
      setResult(saved)
      toast.success(
        saved.kind === 'unsubscribes'
          ? `${plural(saved.updated, 'guest')} opted out`
          : `${plural(saved.updated, 'email')} marked bounced`,
      )
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  function restart() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
  }

  return (
    <div className="grid gap-6">
      <FormError message={error} />
      {result && file ? (
        <ResultCard result={result} file={file} onAgain={restart} />
      ) : preview && file ? (
        <PreviewCard preview={preview} file={file} busy={upload.isPending} onBack={restart} onConfirm={confirm} />
      ) : (
        <UploadCard kind={kind} onKindChange={setKind} busy={previewUpload.isPending} onLoaded={loaded} />
      )}
    </div>
  )
}

function UploadCard({
  kind,
  onKindChange,
  busy,
  onLoaded,
}: {
  kind: UploadKind
  onKindChange: (kind: UploadKind) => void
  busy: boolean
  onLoaded: (file: LoadedFile) => Promise<void>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function read(file: File | undefined) {
    if (!file) return
    setError(null)
    if (!/\.(xlsx|xls|csv|txt)$/i.test(file.name)) return setError('Choose a spreadsheet or text file: .xlsx, .xls, .csv or .txt.')
    setReading(true)
    try {
      // SheetJS is large, so it loads only when a file is chosen
      const { readGrid } = await import('@/lib/spreadsheet')
      const { column, emails } = emailsFromGrid(await readGrid(file))
      if (!emails.length) throw new Error('No email addresses found in the file.')
      await onLoaded({ name: file.name, column: column!, emails })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.")
    } finally {
      setReading(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload a list from the email tool</CardTitle>
        <CardDescription>Export the unsubscribes or bounces as a spreadsheet. You'll see what will change before anything is saved.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div role="radiogroup" aria-label="What the file holds" className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(KINDS) as UploadKind[]).map((k) => {
            const { label, icon: Icon, description } = KINDS[k]
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => onKindChange(k)}
                className={cn(
                  'grid gap-1 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  kind === k && 'border-primary bg-primary/5 ring-1 ring-primary',
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  <Icon className="size-4" /> {label}
                </span>
                <span className="text-sm text-muted-foreground">{description}</span>
              </button>
            )
          })}
        </div>
        <FormError message={error} />
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
            <p className="font-medium">Drop the {KINDS[kind].label.toLowerCase()} file here</p>
            <p className="text-sm text-muted-foreground">.xlsx, .xls, .csv or .txt; the column with the email addresses is found for you</p>
          </div>
          <Button type="button" variant="outline" disabled={reading || busy} onClick={() => input.current?.click()}>
            <UploadIcon /> {reading || busy ? 'Reading…' : 'Choose file'}
          </Button>
          <input
            ref={input}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => read(e.target.files?.[0])}
          />
        </div>
        <FileGuide kind={kind} />
      </CardContent>
    </Card>
  )
}

const FILE_RULES = [
  'The export straight from the email tool works as it is. No need to tidy it up first.',
  'Only the first sheet of an Excel file is read. Move the emails there if they are on another tab.',
  'The columns can be in any order, with any headings. The column with the most email addresses is used, so a "From" or "List" column is left out.',
  'The simplest file is one column of email addresses, one per row, with or without an "Email" heading. A .txt file with one address per line works too.',
  'Names around an address are dropped: "Ann Smith <ann@example.com>" is read as ann@example.com.',
]

// What the upload accepts, with an example file to start from.
function FileGuide({ kind }: { kind: UploadKind }) {
  async function downloadExample() {
    const { downloadCsv } = await import('@/lib/spreadsheet')
    downloadCsv(`Nyne CRM - ${KINDS[kind].label.toLowerCase()} example.csv`, ['Email'], [
      ['ann.smith@example.com'],
      ['j.perera@example.com'],
      ['bookings@example.co.uk'],
    ])
  }
  return (
    <section className="grid gap-3 rounded-lg border bg-muted/30 p-4">
      <h2 className="flex items-center gap-2 font-medium">
        <InfoIcon className="size-4 text-muted-foreground" /> What files work
      </h2>
      <ul className="grid list-disc gap-1.5 pl-5 text-sm">
        {FILE_RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={downloadExample}>
        <DownloadIcon /> Download an example file
      </Button>
    </section>
  )
}

function PreviewCard({
  preview,
  file,
  busy,
  onBack,
  onConfirm,
}: {
  preview: UploadPreview
  file: LoadedFile
  busy: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  const unsubscribing = preview.kind === 'unsubscribes'
  const action = unsubscribing ? `Opt out ${plural(preview.changes, 'guest')}` : `Mark ${plural(preview.changes, 'email')} bounced`
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Check the {KINDS[preview.kind].label.toLowerCase()}</CardTitle>
          <CardDescription>
            {file.name} · {plural(preview.total, 'email')} from the "{file.column}" column. Nothing is saved yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <dl className="grid grid-cols-2 gap-4 sm:max-w-2xl sm:grid-cols-4">
            <Count label={unsubscribing ? 'Guests to opt out' : 'Emails to mark bounced'}>{preview.changes}</Count>
            <Count label={unsubscribing ? 'Already opted out' : 'Already bounced'}>{preview.unchanged}</Count>
            <Count label="Not matched">{preview.unmatched.length}</Count>
            {preview.invalid.length > 0 && <Count label="Not an email">{preview.invalid.length}</Count>}
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onConfirm} disabled={busy || preview.changes === 0}>
              {busy ? 'Saving…' : preview.changes === 0 ? 'Nothing to change' : action}
            </Button>
            <Button variant="outline" onClick={onBack} disabled={busy}>
              Choose another file
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview.matched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Matched ({formatCount(preview.matched.length)})</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.matched.slice(0, PREVIEW_ROWS).flatMap((m) =>
                    m.guests.map((g, i) => (
                      <TableRow key={`${m.email}|${g.id}`}>
                        <TableCell className="max-w-72 truncate">{i === 0 ? m.email : ''}</TableCell>
                        <TableCell className="max-w-56 truncate">
                          <Link to={`/guests/${g.id}`} className="underline-offset-4 hover:underline" target="_blank">
                            {fullName(g) || `Guest #${g.id}`}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {g.done ? (
                            <span className="text-muted-foreground">{unsubscribing ? 'Already opted out' : 'Already bounced'}</span>
                          ) : (
                            <Badge variant="outline" className="border-destructive/40 text-destructive">
                              {unsubscribing ? 'Will opt out' : 'Will mark bounced'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )),
                  )}
                </TableBody>
              </Table>
            </div>
            {preview.matched.length > PREVIEW_ROWS && (
              <p className="text-sm text-muted-foreground">
                Showing the first {formatCount(PREVIEW_ROWS)} of {formatCount(preview.matched.length)} emails.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <UnmatchedCard file={file} unmatched={preview.unmatched} invalid={preview.invalid} kind={preview.kind} saved={false} />
    </div>
  )
}

function ResultCard({ result, file, onAgain }: { result: UploadResult; file: LoadedFile; onAgain: () => void }) {
  const unsubscribing = result.kind === 'unsubscribes'
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{unsubscribing ? 'Unsubscribes saved' : 'Bounces saved'}</CardTitle>
          <CardDescription>{file.name}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <dl className="grid grid-cols-3 gap-4 sm:max-w-lg">
            <Count label={unsubscribing ? 'Opted out' : 'Marked bounced'}>{result.updated}</Count>
            <Count label="Already done">{result.unchanged}</Count>
            <Count label="Not matched">{result.unmatched.length}</Count>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/marketing/email-list">Go to the email list</Link>
            </Button>
            <Button variant="outline" onClick={onAgain}>
              Upload another file
            </Button>
          </div>
        </CardContent>
      </Card>
      <UnmatchedCard file={file} unmatched={result.unmatched} invalid={result.invalid} kind={result.kind} saved />
    </div>
  )
}

// Emails that matched no guest (or, for unsubscribes, only a shared address,
// which is never emailed), and values that aren't emails.
function UnmatchedCard({
  file,
  unmatched,
  invalid,
  kind,
  saved,
}: {
  file: LoadedFile
  unmatched: string[]
  invalid: string[]
  kind: UploadKind
  saved: boolean
}) {
  if (!unmatched.length && !invalid.length) return null
  async function download() {
    const { downloadCsv } = await import('@/lib/spreadsheet')
    downloadCsv(
      file.name.replace(/\.[^.]+$/, '') + ' - not matched.csv',
      ['Email', 'Why'],
      [
        ...unmatched.map((e) => [e, 'No guest has this email']),
        ...invalid.map((e) => [e, 'Not an email address']),
      ],
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Not matched ({formatCount(unmatched.length + invalid.length)})</CardTitle>
        <CardDescription>
          No guest has these emails{kind === 'unsubscribes' ? ', or only as a shared address, which is never emailed' : ''}.{' '}
          {saved ? 'Nothing was changed for them.' : 'Nothing will change for them.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ul className="grid max-h-64 gap-x-6 gap-y-1 overflow-y-auto text-sm sm:grid-cols-2 lg:grid-cols-3">
          {unmatched.slice(0, PREVIEW_ROWS).map((e) => (
            <li key={e} className="truncate">
              {e}
            </li>
          ))}
          {invalid.slice(0, PREVIEW_ROWS).map((e) => (
            <li key={`invalid|${e}`} className="truncate text-muted-foreground" title="Not an email address">
              {e}
            </li>
          ))}
        </ul>
        <Button variant="outline" className="w-fit" onClick={download}>
          <DownloadIcon /> Download the list
        </Button>
      </CardContent>
    </Card>
  )
}

function Count({ label, children }: { label: string; children: number }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-3xl font-semibold tabular-nums">{formatCount(children)}</dd>
    </div>
  )
}
