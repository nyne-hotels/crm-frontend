import { CircleCheckIcon, StarIcon } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { SENTIMENT_CHIP_CLASSES, SENTIMENT_LABELS, type Sentiment } from '@/lib/feedback'
import { cn } from '@/lib/utils'

const STARS = [1, 2, 3, 4, 5]

// ★★★★☆ – amber, or red for a rating of 1 or 2. "No rating" when the guest
// only wrote a review.
export function Stars({ rating, size = 'sm', className }: { rating: number | null; size?: 'sm' | 'lg'; className?: string }) {
  if (rating === null) return <span className={cn('text-xs text-muted-foreground', className)}>No rating</span>
  const low = rating <= 2
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} title={`${rating} out of 5`}>
      {STARS.map((n) => (
        <StarIcon
          key={n}
          aria-hidden
          className={cn(
            size === 'lg' ? 'size-5' : 'size-3.5',
            n <= rating
              ? low
                ? 'fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400'
                : 'fill-amber-400 text-amber-400'
              : 'text-muted-foreground/40',
          )}
        />
      ))}
      <span className="sr-only">{rating} out of 5</span>
    </span>
  )
}

// Clickable stars for the response form; clicking the chosen star again clears it.
export function RatingInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id?: string
  value: number | null
  onChange: (rating: number | null) => void
  invalid?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="Rating"
      aria-invalid={invalid || undefined}
      className="flex w-fit items-center gap-1"
      onMouseLeave={() => setHover(null)}
    >
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(value === n ? null : n)}
          className="rounded-sm p-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <StarIcon
            className={cn(
              'size-7 transition-colors',
              n <= shown ? (shown <= 2 ? 'fill-red-500 text-red-500' : 'fill-amber-400 text-amber-400') : 'text-muted-foreground/40',
            )}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground tabular-nums">{value ? `${value} of 5` : 'No rating'}</span>
    </div>
  )
}

export function NeedsFollowUpChip({ className }: { className?: string }) {
  return (
    <Badge className={cn('border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300', className)}>
      Needs follow-up
    </Badge>
  )
}

export function FollowedUpChip({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn('text-muted-foreground', className)}>
      <CircleCheckIcon /> Followed up
    </Badge>
  )
}

export function SentimentChip({ sentiment, className }: { sentiment: Sentiment; className?: string }) {
  return (
    <Badge className={cn('border-transparent', SENTIMENT_CHIP_CLASSES[sentiment], className)}>{SENTIMENT_LABELS[sentiment]}</Badge>
  )
}
