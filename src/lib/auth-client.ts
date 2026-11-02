import { usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

// Better Auth is mounted on the API at /api/auth (same origin through the Vite proxy).
// Only sign-in, sign-out and the session are used from here; everything else goes
// through the CRM API so roles are checked.
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [usernameClient()],
})

const SIGN_IN_ERRORS: Record<string, string> = {
  INVALID_USERNAME_OR_PASSWORD: 'Username or password is incorrect',
  USERNAME_TOO_SHORT: 'Username or password is incorrect',
  USERNAME_TOO_LONG: 'Username or password is incorrect',
  INVALID_USERNAME: 'Username or password is incorrect',
  BANNED_USER: 'Your account is inactive. Ask an admin.',
}

export const signInErrorMessage = (error: { code?: string; message?: string }) =>
  (error.code && SIGN_IN_ERRORS[error.code]) || error.message || 'Could not sign in. Try again.'
