import { NavLink, Outlet } from 'react-router'
import { cn } from '@/lib/utils'

// Marketing → Email list, and Unsubscribes & bounces (from Mailchimp, by
// themselves). Campaigns have their own tab (/campaigns).
export function MarketingLayout() {
  const tabs = [
    { label: 'Email list', to: '/marketing/email-list' },
    { label: 'Unsubscribes & bounces', to: '/marketing/unsubscribes' },
  ]
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="font-heading text-2xl font-semibold">Marketing</h1>
      <nav className="mt-4 mb-6 flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
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
