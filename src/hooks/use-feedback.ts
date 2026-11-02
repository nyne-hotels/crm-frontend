import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, queryString } from '@/lib/api'
import type { FeedbackTab, Sentiment } from '@/lib/feedback'
import type {
  Feedback,
  FeedbackList,
  FeedbackPanelRow,
  FeedbackStayOption,
  HotelRatings,
  Mention,
  ResponseUpload,
  TimelineItem,
} from '@/lib/types'

// Guest feedback and employee mentions (Module 8). Any change refreshes
// every feedback list, the panels, hotel ratings and the employees' counts.
const FEEDBACK = ['feedback']
const detailKey = (id: number) => [...FEEDBACK, 'detail', id]
const timelineKey = (id: number) => [...FEEDBACK, 'timeline', id]

// The inbox's "More filters" panel, kept in the address under the API's own names.
export const FEEDBACK_MORE_FILTERS = [
  'ratingMin',
  'ratingMax',
  'rated',
  'review',
  'mentions',
  'contacted',
  'stayFrom',
  'stayTo',
  'channel',
  'market',
] as const

export interface FeedbackFilter extends Partial<Record<(typeof FEEDBACK_MORE_FILTERS)[number], string>> {
  q?: string
  tab?: FeedbackTab
  propertyId?: string
  rating?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export const useFeedbackList = (filter: FeedbackFilter, enabled = true) =>
  useQuery({
    queryKey: [...FEEDBACK, 'list', filter],
    queryFn: () =>
      api<FeedbackList>(
        `/feedback${queryString({ ...filter, tab: filter.tab === 'all' ? undefined : filter.tab, page: filter.page?.toString(), pageSize: filter.pageSize?.toString() })}`,
      ),
    placeholderData: (previous) => previous,
    enabled,
  })

export const useFeedback = (id: number) => useQuery({ queryKey: detailKey(id), queryFn: () => api<Feedback>(`/feedback/${id}`) })

export const useFeedbackTimeline = (id: number) =>
  useQuery({ queryKey: timelineKey(id), queryFn: () => api<TimelineItem[]>(`/feedback/${id}/timeline`) })

export const useHotelRatings = () => useQuery({ queryKey: [...FEEDBACK, 'ratings'], queryFn: () => api<HotelRatings>('/feedback/ratings') })

export const useGuestFeedback = (guestId: number) =>
  useQuery({ queryKey: [...FEEDBACK, 'guest', guestId], queryFn: () => api<FeedbackPanelRow[]>(`/guests/${guestId}/feedback`) })

export const useStayFeedback = (stayId: number) =>
  useQuery({
    queryKey: [...FEEDBACK, 'stay', stayId],
    queryFn: () => api<{ feedback: FeedbackPanelRow | null }>(`/stays/${stayId}/feedback`),
  })

// Add response: stays by guest name or booking reference
export function useFeedbackStaySearch(search: string, enabled: boolean) {
  const q = useDebouncedValue(search.trim(), 250)
  return useQuery({
    queryKey: [...FEEDBACK, 'stays', q],
    queryFn: () => api<FeedbackStayOption[]>(`/feedback/stays${queryString({ q })}`),
    enabled: enabled && q.length >= 2,
    placeholderData: (previous) => previous,
  })
}

export interface FeedbackInput {
  stayId: number
  rating: number | null
  review: string | null
  receivedOn?: string // a day; today means now
}

export interface MentionInput {
  employeeId?: number | null
  nameAsWritten?: string | null
  sentiment: Sentiment
  comment?: string | null
}

export function useFeedbackMutations() {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: FEEDBACK })
    queryClient.invalidateQueries({ queryKey: ['employees'] })
  }
  const saved = (feedback: Feedback) => {
    queryClient.setQueryData(detailKey(feedback.id), feedback)
    refresh()
  }
  const mentionsSaved = (id: number) => (mentions: Mention[]) => {
    queryClient.setQueryData<Feedback>(detailKey(id), (f) => f && { ...f, mentions })
    refresh()
  }
  return {
    create: useMutation({
      mutationFn: (input: FeedbackInput) => api<Feedback>('/feedback', { method: 'POST', body: input }),
      onSuccess: saved,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<Omit<FeedbackInput, 'stayId'>> & { id: number }) =>
        api<Feedback>(`/feedback/${id}`, { method: 'PATCH', body: input }),
      onSuccess: saved,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api(`/feedback/${id}`, { method: 'DELETE' }),
      onSuccess: (_data, id) => {
        queryClient.removeQueries({ queryKey: detailKey(id) })
        refresh()
      },
    }),
    followUp: useMutation({
      mutationFn: ({ id, outcome }: { id: number; outcome: string }) =>
        api<Feedback>(`/feedback/${id}/follow-up`, { method: 'POST', body: { outcome } }),
      onSuccess: saved,
    }),
    clearFollowUp: useMutation({
      mutationFn: (id: number) => api<Feedback>(`/feedback/${id}/follow-up`, { method: 'DELETE' }),
      onSuccess: saved,
    }),
    addNote: useMutation({
      mutationFn: ({ id, body }: { id: number; body: string }) =>
        api<TimelineItem[]>(`/feedback/${id}/notes`, { method: 'POST', body: { body } }),
      onSuccess: (timeline, { id }) => {
        queryClient.setQueryData(timelineKey(id), timeline)
        queryClient.invalidateQueries({ queryKey: ['knowledge', 'notes'] })
      },
    }),
    addMention: useMutation({
      mutationFn: ({ feedbackId, ...input }: MentionInput & { feedbackId: number }) =>
        api<Mention[]>(`/feedback/${feedbackId}/mentions`, { method: 'POST', body: input }),
      onSuccess: (mentions, { feedbackId }) => mentionsSaved(feedbackId)(mentions),
    }),
    updateMention: useMutation({
      mutationFn: ({ id, ...input }: Partial<MentionInput> & { id: number; feedbackId: number }) =>
        api<Mention[]>(`/feedback/mentions/${id}`, { method: 'PATCH', body: { ...input, feedbackId: undefined } }),
      onSuccess: (mentions, { feedbackId }) => mentionsSaved(feedbackId)(mentions),
    }),
    removeMention: useMutation({
      mutationFn: ({ id }: { id: number; feedbackId: number }) => api<Mention[]>(`/feedback/mentions/${id}`, { method: 'DELETE' }),
      onSuccess: (mentions, { feedbackId }) => mentionsSaved(feedbackId)(mentions),
    }),
    previewUpload: useMutation({
      mutationFn: (rows: Record<string, string>[]) =>
        api<ResponseUpload>('/feedback/uploads/preview', { method: 'POST', body: { rows } }),
    }),
    upload: useMutation({
      mutationFn: (rows: Record<string, string>[]) => api<ResponseUpload>('/feedback/uploads', { method: 'POST', body: { rows } }),
      onSuccess: refresh,
    }),
  }
}
