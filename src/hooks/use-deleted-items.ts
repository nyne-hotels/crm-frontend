import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, queryString } from '@/lib/api'
import type { DeletedItems, DeletedKind } from '@/lib/types'

// ---------- Settings → Deleted items ----------
export const useDeletedItems = (filter: { kind: DeletedKind; q?: string; page: number }) =>
  useQuery({
    queryKey: ['settings', 'deleted-items', filter],
    queryFn: () =>
      api<DeletedItems>(
        `/settings/deleted-items${queryString({ kind: filter.kind, q: filter.q, page: filter.page > 1 ? String(filter.page) : undefined })}`,
      ),
    placeholderData: (previous) => previous,
  })

// A restored guest, stay or company is back in lists, counts and the email
// list, so everything is re-read.
export function useRestore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, id }: { kind: DeletedKind; id: number }) => api(`/${kind}/${id}/restore`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
