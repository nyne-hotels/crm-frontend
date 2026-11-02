import { EllipsisIcon, PlusIcon, SearchIcon } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMe } from '@/hooks/use-me'
import { useProperties, useStaffUserMutations, useStaffUsers } from '@/hooks/use-settings'
import { formatDateTime, fullName } from '@/lib/format'
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from '@/lib/permissions'
import type { StaffUser } from '@/lib/types'
import { CredentialsDialog, ResetPasswordDialog, StaffUserFormDialog } from './staff-user-dialogs'

const ANY = 'any'

type Confirm = { kind: 'sign-out' | 'deactivate' | 'reactivate'; user: StaffUser }

export function StaffUsersPage() {
  const { data: me } = useMe()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<string>(ANY)
  const [hotel, setHotel] = useState<string>(ANY)
  const q = useDeferredValue(search.trim())

  const { data: users, isPending, isError } = useStaffUsers({
    q: q || undefined,
    role: role === ANY ? undefined : (role as StaffRole),
    propertyId: hotel === ANY ? undefined : hotel,
  })
  const { data: hotels = [] } = useProperties()
  const { signOutEverywhere, setActive } = useStaffUserMutations()

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<StaffUser | null>(null)
  const [resetting, setResetting] = useState<StaffUser | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [credentials, setCredentials] = useState<{ title: string; name: string; username: string; password: string } | null>(
    null,
  )

  const confirmCopy = confirm && {
    'sign-out': {
      title: `Sign ${confirm.user.firstName} out everywhere?`,
      description: 'Every session on every device ends now. They can sign in again with their password.',
      label: 'Sign out everywhere',
      run: () => signOutEverywhere.mutateAsync(confirm.user.id).then(() => toast.success('Signed out everywhere')),
    },
    deactivate: {
      title: `Deactivate ${fullName(confirm.user)}?`,
      description: "They're signed out everywhere at once and can't sign in. Their name stays on everything they did.",
      label: 'Deactivate',
      run: () => setActive.mutateAsync({ id: confirm.user.id, active: false }).then(() => toast.success('Deactivated')),
    },
    reactivate: {
      title: `Reactivate ${fullName(confirm.user)}?`,
      description: 'They can sign in again with their existing password.',
      label: 'Reactivate',
      run: () => setActive.mutateAsync({ id: confirm.user.id, active: true }).then(() => toast.success('Reactivated')),
    },
  }[confirm.kind]

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or username"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            aria-label="Search staff users"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-40" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All roles</SelectItem>
            {STAFF_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={hotel} onValueChange={setHotel}>
          <SelectTrigger className="w-44" aria-label="Filter by hotel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any home hotel</SelectItem>
            <SelectItem value="all">All hotels (group-wide)</SelectItem>
            {hotels.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setAdding(true)} className="ml-auto">
          <PlusIcon /> Add staff user
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Home hotel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-destructive">
                  Couldn't load staff users.
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No staff users match.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className={user.isActive ? undefined : 'text-muted-foreground'}>
                  <TableCell>
                    <div className="font-medium">{fullName(user)}</div>
                    {user.email && <div className="text-xs text-muted-foreground">{user.email}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{user.username}</TableCell>
                  <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                  <TableCell>{user.propertyName ?? 'All hotels'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                      {user.isActive && user.mustChangePassword && <Badge variant="outline">Temporary password</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDateTime(user.lastSignInAt) || 'Never'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${fullName(user)}`}>
                          <EllipsisIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(user)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setResetting(user)} disabled={!user.isActive}>
                          Reset password
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setConfirm({ kind: 'sign-out', user })} disabled={!user.isActive}>
                          Sign out everywhere
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.isActive ? (
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={user.id === me?.id}
                            onSelect={() => setConfirm({ kind: 'deactivate', user })}
                          >
                            Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => setConfirm({ kind: 'reactivate', user })}>Reactivate</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <StaffUserFormDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={(user, password) =>
          setCredentials({ title: 'Staff user added', name: user.firstName, username: user.username ?? '', password })
        }
      />
      <StaffUserFormDialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)} user={editing ?? undefined} />
      <ResetPasswordDialog
        user={resetting}
        onOpenChange={(open) => !open && setResetting(null)}
        onReset={(user, password) =>
          setCredentials({ title: 'Password reset', name: user.firstName, username: user.username ?? '', password })
        }
      />
      <CredentialsDialog credentials={credentials} onOpenChange={(open) => !open && setCredentials(null)} />
      {confirmCopy && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirm(null)}
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.label}
          destructive={confirm?.kind === 'deactivate'}
          onConfirm={confirmCopy.run}
        />
      )}
    </div>
  )
}
