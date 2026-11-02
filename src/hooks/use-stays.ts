import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NewGuestInput } from '@/hooks/use-guests'
import { api, queryString } from '@/lib/api'
import type { QuickView, StayChannel, StayStatus } from '@/lib/stays'
import type {
  GuestStays,
  ImportHistoryRow,
  ImportPreview,
  ImportResult,
  ImportSetup,
  QuickCounts,
  Stay,
  StayList,
} from '@/lib/types'

const STAYS = ['stays']
const LIST = [...STAYS, 'list']
const COUNTS = [...STAYS, 'quick-counts']
const detailKey = (id: number) => [...STAYS, 'detail', id]
const guestStaysKey = (guestId: number) => [...STAYS, 'guest', guestId]
const IMPORTS = [...STAYS, 'imports']

// ---------- list ----------
// The "More filters" panel, kept in the address under the API's own names.
export const STAY_MORE_FILTERS = [
  'departureFrom',
  'departureTo',
  'nightsMin',
  'nightsMax',
  'guestsMin',
  'guestsMax',
  'children',
  'roomType',
  'currency',
  'revenueMin',
  'revenueMax',
  'remarks',
  'feedback',
  'fromLead',
  'guestStage',
  'market',
  'country',
] as const

export interface StayFilter extends Partial<Record<(typeof STAY_MORE_FILTERS)[number], string>> {
  q?: string
  view?: QuickView
  // filters that can have several values are sent as 'a,b'
  propertyId?: string
  status?: string
  arrivalFrom?: string
  arrivalTo?: string
  channel?: string
  occasionId?: string
  companyId?: string
  sort?: 'arrival' | 'departure'
  order?: 'asc' | 'desc'
  page?: number
}

export const useStays = (filter: StayFilter) =>
  useQuery({
    queryKey: [...LIST, filter],
    queryFn: () => api<StayList>(`/stays${queryString({ ...filter, page: filter.page?.toString() })}`),
    placeholderData: (previous) => previous,
  })

export const useQuickCounts = () => useQuery({ queryKey: COUNTS, queryFn: () => api<QuickCounts>('/stays/quick-counts') })

// ---------- one stay, and a guest's stays ----------
export const useStay = (id: number | null) =>
  useQuery({ queryKey: detailKey(id ?? 0), queryFn: () => api<Stay>(`/stays/${id}`), enabled: !!id })

export const useGuestStays = (guestId: number, enabled = true) =>
  useQuery({ queryKey: guestStaysKey(guestId), queryFn: () => api<GuestStays>(`/guests/${guestId}/stays`), enabled })

export interface StayInput {
  propertyId: string
  arrivalDate: string
  departureDate: string
  bookingReference: string | null
  roomType: string | null
  adults: number | null
  children: number | null
  roomRevenue: number | null
  currency: string | null
  channel: StayChannel
  bookingCompanyId: number | null
  occasionId: number | null
  bookingRemarks: string | null
}

export interface NewStayInput extends StayInput {
  contactId?: number
  newGuest?: NewGuestInput
  status: StayStatus
}

// A stay changing can move the guest's stage (check-out, cancel), so guest
// lists and profiles are refreshed too.
export function useStayMutations() {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: LIST })
    queryClient.invalidateQueries({ queryKey: COUNTS })
    queryClient.invalidateQueries({ queryKey: [...STAYS, 'guest'] })
    queryClient.invalidateQueries({ queryKey: ['guests'] })
    // a new stay can book an open lead, and shows on its agent's profile (Module 7)
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['companies'] })
  }
  const saved = (stay: Stay) => {
    queryClient.setQueryData(detailKey(stay.id), stay)
    refresh()
  }
  return {
    create: useMutation({
      mutationFn: (input: NewStayInput) => api<Stay>('/stays', { method: 'POST', body: input }),
      onSuccess: saved,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<StayInput> & { id: number; contactId?: number }) =>
        api<Stay>(`/stays/${id}`, { method: 'PATCH', body: input }),
      onSuccess: saved,
    }),
    changeStatus: useMutation({
      mutationFn: ({ id, ...input }: { id: number; status: StayStatus; reason?: string | null }) =>
        api<Stay>(`/stays/${id}/status`, { method: 'POST', body: input }),
      onSuccess: saved,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api(`/stays/${id}`, { method: 'DELETE' }),
      onSuccess: (_data, id) => {
        queryClient.removeQueries({ queryKey: detailKey(id) })
        refresh()
      },
    }),
  }
}

// ---------- booking import ----------
export type ImportRow = Record<string, string>

export interface ImportInput {
  fileName: string
  propertyId: string | null
  rows: ImportRow[]
}

export const useImportSetup = () =>
  useQuery({ queryKey: [...IMPORTS, 'setup'], queryFn: () => api<ImportSetup>('/stays/imports/setup') })

export const useImportHistory = () =>
  useQuery({ queryKey: [...IMPORTS, 'history'], queryFn: () => api<ImportHistoryRow[]>('/stays/imports') })

export function useImportMutations() {
  const queryClient = useQueryClient()
  return {
    saveMapping: useMutation({
      mutationFn: (mapping: Record<string, string>) =>
        api<ImportSetup>('/stays/imports/mapping', { method: 'PUT', body: { mapping } }),
      onSuccess: (setup) => queryClient.setQueryData([...IMPORTS, 'setup'], setup),
    }),
    preview: useMutation({
      mutationFn: (input: ImportInput) => api<ImportPreview>('/stays/imports/preview', { method: 'POST', body: input }),
    }),
    commit: useMutation({
      mutationFn: (input: ImportInput & { skip: number[] }) =>
        api<ImportResult>('/stays/imports', { method: 'POST', body: input }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: STAYS })
        queryClient.invalidateQueries({ queryKey: ['guests'] })
        queryClient.invalidateQueries({ queryKey: ['leads'] }) // new bookings can book open leads
        queryClient.invalidateQueries({ queryKey: ['companies'] })
      },
    }),
  }
}
