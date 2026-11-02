import { ChevronDownIcon, ExternalLinkIcon, SearchIcon } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCountries } from '@/hooks/use-reference-data'
import {
  CHANGE_FIELD_LABELS,
  DECISION_LABELS,
  formatChangeValue,
  GROUP_LABELS,
  OUTCOME_CLASSES,
  type ChangeField,
  type ContactDecision,
  type ContactRowGroup,
} from '@/lib/contact-imports'
import { formatCount, plural } from '@/lib/format'
import type { ContactImportPreview, ContactImportRow, ContactMatch, ContactRowChoice } from '@/lib/types'
import { cn } from '@/lib/utils'

const PAGE = 50
const GROUPS: ContactRowGroup[] = ['new', 'existing', 'error', 'repeated']
// fields Update adds to rather than replaces
const ADDED: ChangeField[] = ['email', 'phone', 'sharedEmail', 'sharedPhone', 'tag', 'hotel', 'like', 'dislike', 'note']

export type Choices = Map<number, Omit<ContactRowChoice, 'index'>>

// "update:42" in the row's drop-down, so each matched contact is its own option
const choiceValue = (c: { decision: ContactDecision; contactId?: number } | undefined, row: ContactImportRow) =>
  !c || c.decision === 'ignore' ? 'ignore' : c.decision === 'add' ? 'add' : `update:${c.contactId ?? row.matches[0]?.contactId}`

