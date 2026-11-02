import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, queryString } from '@/lib/api'
import type { Department } from '@/lib/feedback'
import type { Employee, EmployeeMention, EmployeeOption, EmployeeRow, LoginOption, StaffListPlan } from '@/lib/types'

// Employees and what guests said about them (Module 8). Admin and management only.
const EMPLOYEES = ['employees']
const detailKey = (id: number) => [...EMPLOYEES, 'detail', id]

// The "More filters" panel, kept in the address under the API's own names.
export const EMPLOYEE_MORE_FILTERS = ['login', 'recent', 'lastMentionedFrom', 'lastMentionedTo'] as const

export interface EmployeeFilter extends Partial<Record<(typeof EMPLOYEE_MORE_FILTERS)[number], string>> {
  q?: string
  // filters that can have several values are sent as 'a,b'
  propertyId?: string // hotel ids, and 'group' for group-wide
  department?: string
  status?: 'active' | 'inactive' | 'all'
}

export const useEmployees = (filter: EmployeeFilter) =>
  useQuery({
    queryKey: [...EMPLOYEES, 'list', filter],
    queryFn: () => api<EmployeeRow[]>(`/employees${queryString({ ...filter })}`),
    placeholderData: (previous) => previous,
  })

export const useEmployee = (id: number) => useQuery({ queryKey: detailKey(id), queryFn: () => api<Employee>(`/employees/${id}`) })

export const useEmployeeMentions = (id: number) =>
  useQuery({ queryKey: [...EMPLOYEES, 'mentions', id], queryFn: () => api<EmployeeMention[]>(`/employees/${id}/mentions`) })

// The picker on a mention: active employees, the stay's hotel first
export const useEmployeeOptions = (propertyId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: [...EMPLOYEES, 'options', propertyId],
    queryFn: () => api<EmployeeOption[]>(`/employees/options${queryString({ propertyId })}`),
    enabled,
  })

export const useLoginOptions = (enabled: boolean) =>
  useQuery({ queryKey: [...EMPLOYEES, 'logins'], queryFn: () => api<LoginOption[]>('/employees/staff-options'), enabled })

export interface EmployeeInput {
  firstName: string
  lastName: string | null
  propertyId: string | null
  department: Department
  jobTitle: string | null
  staffUserId: number | null
  isActive?: boolean
}

export interface StaffListInput {
  propertyId: string | null
  rows: Record<string, string>[]
}

export function useEmployeeMutations() {
  const queryClient = useQueryClient()
  const saved = (employee: Employee) => {
    queryClient.setQueryData(detailKey(employee.id), employee)
    queryClient.invalidateQueries({ queryKey: EMPLOYEES })
    queryClient.invalidateQueries({ queryKey: ['feedback', 'detail'] })
  }
  return {
    create: useMutation({
      mutationFn: (input: EmployeeInput) => api<Employee>('/employees', { method: 'POST', body: input }),
      onSuccess: saved,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<EmployeeInput> & { id: number }) =>
        api<Employee>(`/employees/${id}`, { method: 'PATCH', body: input }),
      onSuccess: saved,
    }),
    previewStaffList: useMutation({
      mutationFn: (input: StaffListInput) => api<StaffListPlan>('/employees/uploads/preview', { method: 'POST', body: input }),
    }),
    uploadStaffList: useMutation({
      mutationFn: (input: StaffListInput) => api<StaffListPlan>('/employees/uploads', { method: 'POST', body: input }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES }),
    }),
  }
}
