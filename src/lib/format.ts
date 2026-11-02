const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const numberFormat = new Intl.NumberFormat('en-GB')

// A plain date such as a stay's arrival ('2026-10-21') is read as a local
// day, so it never shows as the day before in timezones behind UTC.
const toDate = (value: string | Date) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00`) : new Date(value)

// 21 Oct 2026
export const formatDate = (value: string | Date | null | undefined) => (value ? dateFormat.format(toDate(value)) : '')

// 21 Oct 2026, 14:05
export const formatDateTime = (value: string | Date | null | undefined) =>
  value ? dateTimeFormat.format(new Date(value)) : ''

// 6,333
export const formatCount = (n: number) => numberFormat.format(n)

// "1 guest", "6,333 guests"
export const plural = (n: number, one: string, many = `${one}s`) => `${formatCount(n)} ${n === 1 ? one : many}`

export const fullName = (p: { firstName: string | null; lastName: string | null }) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ')

// 🇱🇰 from 'LK' (regional indicator letters; some systems show the letters instead)
export const countryFlag = (code: string | null | undefined) =>
  code && /^[A-Z]{2}$/i.test(code)
    ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : ''
