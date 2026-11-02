import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NewGuestInput } from '@/hooks/use-guests'
import { api, queryString } from '@/lib/api'
import type { CompanyStatus, CompanyType } from '@/lib/leads'
import type { Company, CompanyPerson, CompanyRow, CompanyStays, TimelineItem } from '@/lib/types'

// Companies: travel agents, DMCs, OTAs, corporates and media (Module 7).
const COMPANIES = ['companies']
const detailKey = (id: number) => [...COMPANIES, 'detail', id]
const peopleKey = (id: number) => [...COMPANIES, 'people', id]
const timelineKey = (id: number) => [...COMPANIES, 'timeline', id]

// The "More filters" panel, kept in the address under the API's own names.
export const COMPANY_MORE_FILTERS = ['country', 'people', 'bookedLastYear', 'lastContact', 'openLeads'] as const

export interface CompanyFilter extends Partial<Record<(typeof COMPANY_MORE_FILTERS)[number], string>> {
  q?: string
  // filters that can have several values are sent as 'a,b'
  type?: string
  status?: string
  owner?: string // staff ids, and 'none'
}

export const useCompanies = (filter: CompanyFilter) =>
  useQuery({
    queryKey: [...COMPANIES, 'list', filter],
    queryFn: () => api<{ rows: CompanyRow[]; today: string }>(`/companies${queryString({ ...filter })}`),
    placeholderData: (previous) => previous,
  })

export const useCompany = (id: number) => useQuery({ queryKey: detailKey(id), queryFn: () => api<Company>(`/companies/${id}`) })

export const useCompanyPeople = (id: number) =>
  useQuery({ queryKey: peopleKey(id), queryFn: () => api<CompanyPerson[]>(`/companies/${id}/people`) })

export const useCompanyStays = (id: number, page: number) =>
  useQuery({
    queryKey: [...COMPANIES, 'stays', id, page],
    queryFn: () => api<CompanyStays>(`/companies/${id}/stays${queryString({ page: String(page) })}`),
    placeholderData: (previous) => previous,
  })

export const useCompanyTimeline = (id: number) =>
  useQuery({ queryKey: timelineKey(id), queryFn: () => api<TimelineItem[]>(`/companies/${id}/timeline`) })

export interface CompanyInput {
  name: string
  companyType: CompanyType
  countryCode: string | null
  address: string | null
  website: string | null
  commissionNotes: string | null
  accountOwnerId: number | null
  status: CompanyStatus
}

// A new or renamed company changes the pick-lists (stay form, contact form) too.
export function useCompanyMutations() {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: COMPANIES })
    queryClient.invalidateQueries({ queryKey: ['reference', 'companies'] })
  }
  const saved = (company: Company) => {
    queryClient.setQueryData(detailKey(company.id), company)
    refresh()
  }
  const peopleSaved = (id: number) => (people: CompanyPerson[]) => {
    queryClient.setQueryData(peopleKey(id), people)
    refresh()
    queryClient.invalidateQueries({ queryKey: ['guests'] })
  }
  return {
    create: useMutation({
      mutationFn: (input: CompanyInput) => api<Company>('/companies', { method: 'POST', body: input }),
      onSuccess: saved,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<CompanyInput> & { id: number }) =>
        api<Company>(`/companies/${id}`, { method: 'PATCH', body: input }),
      onSuccess: saved,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api(`/companies/${id}`, { method: 'DELETE' }),
      onSuccess: (_data, id) => {
        queryClient.removeQueries({ queryKey: detailKey(id) })
        refresh()
      },
    }),
    addPerson: useMutation({
      mutationFn: ({ id, ...input }: { id: number; contactId?: number; newPerson?: NewGuestInput }) =>
        api<CompanyPerson[]>(`/companies/${id}/people`, { method: 'POST', body: input }),
      onSuccess: (people, { id }) => peopleSaved(id)(people),
    }),
    removePerson: useMutation({
      mutationFn: ({ id, contactId }: { id: number; contactId: number }) =>
        api<CompanyPerson[]>(`/companies/${id}/people/${contactId}`, { method: 'DELETE' }),
      onSuccess: (people, { id }) => peopleSaved(id)(people),
    }),
    addNote: useMutation({
      mutationFn: ({ id, body }: { id: number; body: string }) =>
        api<TimelineItem[]>(`/companies/${id}/notes`, { method: 'POST', body: { body } }),
      onSuccess: (timeline, { id }) => queryClient.setQueryData(timelineKey(id), timeline),
    }),
  }
}
