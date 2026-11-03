import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NewGuestInput } from '@/hooks/use-guests'
import { api, queryString } from '@/lib/api'
import { is, missing, set, without, type Clash } from '@/lib/filter-clashes'
import type { FollowUpFilter, InteractionDirection, InteractionKind, LeadSource, LeadStatus, LostReason } from '@/lib/leads'
import type { InteractionItem, Lead, LeadBoard, LeadCards, LeadList, StaffOption, TimelineItem } from '@/lib/types'

// Leads and logged conversations (Module 7). Any change to a lead refreshes
// every lead list; a new lead can move the person's stage, so guests too.
const LEADS = ['leads']
const detailKey = (id: number) => [...LEADS, 'detail', id]
const timelineKey = (id: number) => [...LEADS, 'timeline', id]

// The "More filters" panel, kept in the address under the API's own names.
// The board and the list share them; the lost reason is the list's alone.
export const LEAD_MORE_FILTERS = [
  'campaignId',
  'occasionId',
  'checkInFrom',
  'checkInTo',
  'createdFrom',
  'createdTo',
  'currency',
  'quoteMin',
  'quoteMax',
  'contacted',
  'stayToLink',
  'market',
  'country',
  'filled',
  'filledMatch',
  'missing',
  'missingMatch',
] as const

// Filters that can't be combined; the one just chosen wins (see filter-clashes.ts).
export const LEAD_CLASHES: Clash[] = [
  { a: set('hotel', 'Hotel'), b: missing('hotel', 'Hotel') },
  { a: set('occasionId', 'Occasion'), b: missing('occasion', 'Occasion') },
  { a: set(['checkInFrom', 'checkInTo'], 'Check-in asked for'), b: missing('checkIn', 'Check-in date') },
]

// The list's status, follow-up and lost reason: only open leads have a
// follow-up, only lost ones a reason, only booked ones a stay to link.
const lost = set('lostReason', 'Lost because')
const due = set('due', 'Follow-up')
const toLink = is('stayToLink', 'yes', 'Stay to link')
export const LEAD_LIST_CLASHES: Clash[] = [
  ...LEAD_CLASHES,
  { a: without('status', ['lost'], 'Status'), b: lost },
  { a: without('status', ['open', 'new', 'contacted', 'quoted'], 'Status'), b: due },
  { a: without('status', ['booked'], 'Status'), b: toLink },
  { a: lost, b: due },
  { a: lost, b: toLink },
  { a: due, b: toLink },
]

export interface LeadFilter extends Partial<Record<(typeof LEAD_MORE_FILTERS)[number], string>> {
  q?: string
  // filters that can have several values are sent as 'a,b'
  owner?: string // staff ids, 'me' and 'none'
  propertyId?: string
  source?: string
  status?: string // statuses and 'open'
  followUp?: FollowUpFilter
  lostReason?: string
  page?: number
}

export const useLeads = (filter: LeadFilter) =>
  useQuery({
    queryKey: [...LEADS, 'list', filter],
    queryFn: () => api<LeadList>(`/leads${queryString({ ...filter, page: filter.page?.toString() })}`),
    placeholderData: (previous) => previous,
  })

export const useLeadBoard = (filter: Omit<LeadFilter, 'status' | 'followUp' | 'lostReason' | 'page'>) =>
  useQuery({
    queryKey: [...LEADS, 'board', filter],
    queryFn: () => api<LeadBoard>(`/leads/board${queryString(filter)}`),
    placeholderData: (previous) => previous,
  })

export const useFollowUps = (enabled = true) =>
  useQuery({ queryKey: [...LEADS, 'follow-ups'], queryFn: () => api<LeadCards>('/leads/follow-ups'), enabled })

export const useLead = (id: number) => useQuery({ queryKey: detailKey(id), queryFn: () => api<Lead>(`/leads/${id}`) })

export const useLeadTimeline = (id: number) =>
  useQuery({ queryKey: timelineKey(id), queryFn: () => api<TimelineItem[]>(`/leads/${id}/timeline`) })

export const useGuestLeads = (guestId: number) =>
  useQuery({ queryKey: [...LEADS, 'guest', guestId], queryFn: () => api<LeadCards>(`/guests/${guestId}/leads`) })

export const useGuestInteractions = (guestId: number) =>
  useQuery({
    queryKey: [...LEADS, 'guest-interactions', guestId],
    queryFn: () => api<InteractionItem[]>(`/guests/${guestId}/interactions`),
  })

