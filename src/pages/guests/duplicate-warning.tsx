import { TriangleAlertIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useGuestMatches } from '@/hooks/use-guests'
import { fullName } from '@/lib/format'
import { KIND_LABELS, type ContactMethodKind } from '@/lib/guests'
import type { GuestMatch } from '@/lib/types'

const nameOf = (g: GuestMatch) => fullName(g) || `guest #${g.id}`

// "This email belongs to Ahmed Daoud" with a button to open them. Only a
// warning: family members can share a number, so saving is still allowed.
// Shared addresses never warn.
export function DuplicateWarning({
  kind,
  value,
  country,
  excludeId,
  shared,
  onOpen,
}: {
  kind: ContactMethodKind
  value: string
  country?: string | null
  excludeId?: number
  shared?: boolean
  onOpen: () => void // e.g. close the dialog before leaving the page
}) {
  const { data: matches = [] } = useGuestMatches({ kind, value, country, excludeId, enabled: !shared })
  if (shared || !matches.length) return null
  const [first, ...others] = matches

  return (
    <div
      role="status"
      className="grid gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
    >
      <p className="flex items-start gap-2">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
        <span>
          This {KIND_LABELS[kind]} belongs to {nameOf(first)}
          {others.length > 0 && ` and ${others.length} other ${others.length === 1 ? 'guest' : 'guests'}`}. You can still
          save it, for example for a shared family number.
        </span>
      </p>
      <div className="flex flex-wrap gap-2 pl-6">
        {matches.map((g) => (
          <Button key={g.id} asChild size="sm" variant="outline" className="h-7 bg-background">
            <Link to={`/guests/${g.id}`} onClick={onOpen}>
              Open {nameOf(g)}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  )
}
