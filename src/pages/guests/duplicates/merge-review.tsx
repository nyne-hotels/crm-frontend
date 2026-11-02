import { ArrowLeftIcon, BanIcon, CheckCircle2Icon, CircleIcon, ExternalLinkIcon, GitMergeIcon, UserXIcon } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDuplicateMutations, useMergeCompare, useMergePreview } from '@/hooks/use-duplicates'
import { ApiError } from '@/lib/api'
import { countryFlag, formatDate, fullName, plural } from '@/lib/format'
import { CONTACT_TYPE_LABELS, MARKET_LABELS } from '@/lib/guests'
import type { MergeSide } from '@/lib/types'
import { cn } from '@/lib/utils'
import { StageChip } from '../guest-badges'
import { ReasonBadges } from './possible-duplicates'
import {
  ConsentList,
  MethodList,
  NoteList,
  PreferenceChips,
  SpecialDateList,
  StayList,
} from './profile-sections'
import { useNotDuplicate } from './use-not-duplicate'

const sideName = (s: MergeSide) =>
  fullName(s.guest) || s.guest.emails[0]?.value || s.guest.phones[0]?.value || `Guest #${s.guest.id}`

// /guests/duplicates/review?a=1&b=2 – keyed by the pair, so the next pair starts afresh
export function MergeReviewPage() {
  const [params] = useSearchParams()
  const a = Number(params.get('a'))
  const b = Number(params.get('b'))
  return <MergeReview key={`${a}-${b}`} a={a} b={b} />
}

