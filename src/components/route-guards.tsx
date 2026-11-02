import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useMe } from '@/hooks/use-me'
import { can, type Access, type Area } from '@/lib/permissions'
import { ForbiddenPage } from '@/pages/forbidden'

function FullPageLoading() {
  return <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">Loading…</div>
}

// Signed-in staff only. Until a temporary password is replaced, nothing but
// the "Choose a new password" screen is reachable.
export function RequireAuth({ children, allowPendingPassword = false }: { children: ReactNode; allowPendingPassword?: boolean }) {
  const { data: me, isPending, isError } = useMe()
  const location = useLocation()

  if (isPending) return <FullPageLoading />
  if (isError || !me) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  if (me.mustChangePassword && !allowPendingPassword) return <Navigate to="/change-password" replace />
  if (!me.mustChangePassword && allowPendingPassword) return <Navigate to="/" replace />
  return children
}

// Hides a page from roles without access. The API refuses these requests
// too; this just shows a clear message instead of failing requests.
export function RequireAccess({ area, access = 'view', children }: { area: Area; access?: Exclude<Access, 'none'>; children: ReactNode }) {
  const { data: me } = useMe()
  if (!can(me?.permissions, area, access)) return <ForbiddenPage />
  return children
}
