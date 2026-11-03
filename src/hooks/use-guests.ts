import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { consentKey } from '@/hooks/use-consent'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, queryString } from '@/lib/api'
import { filled, including, is, missing, neverStayed, set, without, type Clash, type ClashSide } from '@/lib/filter-clashes'
import type { ContactMethodKind, ContactMethodStatus, ContactType, Market } from '@/lib/guests'
import { formatPhone } from '@/lib/phone'
import type { Guest, GuestList, GuestMatch } from '@/lib/types'

const GUESTS = ['guests']
const LIST = [...GUESTS, 'list']
const detailKey = (id: number) => [...GUESTS, 'detail', id]

// ---------- list ----------
// The "More filters" panel, kept in the address under the API's own names.
export const GUEST_MORE_FILTERS = [
  'company',
  'emailConsent',
  'whatsappConsent',
  'doNotContact',
  'canEmail',
  'emailStatus',
  'staysMin',
  'staysMax',
  'lastStayFrom',
  'lastStayTo',
  'addedFrom',
  'addedTo',
  'upcomingStay',
  'openLead',
  'feedback',
  'birthdayMonth',
  'filled',
  'filledMatch',
  'missing',
  'missingMatch',
] as const

// Filters that can't be combined; the one just chosen wins (see filter-clashes.ts).
const notNone: ClashSide = { key: 'feedback', label: 'Feedback given', is: (v) => v !== 'none' }
const onEmailList = is('canEmail', 'yes', 'On the marketing email list')
export const GUEST_CLASHES: Clash[] = [
  { a: onEmailList, b: is('doNotContact', 'yes', 'Marked do not contact') },
  { a: onEmailList, b: without('emailConsent', ['opted_in'], 'Email marketing') },
  { a: onEmailList, b: missing('email', 'Email') },
  { a: set('emailStatus', 'Primary email status'), b: missing('email', 'Email') },
  { a: filled('whatsapp', 'WhatsApp number'), b: missing('phone', 'Phone') },
  { a: set('country', 'Country'), b: missing('country', 'Country') },
  { a: set('company', 'Company'), b: missing('company', 'Company') },
  { a: set('tag', 'Tag'), b: missing('tags', 'Tags') },
  { a: set('birthdayMonth', 'Birthday in'), b: missing('birthday', 'Birthday') },
  { a: set('birthdayMonth', 'Birthday in'), b: missing('specialDates', 'Special dates') },
  { a: filled('birthday', 'Birthday'), b: missing('specialDates', 'Special dates') },
  { a: missing('name', 'Name'), b: filled('firstName', 'First name') },
  { a: missing('name', 'Name'), b: filled('lastName', 'Last name') },
  { a: neverStayed, b: set(['lastStayFrom', 'lastStayTo'], 'Last stay') },
  { a: neverStayed, b: set('hotel', 'Hotel stayed at') },
  { a: neverStayed, b: notNone },
  { a: neverStayed, b: including('stage', ['stayed', 'repeat_guest'], 'Stage: stayed or repeat guest') },
]

export interface GuestFilter extends Partial<Record<(typeof GUEST_MORE_FILTERS)[number], string>> {
  q?: string
  // filters that can have several values are sent as 'a,b'
  type?: string
  stage?: string
  market?: string
  country?: string
  propertyId?: string // hotels stayed at
  tagId?: string
  sort?: 'name' | 'lastStay' | 'stays'
  order?: 'asc' | 'desc'
  page?: number
}

export const useGuests = (filter: GuestFilter) =>
  useQuery({
    queryKey: [...LIST, filter],
    queryFn: () => api<GuestList>(`/guests${queryString({ ...filter, page: filter.page?.toString() })}`),
    // keep showing the last results while the next ones load, so typing doesn't flash
    placeholderData: (previous) => previous,
  })

// ---------- profile ----------
export const useGuest = (id: number) =>
  useQuery({ queryKey: detailKey(id), queryFn: () => api<Guest>(`/guests/${id}`) })

export interface GuestInput {
  firstName: string | null
  lastName: string | null
  contactType: ContactType
  countryCode: string | null
  market: Market
  designation: string | null
  vipReason: string | null
  companyId?: number | null // the travel agent or company they work for
}

