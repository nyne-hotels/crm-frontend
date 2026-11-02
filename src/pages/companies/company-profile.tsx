import {
  ArrowLeftIcon,
  BedDoubleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessagesSquareIcon,
  PencilIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog, DeleteButton } from '@/components/confirm-dialog'
import { CreatedAndUpdated } from '@/components/last-updated'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  useCompany,
  useCompanyMutations,
  useCompanyPeople,
  useCompanyStays,
  useCompanyTimeline,
} from '@/hooks/use-companies'
import { useMe } from '@/hooks/use-me'
import { useStayPanel } from '@/hooks/use-stay-panel'
import { ApiError, errorMessage } from '@/lib/api'
import { countryFlag, formatCount, formatDate, fullName, plural } from '@/lib/format'
import { COMPANY_TYPE_LABELS } from '@/lib/leads'
import { can } from '@/lib/permissions'
import { didNotHappen } from '@/lib/stays'
import type { Company, CompanyPerson } from '@/lib/types'
import { cn } from '@/lib/utils'
import { StageChip } from '../guests/guest-badges'
import { CompanyStatusChip } from '../leads/lead-badges'
import { LogInteractionDialog } from '../leads/log-interaction-dialog'
import { Timeline } from '../leads/timeline'
import { StayStatusChip } from '../stays/stay-badges'
import { StayDetailSheet } from '../stays/stay-detail-sheet'
import { AddPersonDialog } from './add-person-dialog'
import { CompanyFormDialog } from './company-form-dialog'

// /companies/:id – keyed by id, so opening another company starts afresh
export function CompanyProfilePage() {
  const { id } = useParams()
  return <CompanyProfile key={id} id={Number(id)} />
}

function CompanyProfile({ id }: { id: number }) {
  const { data: me } = useMe()
  const { data: company, isPending, error } = useCompany(id)
  const { data: people = [] } = useCompanyPeople(id)
  const canEdit = can(me?.permissions, 'leads', 'edit')

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-6xl gap-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      </div>
    )
  }
  if (error || !company) {
    const missing = error instanceof ApiError && (error.status === 404 || error.status === 400)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-heading text-xl font-semibold">{missing ? 'Company not found' : "Couldn't load this company"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{missing ? 'It may have been deleted.' : 'Try again in a moment.'}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/companies">Back to companies</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <Link to="/companies" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Companies
      </Link>
      <Header company={company} people={people} canEdit={canEdit} />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="grid gap-6">
          <DetailsCard company={company} />
          <PeopleCard company={company} people={people} canEdit={canEdit} />
        </div>
        <div className="grid gap-6 lg:col-span-2">
          <StaysCard company={company} />
          <TimelineCard company={company} canEdit={canEdit} />
        </div>
      </div>
      <CreatedAndUpdated created={company.created} lastUpdated={company.lastUpdated} className="border-t pt-4" />
      <StayDetailSheet />
    </div>
  )
}

function Header({ company, people, canEdit }: { company: Company; people: CompanyPerson[]; canEdit: boolean }) {
  const navigate = useNavigate()
  const { remove } = useCompanyMutations()
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  return (
    <header className="flex flex-wrap items-start gap-4">
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold wrap-break-word">{company.name}</h1>
          <CompanyStatusChip status={company.status} />
        </div>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span>{COMPANY_TYPE_LABELS[company.companyType]}</span>
          {company.country && (
            <>
              <span aria-hidden>·</span>
              <span>
                {countryFlag(company.countryCode)} {company.country}
              </span>
            </>
          )}
          {company.lastContact && (
            <>
              <span aria-hidden>·</span>
              <span>Last contact {formatDate(company.lastContact)}</span>
            </>
          )}
        </p>
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setLogging(true)}>
            <MessagesSquareIcon /> Log interaction
          </Button>
          <Button size="sm" variant="outline" onClick={() => document.getElementById('company-note')?.focus()}>
            Add note
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <UserPlusIcon /> Add person
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <PencilIcon /> Edit
          </Button>
          <DeleteButton
            what={company.name}
            onDelete={async () => {
              await remove.mutateAsync(company.id)
              navigate('/companies', { replace: true })
            }}
          />
        </div>
      )}
      <LogInteractionDialog
        open={logging}
        onOpenChange={setLogging}
        target={{ companyId: company.id, people }}
        title={`Log interaction with ${company.name}`}
      />
      <CompanyFormDialog open={editing} onOpenChange={setEditing} company={company} />
      <AddPersonDialog companyId={company.id} companyName={company.name} open={adding} onOpenChange={setAdding} />
    </header>
  )
}

