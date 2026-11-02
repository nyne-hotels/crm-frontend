import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  ContactImportChange,
  ContactImportDetail,
  ContactImportHistoryRow,
  ContactImportPreview,
  ContactImportResult,
  ContactImportResults,
  ContactImportSetup,
  ContactRowChoice,
} from '@/lib/types'

// Settings → Import contacts (Module 9, admin only)
const IMPORTS = ['settings', 'contact-imports']

export interface ContactImportInput {
  fileName: string
  rows: Record<string, string>[]
  choices: ContactRowChoice[]
}

export const useContactImportSetup = () =>
  useQuery({ queryKey: [...IMPORTS, 'setup'], queryFn: () => api<ContactImportSetup>('/settings/contact-imports/setup') })

export const useContactImportHistory = () =>
  useQuery({ queryKey: [...IMPORTS, 'history'], queryFn: () => api<ContactImportHistoryRow[]>('/settings/contact-imports') })

export const useContactImport = (id: number) =>
  useQuery({ queryKey: [...IMPORTS, 'detail', id], queryFn: () => api<ContactImportDetail>(`/settings/contact-imports/${id}`) })

export const useContactImportChanges = (id: number) =>
  useQuery({
    queryKey: [...IMPORTS, 'changes', id],
    queryFn: () => api<ContactImportChange[]>(`/settings/contact-imports/${id}/changes`),
  })

// fetched when the result file is downloaded from the history
export const fetchContactImportResults = (id: number) => api<ContactImportResults>(`/settings/contact-imports/${id}/results`)

export function useContactImportMutations() {
  const queryClient = useQueryClient()
  return {
    saveMapping: useMutation({
      mutationFn: (mapping: Record<string, string>) =>
        api<ContactImportSetup>('/settings/contact-imports/mapping', { method: 'PUT', body: { mapping } }),
      onSuccess: (data) => queryClient.setQueryData([...IMPORTS, 'setup'], data),
    }),
    preview: useMutation({
      mutationFn: (input: ContactImportInput) =>
        api<ContactImportPreview>('/settings/contact-imports/preview', { method: 'POST', body: input }),
    }),
    commit: useMutation({
      mutationFn: (input: ContactImportInput & { mapping: Record<string, string> }) =>
        api<ContactImportResult>('/settings/contact-imports', { method: 'POST', body: { ...input, warningsRead: true } }),
      // an import reaches contacts, companies, stays, tags, notes, duplicates
      // and the marketing list, so everything is read again
      onSuccess: () => queryClient.invalidateQueries(),
    }),
  }
}
