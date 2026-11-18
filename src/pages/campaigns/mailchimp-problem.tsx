import { KeyRoundIcon, RotateCwIcon, TriangleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/use-me'
import { ApiError } from '@/lib/api'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'

// What went wrong talking to Mailchimp, from the API's error code
// (backend/src/mailchimp/mailchimp.client.ts). The key is the one to explain
// well: Mailchimp keys stop working a year after they're created.
const KEY_STEPS = (
  <ol className="mt-2 list-decimal space-y-1 pl-5">
    <li>In Mailchimp, open your profile (top right) → Profile → Extras → API keys.</li>
    <li>Create a new key and copy it. Mailchimp shows it only once.</li>
    <li>
      Put it in the API's <code className="rounded bg-muted px-1">backend/.env</code> as{' '}
      <code className="rounded bg-muted px-1">MAILCHIMP_API_KEY=…</code>, replacing the old one, and restart the API.
    </li>
  </ol>
)

export function MailchimpProblem({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const { data: me } = useMe()
  const isAdmin = can(me?.permissions, 'settings', 'edit')
  const code = error instanceof ApiError ? error.code : undefined

  let title: string
  let body: React.ReactNode
  let isKey = false
  switch (code) {
    case 'mailchimp_key_rejected':
      isKey = true
      title = 'The Mailchimp key has expired or isn’t valid'
      body = (
        <>
          Mailchimp didn’t accept the CRM’s API key, so campaign figures can’t be loaded. Keys expire a year after
          they’re created, so it has most likely expired.
          {isAdmin ? KEY_STEPS : ' Ask an admin to create a new key in Mailchimp and put it in the CRM.'}
        </>
      )
      break
    case 'mailchimp_not_configured':
      isKey = true
      title = 'Mailchimp isn’t connected'
      body = (
        <>
          The CRM has no Mailchimp API key, so campaign figures can’t be loaded.
          {isAdmin ? KEY_STEPS : ' Ask an admin to connect it.'}
        </>
      )
      break
    case 'mailchimp_not_found':
      title = 'Mailchimp no longer has this email'
      body = 'It may have been deleted in Mailchimp. Link the campaign to another email.'
      break
    case 'mailchimp_busy':
      title = 'Mailchimp is busy'
      body = 'Too many requests at once. Try again in a minute.'
      break
    default:
      title = 'Couldn’t load the figures from Mailchimp'
      body = error instanceof Error && error.message ? error.message : 'Try again in a few minutes.'
  }

  const Icon = isKey ? KeyRoundIcon : TriangleAlertIcon
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <div className="mt-1">{body}</div>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" className="shrink-0 bg-background" onClick={onRetry}>
          <RotateCwIcon /> Try again
        </Button>
      )}
    </div>
  )
}
