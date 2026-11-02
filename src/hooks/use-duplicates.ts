import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, queryString } from '@/lib/api'
import type { DuplicateReason } from '@/lib/duplicates'
import type { DuplicateList, MergeCompare, MergeDetail, MergeHistory, MergePreview } from '@/lib/types'

const DUPLICATES = ['duplicates']

// ---------- Guests → Possible duplicates ----------
export const useDuplicates = (filter: { reason?: DuplicateReason; page?: number }) =>
  useQuery({
    queryKey: [...DUPLICATES, 'list', filter],
    queryFn: () => api<DuplicateList>(`/duplicates${queryString({ reason: filter.reason, page: filter.page?.toString() })}`),
    placeholderData: (previous) => previous,
  })

// ---------- the merge screen ----------
export const useMergeCompare = (a: number, b: number) =>
  useQuery({
    queryKey: [...DUPLICATES, 'compare', a, b],
    queryFn: () => api<MergeCompare>(`/duplicates/compare${queryString({ a: String(a), b: String(b) })}`),
  })

// What merging would do; changes with the "Keep this one" choice.
export const useMergePreview = (keepId: number | null, removeId: number | null) =>
  useQuery({
    queryKey: [...DUPLICATES, 'preview', keepId, removeId],
    queryFn: () =>
      api<MergePreview>(`/duplicates/preview${queryString({ keepId: String(keepId), removeId: String(removeId) })}`),
    enabled: !!keepId && !!removeId,
    placeholderData: (previous) => previous,
  })

export function useDuplicateMutations() {
  const queryClient = useQueryClient()
  return {
    // Stays, notes, consent and the lists all change, so everything is re-read.
    merge: useMutation({
      mutationFn: (input: { keepId: number; removeId: number }) =>
        api<{ keptId: number }>('/duplicates/merge', { method: 'POST', body: input }),
      onSuccess: () => queryClient.invalidateQueries(),
    }),
    notDuplicate: useMutation({
      mutationFn: (pair: { a: number; b: number }) => api('/duplicates/not-duplicate', { method: 'POST', body: pair }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: DUPLICATES }),
    }),
    undoNotDuplicate: useMutation({
      mutationFn: ({ a, b }: { a: number; b: number }) =>
        api(`/duplicates/not-duplicate${queryString({ a: String(a), b: String(b) })}`, { method: 'DELETE' }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: DUPLICATES }),
    }),
  }
}

// ---------- Settings → Merge history ----------
export const useMergeHistory = (page: number) =>
  useQuery({
    queryKey: ['settings', 'merges', page],
    queryFn: () => api<MergeHistory>(`/settings/merges${queryString({ page: page > 1 ? String(page) : undefined })}`),
    placeholderData: (previous) => previous,
  })

export const useMergeDetail = (id: number) =>
  useQuery({ queryKey: ['settings', 'merges', 'detail', id], queryFn: () => api<MergeDetail>(`/settings/merges/${id}`) })
