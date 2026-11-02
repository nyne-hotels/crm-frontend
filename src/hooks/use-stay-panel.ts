import { useSearchParams } from 'react-router'

// The stay open in the side panel lives in the address (?stay=123), so the
// list and the guest profile can both open it and Back closes it.
export function useStayPanel() {
  const [params, setParams] = useSearchParams()
  const openId = Number(params.get('stay')) || null
  const set = (id: number | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (id) next.set('stay', String(id))
      else next.delete('stay')
      return next
    })
  return { openId, open: (id: number) => set(id), close: () => set(null) }
}
