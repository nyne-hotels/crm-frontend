import { useSearchParams } from 'react-router'
import { LEAD_MORE_FILTERS } from '@/hooks/use-leads'

// The filters the leads board and list share, so switching between them keeps them.
export const SHARED_LEAD_FILTERS = ['q', 'owner', 'hotel', 'source', ...LEAD_MORE_FILTERS] as const

// Writes filter changes into the address; anything but paging goes back to page 1.
export function useFilterParams() {
  const [params, setParams] = useSearchParams()
  function update(changes: Record<string, string | undefined>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!('page' in changes)) next.delete('page')
        return next
      },
      { replace: true },
    )
  }
  return { params, update }
}
