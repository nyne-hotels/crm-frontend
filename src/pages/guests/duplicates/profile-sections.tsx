import { CopyIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CHANNEL_LABELS, CONSENT_CHIP_CLASSES, CONSENT_STATUS_LABELS, type ConsentChannel, type ConsentStatus } from '@/lib/consent'
import { formatDate } from '@/lib/format'
import { PREFERENCE_CHIP_CLASSES, SPECIAL_DATE_LABELS, specialDateLabel, type PreferenceKind, type SpecialDateOccasion } from '@/lib/knowledge'
import { didNotHappen, type StayStatus } from '@/lib/stays'
import { cn } from '@/lib/utils'
import { StayStatusChip } from '../../stays/stay-badges'
import { PrimaryStar } from '../guest-badges'

// The pieces of a guest's profile shown on the merge screen and in the merge
// history's copy of a removed guest. Read-only.

const None = ({ children = 'None' }: { children?: string }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
)

export function MethodList({
  methods,
  empty,
}: {
  methods: { id: number; value: string; isPrimary: boolean; isShared: boolean }[]
  empty: string
}) {
  if (!methods.length) return <None>{empty}</None>
  return (
    <ul className="grid gap-1 text-sm">
      {methods.map((m) => (
        <li key={m.id} className="flex min-w-0 items-center gap-2">
          <PrimaryStar primary={m.isPrimary} />
          <span className="truncate">{m.value}</span>
          {m.isShared && (
            <Badge variant="outline" className="text-muted-foreground">
              Shared
            </Badge>
          )}
        </li>
      ))}
    </ul>
  )
}

export function ConsentList({ consents }: { consents: { channel: ConsentChannel; status: ConsentStatus }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {consents.map((c) => (
        <li key={c.channel} className="flex items-center gap-1.5">
          {CHANNEL_LABELS[c.channel]}
          <Badge className={cn('border-transparent', CONSENT_CHIP_CLASSES[c.status])}>{CONSENT_STATUS_LABELS[c.status]}</Badge>
        </li>
      ))}
    </ul>
  )
}

export function StayList({
  stays,
  sharedLabel,
}: {
  stays: {
    id: number
    hotel: string
    status: StayStatus
    arrivalDate: string | null
    departureDate: string | null
    bookingReference: string | null
    shared?: boolean
  }[]
  sharedLabel?: string // badge on a stay both profiles have
}) {
  if (!stays.length) return <None>No stays</None>
  return (
    <ul className="grid gap-1.5 text-sm">
      {stays.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('font-medium', didNotHappen(s.status) && 'text-muted-foreground line-through')}>{s.hotel}</span>
          <span className="text-muted-foreground tabular-nums">
            {s.arrivalDate ? `${formatDate(s.arrivalDate)} – ${formatDate(s.departureDate)}` : 'Dates not known'}
          </span>
          {s.bookingReference && <span className="text-xs text-muted-foreground">#{s.bookingReference}</span>}
          {s.status !== 'checked_out' && <StayStatusChip status={s.status} />}
          {s.shared && sharedLabel && (
            <Badge variant="outline" className="border-sky-300 text-sky-800 dark:border-sky-800 dark:text-sky-300">
              <CopyIcon /> {sharedLabel}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  )
}

export function PreferenceChips({ preferences }: { preferences: { id: number; kind: PreferenceKind; body: string }[] }) {
  if (!preferences.length) return <None />
  return (
    <ul className="flex flex-wrap gap-1.5">
      {preferences.map((p) => (
        <li key={p.id} className={cn('rounded-md border px-2 py-0.5 text-sm', PREFERENCE_CHIP_CLASSES[p.kind])}>
          <span className="sr-only">{p.kind === 'like' ? 'Likes' : 'Dislikes'}: </span>
          {p.body}
        </li>
      ))}
    </ul>
  )
}

export function SpecialDateList({
  dates,
}: {
  dates: { id: number; occasion: SpecialDateOccasion; label: string | null; month: number; day: number; year: number | null }[]
}) {
  if (!dates.length) return <None />
  return (
    <ul className="grid gap-1 text-sm">
      {dates.map((d) => (
        <li key={d.id}>
          {SPECIAL_DATE_LABELS[d.occasion]}
          {d.label && ` (${d.label})`}: <span className="tabular-nums">{specialDateLabel(d)}</span>
        </li>
      ))}
    </ul>
  )
}

export function NoteList({ notes, total }: { notes: { id: number; body: string; createdAt: string }[]; total?: number }) {
  if (!notes.length) return <None />
  const more = (total ?? notes.length) - notes.length
  return (
    <ul className="grid gap-2 text-sm">
      {notes.map((n) => (
        <li key={n.id} className="grid gap-0.5">
          <span className="line-clamp-3 whitespace-pre-line">{n.body}</span>
          <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
        </li>
      ))}
      {more > 0 && <li className="text-xs text-muted-foreground">and {more} more</li>}
    </ul>
  )
}
