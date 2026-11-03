import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { LEAD_MORE_FILTERS } from '@/hooks/use-leads'
import { settleClashes, type Clash } from '@/lib/filter-clashes'

// The filters the leads board and list share, so switching between them keeps them.
export const SHARED_LEAD_FILTERS = ['q', 'owner', 'hotel', 'source', ...LEAD_MORE_FILTERS] as const

// Writes filter changes into the address; anything but paging goes back to page 1.
// A filter that can't be combined with the one just chosen gives way, with a note.
export function useFilterParams(clashes: readonly Clash[] = []) {
  const [params, setParams] = useSearchParams()
  // react-router builds each update from the last render's address, so two
  // updates in one click would lose the first; keep the latest here instead
  const latest = useRef(params)
  useEffect(() => {
    latest.current = params
  }, [params])

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(latest.current)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    const notes = settleClashes(next, Object.keys(changes), clashes)
    latest.current = next
    setParams(next, { replace: true })
    for (const note of notes) toast.info(note)
  }
  return { params, update }
}
