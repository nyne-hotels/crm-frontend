import { zodResolver } from '@hookform/resolvers/zod'
import { CopyIcon, RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Field, FormError } from '@/components/field'
import { LastUpdated } from '@/components/last-updated'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProperties, useStaffUserMutations } from '@/hooks/use-settings'
import { errorMessage } from '@/lib/api'
import { MIN_PASSWORD_LENGTH, generatePassword } from '@/lib/password'
import { ROLE_LABELS, STAFF_ROLES } from '@/lib/permissions'
import type { StaffUser } from '@/lib/types'

const ALL_HOTELS = 'all'

const passwordField = z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)

const baseSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter a first name'),
  lastName: z.string().trim(),
  username: z
    .string()
    .trim()
    .min(3, 'Use 3 to 30 characters')
    .max(30, 'Use 3 to 30 characters')
    .regex(/^[a-z0-9]+(\.[a-z0-9]+)*$/i, 'Use letters and numbers, with dots between them (e.g. nisha.silva)'),
  role: z.enum(STAFF_ROLES, 'Choose a role'),
  propertyId: z.string(),
  email: z.union([z.literal(''), z.email('Enter a valid email')]),
  temporaryPassword: z.string(),
})

type Values = z.infer<typeof baseSchema>

function PasswordInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" />
      <Button type="button" variant="outline" onClick={() => onChange(generatePassword())}>
        <RefreshCwIcon /> Generate
      </Button>
    </div>
  )
}

// Add staff user / Edit staff user
export function StaffUserFormDialog({
  open,
  onOpenChange,
  user,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: StaffUser
  onCreated?: (user: StaffUser, temporaryPassword: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit staff user' : 'Add staff user'}</DialogTitle>
          <DialogDescription>
            {user
              ? 'Changes apply at their next request. To change their password, use Reset password.'
              : 'Pass the username and temporary password on in person or by message. They choose their own password at first sign-in.'}
          </DialogDescription>
        </DialogHeader>
        {/* mounted only while open, so each opening starts from fresh values */}
        <StaffUserForm user={user} onClose={() => onOpenChange(false)} onCreated={onCreated} />
      </DialogContent>
    </Dialog>
  )
}

function StaffUserForm({
  user,
  onClose,
  onCreated,
}: {
  user?: StaffUser
  onClose: () => void
  onCreated?: (user: StaffUser, temporaryPassword: string) => void
}) {
  const isEdit = !!user
  const { create, update } = useStaffUserMutations()
  const { data: hotels = [] } = useProperties()
  const [error, setError] = useState<string | null>(null)
  const schema = isEdit ? baseSchema : baseSchema.extend({ temporaryPassword: passwordField })

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      username: user?.username ?? '',
      role: user?.role,
      propertyId: user?.propertyId ?? ALL_HOTELS,
      email: user?.email ?? '',
      temporaryPassword: isEdit ? '' : generatePassword(),
    },
  })

  async function submit(values: Values) {
    setError(null)
    const input = {
      firstName: values.firstName,
      lastName: values.lastName || null,
      username: values.username.toLowerCase(),
      role: values.role,
      propertyId: values.propertyId === ALL_HOTELS ? null : values.propertyId,
      email: values.email || null,
    }
    try {
      if (isEdit) {
        await update.mutateAsync({ id: user.id, ...input })
        toast.success('Staff user saved')
        onClose()
      } else {
        const created = await create.mutateAsync({ ...input, temporaryPassword: values.temporaryPassword })
        onClose()
        onCreated?.(created, values.temporaryPassword)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
        <form id="staff-user-form" onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
          <FormError message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="firstName" error={errors.firstName?.message}>
              <Input id="firstName" {...register('firstName')} />
            </Field>
            <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
              <Input id="lastName" {...register('lastName')} />
            </Field>
          </div>
          <Field label="Username" htmlFor="username" error={errors.username?.message} hint="For example nisha.silva. Not case-sensitive.">
            <Input id="username" autoCapitalize="none" spellCheck={false} {...register('username')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role" htmlFor="role" error={errors.role?.message}>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger id="role" className="w-full">
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Home hotel" htmlFor="propertyId" error={errors.propertyId?.message}>
              <Controller
                control={control}
                name="propertyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="propertyId" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_HOTELS}>All hotels</SelectItem>
                      {hotels
                        .filter((h) => h.isActive || h.id === field.value)
                        .map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          {!isEdit && (
            <Field label="Temporary password" htmlFor="temporaryPassword" error={errors.temporaryPassword?.message}>
              <Controller
                control={control}
                name="temporaryPassword"
                render={({ field }) => <PasswordInput id="temporaryPassword" value={field.value} onChange={field.onChange} />}
              />
            </Field>
          )}
          <Field label="Email (optional)" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" {...register('email')} />
          </Field>
          {user && <LastUpdated value={user.lastUpdated} />}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="staff-user-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isEdit ? 'Save' : 'Add staff user'}
          </Button>
        </DialogFooter>
    </>
  )
}

// Sets a new temporary password; the old one stops working at once.
export function ResetPasswordDialog({
  user,
  onOpenChange,
  onReset,
}: {
  user: StaffUser | null
  onOpenChange: (open: boolean) => void
  onReset: (user: StaffUser, temporaryPassword: string) => void
}) {
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            {user?.firstName}'s current password will stop working and they'll be signed out everywhere. They choose a
            new password at their next sign-in.
          </DialogDescription>
        </DialogHeader>
        {user && <ResetPasswordForm user={user} onClose={() => onOpenChange(false)} onReset={onReset} />}
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordForm({
  user,
  onClose,
  onReset,
}: {
  user: StaffUser
  onClose: () => void
  onReset: (user: StaffUser, temporaryPassword: string) => void
}) {
  const { resetPassword } = useStaffUserMutations()
  const [password, setPassword] = useState(generatePassword)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    try {
      await resetPassword.mutateAsync({ id: user.id, temporaryPassword: password })
      onClose()
      onReset(user, password)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <div className="grid gap-4">
        <FormError message={error} />
        <Field label="New temporary password" htmlFor="resetPassword">
          <PasswordInput id="resetPassword" value={password} onChange={setPassword} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={resetPassword.isPending}>
          {resetPassword.isPending ? 'Saving…' : 'Reset password'}
        </Button>
      </DialogFooter>
    </>
  )
}

// Shown once after adding a user or resetting a password, so the admin can pass the details on.
export function CredentialsDialog({
  credentials,
  onOpenChange,
}: {
  credentials: { title: string; name: string; username: string; password: string } | null
  onOpenChange: (open: boolean) => void
}) {
  async function copy() {
    if (!credentials) return
    await navigator.clipboard.writeText(`Username: ${credentials.username}\nTemporary password: ${credentials.password}`)
    toast.success('Copied')
  }

  return (
    <Dialog open={!!credentials} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{credentials?.title}</DialogTitle>
          <DialogDescription>
            Pass these on to {credentials?.name} in person or by message. The password isn't shown again.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-md bg-muted p-4 text-sm">
          <dt className="text-muted-foreground">Username</dt>
          <dd className="font-mono">{credentials?.username}</dd>
          <dt className="text-muted-foreground">Temporary password</dt>
          <dd className="font-mono">{credentials?.password}</dd>
        </dl>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            <CopyIcon /> Copy
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
