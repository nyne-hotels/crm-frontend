import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { SHARED_LEAD_FILTERS } from '@/hooks/use-filter-params'
import { useFollowUps } from '@/hooks/use-leads'
import { useMe } from '@/hooks/use-me'
import { formatCount } from '@/lib/format'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { NewLeadDialog } from './new-lead-dialog'

// Leads → Board, List and My follow-ups, with "New lead" top right.
export function LeadsLayout() {
  const { data: me } = useMe()
  const canEdit = can(me?.permissions, 'leads', 'edit')
  const { data: followUps } = useFollowUps(canEdit)
  const [adding, setAdding] = useState(false)
  const [params] = useSearchParams()
  // the board and the list share their filters, so switching keeps them
  const keep = (path: string) => {
    const shared = new URLSearchParams()
    for (const key of SHARED_LEAD_FILTERS) {
      const value = params.get(key)
      if (value) shared.set(key, value)
    }
    return shared.size ? `${path}?${shared}` : path
  }
  const tabs = [
    { label: 'Board', to: keep('/leads'), end: true },
    { label: 'List', to: keep('/leads/list'), end: false },
    ...(canEdit ? [{ label: 'My follow-ups', to: '/leads/follow-ups', end: false, count: followUps?.rows.length }] : []),
  ]

  return (
    <div className="mx-auto max-w-[96rem]">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-2xl font-semibold">Leads</h1>
        {canEdit && (
          <Button className="ml-auto" onClick={() => setAdding(true)}>
            <PlusIcon /> New lead
          </Button>
        )}
      </div>
      <nav className="mt-4 mb-6 flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                '-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground',
                isActive && 'border-foreground text-foreground',
              )
            }
          >
            {tab.label}
            {!!tab.count && (
              <span className="rounded-full bg-destructive px-1.5 text-xs leading-5 text-white tabular-nums">{formatCount(tab.count)}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <Outlet />
      <NewLeadDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}

