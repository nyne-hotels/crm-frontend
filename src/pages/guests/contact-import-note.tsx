import { Link } from 'react-router'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

// "Updated by contact import #12 (Tehan, 28 Oct 2026)" on the profile footer
// and the consent panel. Admins can open the import's change log.
export function ContactImportNote({
  contactImport,
  canOpen,
  className,
}: {
  contactImport: { id: number; at: string; by: string | null }
  canOpen: boolean
  className?: string
}) {
  const label = `contact import #${contactImport.id}`
  return (
    <p className={cn('text-muted-foreground', className)}>
      Updated by{' '}
      {canOpen ? (
        <Link to={`/settings/contact-imports/${contactImport.id}`} className="underline-offset-4 hover:text-foreground hover:underline">
          {label}
        </Link>
      ) : (
        label
      )}{' '}
      ({contactImport.by ?? 'System'}, {formatDate(contactImport.at)})
    </p>
  )
}
