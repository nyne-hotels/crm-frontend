import { CheckIcon, FileSpreadsheetIcon, UploadIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCount } from '@/lib/format'
import type { SpreadsheetData } from '@/lib/spreadsheet'
import type { ImportFieldInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

// The pieces both spreadsheet imports share: Stays → Import bookings
// (Module 3) and Settings → Import contacts (Module 9).

export function Steps({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          <span
            className={cn(
              'grid size-6 place-items-center rounded-full border text-xs font-medium tabular-nums',
              i < current && 'border-primary bg-primary text-primary-foreground',
              i === current && 'border-primary text-primary',
              i > current && 'text-muted-foreground',
            )}
          >
            {i < current ? <CheckIcon className="size-3.5" /> : i + 1}
          </span>
          <span className={cn(i === current ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
        </li>
      ))}
    </ol>
  )
}

// Drop a spreadsheet here or choose one. `onFile` reads it; an error it
// throws is shown under the box.
export function FileDrop({
  hint,
  disabled,
  onFile,
}: {
  hint: string
  disabled?: boolean
  onFile: (file: File) => Promise<void>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function read(file: File | undefined) {
    if (!file) return
    setError(null)
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return setError('Choose a spreadsheet: .xlsx, .xls or .csv.')
    setReading(true)
    try {
      await onFile(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.")
    } finally {
      setReading(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="grid gap-4">
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
          <p className="font-medium">Drop the file here</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button type="button" variant="outline" disabled={reading || disabled} onClick={() => input.current?.click()}>
          <UploadIcon /> {reading ? 'Reading…' : 'Choose file'}
        </Button>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => read(e.target.files?.[0])}
        />
      </div>
    </div>
  )
}

const NOT_IN_FILE = '__none'
// Step 2: each CRM field paired with a column in the file, with the first values.
export function ColumnMatchTable({
  fields,
  data,
  mapping,
  onChange,
  noneLabel = 'Not in the file',
}: {
  fields: ImportFieldInfo[]
  data: SpreadsheetData
  mapping: Record<string, string>
  onChange: (mapping: Record<string, string>) => void
  noneLabel?: string
}) {
  const sample = (header: string | undefined) => {
    if (!header) return ''
    const c = data.headers.indexOf(header)
    return data.rows
      .slice(0, 3)
      .map((r) => r[c])
      .filter(Boolean)
      .join(' · ')
  }

  function set(field: string, header: string) {
    const next = { ...mapping }
    // a column feeds one field: taking it here frees it elsewhere
    for (const [k, h] of Object.entries(next)) if (h === header) delete next[k]
    if (header === NOT_IN_FILE) delete next[field]
    else next[field] = header
    onChange(next)
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-56">CRM field</TableHead>
            <TableHead className="w-64">Column in the file</TableHead>
            <TableHead>First values</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((f) => (
            <TableRow key={f.key}>
              <TableCell className="align-top">
                <div className="font-medium">
                  {f.label}
                  {f.required && <span className="text-destructive"> *</span>}
                </div>
                {f.hint && <div className="text-xs whitespace-normal text-muted-foreground">{f.hint}</div>}
              </TableCell>
              <TableCell className="align-top">
                <Select value={mapping[f.key] ?? NOT_IN_FILE} onValueChange={(v) => set(f.key, v)}>
                  <SelectTrigger className="w-60" aria-label={`Column for ${f.label}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOT_IN_FILE}>
                      <span className="text-muted-foreground">{noneLabel}</span>
                    </SelectItem>
                    {data.headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="max-w-80 truncate align-top text-muted-foreground" title={sample(mapping[f.key])}>
                {sample(mapping[f.key])}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// A big number with its label, for the result step.
export function ResultCount({ label, children }: { label: string; children: number }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-3xl font-semibold tabular-nums">{formatCount(children)}</dd>
    </div>
  )
}
