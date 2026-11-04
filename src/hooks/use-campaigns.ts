import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Campaign } from '@/lib/types'

// Marketing → Campaigns. A new name or a closed campaign shows on lead cards
// and in the leads' Campaign filter, so leads are refreshed too.
const CAMPAIGNS = ['campaigns']

export const useCampaigns = (enabled = true) =>
  useQuery({ queryKey: CAMPAIGNS, queryFn: () => api<Campaign[]>('/campaigns'), enabled })

export function useCampaignMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: CAMPAIGNS })
    queryClient.invalidateQueries({ queryKey: ['leads'] })
  }
  return {
    create: useMutation({
      mutationFn: (input: { name: string; ownerId: number }) => api<Campaign>('/campaigns', { method: 'POST', body: input }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: number; name?: string; slug?: string; ownerId?: number; isActive?: boolean }) =>
        api<Campaign>(`/campaigns/${id}`, { method: 'PATCH', body: input }),
      onSuccess,
    }),
  }
}
