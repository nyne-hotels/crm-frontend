import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { ChangePasswordForm } from '@/components/change-password-form'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authClient } from '@/lib/auth-client'

// Shown after signing in with a temporary password, before anything else.
export function ChangePasswordPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function signOut() {
    await authClient.signOut()
    queryClient.clear()
    navigate('/sign-in', { replace: true })
  }

  return (
    <div className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Logo className="mx-auto mb-2 h-16" />
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>You signed in with a temporary password. Choose your own to continue.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ChangePasswordForm
            currentLabel="Temporary password"
            submitLabel="Save and continue"
            onDone={() => navigate('/', { replace: true })}
          />
          <Button variant="link" size="sm" className="text-muted-foreground" onClick={signOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
