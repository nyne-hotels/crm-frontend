import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

const asCountry = (code: string | null | undefined) =>
  code && isSupportedCountry(code) ? (code as CountryCode) : undefined

// How the API will save the number: the international form, e.g. +94 77 123 4567.
// Mirrors backend/src/guests/guest-rules.ts; null when it can't be a phone number.
export function formatPhone(number: string, country: string | null | undefined): string | null {
  if (!number.trim()) return null
  const parsed = parsePhoneNumberFromString(number.trim(), asCountry(country))
  return parsed?.isPossible() ? parsed.formatInternational() : null
}

// Splits a saved number into the country picker and the number field, for editing:
// '+94 77 123 4567' → LK and '077 123 4567'.
export function splitPhone(value: string): { country: string | null; number: string } {
  const parsed = parsePhoneNumberFromString(value)
  if (!parsed?.country) return { country: null, number: value }
  return { country: parsed.country, number: parsed.formatNational() }
}

// For tel: links
export const phoneHref = (value: string) => `tel:${value.replace(/[^\d+]/g, '')}`

// The hint under a phone field: what will be saved, or why it can't be.
export function phoneHint(number: string, country: string | null) {
  if (!number.trim()) return undefined
  const formatted = formatPhone(number, country)
  return formatted ? `Saved as ${formatted}` : country ? 'Not a complete phone number yet' : 'Choose the country code'
}
