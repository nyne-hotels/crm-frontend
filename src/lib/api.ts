// Thin fetch wrapper for the NestJS API. Same origin (Vite proxies /api), so
// the Better Auth session cookie is sent automatically.

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly body?: Record<string, unknown> // the whole error, e.g. the feedbackId of a response already on file

  constructor(status: number, message: string, code?: string, body?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.code = code
    this.body = body
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export async function api<T = void>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
    throw new ApiError(res.status, message || 'Something went wrong. Try again.', data?.code, data ?? undefined)
  }
  return data as T
}

export const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Something went wrong. Try again.'

// Builds "?a=1&b=2", leaving out empty values.
export function queryString(params: Record<string, string | undefined>) {
  const entries = Object.entries(params).filter((e): e is [string, string] => !!e[1])
  return entries.length ? `?${new URLSearchParams(entries)}` : ''
}