// Admin and management users, who can own leads (deactivated ones too, for filters)
export const useLeadOwners = () =>
  useQuery({ queryKey: [...LEADS, 'owners'], queryFn: () => api<StaffOption[]>('/leads/owners'), staleTime: 5 * 60_000 })

export interface LeadRequestInput {
  source: LeadSource
  propertyId: string | null
  checkIn: string | null
  checkOut: string | null
  adults: number | null
  children: number | null
  occasionId: number | null
}

export interface NewLeadInput extends LeadRequestInput {
  contactId?: number
  newPerson?: NewGuestInput
  ownerId: number
  followUpOn: string
  note: string | null
}

export interface LeadUpdate extends Partial<LeadRequestInput> {
  ownerId?: number
  followUpOn?: string
  quotedValue?: number | null
  currency?: string | null
}

export interface StatusChangeInput {
  status: LeadStatus
  lostReason?: LostReason | null
  quotedValue?: number | null
  currency?: string | null
  stayId?: number | null
  stayToLink?: boolean
  ownerId?: number | null
  followUpOn?: string | null
  note?: string | null
}

export interface InteractionInput {
  kind: InteractionKind
  direction: InteractionDirection | null
  occurredAt?: string // ISO; now when left out
  staffId?: number | null
  summary: string
  contactId?: number | null
  companyId?: number | null
  leadId?: number | null
  feedbackId?: number | null // following up a feedback response
  followUpOn?: string // next follow-up, on an open lead
}

export function useLeadMutations() {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: LEADS })
    queryClient.invalidateQueries({ queryKey: ['guests'] })
    queryClient.invalidateQueries({ queryKey: ['companies'] })
  }
  const saved = (lead: Lead) => {
    queryClient.setQueryData(detailKey(lead.id), lead)
    refresh()
  }
  return {
    create: useMutation({
      mutationFn: (input: NewLeadInput) => api<Lead>('/leads', { method: 'POST', body: input }),
      onSuccess: saved,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: LeadUpdate & { id: number }) => api<Lead>(`/leads/${id}`, { method: 'PATCH', body: input }),
      onSuccess: saved,
    }),
    changeStatus: useMutation({
      mutationFn: ({ id, ...input }: StatusChangeInput & { id: number }) =>
        api<Lead>(`/leads/${id}/status`, { method: 'POST', body: input }),
      onSuccess: saved,
    }),
    linkStay: useMutation({
      mutationFn: ({ id, stayId }: { id: number; stayId: number }) =>
        api<Lead>(`/leads/${id}/link-stay`, { method: 'POST', body: { stayId } }),
      onSuccess: (lead) => {
        saved(lead)
        queryClient.invalidateQueries({ queryKey: ['stays'] })
      },
    }),
    snooze: useMutation({
      mutationFn: (id: number) => api<Lead>(`/leads/${id}/snooze`, { method: 'POST' }),
      onSuccess: saved,
    }),
    addNote: useMutation({
      mutationFn: ({ id, body }: { id: number; body: string }) =>
        api<TimelineItem[]>(`/leads/${id}/notes`, { method: 'POST', body: { body } }),
      onSuccess: (timeline, { id }) => {
        queryClient.setQueryData(timelineKey(id), timeline)
        queryClient.invalidateQueries({ queryKey: ['knowledge', 'notes'] })
      },
    }),
    remove: useMutation({
      mutationFn: (id: number) => api(`/leads/${id}`, { method: 'DELETE' }),
      onSuccess: (_data, id) => {
        queryClient.removeQueries({ queryKey: detailKey(id) })
        refresh()
      },
    }),
  }
}

// Logging a reply can move a lead, so leads and company timelines are refreshed
// too, and a feedback response's follow-up (Module 8).
export function useInteractionMutations() {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: LEADS })
    queryClient.invalidateQueries({ queryKey: ['companies'] })
    queryClient.invalidateQueries({ queryKey: ['feedback'] })
  }
  return {
    create: useMutation({
      mutationFn: (input: InteractionInput) => api<InteractionItem>('/interactions', { method: 'POST', body: input }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<InteractionInput> & { id: number }) =>
        api<InteractionItem>(`/interactions/${id}`, { method: 'PATCH', body: input }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api(`/interactions/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
  }
}
