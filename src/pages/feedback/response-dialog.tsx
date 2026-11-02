import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Field, FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { useFeedbackMutations, useFeedbackStaySearch } from '@/hooks/use-feedback'
import { ApiError, errorMessage } from '@/lib/api'
import { hotelDay, STAY_NOT_OVER, stayDates } from '@/lib/feedback'
import { fullName } from '@/lib/format'
import { hotelToday } from '@/lib/leads'
import { STAY_STATUS_LABELS } from '@/lib/stays'
import type { Feedback, FeedbackStayOption } from '@/lib/types'
import { cn } from '@/lib/utils'
import { RatingInput } from './feedback-badges'

// The stay a response is for, as the form shows it
export interface ResponseStay {
  id: number
  label: string // "Ahmed Daoud · Mayur Lodge"
  detail: string // "1 Oct 2026 – 4 Oct 2026 · ML-100"
  feedbackId: number | null // a response already on file
}

const stayOption = (s: FeedbackStayOption): ResponseStay => ({
  id: s.id,
  label: `${fullName(s) || `Guest #${s.contactId}`} · ${s.hotel}`,
  detail: [stayDates(s), s.bookingReference].filter(Boolean).join(' · '),
  feedbackId: s.feedbackId,
})

// Add response (pick the stay, or it comes from the stay detail) and Edit
// response (the stay can't change). A new response opens on its own page,
// ready for employee mentions.
export function ResponseDialog({
  open,
  onOpenChange,
  feedback,
  stay,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  feedback?: Feedback
  stay?: ResponseStay
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{feedback ? 'Edit response' : 'Add response'}</DialogTitle>
          <DialogDescription>
            {feedback
              ? 'Correct what was entered from the feedback form.'
              : 'The guest\'s answer to the post-stay feedback form: a rating from 1 to 5, the review, or both.'}
          </DialogDescription>
        </DialogHeader>
        {open && <ResponseForm feedback={feedback} presetStay={stay} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ResponseForm({ feedback, presetStay, onClose }: { feedback?: Feedback; presetStay?: ResponseStay; onClose: () => void }) {
  const navigate = useNavigate()
  const { create, update } = useFeedbackMutations()
  const [stay, setStay] = useState<ResponseStay | null>(presetStay ?? null)
  const [rating, setRating] = useState<number | null>(feedback?.rating ?? null)
  const [review, setReview] = useState(feedback?.review ?? '')
  const today = hotelToday()
  const [receivedOn, setReceivedOn] = useState(feedback ? hotelDay(feedback.submittedAt) : today)
  const [error, setError] = useState<string | null>(null)
  const [existingId, setExistingId] = useState<number | null>(null) // the response already on this stay
  const busy = create.isPending || update.isPending
  const taken = existingId ?? (feedback ? null : stay?.feedbackId ?? null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!feedback && !stay) return setError('Choose the stay')
    if (rating === null && !review.trim()) return setError('Enter a rating, a review, or both')
    if (!receivedOn || receivedOn > today) return setError("Enter the date received (it can't be in the future)")
    try {
      if (feedback) {
        await update.mutateAsync({ id: feedback.id, rating, review: review.trim() || null, receivedOn })
        toast.success('Response saved')
        onClose()
      } else {
        const saved = await create.mutateAsync({ stayId: stay!.id, rating, review: review.trim() || null, receivedOn })
        toast.success(saved.needsFollowUp ? 'Response saved. It needs follow-up.' : 'Response saved')
        onClose()
        navigate(`/feedback/${saved.id}`)
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'FEEDBACK_EXISTS') setExistingId(Number(err.body?.feedbackId))
      else setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormError message={error} />
      {feedback || presetStay ? (
        <div className="grid gap-0.5 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">
            {feedback ? `${fullName(feedback.guest) || 'Guest'} · ${feedback.stay.hotel}` : presetStay!.label}
          </span>
          <span className="text-muted-foreground">{feedback ? stayDates(feedback.stay) : presetStay!.detail}</span>
        </div>
      ) : (
        <Field label="Stay" htmlFor="response-stay" hint="Search by the guest's name or the booking reference">
          <StayPicker
            id="response-stay"
            value={stay}
            onChange={(s) => {
              setStay(s)
              setExistingId(null)
            }}
          />
        </Field>
      )}
      {taken && (
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          This stay already has a response.{' '}
          <Link to={`/feedback/${taken}`} className="font-medium underline underline-offset-4" onClick={onClose}>
            Open it
          </Link>
        </p>
      )}
      <Field label="Rating" htmlFor="response-rating">
        <RatingInput id="response-rating" value={rating} onChange={setRating} />
      </Field>
      <Field label="Review" htmlFor="response-review" hint="The guest's words, as written">
        <Textarea
          id="response-review"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          maxLength={10_000}
          className="min-h-32"
        />
      </Field>
      <Field label="Date received" htmlFor="response-received" className="sm:w-48">
        <Input id="response-received" type="date" value={receivedOn} max={today} onChange={(e) => setReceivedOn(e.target.value)} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !!taken}>
          {busy ? 'Saving…' : feedback ? 'Save' : 'Add response'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// Search stays by guest or booking reference. Stays not yet over are listed
// but can't be picked; ones with a response say so.
function StayPicker({ id, value, onChange }: { id?: string; value: ResponseStay | null; onChange: (stay: ResponseStay) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { data, isFetching } = useFeedbackStaySearch(search, open)
  const typed = search.trim().length >= 2
  const results = typed ? (data ?? []) : []

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-auto min-h-9 w-full justify-between py-1.5 font-normal', !value && 'text-muted-foreground')}
        >
          {value ? (
            <span className="grid min-w-0 text-left">
              <span className="truncate">{value.label}</span>
              <span className="truncate text-xs text-muted-foreground">{value.detail}</span>
            </span>
          ) : (
            'Search by guest or booking reference'
          )}
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type at least 2 letters…" value={search} onValueChange={setSearch} />
          <CommandList>
            {results.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {!typed ? 'Type a guest name or booking reference.' : isFetching ? 'Searching…' : 'No stay found.'}
              </p>
            )}
            {results.length > 0 && (
              <CommandGroup>
                {results.map((s) => {
                  const over = s.status === 'checked_out'
                  const option = stayOption(s)
                  return (
                    <CommandItem
                      key={s.id}
                      value={String(s.id)}
                      disabled={!over}
                      onSelect={() => {
                        onChange(option)
                        setOpen(false)
                        setSearch('')
                      }}
                    >
                      <CheckIcon className={cn(value?.id === s.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate">{option.label}</span>
                        <span className="truncate text-xs text-muted-foreground">{option.detail}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground" title={over ? undefined : STAY_NOT_OVER}>
                        {!over ? STAY_STATUS_LABELS[s.status] : s.feedbackId ? 'Has a response' : ''}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