function DetailsCard({ company }: { company: Company }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Account owner</dt>
          <dd>{company.accountOwner?.name ?? <span className="text-muted-foreground">No one yet</span>}</dd>
          <dt className="text-muted-foreground">Website</dt>
          <dd className="min-w-0 truncate">
            {company.website ? (
              <a href={/^https?:\/\//.test(company.website) ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                {company.website.replace(/^https?:\/\//, '')}
              </a>
            ) : (
              <span className="text-muted-foreground">–</span>
            )}
          </dd>
          <dt className="text-muted-foreground">Address</dt>
          <dd className="whitespace-pre-wrap">{company.address ?? <span className="text-muted-foreground">–</span>}</dd>
          <dt className="text-muted-foreground">Stays</dt>
          <dd className="tabular-nums">
            {formatCount(company.staysTotal)} in all · {formatCount(company.staysLastYear)} in the last 12 months
          </dd>
        </dl>
        <section className="grid gap-1">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Commission terms</h3>
          <p className={cn('text-sm whitespace-pre-wrap', !company.commissionNotes && 'text-muted-foreground')}>
            {company.commissionNotes ?? 'Not recorded'}
          </p>
        </section>
      </CardContent>
    </Card>
  )
}

function PeopleCard({ company, people, canEdit }: { company: Company; people: CompanyPerson[]; canEdit: boolean }) {
  const { removePerson } = useCompanyMutations()
  const [removing, setRemoving] = useState<CompanyPerson | null>(null)
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersIcon className="size-4 text-muted-foreground" /> People
        </CardTitle>
      </CardHeader>
      <CardContent>
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one linked yet.</p>
        ) : (
          <ul className="grid">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-2 border-b py-2 last:border-0">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/guests/${p.id}`} className="truncate text-sm font-medium hover:underline">
                      {fullName(p) || p.email || p.phone || `Contact #${p.id}`}
                    </Link>
                    <StageChip stage={p.lifecycleStage} />
                  </div>
                  <span className="truncate text-xs text-muted-foreground">{[p.designation, p.email, p.phone].filter(Boolean).join(' · ')}</span>
                </div>
                {canEdit && (
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`Take ${fullName(p)} off ${company.name}`} onClick={() => setRemoving(p)}>
                    <UserMinusIcon />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Take ${removing ? fullName(removing) || 'this person' : ''} off ${company.name}?`}
        description="They stay in the CRM, with their stays, notes and conversations."
        confirmLabel="Take off"
        onConfirm={async () => {
          await removePerson.mutateAsync({ id: company.id, contactId: removing!.id })
          toast.success('Taken off the company')
        }}
      />
    </Card>
  )
}

function StaysCard({ company }: { company: Company }) {
  const [page, setPage] = useState(1)
  const { data, isPending, isError, isPlaceholderData } = useCompanyStays(company.id, page)
  const { open } = useStayPanel()
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BedDoubleIcon className="size-4 text-muted-foreground" /> Stays booked through {company.name}
        </CardTitle>
        {data && data.total > 0 && (
          <CardAction className="text-sm text-muted-foreground tabular-nums">{plural(data.total, 'stay')}</CardAction>
        )}
      </CardHeader>
      <CardContent className={cn('grid gap-3 transition-opacity', isPlaceholderData && 'opacity-60')}>
        {isPending ? (
          <Skeleton className="h-24" />
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load stays.</p>
        ) : data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No stays yet. A booking with this agent picked on the stay, or named in an imported file, shows here.
          </p>
        ) : (
          <>
            <ul className="grid">
              {data.rows.map((s) => {
                const gone = didNotHappen(s.status)
                return (
                  <li key={s.id} className="border-b last:border-0">
                    <button
                      type="button"
                      onClick={() => open(s.id)}
                      className="flex w-full items-center gap-3 rounded-sm py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span className={cn('grid min-w-0 flex-1 gap-0.5', gone && 'text-muted-foreground line-through decoration-1')}>
                        <span className="truncate text-sm font-medium">
                          {fullName(s) || `Guest #${s.contactId}`} · {s.hotel}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {s.arrivalDate ? `${formatDate(s.arrivalDate)} – ${formatDate(s.departureDate)}` : 'Dates not known'}
                          {s.bookingReference && ` · ${s.bookingReference}`}
                        </span>
                      </span>
                      <StayStatusChip status={s.status} className="shrink-0" />
                    </button>
                  </li>
                )
              })}
            </ul>
            {pages > 1 && (
              <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                <span className="tabular-nums">
                  Page {page} of {pages}
                </span>
                <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                  <ChevronLeftIcon />
                </Button>
                <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                  <ChevronRightIcon />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TimelineCard({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const { data, isPending, isError } = useCompanyTimeline(company.id)
  const { addNote } = useCompanyMutations()
  const [body, setBody] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    try {
      await addNote.mutateAsync({ id: company.id, body: body.trim() })
      setBody('')
      toast.success('Note added')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {canEdit && (
          <form onSubmit={submit} className="grid gap-2">
            <Textarea
              id="company-note"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a note, e.g. Commission renegotiated to 15%"
              maxLength={5000}
              className="min-h-16"
              aria-label="New note"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
              }}
            />
            <Button type="submit" size="sm" className="ml-auto" disabled={!body.trim() || addNote.isPending}>
              {addNote.isPending ? 'Saving…' : 'Add note'}
            </Button>
          </form>
        )}
        {isPending ? (
          <Skeleton className="h-32" />
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load the timeline.</p>
        ) : (
          <Timeline items={data} showPerson showLead empty="No conversations or notes yet." />
        )}
      </CardContent>
    </Card>
  )
}
