import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, queryString } from '@/lib/api'
import type {
  Campaign,
  CampaignPeople,
  CampaignReport,
  CampaignResults,
  ContactCampaignEmail,
  EmailSummary,
  MailchimpEmail,
  PeopleShow,
} from '@/lib/types'

// Campaigns. A new name or a closed campaign shows on lead cards and in the
// leads' Campaign filter, so leads are refreshed too.
const CAMPAIGNS = ['campaigns']
const MAILCHIMP = [...CAMPAIGNS, 'mailchimp']

export const useCampaigns = (enabled = true) =>
  useQuery({ queryKey: CAMPAIGNS, queryFn: () => api<Campaign[]>('/campaigns'), enabled })

export const useCampaign = (id: number) =>
  useQuery({ queryKey: [...CAMPAIGNS, 'detail', id], queryFn: () => api<Campaign>(`/campaigns/${id}`) })

// ---------- Mailchimp ----------
// Mailchimp problems (an expired key, Mailchimp down) aren't tried again
// straight away: the page says what's wrong and offers Try again.
const mailchimpRetry = (count: number, error: Error) =>
  !(error instanceof ApiError && (error.status < 500 || error.code?.startsWith('mailchimp_'))) && count < 2
// the API keeps Mailchimp's answers for 5 minutes, so the app does too
const STALE = 5 * 60_000

// every sent email's headline figures, for the list
export const useEmailSummaries = (enabled = true) =>
  useQuery({
    queryKey: [...MAILCHIMP, 'summaries'],
    queryFn: () => api<EmailSummary[]>('/campaigns/mailchimp/summaries'),
    enabled,
    retry: mailchimpRetry,
    staleTime: STALE,
  })

// sent emails to link a campaign to
export const useMailchimpEmails = (enabled: boolean) =>
  useQuery({
    queryKey: [...MAILCHIMP, 'emails'],
    queryFn: () => api<MailchimpEmail[]>('/campaigns/mailchimp/emails'),
    enabled,
    retry: mailchimpRetry,
    staleTime: 60_000,
  })

const reportKey = (id: number) => [...MAILCHIMP, 'report', id]

export const useCampaignReport = (id: number, enabled: boolean) =>
  useQuery({
    queryKey: reportKey(id),
    queryFn: () => api<CampaignReport>(`/campaigns/${id}/report`),
    enabled,
    retry: mailchimpRetry,
    staleTime: STALE,
  })

// the Refresh button: the API asks Mailchimp again (unless it did in the last 30 seconds)
export function useRefreshReport(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<CampaignReport>(`/campaigns/${id}/report?fresh=1`),
    onSuccess: (report) => {
      queryClient.setQueryData(reportKey(id), report)
      queryClient.invalidateQueries({ queryKey: [...MAILCHIMP, 'summaries'] })
    },
  })
}

// the email itself, for the preview
export const useEmailHtml = (id: number, enabled: boolean) =>
  useQuery({
    queryKey: [...MAILCHIMP, 'html', id],
    queryFn: () => api<{ html: string }>(`/campaigns/${id}/email-html`),
    enabled,
    retry: mailchimpRetry,
    staleTime: 60 * 60_000,
  })

// ---------- synced from Mailchimp ----------
const resultsKey = (id: number) => [...MAILCHIMP, 'results', id]

// Until the first sync is in (it starts when the email is linked), look again every 5 seconds.
export const useCampaignResults = (id: number, enabled: boolean) =>
  useQuery({
    queryKey: resultsKey(id),
    queryFn: () => api<CampaignResults>(`/campaigns/${id}/results`),
    enabled,
    refetchInterval: (query) => (query.state.data && !query.state.data.recipients && !query.state.data.sync?.lastError ? 5_000 : false),
  })

export const useCampaignPeople = (id: number, query: { show: PeopleShow; q: string; page: number }, enabled: boolean) =>
  useQuery({
    queryKey: [...MAILCHIMP, 'people', id, query],
    queryFn: () =>
      api<CampaignPeople>(
        `/campaigns/${id}/people${queryString({ show: query.show, q: query.q || undefined, page: String(query.page) })}`,
      ),
    enabled,
    placeholderData: keepPreviousData,
  })

// Sync now
export function useSyncCampaign(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<CampaignResults>(`/campaigns/${id}/sync`, { method: 'POST' }),
    onSuccess: (results) => queryClient.setQueryData(resultsKey(id), results),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: resultsKey(id) })
      queryClient.invalidateQueries({ queryKey: [...MAILCHIMP, 'people', id] })
    },
  })
}

export const useContactCampaignEmails = (contactId: number, enabled: boolean) =>
  useQuery({
    queryKey: [...MAILCHIMP, 'contact', contactId],
    queryFn: () => api<ContactCampaignEmail[]>(`/campaigns/contact/${contactId}/emails`),
    enabled,
  })

export type CampaignChanges = {
  name?: string
  slug?: string
  ownerId?: number
  isActive?: boolean
  mailchimpCampaignId?: string | null
  notificationEmails?: string[]
}

export function useCampaignMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: CAMPAIGNS }) // the Mailchimp queries are under it too
    queryClient.invalidateQueries({ queryKey: ['leads'] })
  }
  return {
    create: useMutation({
      mutationFn: (input: { name: string; ownerId: number }) => api<Campaign>('/campaigns', { method: 'POST', body: input }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: number } & CampaignChanges) =>
        api<Campaign>(`/campaigns/${id}`, { method: 'PATCH', body: input }),
      onSuccess,
    }),
  }
}
