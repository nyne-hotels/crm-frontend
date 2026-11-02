import { useQueryClient } from '@tanstack/react-query'
import {
  BedDoubleIcon,
  Building2Icon,
  ChartColumnIcon,
  ChevronDownIcon,
  HouseIcon,
  KeyRoundIcon,
  LogOutIcon,
  MegaphoneIcon,
  MenuIcon,
  MessageSquareHeartIcon,
  SettingsIcon,
  TargetIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ChangePasswordForm } from '@/components/change-password-form'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMe } from '@/hooks/use-me'
import { authClient } from '@/lib/auth-client'
import { fullName } from '@/lib/format'
import { can, type Area } from '@/lib/permissions'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  area?: Area // hidden from roles without at least view access
  built: boolean // hidden until its module is built
}

const NAV: NavItem[] = [
  { label: 'Home', to: '/', icon: HouseIcon, built: true },
  // "Contacts": guests, leads, agent contacts and influencers. The URL and API stay /guests.
  { label: 'Contacts', to: '/guests', icon: UsersIcon, area: 'guests', built: true }, // Module 2
  { label: 'Stays', to: '/stays', icon: BedDoubleIcon, area: 'stays', built: true }, // Module 3
  { label: 'Marketing', to: '/marketing', icon: MegaphoneIcon, area: 'marketingExport', built: true }, // Module 5
  { label: 'Leads', to: '/leads', icon: TargetIcon, area: 'leads', built: true }, // Module 7
  { label: 'Companies', to: '/companies', icon: Building2Icon, area: 'leads', built: true }, // Module 7: travel agents
  { label: 'Feedback', to: '/feedback', icon: MessageSquareHeartIcon, area: 'feedback', built: true }, // Module 8
  { label: 'Reports', to: '/reports', icon: ChartColumnIcon, built: false },
  { label: 'Settings', to: '/settings', icon: SettingsIcon, area: 'settings', built: true },
]

export function AppShell() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [changingPassword, setChangingPassword] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const items = NAV.filter((item) => item.built && (!item.area || can(me?.permissions, item.area)))

  async function signOut() {
    await authClient.signOut()
    queryClient.clear()
    navigate('/sign-in', { replace: true })
  }

  const nav = (
    <nav className="grid gap-1 p-3">
      {items.map(({ label, to, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
            )
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
          <MenuIcon />
        </Button>
        <Logo />
        <div className="ml-auto">
          {me && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto py-1.5">
                  <span className="grid text-right leading-tight">
                    <span className="text-sm font-medium">{fullName(me)}</span>
                    <span className="text-xs text-muted-foreground">{me.roleLabel}</span>
                  </span>
                  <ChevronDownIcon className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal text-muted-foreground">{me.username}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setChangingPassword(true)}>
                  <KeyRoundIcon /> Change password
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={signOut}>
                  <LogOutIcon /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r bg-sidebar md:block">{nav}</aside>
        {menuOpen && (
          <aside className="fixed inset-x-0 top-14 bottom-0 z-20 bg-sidebar md:hidden">{nav}</aside>
        )}
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      <Dialog open={changingPassword} onOpenChange={setChangingPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>You'll stay signed in here and be signed out on other devices.</DialogDescription>
          </DialogHeader>
          <ChangePasswordForm
            onCancel={() => setChangingPassword(false)}
            onDone={() => {
              setChangingPassword(false)
              toast.success('Password changed')
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