// The merge screen: both profiles side by side, "Keep this one" on each, a
// preview of what the merge will do in plain words, then Merge, Not a
// duplicate, or Skip / Cancel.
function MergeReview({ a, b }: { a: number; b: number }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { data, isPending, error } = useMergeCompare(a, b)
  const [chosenKeepId, setKeepId] = useState<number | null>(null)
  const keepId = chosenKeepId ?? data?.suggestedKeepId ?? null
  const removeId = keepId === null ? null : keepId === a ? b : a
  const preview = useMergePreview(keepId, removeId)
  const { merge } = useDuplicateMutations()
  const markNotDuplicate = useNotDuplicate()
  const [confirming, setConfirming] = useState(false)

  // Back where the user came from: the queue, or a profile's "Merge with another guest"
  const fromQueue = (location.state as { from?: string } | null)?.from !== 'profile'
  const leave = () => (location.key !== 'default' ? navigate(-1) : navigate('/guests/duplicates'))

  if (isPending) return <ReviewSkeleton />
  if (error || !data) {
    const gone = error instanceof ApiError && (error.status === 404 || error.status === 400)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-heading text-xl font-semibold">{gone ? 'This pair is no longer there' : "Couldn't load these guests"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {gone ? 'One of them may have been merged or deleted already.' : 'Try again in a moment.'}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/guests/duplicates">Possible duplicates</Link>
        </Button>
      </div>
    )
  }

  const sides = [data.a, data.b]
  const kept = sides.find((s) => s.guest.id === keepId)!
  const removed = sides.find((s) => s.guest.id === removeId)!
  const sameName = sideName(kept).toLowerCase() === sideName(removed).toLowerCase()
  const removedLabel = sameName ? `the other ${sideName(removed)} profile` : sideName(removed)
  const previewMatches = preview.data?.keepId === keepId && !preview.isPlaceholderData

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <button
        type="button"
        onClick={leave}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> {fromQueue ? 'Possible duplicates' : 'Back'}
      </button>

      <header className="grid gap-2">
        <h1 className="font-heading text-2xl font-semibold">Same person?</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {data.reasons.length > 0 ? (
            <>
              Flagged for <ReasonBadges reasons={data.reasons} />
            </>
          ) : (
            'Not flagged as possible duplicates; compare them carefully.'
          )}
          {data.notDuplicate && (
            <Badge variant="outline" className="text-muted-foreground">
              Marked not a duplicate before
            </Badge>
          )}
        </div>
      </header>

      <div className="grid gap-x-4 md:grid-cols-2" role="group" aria-label="The two profiles">
        {sides.map((s) => (
          <SideHeader key={s.guest.id} side={s} kept={s.guest.id === keepId} onKeep={() => setKeepId(s.guest.id)} />
        ))}
        {SECTIONS.map(({ title, render }) => (
          <Fragment key={title}>
            <h2 className="mt-4 border-b pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase md:col-span-2">
              {title}
            </h2>
            {sides.map((s) => (
              <div
                key={s.guest.id}
                className={cn('min-w-0 px-3 py-2', s.guest.id === keepId ? 'bg-primary/5' : 'opacity-80')}
              >
                {/* one column on a phone: say whose this is */}
                <p className="mb-1 text-xs text-muted-foreground md:hidden">{sideName(s)}</p>
                {render(s)}
              </div>
            ))}
          </Fragment>
        ))}
      </div>

      <Card className="gap-3 border-primary/40" aria-live="polite">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitMergeIcon className="size-4 text-muted-foreground" /> What merging will do
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1.5 text-sm">
          {preview.isError ? (
            <p className="text-destructive">Couldn't work out the preview. Try again in a moment.</p>
          ) : !preview.data ? (
            <p className="text-muted-foreground">Working it out…</p>
          ) : (
            preview.data.sentences.map((sentence, i) => (
              <p key={i} className={cn(i === 0 && 'font-medium', !previewMatches && 'opacity-50')}>
                {sentence}
              </p>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setConfirming(true)} disabled={!previewMatches}>
          <GitMergeIcon /> Merge
        </Button>
        {!data.notDuplicate && (
          <Button
            variant="outline"
            onClick={async () => {
              if (await markNotDuplicate(a, b, [sideName(data.a), sideName(data.b)])) leave()
            }}
          >
            <UserXIcon /> Not a duplicate
          </Button>
        )}
        <Button variant="ghost" onClick={leave}>
          {fromQueue ? 'Skip' : 'Cancel'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Merge into ${sideName(kept)}?`}
        description={`Everything on ${removedLabel} moves to the profile you're keeping, and ${removedLabel} is removed. There's no undo button; an admin can rebuild it from the merge history.`}
        confirmLabel="Merge"
        onConfirm={async () => {
          const { keptId } = await merge.mutateAsync({ keepId: kept.guest.id, removeId: removed.guest.id })
          toast.success('Merged')
          navigate(`/guests/${keptId}`, { replace: true })
        }}
      />
    </div>
  )
}

function SideHeader({ side, kept, onKeep }: { side: MergeSide; kept: boolean; onKeep: () => void }) {
  const g = side.guest
  return (
    <div
      className={cn(
        'mb-2 grid content-start gap-2 rounded-lg border p-4 transition-colors md:mb-0',
        kept ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-background',
      )}
    >
      <Button
        variant={kept ? 'default' : 'outline'}
        size="sm"
        className="w-fit"
        aria-pressed={kept}
        onClick={onKeep}
      >
        {kept ? <CheckCircle2Icon /> : <CircleIcon />} {kept ? 'Keeping this one' : 'Keep this one'}
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/guests/${g.id}`}
          target="_blank"
          rel="noreferrer"
          className={cn('flex items-center gap-1 font-heading text-lg font-semibold hover:underline', !fullName(g) && 'text-muted-foreground')}
        >
          {sideName(side)} <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
        </a>
        <StageChip stage={g.lifecycleStage} />
        {g.status === 'do_not_contact' && (
          <Badge variant="destructive">
            <BanIcon /> Do not contact
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {[
          CONTACT_TYPE_LABELS[g.contactType],
          g.countryName ? `${countryFlag(g.countryCode)} ${g.countryName}` : 'Country not known',
          MARKET_LABELS[g.market],
          [g.designation, g.companyName].filter(Boolean).join(', '),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="text-xs text-muted-foreground">
        {kept ? 'Kept: empty fields are filled from the other profile.' : 'Merged in, then removed.'} Added{' '}
        {formatDate(g.created.at)}.
      </p>
    </div>
  )
}

// The rows of the comparison, the same for both columns.
const SECTIONS: { title: string; render: (s: MergeSide) => ReactNode }[] = [
  { title: 'Emails', render: (s) => <MethodList methods={s.guest.emails} empty="No email" /> },
  { title: 'Phones', render: (s) => <MethodList methods={s.guest.phones} empty="No phone" /> },
  { title: 'Consent', render: (s) => <ConsentList consents={s.consents} /> },
  {
    title: 'Tags',
    render: (s) =>
      s.guest.tags.length ? (
        <div className="flex flex-wrap gap-1">
          {s.guest.tags.map((t) => (
            <Badge key={t.id} variant="secondary">
              {t.name}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">None</p>
      ),
  },
  {
    title: 'Stays',
    render: (s) => <StayList stays={s.stays.map((x) => ({ ...x, shared: x.inBoth }))} sharedLabel="On both, kept once" />,
  },
  { title: 'Notes', render: (s) => <NoteList notes={s.notes.latest} total={s.notes.count} /> },
  { title: 'Likes and dislikes', render: (s) => <PreferenceChips preferences={s.preferences} /> },
  { title: 'Special dates', render: (s) => <SpecialDateList dates={s.specialDates} /> },
  {
    title: 'Leads',
    render: (s) => <p className="text-sm text-muted-foreground">{s.leads ? plural(s.leads, 'lead') : 'None'}</p>,
  },
]

function ReviewSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}