export interface NewGuestInput extends GuestInput {
  email: { value: string; isShared: boolean } | null
  phone: { value: string; country: string | null; isShared: boolean; isWhatsapp: boolean | null } | null
}

export interface ContactMethodInput {
  value?: string
  country?: string | null // for phones: the picked country code
  isPrimary?: boolean
  isShared?: boolean
  isWhatsapp?: boolean | null
  status?: ContactMethodStatus
}

// Every write returns the whole profile, so it replaces the cached one and
// the list is refreshed. A change to an email can put the guest on or off the
// marketing list, so the Consent panel is re-read too.
export function useGuestMutations() {
  const queryClient = useQueryClient()
  const saved = (guest: Guest) => {
    queryClient.setQueryData(detailKey(guest.id), guest)
    queryClient.invalidateQueries({ queryKey: LIST })
    queryClient.invalidateQueries({ queryKey: consentKey(guest.id) })
  }
  return {
    create: useMutation({
      mutationFn: (input: NewGuestInput) => api<Guest>('/guests', { method: 'POST', body: input }),
      onSuccess: saved,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<GuestInput> & { id: number }) =>
        api<Guest>(`/guests/${id}`, { method: 'PATCH', body: input }),
      onSuccess: saved,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api(`/guests/${id}`, { method: 'DELETE' }),
      onSuccess: (_data, id) => {
        queryClient.removeQueries({ queryKey: detailKey(id) })
        queryClient.invalidateQueries({ queryKey: LIST })
      },
    }),
    addContactMethod: useMutation({
      mutationFn: ({ guestId, ...input }: ContactMethodInput & { guestId: number; kind: ContactMethodKind; value: string }) =>
        api<Guest>(`/guests/${guestId}/contact-methods`, { method: 'POST', body: input }),
      onSuccess: saved,
    }),
    updateContactMethod: useMutation({
      mutationFn: ({ guestId, id, ...input }: ContactMethodInput & { guestId: number; id: number }) =>
        api<Guest>(`/guests/${guestId}/contact-methods/${id}`, { method: 'PATCH', body: input }),
      onSuccess: saved,
    }),
    removeContactMethod: useMutation({
      mutationFn: ({ guestId, id }: { guestId: number; id: number }) =>
        api<Guest>(`/guests/${guestId}/contact-methods/${id}`, { method: 'DELETE' }),
      onSuccess: saved,
    }),
    addTag: useMutation({
      mutationFn: ({ guestId, tagId }: { guestId: number; tagId: number }) =>
        api<Guest>(`/guests/${guestId}/tags`, { method: 'POST', body: { tagId } }),
      onSuccess: saved,
    }),
    removeTag: useMutation({
      mutationFn: ({ guestId, tagId }: { guestId: number; tagId: number }) =>
        api<Guest>(`/guests/${guestId}/tags/${tagId}`, { method: 'DELETE' }),
      onSuccess: saved,
    }),
  }
}

// ---------- "This email belongs to Ahmed Daoud" ----------
// Other guests who already have the email or phone being typed. Checked once
// typing pauses, and only for something that looks complete. Shared addresses
// never warn, so pass enabled = false for those.
export function useGuestMatches({
  kind,
  value,
  country,
  excludeId,
  enabled = true,
}: {
  kind: ContactMethodKind
  value: string
  country?: string | null
  excludeId?: number
  enabled?: boolean
}) {
  const typed = useDebouncedValue(value.trim(), 400)
  const phone = kind === 'phone' ? formatPhone(typed, country) : null
  const ready = kind === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(typed) : !!phone
  return useQuery({
    queryKey: [...GUESTS, 'matches', kind, kind === 'email' ? typed.toLowerCase() : phone, excludeId],
    queryFn: () =>
      api<GuestMatch[]>(
        `/guests/matches${queryString({
          [kind]: kind === 'email' ? typed : phone!,
          excludeId: excludeId?.toString(),
        })}`,
      ),
    enabled: enabled && ready,
    staleTime: 30_000,
  })
}
