import { toast } from 'sonner'
import { useDuplicateMutations } from '@/hooks/use-duplicates'
import { errorMessage } from '@/lib/api'

// "Not a duplicate": the pair leaves the queue for good, so the toast offers
// an Undo for a slip of the finger. Resolves to whether it was saved.
export function useNotDuplicate() {
  const { notDuplicate, undoNotDuplicate } = useDuplicateMutations()
  return async (a: number, b: number, names: [string, string]): Promise<boolean> => {
    try {
      await notDuplicate.mutateAsync({ a, b })
      toast.success(`${names[0]} and ${names[1]} marked as different people`, {
        action: {
          label: 'Undo',
          onClick: () =>
            undoNotDuplicate.mutate({ a, b }, { onError: (err) => toast.error(errorMessage(err)) }),
        },
      })
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }
}
