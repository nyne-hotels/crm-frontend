import { CountryPicker } from '@/components/country-picker'
import { Input } from '@/components/ui/input'

// A country code picker and the number. The API saves it in the international
// form (+94 77 123 4567); the line underneath shows exactly what will be saved.
// A number typed with its own +code ignores the picker.
export function PhoneInput({
  id,
  country,
  onCountryChange,
  number,
  onNumberChange,
  invalid,
}: {
  id?: string
  country: string | null
  onCountryChange: (code: string | null) => void
  number: string
  onNumberChange: (number: string) => void
  invalid?: boolean
}) {
  return (
    <div className="flex gap-2">
      <CountryPicker
        value={country}
        onChange={onCountryChange}
        display="dialCode"
        placeholder="Code"
        aria-label="Country code"
        className="w-28 shrink-0"
      />
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="77 123 4567"
        value={number}
        onChange={(e) => onNumberChange(e.target.value)}
        aria-invalid={invalid || undefined}
      />
    </div>
  )
}

