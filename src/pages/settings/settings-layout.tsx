import { NavLink, Outlet } from 'react-router'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Staff users', to: '/settings/staff-users' },
  { label: 'Hotels', to: '/settings/hotels' },
  { label: 'Occasions', to: '/settings/occasions' },
  { label: 'Tags', to: '/settings/tags' },
  { label: 'Merge history', to: '/settings/merges' },
  { label: 'Import contacts', to: '/settings/contact-imports' },
  { label: 'Deleted items', to: '/settings/deleted-items' },
]

export function SettingsLayout() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-heading text-2xl font-semibold">Settings</h1>
      <nav className="mt-4 mb-6 flex gap-1 overflow-x-auto border-b">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
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
    </div>
  )
}
