import { FileSpreadsheetIcon, UploadIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Field, FormError } from '@/components/field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useEmployeeMutations } from '@/hooks/use-employees'
import { usePropertyOptions } from '@/hooks/use-reference-data'
import { errorMessage } from '@/lib/api'
import { DEPARTMENT_LABELS, matchColumns, rowsFor, STAFF_FIELDS } from '@/lib/feedback'
import { formatCount, plural } from '@/lib/format'
import type { StaffListPlan } from '@/lib/types'

const GROUP = 'group'
const NOT_USED = 'none'
type StaffKey = (typeof STAFF_FIELDS)[number]['key']

interface LoadedFile {
  name: string
  headers: string[]
  rows: string[][]
}

// Load a hotel's staff list (name, department, job title) from a spreadsheet.
// Columns are matched by their headings; people already on the hotel's list
// are left as they are. Nothing is saved until Add.
export function StaffListDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upload a staff list</DialogTitle>
          <DialogDescription>A spreadsheet from the hotel with each person's name, department and job title.</DialogDescription>
        </DialogHeader>
        {open && <StaffListForm onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function StaffListForm({ onClose }: { onClose: () => void }) {
  const { data: hotels = [] } = usePropertyOptions()
  const { previewStaffList, uploadStaffList } = useEmployeeMutations()
  const input = useRef<HTMLInputElement>(null)
  const [hotel, setHotel] = useState('')
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [columns, setColumns] = useState<Partial<Record<StaffKey, number>>>({})
  const [plan, setPlan] = useState<StaffListPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const propertyId = hotel === GROUP ? null : hotel

  async function preview(loaded: LoadedFile, cols: Partial<Record<StaffKey, number>>, at = hotel) {
    setPlan(null)
    if (!at) return
    if (cols.name === undefined && cols.firstName === undefined) return setError('Choose the column with the names')
    setError(null)
    try {
      setPlan(await previewStaffList.mutateAsync({ propertyId: at === GROUP ? null : at, rows: rowsFor(loaded.rows, cols) }))
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
      const found = matchColumns(STAFF_FIELDS, sheet.headers)
      setFile(loaded)
      setColumns(found)
      await preview(loaded, found)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.")
    } finally {
      setReading(false)
      if (input.current) input.current.value = ''
    }
  }

  async function save() {
    if (!file) return
    try {
      const saved = await uploadStaffList.mutateAsync({ propertyId, rows: rowsFor(file.rows, columns) })
      toast.success(`${plural(saved.counts.new, 'employee')} added`)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="grid gap-4">
      <FormError message={error} />
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <Field label="Hotel" htmlFor="staff-hotel">
          <Select
            value={hotel}
            onValueChange={(v) => {
              setHotel(v)
              if (file) preview(file, columns, v)
            }}
          >
            <SelectTrigger id="staff-hotel" className="w-full">
              <SelectValue placeholder="Whose staff list is it?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GROUP}>Group-wide</SelectItem>
              {hotels.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={!hotel || reading} onClick={() => input.current?.click()}>
            <UploadIcon /> {reading ? 'Reading…' : file ? 'Choose another file' : 'Choose file'}
          </Button>
          {file && (
            <span className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
              <FileSpreadsheetIcon className="size-4 shrink-0" /> <span className="truncate">{file.name}</span>
            </span>
          )}
          <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="sr-only" tabIndex={-1} onChange={(e) => read(e.target.files?.[0])} />
        </div>
      </div>

      {file && (
        <div className="grid items-start gap-3 sm:grid-cols-3">
          {STAFF_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`staff-col-${f.key}`}>
              <Select
                value={columns[f.key] !== undefined ? String(columns[f.key]) : NOT_USED}
                onValueChange={(v) => {
                  const next = { ...columns, [f.key]: v === NOT_USED ? undefined : Number(v) }
                  setColumns(next)
                  preview(file, next)
                }}
              >
                <SelectTrigger id={`staff-col-${f.key}`} className="w-full">
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
      )}

      {plan && (
        <>
          <p className="text-sm">
            <span className="font-medium">{plural(plan.counts.new, 'person', 'people')} to add.</span>{' '}
            <span className="text-muted-foreground">
              {plan.counts.exists > 0 && `${formatCount(plan.counts.exists)} already on the list. `}
              {plan.counts.error > 0 && `${formatCount(plan.counts.error)} without a name.`}
            </span>
          </p>
          <div className="max-h-72 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Job title</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.rows.map((r) => (
                  <TableRow key={r.row} className={r.outcome !== 'new' ? 'text-muted-foreground' : undefined}>
                    <TableCell className="tabular-nums">{r.row}</TableCell>
                    <TableCell>{[r.firstName, r.lastName].filter(Boolean).join(' ')}</TableCell>
                    <TableCell title={r.note ?? undefined}>
                      {DEPARTMENT_LABELS[r.department]}
                      {r.note && <span className="text-amber-700 dark:text-amber-400"> *</span>}
                    </TableCell>
                    <TableCell>{r.jobTitle}</TableCell>
                    <TableCell className="text-right">
                      {r.outcome === 'new' ? (
                        <Badge variant="outline">New</Badge>
                      ) : (
                        <span className="text-xs">{r.problem}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {plan.rows.some((r) => r.note) && (
            <p className="text-xs text-muted-foreground">* Department not recognised; saved as Other. You can change it afterwards.</p>
          )}
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={!plan || plan.counts.new === 0 || uploadStaffList.isPending}>
          {uploadStaffList.isPending ? 'Saving…' : plan ? `Add ${plural(plan.counts.new, 'person', 'people')}` : 'Add'}
        </Button>
      </DialogFooter>
    </div>
  )
}
