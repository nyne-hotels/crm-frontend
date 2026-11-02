import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, queryString } from '@/lib/api'
import type { StaffRole } from '@/lib/permissions'
import type { Occasion, Property, StaffUser, Tag } from '@/lib/types'

// ---------- staff users ----------
export interface StaffUserFilter {
  q?: string
  role?: StaffRole
  propertyId?: string // a hotel id, or 'all' for group-wide staff
}

export interface StaffUserInput {
  firstName: string
  lastName: string | null
  username: string
  role: StaffRole
  propertyId: string | null
  email: string | null
  temporaryPassword?: string
}

const STAFF = ['settings', 'staff-users']

export const useStaffUsers = (filter: StaffUserFilter) =>
  useQuery({
    queryKey: [...STAFF, filter],
    queryFn: () => api<StaffUser[]>(`/settings/staff-users${queryString({ ...filter })}`),
    placeholderData: (previous) => previous,
  })

export function useStaffUserMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: STAFF })
  return {
    create: useMutation({
      mutationFn: (input: StaffUserInput) => api<StaffUser>('/settings/staff-users', { method: 'POST', body: input }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<StaffUserInput> & { id: number }) =>
        api<StaffUser>(`/settings/staff-users/${id}`, { method: 'PATCH', body: input }),
      onSuccess,
    }),
    resetPassword: useMutation({
      mutationFn: ({ id, temporaryPassword }: { id: number; temporaryPassword: string }) =>
        api(`/settings/staff-users/${id}/reset-password`, { method: 'POST', body: { temporaryPassword } }),
      onSuccess,
    }),
    signOutEverywhere: useMutation({
      mutationFn: (id: number) => api(`/settings/staff-users/${id}/sign-out-everywhere`, { method: 'POST' }),
    }),
    setActive: useMutation({
      mutationFn: ({ id, active }: { id: number; active: boolean }) =>
        api<StaffUser>(`/settings/staff-users/${id}/${active ? 'reactivate' : 'deactivate'}`, { method: 'POST' }),
      onSuccess,
    }),
  }
}

// ---------- hotels ----------
const PROPERTIES = ['settings', 'properties']

export const useProperties = () =>
  useQuery({ queryKey: PROPERTIES, queryFn: () => api<Property[]>('/settings/properties') })

export function useUpdateProperty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<Omit<Property, 'lastUpdated'>> & { id: string }) =>
      api<Property>(`/settings/properties/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROPERTIES })
      queryClient.invalidateQueries({ queryKey: ['reference', 'properties'] })
      queryClient.invalidateQueries({ queryKey: STAFF }) // home hotel names
    },
  })
}

// ---------- occasions ----------
const OCCASIONS = ['settings', 'occasions']

export const useOccasions = () =>
  useQuery({ queryKey: OCCASIONS, queryFn: () => api<Occasion[]>('/settings/occasions') })

export function useOccasionMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: OCCASIONS })
    queryClient.invalidateQueries({ queryKey: ['reference', 'occasions'] })
  }
  return {
    create: useMutation({
      mutationFn: (name: string) => api<Occasion>('/settings/occasions', { method: 'POST', body: { name } }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: number; name?: string; isActive?: boolean }) =>
        api<Occasion>(`/settings/occasions/${id}`, { method: 'PATCH', body: input }),
      onSuccess,
    }),
    reorder: useMutation({
      mutationFn: (ids: number[]) => api<Occasion[]>('/settings/occasions/order', { method: 'PUT', body: { ids } }),
      // show the new order straight away; the server's answer replaces it
      onMutate: (ids) => {
        const previous = queryClient.getQueryData<Occasion[]>(OCCASIONS)
        if (previous) {
          const byId = new Map(previous.map((o) => [o.id, o]))
          queryClient.setQueryData(OCCASIONS, ids.map((id) => byId.get(id)!).filter(Boolean))
        }
        return { previous }
      },
      onError: (_err, _ids, context) => queryClient.setQueryData(OCCASIONS, context?.previous),
      onSuccess: (data) => {
        queryClient.setQueryData(OCCASIONS, data)
        queryClient.invalidateQueries({ queryKey: ['reference', 'occasions'] })
      },
    }),
  }
}

// ---------- tags ----------
const TAGS = ['settings', 'tags']

export const useTags = () => useQuery({ queryKey: TAGS, queryFn: () => api<Tag[]>('/settings/tags') })

export function useTagMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: TAGS })
    queryClient.invalidateQueries({ queryKey: ['reference', 'tags'] })
    queryClient.invalidateQueries({ queryKey: ['guests', 'detail'] }) // tag names in profile headers
  }
  return {
    create: useMutation({
      mutationFn: (name: string) => api<Tag>('/settings/tags', { method: 'POST', body: { name } }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: number; name?: string; isActive?: boolean }) =>
        api<Tag>(`/settings/tags/${id}`, { method: 'PATCH', body: input }),
      onSuccess,
    }),
  }
}
