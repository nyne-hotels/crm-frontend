import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Field, FormError } from '@/components/field'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ME_KEY, useMe } from '@/hooks/use-me'
import { api } from '@/lib/api'
import { authClient, signInErrorMessage } from '@/lib/auth-client'
import type { Me } from '@/lib/types'

export function SignInPage() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: string } | null)?.from || '/'
  if (me) return <Navigate to={me.mustChangePassword ? '/change-password' : from} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter your username and password')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await authClient.signIn.username({ username: username.trim(), password })
    if (error) {
      setError(signInErrorMessage(error))
      setBusy(false)
      return
    }
    const signedIn = await queryClient.fetchQuery({ queryKey: ME_KEY, queryFn: () => api<Me>('/me') })
    navigate(signedIn.mustChangePassword ? '/change-password' : from, { replace: true })
  }

  return (
    <div className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Logo className="mx-auto mb-2 h-16" />
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Nyne Hotels CRM</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <FormError message={error} />
            <Field label="Username" htmlFor="username">
              <Input
                id="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">Forgot your password? Ask your admin.</p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
