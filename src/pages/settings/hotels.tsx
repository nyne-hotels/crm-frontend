import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLinkIcon, PencilIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Field, FormError } from '@/components/field'
import { LastUpdated } from '@/components/last-updated'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useProperties, useUpdateProperty } from '@/hooks/use-settings'
import { errorMessage } from '@/lib/api'
import type { Property } from '@/lib/types'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  location: z.string().trim(),
  propertyType: z.string().trim(),
  webUrl: z.union([z.literal(''), z.url('Enter a full web address, starting with https://')]),
})
type Values = z.infer<typeof schema>

function HotelDialog({ hotel, onOpenChange }: { hotel: Property | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={!!hotel} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit hotel</DialogTitle>
          <DialogDescription>{hotel?.id}</DialogDescription>
        </DialogHeader>
        {hotel && <HotelForm hotel={hotel} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function HotelForm({ hotel, onClose }: { hotel: Property; onClose: () => void }) {
  const update = useUpdateProperty()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: hotel.name,
      location: hotel.location ?? '',
      propertyType: hotel.propertyType ?? '',
      webUrl: hotel.webUrl ?? '',
    },
  })

  async function submit(values: Values) {
    try {
      await update.mutateAsync({
        id: hotel.id,
        name: values.name,
        location: values.location || null,
        propertyType: values.propertyType || null,
        webUrl: values.webUrl || null,
      })
      toast.success('Hotel saved')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
        <form id="hotel-form" onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
          <FormError message={error} />
          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" {...register('name')} />
          </Field>
          <Field label="Location" htmlFor="location" error={errors.location?.message}>
            <Input id="location" {...register('location')} />
          </Field>
          <Field label="Type" htmlFor="propertyType" error={errors.propertyType?.message} hint="For example boutique hotel or villa.">
            <Input id="propertyType" {...register('propertyType')} />
          </Field>
          <Field label="Website" htmlFor="webUrl" error={errors.webUrl?.message}>
            <Input id="webUrl" type="url" placeholder="https://" {...register('webUrl')} />
          </Field>
          <LastUpdated value={hotel.lastUpdated} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="hotel-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
    </>
  )
}

export function HotelsPage() {
  const { data: hotels, isPending, isError } = useProperties()
  const update = useUpdateProperty()
  const [editing, setEditing] = useState<Property | null>(null)

  async function toggle(hotel: Property, isActive: boolean) {
    try {
      await update.mutateAsync({ id: hotel.id, isActive })
      toast.success(isActive ? `${hotel.name} is active` : `${hotel.name} is hidden from drop-downs`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">
        Switching a hotel off hides it from drop-downs. Its guests and stays are kept.
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Edit</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending || isError ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {isError ? "Couldn't load hotels." : 'Loading…'}
                </TableCell>
              </TableRow>
            ) : (
              hotels.map((hotel) => (
                <TableRow key={hotel.id} className={hotel.isActive ? undefined : 'text-muted-foreground'}>
                  <TableCell className="font-mono text-xs">{hotel.id}</TableCell>
                  <TableCell className="font-medium">{hotel.name}</TableCell>
                  <TableCell>{hotel.location}</TableCell>
                  <TableCell>{hotel.propertyType}</TableCell>
                  <TableCell>
                    {hotel.webUrl && (
                      <a
                        href={hotel.webUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                      >
                        {new URL(hotel.webUrl).hostname}
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={hotel.isActive}
                      onCheckedChange={(checked) => toggle(hotel, checked)}
                      aria-label={`${hotel.name} active`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(hotel)} aria-label={`Edit ${hotel.name}`}>
                      <PencilIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <HotelDialog hotel={editing} onOpenChange={(open) => !open && setEditing(null)} />
    </div>
  )
}
