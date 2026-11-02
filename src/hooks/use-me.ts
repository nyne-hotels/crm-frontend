import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Me } from '@/lib/types'

export const ME_KEY = ['me']

// The signed-in staff member, or an ApiError(401) when signed out.
export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: () => api<Me>('/me'), retry: false, staleTime: 60_000 })
}
