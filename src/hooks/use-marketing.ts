import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, queryString } from '@/lib/api'
import type { EmailList, EmailListExport, ExportHistoryRow, UploadKind, UploadPreview, UploadResult } from '@/lib/types'

// Marketing → Email list and Upload unsubscribes or bounces (Module 5).
export const MARKETING = ['marketing']
const EMAIL_LIST = [...MARKETING, 'email-list']
const EXPORTS = [...MARKETING, 'exports']

// The "More filters" panel, kept in the address under the API's own names.
// Exports send them too, and the export log describes them.
export const EMAIL_LIST_MORE_FILTERS = [
  'contactType',
  'lastHotelId',
  'staysMin',
  'staysMax',
  'birthdayMonth',
  'optedInFrom',
  'optedInTo',
  'addedFrom',
  'addedTo',
  'upcomingStay',
  'lowRating',
] as const

export interface EmailListFilter extends Partial<Record<(typeof EMAIL_LIST_MORE_FILTERS)[number], string>> {
  // filters that can have several values are sent as 'a,b'
  market?: string
  country?: string
  propertyId?: string // hotels stayed at
  stage?: string
  lastStayFrom?: string // 'YYYY-MM-DD'
  lastStayTo?: string
  tagId?: string
}

export const useEmailList = (filter: EmailListFilter & { page?: number }) =>
  useQuery({
    queryKey: [...EMAIL_LIST, filter],
    queryFn: () => api<EmailList>(`/marketing/email-list${queryString({ ...filter, page: filter.page?.toString() })}`),
    // keep showing the last results while the next ones load
    placeholderData: (previous) => previous,
  })

export const useExportHistory = () =>
  useQuery({ queryKey: EXPORTS, queryFn: () => api<ExportHistoryRow[]>('/marketing/exports') })

export function useMarketingMutations() {
  const queryClient = useQueryClient()
  return {
    // the rows for the spreadsheet; the export is logged
    exportList: useMutation({
      mutationFn: (filter: EmailListFilter) =>
        api<EmailListExport>('/marketing/email-list/export', {
          method: 'POST',
          body: filter, // filters with several values go as 'a,b', as in the address
        }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: EXPORTS }),
    }),
    previewUpload: useMutation({
      mutationFn: (input: { kind: UploadKind; emails: string[] }) =>
        api<UploadPreview>('/marketing/uploads/preview', { method: 'POST', body: input }),
    }),
    // opts guests out or marks emails bounced, so profiles and lists change too
    upload: useMutation({
      mutationFn: (input: { kind: UploadKind; emails: string[]; fileName: string }) =>
        api<UploadResult>('/marketing/uploads', { method: 'POST', body: input }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: MARKETING })
        queryClient.invalidateQueries({ queryKey: ['consent'] })
        queryClient.invalidateQueries({ queryKey: ['guests'] })
        queryClient.invalidateQueries({ queryKey: ['knowledge', 'upcoming'] })
      },
    }),
  }
}
