import { TriangleAlertIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCount } from '@/lib/format'
import type { ContactImportDetails } from '@/lib/types'

// The do-not-contact opt-ins, new companies and new contacts of an import;
// also on the import's page in the history.
export function ImportedPeople({ details }: { details: ContactImportDetails }) {
  return (
    <>
      {details.doNotContact.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TriangleAlertIcon className="size-4 text-amber-600" /> Opted in while on do not contact
            </CardTitle>
            <CardDescription>
              The file said Yes for these guests, but they are marked do not contact, so they stay off the marketing list.
              Confirm with each guest before clearing it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LinkList items={details.doNotContact.map((g) => ({ to: `/guests/${g.id}`, label: g.name }))} />
          </CardContent>
        </Card>
      )}
      {details.newCompanies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>New companies ({formatCount(details.newCompanies.length)})</CardTitle>
            <CardDescription>Added as travel agents with status prospect. Check their type and details.</CardDescription>
          </CardHeader>
          <CardContent>
            <LinkList items={details.newCompanies.map((co) => ({ to: `/companies/${co.id}`, label: co.name }))} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>New contacts ({formatCount(details.newContacts.length)})</CardTitle>
          <CardDescription>
            New and added-again contacts, with the row they came from. Check Possible duplicates for people already in the
            CRM under another email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {details.newContacts.length ? (
            <LinkList items={details.newContacts.map((g) => ({ to: `/guests/${g.id}`, label: g.name, note: `row ${formatCount(g.row)}` }))} />
          ) : (
            <p className="text-sm text-muted-foreground">None.</p>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function LinkList({ items }: { items: { to: string; label: string; note?: string }[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.to} className="truncate">
          <Link to={item.to} className="underline-offset-4 hover:underline">
            {item.label}
          </Link>
          {item.note && <span className="text-muted-foreground"> · {item.note}</span>}
        </li>
      ))}
    </ul>
  )
}
