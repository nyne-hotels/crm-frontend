import { FileUpIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/use-me'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { ResponseDialog } from './response-dialog'

// Feedback → Inbox, Hotel ratings and (for management and admin) Employees,
// with Add response and Upload responses top right.
export function FeedbackLayout() {
  const { data: me } = useMe()
  const canEdit = can(me?.permissions, 'feedback', 'edit')
  const [adding, setAdding] = useState(false)
  const tabs = [
    { label: 'Inbox', to: '/feedback', end: true },
    { label: 'Hotel ratings', to: '/feedback/ratings', end: false },
    ...(can(me?.permissions, 'employees') ? [{ label: 'Employees', to: '/feedback/employees', end: false }] : []),
  ]

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-2xl font-semibold">Feedback</h1>
        {canEdit && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/feedback/upload">
                <FileUpIcon /> Upload responses
              </Link>
            </Button>
            <Button onClick={() => setAdding(true)}>
              <PlusIcon /> Add response
            </Button>
          </div>
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
                '-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground',
                isActive && 'border-foreground text-foreground',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
      <ResponseDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
