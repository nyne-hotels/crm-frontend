import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Field, FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ME_KEY } from '@/hooks/use-me'
import { api, errorMessage } from '@/lib/api'
import { MIN_PASSWORD_LENGTH } from '@/lib/password'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: "The passwords don't match" })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password that is different from the current one',
  })

type Values = z.infer<typeof schema>

// Used for the forced change after a temporary password and for "Change
// password" in the top bar. Changing it signs out every other device.
export function ChangePasswordForm({
  currentLabel = 'Current password',
  submitLabel = 'Change password',
  onDone,
  onCancel,
}: {
  currentLabel?: string
  submitLabel?: string
  onDone: () => void
  onCancel?: () => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  async function submit({ currentPassword, newPassword }: Values) {
    setError(null)
    try {
      await api('/me/password', { method: 'POST', body: { currentPassword, newPassword } })
      await queryClient.invalidateQueries({ queryKey: ME_KEY })
      onDone()
    } catch (err) {
      setError(errorMessage(err) === 'Invalid password' ? `${currentLabel} is incorrect` : errorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
      <FormError message={error} />
      <Field label={currentLabel} htmlFor="currentPassword" error={errors.currentPassword?.message}>
        <Input id="currentPassword" type="password" autoComplete="current-password" autoFocus {...register('currentPassword')} />
      </Field>
      <Field
        label="New password"
        htmlFor="newPassword"
        error={errors.newPassword?.message}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      >
        <Input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword')} />
      </Field>
      <Field label="Repeat new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
        <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
      </Field>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
