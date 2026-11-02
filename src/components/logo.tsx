import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return <img src="/logo.svg" alt="Nyne Hotels" className={cn('h-9 w-auto', className)} />
}
