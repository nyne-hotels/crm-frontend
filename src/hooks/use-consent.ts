import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MARKETING } from '@/hooks/use-marketing'
import { api } from '@/lib/api'
import type { ConsentChannel, ConsentSource } from '@/lib/consent'
import type { GuestConsent } from '@/lib/types'

// The Consent panel, the do-not-contact banner and the profile's ⋯ menu all
// read this one query (Module 5).
export const consentKey = (guestId: number) => ['consent', guestId]

export const useGuestConsent = (guestId: number) =>
  useQuery({ queryKey: consentKey(guestId), queryFn: () => api<GuestConsent>(`/guests/${guestId}/consents`) })

export interface ConsentInput {
  channel: ConsentChannel
  status: 'opted_in' | 'opted_out'
  source: ConsentSource
  givenOn: string // 'YYYY-MM-DD'
  evidence: string | null
}

// Each change returns the whole panel. The guest (status, "Last updated"),
// the lists and Upcoming occasions' "can be emailed" change with it.
export function useConsentMutations(guestId: number) {
  const queryClient = useQueryClient()
  const onSuccess = (consent: GuestConsent) => {
    queryClient.setQueryData(consentKey(guestId), consent)
    queryClient.invalidateQueries({ queryKey: ['guests'] })
    queryClient.invalidateQueries({ queryKey: ['knowledge', 'upcoming'] })
    queryClient.invalidateQueries({ queryKey: MARKETING })
  }
  return {
    change: useMutation({
      mutationFn: ({ channel, ...input }: ConsentInput) =>
        api<GuestConsent>(`/guests/${guestId}/consents/${channel}`, { method: 'PUT', body: input }),
      onSuccess,
    }),
    setDoNotContact: useMutation({
      mutationFn: () => api<GuestConsent>(`/guests/${guestId}/do-not-contact`, { method: 'POST' }),
      onSuccess,
    }),
    clearDoNotContact: useMutation({
      mutationFn: () => api<GuestConsent>(`/guests/${guestId}/do-not-contact`, { method: 'DELETE' }),
      onSuccess,
    }),
  }
}
