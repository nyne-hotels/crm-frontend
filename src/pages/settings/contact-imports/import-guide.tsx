import { ChevronDownIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

// Import a file | History, under Settings → Import contacts.
export function ContactImportsNav() {
  const links = [
    { label: 'Import a file', to: '/settings/contact-imports', end: true },
    { label: 'History', to: '/settings/contact-imports/history', end: false },
  ]
  return (
    <nav className="flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-1 font-medium text-muted-foreground hover:text-foreground',
              isActive && 'bg-background text-foreground shadow-sm',
            )
          }
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  )
}

const STEPS = [
  'Download the template and keep its column headings. Other headings work too: you will be asked to match them to CRM fields.',
  'One row per person. Every row needs a name, and an email or a phone number. For an agency’s office contact, the company name counts as the name.',
  'Write phone numbers with the country code (+44 7911 123456). Sri Lankan numbers starting with 0 are read as +94.',
  'Countries, hotels, types and tags must be written as the CRM lists them (the template’s second tab lists them all).',
  'In “Email marketing” and “WhatsApp marketing”, write Yes or No. Leave the cell empty if you don’t know.',
  'Nothing is saved until you click Import on the last step. You can stop at any point.',
]

const WARNINGS: [string, string][] = [
  [
    'The file wins when you choose Update.',
    'Every filled cell replaces what the CRM has: names, type, country, company, and the primary email and phone. Empty cells change nothing.',
  ],
  [
    'Consent follows the file.',
    '“No” opts the person out. “Yes” opts them back in, even if they unsubscribed in the CRM or with the email tool. Only upload “Yes” for people who have agreed to marketing, and be ready to show where they agreed.',
  ],
  [
    'Updates cannot be undone in one step.',
    'Every change is logged with its old value, so it can be put back by hand, but there is no Undo button.',
  ],
  ['Your name is recorded on every change this import makes.', ''],
  ['Rows that only match by name are new contacts.', 'Check Possible duplicates afterwards.'],
  ['This page does not delete anyone and does not record dated stays.', 'Use the booking import for stays.'],
]

// "How to use this page" and "Warnings", always at the top of the import.
// Open on the upload step; folded away (one click to read) on later steps.
export function ImportGuide({ open }: { open: boolean }) {
  const body = (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border bg-muted/30 p-4">
        <h2 className="mb-2 flex items-center gap-2 font-medium">
          <InfoIcon className="size-4 text-muted-foreground" /> How to use this page
        </h2>
        <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>
      <section className="rounded-lg border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <h2 className="mb-2 flex items-center gap-2 font-medium">
          <TriangleAlertIcon className="size-4 text-amber-600" /> Warnings
        </h2>
        <ul className="grid list-disc gap-1.5 pl-5 text-sm">
          {WARNINGS.map(([title, text]) => (
            <li key={title}>
              <strong className="font-medium">{title}</strong> {text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
  if (open) return body
  return (
    <details className="group rounded-lg border px-4 py-2 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
        <TriangleAlertIcon className="size-4 text-amber-600" /> How to use this page, and the warnings
        <ChevronDownIcon className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="pt-3 pb-2">{body}</div>
    </details>
  )
}
