import { ArrowLeftIcon, BanIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMergeDetail } from '@/hooks/use-duplicates'
import { CHANNEL_LABELS, CONSENT_CHIP_CLASSES, CONSENT_SOURCE_LABELS, CONSENT_STATUS_LABELS } from '@/lib/consent'
import { countryFlag, formatDate, formatDateTime, fullName, plural } from '@/lib/format'
import { CONTACT_TYPE_LABELS, MARKET_LABELS } from '@/lib/guests'
import type { MergeDetail } from '@/lib/types'
import { cn } from '@/lib/utils'
import { StageChip } from '../guests/guest-badges'
import { MethodList, NoteList, PreferenceChips, SpecialDateList, StayList } from '../guests/duplicates/profile-sections'

// Settings → Merge history → one merge: who, when, which guest was kept,
// what moved to them, and a read-only copy of the removed profile.
export function MergeDetailPage() {
  const { id } = useParams()
  const { data, isPending, isError } = useMergeDetail(Number(id))

  return (
    <div className="grid gap-6">
      <Link to="/settings/merges" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Merge history
      </Link>
      {isPending ? (
        <Skeleton className="h-96" />
      ) : isError || !data ? (
        <p className="text-sm text-destructive">Couldn't load this merge.</p>
      ) : (
        <Merge merge={data} />
      )}
    </div>
  )
}

function Merge({ merge }: { merge: MergeDetail }) {
  const r = merge.removed
  const removedName = fullName(r) || r.emails[0]?.value || r.phones[0]?.value || 'Unnamed guest'
  const keptName = merge.kept?.name || 'the kept guest'
  const keptOnce = r.stays.filter((s) => s.keptOnce).length
  const moved = [
    merge.moved.stays && plural(merge.moved.stays, 'stay'),
    merge.moved.emails && plural(merge.moved.emails, 'email'),
    merge.moved.phones && plural(merge.moved.phones, 'phone'),
    merge.moved.notes && plural(merge.moved.notes, 'note'),
    merge.moved.preferences && plural(merge.moved.preferences, 'like or dislike', 'likes and dislikes'),
    merge.moved.specialDates && plural(merge.moved.specialDates, 'special date'),
    merge.moved.leads && plural(merge.moved.leads, 'lead'),
    merge.moved.interactions && plural(merge.moved.interactions, 'interaction'),
  ].filter(Boolean)

  return (
    <>
      <header className="grid gap-1">
        <h2 className="font-heading text-xl font-semibold">
          {removedName} merged into{' '}
          {merge.kept && !merge.kept.deleted ? (
            <Link to={`/guests/${merge.kept.id}`} className="underline-offset-4 hover:underline">
              {keptName}
            </Link>
          ) : (
            keptName
          )}
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatDateTime(merge.merged.at)} by {merge.merged.by ?? 'System'}
          {!merge.kept && ' · the kept guest is no longer in the CRM'}
          {merge.kept?.deleted && ' · the kept guest has since been deleted'}
        </p>
        {merge.note && <p className="text-sm">{merge.note}</p>}
      </header>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>What moved to {keptName}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {moved.length ? moved.join(', ') : 'Nothing besides what was combined (consent, tags and empty fields).'}
          {keptOnce > 0 && (
            <p className="mt-1 text-muted-foreground">
              {keptOnce === 1 ? 'A stay both profiles had was' : `${keptOnce} stays both profiles had were`} kept once.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Removed profile <span className="text-sm font-normal text-muted-foreground">(read-only copy)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-lg font-semibold', !fullName(r) && 'text-muted-foreground')}>{removedName}</span>
              <StageChip stage={r.lifecycleStage} />
              {r.status === 'do_not_contact' && (
                <Badge variant="destructive">
                  <BanIcon /> Do not contact{r.doNotContactAt && ` since ${formatDate(r.doNotContactAt)}`}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {[
                CONTACT_TYPE_LABELS[r.contactType],
                r.country ? `${countryFlag(r.countryCode)} ${r.country}` : 'Country not known',
                MARKET_LABELS[r.market],
                r.designation,
                r.vipReason && `VIP: ${r.vipReason}`,
                `Added ${formatDate(r.createdAt)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Emails">
              <MethodList methods={r.emails} empty="No email" />
            </Section>
            <Section title="Phones">
              <MethodList methods={r.phones} empty="No phone" />
            </Section>
            <Section title="Consent">
              <ul className="grid gap-1 text-sm">
                {r.consents.map((c) => (
                  <li key={c.channel} className="flex flex-wrap items-center gap-1.5">
                    {CHANNEL_LABELS[c.channel]}
                    <Badge className={cn('border-transparent', CONSENT_CHIP_CLASSES[c.status])}>
                      {CONSENT_STATUS_LABELS[c.status]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {[c.source && CONSENT_SOURCE_LABELS[c.source], c.givenAt && formatDate(c.givenAt)].filter(Boolean).join(', ')}
                    </span>
                  </li>
                ))}
                {!r.consents.length && <li className="text-muted-foreground">Unknown</li>}
              </ul>
            </Section>
            <Section title="Tags">
              {r.tags.length ? (
                <div className="flex flex-wrap gap-1">
                  {r.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">None</p>
              )}
            </Section>
          </div>

          {r.detailRecorded ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Section title="Stays">
                <StayList stays={r.stays.map((s) => ({ ...s, shared: s.keptOnce }))} sharedLabel="Kept guest had it too" />
              </Section>
              <Section title="Notes">
                <NoteList notes={r.notes} />
              </Section>
              <Section title="Likes and dislikes">
                <PreferenceChips preferences={r.preferences} />
              </Section>
              <Section title="Special dates">
                <SpecialDateList dates={r.specialDates} />
              </Section>
              <Section title="Leads and interactions">
                <p className="text-sm text-muted-foreground">
                  {r.leads || r.interactions
                    ? [plural(r.leads, 'lead'), plural(r.interactions, 'interaction')].join(', ')
                    : 'None'}
                </p>
              </Section>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Stays, notes and other history weren't copied for this merge; they moved to {keptName}.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-1.5">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}
