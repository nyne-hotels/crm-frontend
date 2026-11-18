import { ArrowLeftIcon, MailIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCampaign, useCampaignMutations, useCampaignReport, useCampaignResults } from '@/hooks/use-campaigns'
import { useLeadOwners } from '@/hooks/use-leads'
import { useMe } from '@/hooks/use-me'
import { ApiError, errorMessage } from '@/lib/api'
import { can } from '@/lib/permissions'
import { PeopleList, SyncedResults, SyncStatus } from './campaign-people'
import { FormResults, MailchimpReport } from './campaign-report'
import { CampaignHeader, CampaignSetup } from './campaign-setup'
import { LinkMailchimpDialog } from './link-mailchimp-dialog'

// /campaigns/:id – keyed by id, so opening another campaign starts afresh
export function CampaignPage() {
  const { id } = useParams()
  return <CampaignView key={id} id={Number(id)} />
}

function CampaignView({ id }: { id: number }) {
  const { data: me } = useMe()
  const canEdit = can(me?.permissions, 'campaigns', 'edit')
  const { data: campaign, isPending, error } = useCampaign(id)
  const { data: owners = [] } = useLeadOwners()
  const linked = !!campaign?.mailchimpCampaignId
  const report = useCampaignReport(id, linked)
  const results = useCampaignResults(id, linked)

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-6xl gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (error || !campaign) {
    const missing = error instanceof ApiError && (error.status === 404 || error.status === 400)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-heading text-xl font-semibold">{missing ? 'Campaign not found' : "Couldn't load this campaign"}</h1>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/campaigns">Back to campaigns</Link>
        </Button>
      </div>
    )
  }

  return (
    // grid-cols-1 keeps wide content (the providers table) scrolling in its card on a phone
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4">
      <Link to="/campaigns" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Campaigns
      </Link>
      <CampaignHeader campaign={campaign} canEdit={canEdit} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CampaignSetup campaign={campaign} owners={owners} email={report.data?.email} canEdit={canEdit} />
        </div>
        <FormResults campaign={campaign} />
      </div>
      {linked ? (
        <MailchimpReport
          campaign={campaign}
          report={report.data}
          error={report.error}
          isPending={report.isPending}
          onRetry={() => report.refetch()}
          afterTiles={
            <>
              <SyncStatus campaignId={campaign.id} results={results.data} canSync={canEdit} />
              {results.data && <SyncedResults results={results.data} />}
            </>
          }
          afterLinks={results.data?.recipients && <PeopleList campaignId={campaign.id} />}
        />
      ) : (
        <NotLinked campaign={campaign} canEdit={canEdit} />
      )}
    </div>
  )
}

function NotLinked({ campaign, canEdit }: { campaign: NonNullable<ReturnType<typeof useCampaign>['data']>; canEdit: boolean }) {
  const [picking, setPicking] = useState(false)
  const { update } = useCampaignMutations()
  return (
    <div className="grid justify-items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
      <MailIcon className="size-6 text-muted-foreground" />
      <div>
        <p className="font-medium">No Mailchimp email linked yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {canEdit
            ? 'Link the email this campaign was sent as to see how it did: opens, clicks, links and more.'
            : 'Once someone links the email this campaign was sent as, its figures show here.'}
        </p>
      </div>
      {canEdit && (
        <>
          <Button onClick={() => setPicking(true)}>Link a Mailchimp email</Button>
          <LinkMailchimpDialog
            open={picking}
            onOpenChange={setPicking}
            campaign={campaign}
            saving={update.isPending}
            onPick={async (mailchimpCampaignId) => {
              try {
                await update.mutateAsync({ id: campaign.id, mailchimpCampaignId })
                toast.success('Mailchimp email linked')
                setPicking(false)
              } catch (err) {
                toast.error(errorMessage(err))
              }
            }}
          />
        </>
      )}
    </div>
  )
}
