import { useState } from 'react'
import { toast } from 'sonner'
import { Field, FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEmployeeMutations, useLoginOptions } from '@/hooks/use-employees'
import { usePropertyOptions } from '@/hooks/use-reference-data'
import { errorMessage } from '@/lib/api'
import { DEPARTMENT_LABELS, DEPARTMENTS, type Department } from '@/lib/feedback'
import { fullName } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/permissions'
import type { Employee } from '@/lib/types'

const GROUP = 'group'
const NONE = 'none'

// Add employee / Edit: name, hotel (or group-wide), department, job title,
// and their CRM login if they have one. Leavers are made inactive from the
// employee's page, not deleted.
export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  defaultPropertyId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: Employee
  defaultPropertyId?: string // the hotel the list is filtered to
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee ? 'Edit employee' : 'Add employee'}</DialogTitle>
          <DialogDescription>Everyone guests might name: drivers, butlers, chefs, front office and the rest.</DialogDescription>
        </DialogHeader>
        {open && <EmployeeForm employee={employee} defaultPropertyId={defaultPropertyId} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function EmployeeForm({ employee, defaultPropertyId, onClose }: { employee?: Employee; defaultPropertyId?: string; onClose: () => void }) {
  const { create, update } = useEmployeeMutations()
  const { data: hotels = [] } = usePropertyOptions()
  const { data: logins = [] } = useLoginOptions(true)
  const [firstName, setFirstName] = useState(employee?.firstName ?? '')
  const [lastName, setLastName] = useState(employee?.lastName ?? '')
  const [hotel, setHotel] = useState(employee ? (employee.propertyId ?? GROUP) : (defaultPropertyId ?? ''))
  const [department, setDepartment] = useState<Department | ''>(employee?.department ?? '')
  const [jobTitle, setJobTitle] = useState(employee?.jobTitle ?? '')
  const [login, setLogin] = useState(employee?.staffUser ? String(employee.staffUser.id) : NONE)
  const [error, setError] = useState<string | null>(null)
  const busy = create.isPending || update.isPending
  // a login belongs to one employee
  const freeLogins = logins.filter((l) => !l.employeeId || l.employeeId === employee?.id)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!firstName.trim()) return setError('Enter a first name')
    if (!hotel) return setError('Choose the hotel, or Group-wide')
    if (!department) return setError('Choose a department')
    const input = {
      firstName: firstName.trim(),
      lastName: lastName.trim() || null,
      propertyId: hotel === GROUP ? null : hotel,
      department,
      jobTitle: jobTitle.trim() || null,
      staffUserId: login === NONE ? null : Number(login),
    }
    try {
      if (employee) await update.mutateAsync({ id: employee.id, ...input })
      else await create.mutateAsync(input)
      toast.success(employee ? 'Employee saved' : `${input.firstName} added`)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormError message={error} />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="employee-first">
          <Input id="employee-first" autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={100} />
        </Field>
        <Field label="Last name" htmlFor="employee-last">
          <Input id="employee-last" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={200} />
        </Field>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Hotel" htmlFor="employee-hotel">
          <Select value={hotel} onValueChange={setHotel}>
            <SelectTrigger id="employee-hotel" className="w-full">
              <SelectValue placeholder="Choose" />
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
        <Field label="Department" htmlFor="employee-department">
          <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
            <SelectTrigger id="employee-department" className="w-full">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {DEPARTMENT_LABELS[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Job title" htmlFor="employee-title" hint="e.g. Driver, Butler, Head Chef">
        <Input id="employee-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={200} />
      </Field>
      <Field label="CRM login" htmlFor="employee-login" hint="Only if they also use the CRM">
        <Select value={login} onValueChange={setLogin}>
          <SelectTrigger id="employee-login" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {freeLogins.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                {fullName(l)} · {ROLE_LABELS[l.role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : employee ? 'Save' : 'Add employee'}
        </Button>
      </DialogFooter>
    </form>
  )
}
