import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useGuestStays } from '@/hooks/use-stays'
import { api, queryString } from '@/lib/api'
import { is, missing, type Clash } from '@/lib/filter-clashes'
import type { PreferenceCategory, PreferenceKind, SpecialDateOccasion } from '@/lib/knowledge'
import type { Note, Preference, SpecialDate, UpcomingOccasions } from '@/lib/types'

// What staff know about a guest (Module 4). Each panel reads its own list;
// a change refreshes that list.
const KNOWLEDGE = ['knowledge']
const preferencesKey = (guestId: number) => [...KNOWLEDGE, 'preferences', guestId]
const specialDatesKey = (guestId: number) => [...KNOWLEDGE, 'special-dates', guestId]
const NOTES = [...KNOWLEDGE, 'notes']
const guestNotesKey = (guestId: number) => [...NOTES, 'guest', guestId]
const stayNotesKey = (stayId: number) => [...NOTES, 'stay', stayId]
const UPCOMING = [...KNOWLEDGE, 'upcoming']

// The stay the guest is in house for, if any – new notes and preferences link to it by default.
export function useCurrentStayId(guestId: number): number | null {
  const { data } = useGuestStays(guestId)
  return data?.stays.find((s) => s.status === 'checked_in')?.id ?? null
}

// ---------- likes and dislikes ----------
export const usePreferences = (guestId: number) =>
  useQuery({ queryKey: preferencesKey(guestId), queryFn: () => api<Preference[]>(`/guests/${guestId}/preferences`) })

export interface PreferenceInput {
  kind: PreferenceKind
  category: PreferenceCategory | null
  body: string
  stayId: number | null
}

export function usePreferenceMutations(guestId: number) {
  const queryClient = useQueryClient()
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: preferencesKey(guestId) })
  return {
    create: useMutation({
      mutationFn: (input: PreferenceInput) =>
        api<Preference>(`/guests/${guestId}/preferences`, { method: 'POST', body: input }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<PreferenceInput> & { id: number }) =>
        api<Preference>(`/guests/${guestId}/preferences/${id}`, { method: 'PATCH', body: input }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api(`/guests/${guestId}/preferences/${id}`, { method: 'DELETE' }),
      onSuccess,
    }),
  }
}

// ---------- notes ----------
// A note on a stay is also the guest's note, so any change refreshes every notes list
// (and the lead and company timelines, which show notes too).
export const useGuestNotes = (guestId: number) =>
  useQuery({ queryKey: guestNotesKey(guestId), queryFn: () => api<Note[]>(`/guests/${guestId}/notes`) })

export const useStayNotes = (stayId: number) =>
  useQuery({ queryKey: stayNotesKey(stayId), queryFn: () => api<Note[]>(`/stays/${stayId}/notes`) })

export function useNoteMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: NOTES })
    queryClient.invalidateQueries({ queryKey: ['leads', 'timeline'] })
    queryClient.invalidateQueries({ queryKey: ['companies', 'timeline'] })
  }
  return {
    addToGuest: useMutation({
      mutationFn: ({ guestId, ...input }: { guestId: number; body: string; stayId: number | null }) =>
        api<Note>(`/guests/${guestId}/notes`, { method: 'POST', body: input }),
      onSuccess,
    }),
    addToStay: useMutation({
      mutationFn: ({ stayId, body }: { stayId: number; body: string }) =>
        api<Note>(`/stays/${stayId}/notes`, { method: 'POST', body: { body } }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: number; body?: string; stayId?: number | null }) =>
        api<Note>(`/notes/${id}`, { method: 'PATCH', body: input }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api(`/notes/${id}`, { method: 'DELETE' }),
      onSuccess,
    }),
  }
}

// ---------- birthdays and anniversaries ----------
export const useSpecialDates = (guestId: number) =>
  useQuery({ queryKey: specialDatesKey(guestId), queryFn: () => api<SpecialDate[]>(`/guests/${guestId}/special-dates`) })

export interface SpecialDateInput {
  occasion: SpecialDateOccasion
  label: string | null
  day: number
  month: number
  year: number | null
}

export function useSpecialDateMutations(guestId: number) {
  const queryClient = useQueryClient()
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: specialDatesKey(guestId) })
    queryClient.invalidateQueries({ queryKey: UPCOMING })
  }
  return {
    create: useMutation({
      mutationFn: (input: SpecialDateInput) =>
        api<SpecialDate>(`/guests/${guestId}/special-dates`, { method: 'POST', body: input }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<SpecialDateInput> & { id: number }) =>
        api<SpecialDate>(`/guests/${guestId}/special-dates/${id}`, { method: 'PATCH', body: input }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api(`/guests/${guestId}/special-dates/${id}`, { method: 'DELETE' }),
      onSuccess,
    }),
  }
}

// ---------- Guests → Upcoming occasions ----------
// The "More filters" panel, kept in the address under the API's own names.
export const UPCOMING_MORE_FILTERS = [
  'within',
  'nextStay',
  'stage',
  'milestone',
  'filled',
  'filledMatch',
  'missing',
  'missingMatch',
] as const

// Filters that can't be combined; the one just chosen wins (see filter-clashes.ts).
// A round number needs the year.
export const UPCOMING_CLASHES: Clash[] = [{ a: is('milestone', 'yes', 'Round number'), b: missing('year', 'Year') }]

export interface UpcomingFilter extends Partial<Record<(typeof UPCOMING_MORE_FILTERS)[number], string>> {
  // filters that can have several values are sent as 'a,b'
  occasion?: string
  propertyId?: string // hotels of their next or last stay
  canEmail?: 'yes' | 'no'
}

export const useUpcomingOccasions = (filter: UpcomingFilter) =>
  useQuery({
    queryKey: [...UPCOMING, filter],
    queryFn: () => api<UpcomingOccasions>(`/special-dates/upcoming${queryString({ ...filter })}`),
    placeholderData: (previous) => previous,
  })
