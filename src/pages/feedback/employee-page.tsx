import { ArrowLeftIcon, PencilIcon, UserCheckIcon, UserXIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CreatedAndUpdated } from '@/components/last-updated'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useEmployee, useEmployeeMentions, useEmployeeMutations } from '@/hooks/use-employees'
import { useMe } from '@/hooks/use-me'
import { ApiError } from '@/lib/api'
import { DEPARTMENT_LABELS, employeeName, SENTIMENT_LABELS, stayDates, type Sentiment } from '@/lib/feedback'
import { formatCount, formatDate, fullName } from '@/lib/format'
import { can } from '@/lib/permissions'
import type { Employee, EmployeeMention } from '@/lib/types'
import { cn } from '@/lib/utils'
import { EmployeeFormDialog } from './employee-form-dialog'
import { SentimentChip, Stars } from './feedback-badges'

// /feedback/employees/:id – keyed by id, so opening another employee starts afresh
export function EmployeePage() {
  const { id } = useParams()
  return <EmployeeDetail key={id} id={Number(id)} />
}

function EmployeeDetail({ id }: { id: number }) {
  const { data: me } = useMe()
  const { data: employee, isPending, error } = useEmployee(id)
  const canEdit = can(me?.permissions, 'employees', 'edit')

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-5xl gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (error || !employee) {
    const missing = error instanceof ApiError && (error.status === 404 || error.status === 400)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-heading text-xl font-semibold">{missing ? 'Employee not found' : "Couldn't load this employee"}</h1>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/feedback/employees">Back to employees</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <Link to="/feedback/employees" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Employees
      </Link>
      <Header employee={employee} canEdit={canEdit} />
      <Counts employee={employee} />
      <Comments id={employee.id} />
      <CreatedAndUpdated created={employee.created} lastUpdated={employee.lastUpdated} className="border-t pt-4" />
    </div>
  )
}

function Header({ employee, canEdit }: { employee: Employee; canEdit: boolean }) {
  const { update } = useEmployeeMutations()
  const [editing, setEditing] = useState(false)
  const [toggling, setToggling] = useState(false)
  const name = employeeName(employee)
  return (
    <header className="flex flex-wrap items-start gap-4">
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold wrap-break-word">{name}</h1>
          {!employee.isActive && <Badge variant="outline">Left</Badge>}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          {employee.jobTitle && (
            <>
              <span className="text-foreground">{employee.jobTitle}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>{DEPARTMENT_LABELS[employee.department]}</span>
          <span aria-hidden>·</span>
          <span>{employee.hotel ?? 'Group-wide'}</span>
          {employee.staffUser && (
            <>
              <span aria-hidden>·</span>
              <span>CRM login: {employee.staffUser.name}</span>
            </>
          )}
        </p>
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <PencilIcon /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setToggling(true)}>
            {employee.isActive ? <UserXIcon /> : <UserCheckIcon />} {employee.isActive ? 'Mark as left' : 'Back at work'}
          </Button>
        </div>
      )}
      <EmployeeFormDialog open={editing} onOpenChange={setEditing} employee={employee} />
      <ConfirmDialog
        open={toggling}
        onOpenChange={setToggling}
        title={employee.isActive ? `Mark ${name} as left?` : `${name} is back at work?`}
        description={
          employee.isActive
            ? 'They leave the employee picker. What guests said about them stays here.'
            : 'They go back into the employee picker.'
        }
        confirmLabel={employee.isActive ? 'Mark as left' : 'Back at work'}
        onConfirm={async () => {
          await update.mutateAsync({ id: employee.id, isActive: !employee.isActive })
          toast.success(employee.isActive ? `${name} marked as left` : `${name} is back on the list`)
        }}
      />
    </header>
  )
}

function Counts({ employee }: { employee: Employee }) {
  const c = employee.counts
  return (
    <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
      <Count label="Praise, 90 days" value={c.positive90Days} tone="positive" />
      <Count label="Criticism, 90 days" value={c.negative90Days} tone="negative" />
      <Count label="Praise, all time" value={c.positive} />
      <Count label="Criticism, all time" value={c.negative} />
    </dl>
  )
}

function Count({ label, value, tone }: { label: string; value: number; tone?: Sentiment }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'text-3xl font-semibold tabular-nums',
          value > 0 && tone === 'positive' && 'text-emerald-700 dark:text-emerald-400',
          value > 0 && tone === 'negative' && 'text-destructive',
        )}
      >
        {formatCount(value)}
      </dd>
    </div>
  )
}

const SHOW: (Sentiment | 'all')[] = ['all', 'positive', 'negative']

// Every comment about them, newest first, with the guest and the stay's rating.
function Comments({ id }: { id: number }) {
  const { data, isPending, isError } = useEmployeeMentions(id)
  const [show, setShow] = useState<Sentiment | 'all'>('all')
  const rows = (data ?? []).filter((m) => show === 'all' || m.sentiment === show)
  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>What guests said</CardTitle>
        <div role="tablist" aria-label="Show" className="flex gap-1 rounded-lg bg-muted p-1">
          {SHOW.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={show === s}
              onClick={() => setShow(s)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground',
                show === s && 'bg-background text-foreground shadow-sm',
              )}
            >
              {s === 'all' ? 'All' : SENTIMENT_LABELS[s]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-32" />
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load the comments.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{data.length ? 'None of this kind.' : 'No guest has mentioned them yet.'}</p>
        ) : (
          <ul className="grid">
            {rows.map((m) => (
              <CommentLine key={m.id} mention={m} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function CommentLine({ mention: m }: { mention: EmployeeMention }) {
  return (
    <li className="grid gap-1.5 border-b py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <SentimentChip sentiment={m.sentiment} />
        <span className="text-sm text-muted-foreground tabular-nums">{formatDate(m.submittedAt)}</span>
        <Link to={`/feedback/${m.feedbackId}`} className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline">
          Open the response
        </Link>
      </div>
      {m.comment ? (
        <p className="text-sm whitespace-pre-wrap wrap-break-word">"{m.comment}"</p>
      ) : (
        <p className="text-sm text-muted-foreground">No words copied.</p>
      )}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <Link to={`/guests/${m.guest.id}`} className="font-medium text-foreground/80 underline-offset-4 hover:underline">
          {fullName(m.guest) || `Guest #${m.guest.id}`}
        </Link>
        <span>
          · {m.hotel}, {stayDates(m)}
        </span>
        <span className="inline-flex items-center gap-1">
          · Stay rated <Stars rating={m.stayRating} />
        </span>
        {m.nameAsWritten && <span>· wrote "{m.nameAsWritten}"</span>}
      </p>
    </li>
  )
}
