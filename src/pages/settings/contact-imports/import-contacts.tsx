import { DownloadIcon, TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Field, FormError } from '@/components/field'
import { ColumnMatchTable, FileDrop, ResultCount, Steps } from '@/components/import-wizard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useContactImportMutations, useContactImportSetup } from '@/hooks/use-contact-imports'
import { errorMessage } from '@/lib/api'
import { resultSheets, templateSheets } from '@/lib/contact-imports'
import { formatCount, plural } from '@/lib/format'
import { autoMatch, buildRows } from '@/lib/import-matching'
import { downloadSheets, openWorkbook, type SpreadsheetData } from '@/lib/spreadsheet'
import type { ContactImportPreview, ContactImportResult, ContactImportSetup } from '@/lib/types'
import { ContactImportsNav, ImportGuide } from './import-guide'
import { ImportedPeople } from './imported-people'
import { ReviewStep, type Choices } from './review-step'

const STEPS = ['Upload', 'Match columns', 'Review', 'Confirm', 'Result'] as const
const MAX_ROWS = 10_000
const NAME_FIELDS = ['firstName', 'lastName', 'fullName', 'company']
const CONTACT_FIELDS = ['email', 'otherEmails', 'phone', 'otherPhones', 'sharedEmail', 'sharedPhone']

interface LoadedFile {
  name: string
  sheetNames: string[]
  sheet: string
  data: SpreadsheetData
  read: (sheet: string) => SpreadsheetData
}

const toList = (choices: Choices) => [...choices].map(([index, c]) => ({ index, ...c }))

