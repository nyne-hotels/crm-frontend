import { FileUpIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { FieldsFilter, FilterGroup, FilterSelect, MoreFilters, RangeFilter } from '@/components/more-filters'
import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { EMPLOYEE_MORE_FILTERS, useEmployees, type EmployeeFilter } from '@/hooks/use-employees'
import { useFilterParams } from '@/hooks/use-filter-params'
import { useMe } from '@/hooks/use-me'
import { usePropertyOptions } from '@/hooks/use-reference-data'
import { DEPARTMENT_LABELS, DEPARTMENTS, employeeName } from '@/lib/feedback'
import { filterFields, optionsFrom, pickParams } from '@/lib/filters'
import { formatCount, formatDate, plural } from '@/lib/format'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { EmployeeFormDialog } from './employee-form-dialog'
import { StaffListDialog } from './staff-list-dialog'

const FILTER_KEYS = ['hotel', 'department', 'status', ...EMPLOYEE_MORE_FILTERS]

// Feedback → Employees: by hotel and department, with praise and criticism
// in the last 90 days. Management and admin only.
export function EmployeesPage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const canEdit = can(me?.permissions, 'employees', 'edit')
  const { params, update } = useFilterParams()
  const { data: hotels = [] } = usePropertyOptions()
  const filter: EmployeeFilter = {
    q: params.get('q') ?? undefined,
    propertyId: params.get('hotel') ?? undefined,
    department: params.get('department') ?? undefined,
    status: (params.get('status') as EmployeeFilter['status']) ?? 'active',
    ...pickParams(params, EMPLOYEE_MORE_FILTERS),
  }
  const { data, isPending, isError, isPlaceholderData } = useEmployees(filter)
  const [adding, setAdding] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState(filter.q ?? '')
  const q = useDebouncedValue(search.trim(), 250)
  useEffect(() => {
    if (q !== (params.get('q') ?? '')) update({ q: q || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed text settles
  }, [q])
  const f = filterFields(params, update)
  const hasFilters = FILTER_KEYS.some((k) => params.has(k))

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {data && <span className="text-sm text-muted-foreground tabular-nums">{plural(data.length, 'employee')}</span>}
        {canEdit && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setUploading(true)}>
              <FileUpIcon /> Upload staff list
            </Button>
            <Button onClick={() => setAdding(true)}>
              <PlusIcon /> Add employee
            </Button>
          </div>
        )}
      </div>

      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name or job title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
          aria-label="Search employees"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          {...f.multi('hotel')}
          options={[{ value: 'group', label: 'Group-wide' }, ...hotels.map((h) => ({ value: h.id, label: h.name }))]}
          anyLabel="All hotels"
          className="w-44"
          aria-label="Filter by hotel"
        />
        <MultiSelect
          {...f.multi('department')}
          options={optionsFrom(DEPARTMENTS, DEPARTMENT_LABELS)}
          anyLabel="Any department"
          className="w-44"
          aria-label="Filter by department"
        />
        <Select value={filter.status} onValueChange={(v) => update({ status: v === 'active' ? undefined : v })}>
          <SelectTrigger className="w-36" aria-label="Working or left">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Working</SelectItem>
            <SelectItem value="inactive">Left</SelectItem>
            <SelectItem value="all">Everyone</SelectItem>
          </SelectContent>
        </Select>
        <MoreFilters
          params={params}
          keys={EMPLOYEE_MORE_FILTERS}
          update={update}
          total={data ? plural(data.length, 'employee') : undefined}
        >
          <EmployeeMoreFilters params={params} update={update} />
        </MoreFilters>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])))}>
            <XIcon /> Clear filters
          </Button>
        )}
      </div>

      <div className={cn('rounded-md border transition-opacity', isPlaceholderData && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Job title</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right" title="Praise in the last 90 days">
                Praise, 90 days
              </TableHead>
              <TableHead className="text-right" title="Criticism in the last 90 days">
                Criticism, 90 days
              </TableHead>
              <TableHead>Last mentioned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <MessageRow>Loading…</MessageRow>
            ) : isError ? (
              <MessageRow className="text-destructive">Couldn't load employees.</MessageRow>
            ) : data.length === 0 ? (
              <MessageRow>
                {filter.q || hasFilters ? 'No employees match.' : 'No employees yet. Add them one by one, or upload each hotel\'s staff list.'}
              </MessageRow>
            ) : (
              data.map((e, i) => (
                <Fragment key={e.id}>
                  {/* the list runs by hotel, then department */}
                  {(i === 0 || data[i - 1].propertyId !== e.propertyId) && (
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={6} className="py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {e.hotel ?? 'Group-wide'}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="cursor-pointer" onClick={() => navigate(`/feedback/employees/${e.id}`)}>
                    <TableCell className="max-w-56">
                      <Link
                        to={`/feedback/employees/${e.id}`}
                        className={cn('block truncate font-medium hover:underline', !e.isActive && 'text-muted-foreground')}
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        {employeeName(e)}
                        {!e.isActive && <span className="font-normal"> (left)</span>}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">{e.jobTitle}</TableCell>
                    <TableCell className="whitespace-nowrap">{DEPARTMENT_LABELS[e.department]}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', e.positive90Days > 0 ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                      {formatCount(e.positive90Days)}
                    </TableCell>
                    <TableCell className={cn('text-right tabular-nums', e.negative90Days > 0 ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                      {formatCount(e.negative90Days)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{e.lastMentioned ? formatDate(e.lastMentioned) : ''}</TableCell>
                  </TableRow>
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EmployeeFormDialog
        open={adding}
        onOpenChange={setAdding}
        defaultPropertyId={filter.propertyId && filter.propertyId !== 'group' ? filter.propertyId : undefined}
      />
      <StaffListDialog open={uploading} onOpenChange={setUploading} />
    </div>
  )
}

function MessageRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={6} className={cn('h-24 text-center text-muted-foreground', className)}>
        {children}
      </TableCell>
    </TableRow>
  )
}

// Employees → More filters: what guests said about them lately, and their CRM login.
function EmployeeMoreFilters({
  params,
  update,
}: {
  params: URLSearchParams
  update: (changes: Record<string, string | undefined>) => void
}) {
  const f = filterFields(params, update)
  return (
    <>
      <FilterGroup title="Filled in or missing">
        <FieldsFilter
          options={[
            { value: 'lastName', label: 'Last name' },
            { value: 'jobTitle', label: 'Job title' },
            { value: 'login', label: 'CRM login' },
          ]}
          params={params}
          update={update}
        />
      </FilterGroup>

      <FilterGroup title="Guest feedback">
        <FilterSelect
          label="In the last 90 days"
          options={[
            { value: 'mentioned', label: 'Mentioned by guests' },
            { value: 'praised', label: 'Praised' },
            { value: 'criticised', label: 'Criticised' },
            { value: 'none', label: 'Not mentioned' },
          ]}
          {...f.choice('recent')}
        />
        <RangeFilter label="Last mentioned" type="date" {...f.range('lastMentionedFrom', 'lastMentionedTo')} />
      </FilterGroup>
    </>
  )
}
