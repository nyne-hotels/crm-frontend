import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-heading text-xl font-semibold">You don't have access to this page</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your role can't open it. Ask an admin if you need it.</p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/">Go to home</Link>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-heading text-xl font-semibold">Page not found</h1>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/">Go to home</Link>
      </Button>
    </div>
  )
}