// Settings → Import contacts (admin only). The file is read in the browser
// and its rows go to the API with the columns matched to CRM fields. Nothing
// is saved until Import on the confirm step.
export function ImportContactsPage() {
  const { data: setup } = useContactImportSetup()
  const { saveMapping, preview: previewRows, commit } = useContactImportMutations()
  const [step, setStep] = useState(0)
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [preview, setPreview] = useState<ContactImportPreview | null>(null)
  const [choices, setChoices] = useState<Choices>(new Map())
  const [confirm, setConfirm] = useState<ContactImportPreview | null>(null)
  const [result, setResult] = useState<ContactImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load(picked: File) {
    const workbook = await openWorkbook(picked)
    const sheet = workbook.sheetNames[0]
    const data = workbook.read(sheet)
    setFile({ name: picked.name, sheetNames: workbook.sheetNames, sheet, data, read: workbook.read })
    setMapping(autoMatch(setup?.fields ?? [], data.headers, setup?.mapping ?? {}))
    setPreview(null)
    setChoices(new Map())
    setConfirm(null)
    setResult(null)
    setStep(1)
  }

  function pickSheet(sheet: string) {
    if (!file) return
    setError(null)
    try {
      const data = file.read(sheet)
      setFile({ ...file, sheet, data })
      setMapping(autoMatch(setup?.fields ?? [], data.headers, setup?.mapping ?? {}))
    } catch (err) {
      setError(`${sheet}: ${errorMessage(err)}`)
    }
  }

  async function matched() {
    setError(null)
    // remembered for next time, whether or not this file is imported
    saveMapping.mutate(mapping)
    const nextRows = buildRows(file!.data, mapping)
    try {
      setPreview(await previewRows.mutateAsync({ fileName: file!.name, rows: nextRows, choices: [] }))
      setRows(nextRows)
      setChoices(new Map())
      setStep(2)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // the confirm step's numbers come from the same plan the import will run
  async function reviewed() {
    setError(null)
    try {
      setConfirm(await previewRows.mutateAsync({ fileName: file!.name, rows, choices: toList(choices) }))
      setStep(3)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function runImport() {
    setError(null)
    try {
      const saved = await commit.mutateAsync({ fileName: file!.name, rows, choices: toList(choices), mapping })
      setResult(saved)
      setStep(4)
      toast.success(`Contact import #${saved.id} saved`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  function restart() {
    setFile(null)
    setPreview(null)
    setConfirm(null)
    setResult(null)
    setRows([])
    setChoices(new Map())
    setError(null)
    setStep(0)
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContactImportsNav />
        <Steps steps={STEPS} current={step} />
      </div>
      <ImportGuide open={step === 0} />
      <FormError message={error} />

      {step === 0 && <UploadStep setup={setup} onFile={load} />}
      {step === 1 && file && setup && (
        <MatchStep
          file={file}
          setup={setup}
          mapping={mapping}
          onChange={setMapping}
          onSheet={pickSheet}
          busy={previewRows.isPending}
          onBack={restart}
          onNext={matched}
        />
      )}
      {step === 2 && preview && (
        <ReviewStep
          preview={preview}
          choices={choices}
          onChoicesChange={setChoices}
          busy={previewRows.isPending}
          onBack={() => setStep(1)}
          onNext={reviewed}
        />
      )}
      {step === 3 && confirm && file && (
        <ConfirmStep
          plan={confirm}
          choices={choices}
          fileName={file.name}
          busy={commit.isPending}
          onBack={() => setStep(2)}
          onImport={runImport}
        />
      )}
      {step === 4 && result && file && <ResultStep result={result} file={file} onAgain={restart} />}
    </div>
  )
}

// =====================================================================
// Step 1 – upload
// =====================================================================
function UploadStep({ setup, onFile }: { setup: ContactImportSetup | undefined; onFile: (file: File) => Promise<void> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload the contact list</CardTitle>
        <CardDescription>
          An event sign-up sheet, an agent list, a Wix export or a list from a hotel. Use the template, or a file whose
          columns are close to it.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <Button
            variant="outline"
            disabled={!setup}
            onClick={() => setup && downloadSheets('Nyne CRM - contact import template.xlsx', templateSheets(setup))}
          >
            <DownloadIcon /> Download the template
          </Button>
        </div>
        <FileDrop hint={`.xlsx, .xls or .csv, up to ${formatCount(MAX_ROWS)} contacts`} disabled={!setup} onFile={onFile} />
      </CardContent>
    </Card>
  )
}

// =====================================================================
// Step 2 – match columns
// =====================================================================
function MatchStep({
  file,
  setup,
  mapping,
  onChange,
  onSheet,
  busy,
  onBack,
  onNext,
}: {
  file: LoadedFile
  setup: ContactImportSetup
  mapping: Record<string, string>
  onChange: (mapping: Record<string, string>) => void
  onSheet: (sheet: string) => void
  busy: boolean
  onBack: () => void
  onNext: () => void
}) {
  const used = new Set(Object.values(mapping))
  const unmatched = file.data.headers.filter((h) => !used.has(h))
  const problems: string[] = []
  if (!NAME_FIELDS.some((k) => mapping[k])) problems.push('Match a name column: First name, Last name or Name.')
  if (!CONTACT_FIELDS.some((k) => mapping[k])) problems.push('Match an Email or a Phone column.')
  if (file.data.rows.length > MAX_ROWS) {
    problems.push(`The sheet has ${formatCount(file.data.rows.length)} rows. Import at most ${formatCount(MAX_ROWS)} at a time.`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match the columns</CardTitle>
        <CardDescription>
          {file.name}: {plural(file.data.rows.length, 'row')}, {plural(file.data.headers.length, 'column')}. Pair each CRM field
          with a column in the file; the CRM remembers this for next time.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {file.sheetNames.length > 1 && (
          <Field label="Sheet" htmlFor="import-sheet" hint="The first sheet is read unless you pick another.">
            <Select value={file.sheet} onValueChange={onSheet}>
              <SelectTrigger id="import-sheet" className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {file.sheetNames.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <ColumnMatchTable fields={setup.fields} data={file.data} mapping={mapping} onChange={onChange} noneLabel="Don't import" />
        {mapping.fullName && (mapping.firstName || mapping.lastName) && (
          <p className="text-sm text-muted-foreground">First name and Last name are used; the Name column is ignored.</p>
        )}
        {unmatched.length > 0 && <p className="text-sm text-muted-foreground">Not imported: {unmatched.join(', ')}.</p>}
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
            {busy ? 'Checking every row…' : 'Check the rows'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// =====================================================================
// Step 4 – confirm
// =====================================================================
function ConfirmStep({
  plan,
  choices,
  fileName,
  busy,
  onBack,
  onImport,
}: {
  plan: ContactImportPreview
  choices: Choices
  fileName: string
  busy: boolean
  onBack: () => void
  onImport: () => void
}) {
  const [read, setRead] = useState(false)
  const s = plan.summary
  const o = s.outcomes
  // an Update the plan turned into Ignore: another row updates the same contact
  const clashes = plan.rows.filter((r) => choices.get(r.index)?.decision === 'update' && r.outcome === 'ignored').length

  const warnings = [
    s.changedContacts > 0 &&
      `${plural(s.changedContacts, 'existing contact')} will be changed. Their old values are kept in the change log.`,
    s.primaryChanges > 0 &&
      `${plural(s.primaryChanges, 'contact')} will get a new primary email or phone. The old one stays on the contact as an extra.`,
    s.optedBackIn.email > 0 && `${plural(s.optedBackIn.email, 'contact')} who had opted out of email will be opted back in.`,
    s.optedBackIn.whatsapp > 0 && `${plural(s.optedBackIn.whatsapp, 'contact')} who had opted out of WhatsApp will be opted back in.`,
    s.optedOut.email > 0 && `${plural(s.optedOut.email, 'contact')} who had opted in to email will be opted out.`,
    s.optedOut.whatsapp > 0 && `${plural(s.optedOut.whatsapp, 'contact')} who had opted in to WhatsApp will be opted out.`,
    s.doNotContactOptIns > 0 &&
      `${plural(s.doNotContactOptIns, 'guest')} on do-not-contact will be recorded as opted in but stay blocked.`,
    s.newCompanies.length > 0 &&
      `${plural(s.newCompanies.length, 'new company', 'new companies')} will be created: ${s.newCompanies.join(', ')}.`,
    o.added_again > 0 &&
      `${plural(o.added_again, 'contact')} will be added again although their email or phone is already in the CRM. They will appear in Possible duplicates.`,
    clashes > 0 && `${plural(clashes, 'row')} chose Update for a contact another row already updates, so they will be ignored.`,
    o.error > 0 && `${plural(o.error, 'row')} with errors won't be imported. The result file lists them with the reason.`,
    o.updated > 0 && 'Updates cannot be undone in one step.',
    'Your name is recorded on every change this import makes.',
  ].filter((w): w is string => !!w)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm the import</CardTitle>
        <CardDescription>
          {fileName}:{' '}
          {[
            `${formatCount(o.new)} new`,
            `${formatCount(o.updated)} updated`,
            `${formatCount(o.added_again)} added again`,
            `${formatCount(o.ignored)} ignored`,
            plural(o.error, 'error'),
          ].join(', ')}
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <ResultCount label="New">{o.new}</ResultCount>
          <ResultCount label="Updated">{o.updated}</ResultCount>
          <ResultCount label="Added again">{o.added_again}</ResultCount>
          <ResultCount label="Ignored">{o.ignored}</ResultCount>
          <ResultCount label="Errors">{o.error}</ResultCount>
        </dl>
        <section className="rounded-lg border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="mb-2 flex items-center gap-2 font-medium">
            <TriangleAlertIcon className="size-4 text-amber-600" /> Before you import
          </h2>
          <ul className="grid list-disc gap-1.5 pl-5 text-sm">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
        <div className="flex items-center gap-2">
          <Checkbox id="warnings-read" checked={read} onCheckedChange={(c) => setRead(c === true)} />
          <Label htmlFor="warnings-read">I have read the warnings</Label>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
          <Button variant="outline" onClick={onBack} disabled={busy}>
            Back to the review
          </Button>
          <Button onClick={onImport} disabled={!read || busy}>
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// =====================================================================
// Step 5 – result
// =====================================================================
function ResultStep({ result, file, onAgain }: { result: ContactImportResult; file: LoadedFile; onAgain: () => void }) {
  const c = result.counts
  function download() {
    downloadSheets(
      `${file.name.replace(/\.[^.]+$/, '')} - result.xlsx`,
      resultSheets(file.data.headers, file.data.rows, result.rows),
    )
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Contact import #{result.id} saved</CardTitle>
          <CardDescription>{file.name}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <ResultCount label="New">{c.new}</ResultCount>
            <ResultCount label="Updated">{c.updated}</ResultCount>
            <ResultCount label="Added again">{c.added_again}</ResultCount>
            <ResultCount label="Ignored">{c.ignored}</ResultCount>
            <ResultCount label="Errors">{c.error}</ResultCount>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>
              <DownloadIcon /> Download result file
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/settings/contact-imports/${result.id}`}>See the change log</Link>
            </Button>
            <Button variant="outline" onClick={onAgain}>
              Import another file
            </Button>
          </div>
        </CardContent>
      </Card>
      <ImportedPeople details={result} />
    </div>
  )
}
