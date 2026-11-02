import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CompanyOption, Country, OccasionOption, PropertyOption, TagOption } from '@/lib/types'

// Pick-lists for drop-downs: only active options. They rarely change, so
// they're fetched once per session (Settings screens refresh them on save).
const options = { staleTime: Infinity }

export const useCountries = () =>
  useQuery({ queryKey: ['reference', 'countries'], queryFn: () => api<Country[]>('/countries'), ...options })

export const usePropertyOptions = () =>
  useQuery({ queryKey: ['reference', 'properties'], queryFn: () => api<PropertyOption[]>('/properties'), ...options })

export const useOccasionOptions = () =>
  useQuery({ queryKey: ['reference', 'occasions'], queryFn: () => api<OccasionOption[]>('/occasions'), ...options })

// Travel agents, DMCs, OTAs … for the stay's agent drop-down and the contact's
// company. Refreshed when a company is added or renamed.
export const useCompanyOptions = () =>
  useQuery({ queryKey: ['reference', 'companies'], queryFn: () => api<CompanyOption[]>('/companies/options'), ...options })

// Active tags for the tag picker and the guest list filter
export const useTagOptions = () =>
  useQuery({ queryKey: ['reference', 'tags'], queryFn: () => api<TagOption[]>('/tags'), ...options })