// Step 3: the four groups as tabs. Rows already in the CRM are ignored until
// the admin picks Add or Update, one by one or with "Apply to all".
export function ReviewStep({
  preview,
  choices,
  onChoicesChange,
  busy,
  onBack,
  onNext,
}: {
  preview: ContactImportPreview
  choices: Choices
  onChoicesChange: (choices: Choices) => void
  busy: boolean
  onBack: () => void
  onNext: () => void
}) {
  const counts = preview.summary.groups
  // the rows needing a choice first
  const [group, setGroup] = useState<ContactRowGroup>(counts.existing ? 'existing' : (GROUPS.find((g) => counts[g]) ?? 'new'))
  const [q, setQ] = useState('')
  const [decisionFilter, setDecisionFilter] = useState<ContactDecision | 'all'>('all')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [bulk, setBulk] = useState<ContactDecision>('update')

  const decisionOf = (r: ContactImportRow) => choices.get(r.index)?.decision ?? 'ignore'
  const search = q.trim().toLowerCase()
  const shown = preview.rows.filter(
    (r) =>
      r.group === group &&
      (!search || [r.summary.name, r.summary.email, r.summary.phone, String(r.index + 1)].some((v) => v?.toLowerCase().includes(search))) &&
      (group !== 'existing' || decisionFilter === 'all' || decisionOf(r) === decisionFilter),
  )
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const pageRows = shown.slice(page * PAGE, (page + 1) * PAGE)

  const existing = preview.rows.filter((r) => r.group === 'existing')
  const tally = { ignore: 0, add: 0, update: 0 }
  for (const r of existing) tally[decisionOf(r)]++

  function choose(row: ContactImportRow, value: string) {
    const next = new Map(choices)
    if (value === 'ignore') next.delete(row.index)
    else if (value === 'add') next.set(row.index, { decision: 'add' })
    else next.set(row.index, { decision: 'update', contactId: Number(value.split(':')[1]) })
    onChoicesChange(next)
  }

  // to every row shown (this tab, search and filter); Update keeps a contact picked by hand
  function applyToAll() {
    const next = new Map(choices)
    for (const r of shown) {
      if (bulk === 'ignore') next.delete(r.index)
      else if (bulk === 'add') next.set(r.index, { decision: 'add' })
      else next.set(r.index, { decision: 'update', contactId: choices.get(r.index)?.contactId ?? r.matches[0]?.contactId })
    }
    onChoicesChange(next)
  }

  const toggle = (index: number) => {
    const next = new Set(open)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setOpen(next)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review every row</CardTitle>
        <CardDescription>
          Nothing is saved yet. Contacts already in the CRM are left alone unless you choose Add or Update for them.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Groups">
          {GROUPS.map((g) => (
            <Button
              key={g}
              size="sm"
              role="tab"
              aria-selected={group === g}
              variant={group === g ? 'default' : 'outline'}
              onClick={() => {
                setGroup(g)
                setPage(0)
                setDecisionFilter('all')
              }}
            >
              {GROUP_LABELS[g]}
              <span className={cn('tabular-nums', group === g ? 'opacity-80' : 'text-muted-foreground')}>{formatCount(counts[g])}</span>
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
              placeholder="Name, email, phone or row"
              className="pl-8"
              aria-label="Search rows"
            />
          </div>
          {group === 'existing' && (
            <>
              <Select
                value={decisionFilter}
                onValueChange={(v) => {
                  setDecisionFilter(v as ContactDecision | 'all')
                  setPage(0)
                }}
              >
                <SelectTrigger className="w-44" aria-label="Show">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Every choice</SelectItem>
                  <SelectItem value="ignore">Ignore ({formatCount(tally.ignore)})</SelectItem>
                  <SelectItem value="add">Add ({formatCount(tally.add)})</SelectItem>
                  <SelectItem value="update">Update ({formatCount(tally.update)})</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 sm:ml-auto">
                <Select value={bulk} onValueChange={(v) => setBulk(v as ContactDecision)}>
                  <SelectTrigger className="w-48" aria-label="Choice for every row shown">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ignore">Ignore</SelectItem>
                    <SelectItem value="add">Add as new contacts</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={applyToAll} disabled={!shown.length}>
                  Apply to all {formatCount(shown.length)}
                </Button>
              </div>
            </>
          )}
        </div>

        {group === 'existing' && (
          <p className="text-sm text-muted-foreground">
            Ignore leaves the contact as it is. Add creates a new contact anyway (they will appear in Possible duplicates).
            Update writes the file's filled cells over the CRM's, consent included. Open a row to compare.
          </p>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-right">Row</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-64">What will happen</TableHead>
                <TableHead className="min-w-56">Notes</TableHead>
                {group === 'existing' && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                    No rows.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => (
                  <Fragment key={r.index}>
                    <TableRow className={cn(open.has(r.index) && 'border-b-0 bg-muted/30')}>
                      <TableCell className="text-right align-top tabular-nums">{r.index + 1}</TableCell>
                      <TableCell className="max-w-48 truncate align-top font-medium">
                        {r.summary.name || <span className="text-muted-foreground italic">No name</span>}
                      </TableCell>
                      <TableCell className="max-w-56 truncate align-top">{r.summary.email}</TableCell>
                      <TableCell className="align-top whitespace-nowrap">{r.summary.phone}</TableCell>
                      <TableCell className="align-top">
                        {r.group === 'existing' ? (
                          <Select value={choiceValue(choices.get(r.index), r)} onValueChange={(v) => choose(r, v)}>
                            <SelectTrigger className="w-60" size="sm" aria-label={`What to do with row ${r.index + 1}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ignore">{DECISION_LABELS.ignore}</SelectItem>
                              <SelectItem value="add">{DECISION_LABELS.add}</SelectItem>
                              {r.matches.map((m) => (
                                <SelectItem key={m.contactId} value={`update:${m.contactId}`}>
                                  Update {m.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={cn('border-transparent', OUTCOME_CLASSES[r.group === 'new' ? 'new' : 'error'])}>
                            {r.group === 'new' ? 'New contact' : 'Not imported'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-xs whitespace-normal">
                        <ul className="grid gap-0.5">
                          {r.group === 'existing' && (
                            <li className="text-muted-foreground">
                              {r.matches.map((m) => `${m.name} (by ${m.by.join(' and ')})`).join(' · ')}
                            </li>
                          )}
                          {r.errors.map((e) => (
                            <li key={e} className="text-destructive">
                              {e}
                            </li>
                          ))}
                          {r.warnings.map((w) => (
                            <li key={w} className="text-amber-700 dark:text-amber-400">
                              {w}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                      {group === 'existing' && (
                        <TableCell className="align-top">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => toggle(r.index)}
                            aria-expanded={open.has(r.index)}
                            aria-label={`Compare row ${r.index + 1} with the CRM`}
                          >
                            <ChevronDownIcon className={cn('transition-transform', open.has(r.index) && 'rotate-180')} />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                    {open.has(r.index) && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={7} className="pt-0">
                          <div className="grid gap-3 lg:grid-cols-2">
                            {r.matches.map((m) => (
                              <Comparison
                                key={m.contactId}
                                match={m}
                                updating={choiceValue(choices.get(r.index), r) === `update:${m.contactId}`}
                              />
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums">
              Rows {formatCount(page * PAGE + 1)}–{formatCount(Math.min(shown.length, (page + 1) * PAGE))} of {formatCount(shown.length)}
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
              {[
                `${formatCount(counts.new)} new`,
                `${formatCount(tally.update)} to update`,
                `${formatCount(tally.add)} to add again`,
                `${formatCount(tally.ignore)} ignored`,
                plural(counts.error + counts.repeated, 'error'),
              ].join(', ')}
            </span>
            <Button onClick={onNext} disabled={busy}>
              {busy ? 'Checking…' : 'Next: confirm'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// The CRM's record and the file's row side by side; what Update would change is highlighted.
function Comparison({ match: m, updating }: { match: ContactMatch; updating: boolean }) {
  const { data: countries = [] } = useCountries()
  const countryName = (code: string) => countries.find((c) => c.code === code)?.name
  const show = (field: ChangeField, value: string | null) => formatChangeValue(field, value, countryName) ?? '–'

  return (
    <div className="overflow-hidden rounded-md border bg-background whitespace-normal">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2 text-sm">
        <span className="font-medium">{m.name}</span>
        <span className="text-muted-foreground">matched by {m.by.join(' and ')}</span>
        {m.doNotContact && <Badge variant="destructive">Do not contact</Badge>}
        <a
          href={`/guests/${m.contactId}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Open contact <ExternalLinkIcon className="size-3" />
        </a>
      </div>
      <table className="w-full table-fixed text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-32 px-3 py-1.5 font-medium">Field</th>
            <th className="px-3 py-1.5 font-medium">In the CRM</th>
            <th className="px-3 py-1.5 font-medium">In the file</th>
          </tr>
        </thead>
        <tbody>
          {m.comparison.map((c) => (
            <tr key={c.field} className={cn('border-t align-top', c.changes && 'bg-amber-50 dark:bg-amber-950/30')}>
              <td className="px-3 py-1.5 text-muted-foreground">{CHANGE_FIELD_LABELS[c.field]}</td>
              <td className={cn('px-3 py-1.5 wrap-anywhere', c.changes && updating && !ADDED.includes(c.field) && 'line-through decoration-amber-600/60')}>
                {show(c.field, c.crm)}
              </td>
              <td className="px-3 py-1.5 wrap-anywhere">
                {show(c.field, c.file)}
                {c.changes && (
                  <span className="ml-1.5 text-xs whitespace-nowrap text-amber-700 dark:text-amber-400">
                    {ADDED.includes(c.field) ? (updating ? 'will be added' : 'new') : updating ? 'will replace' : 'differs'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
