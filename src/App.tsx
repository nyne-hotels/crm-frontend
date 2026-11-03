import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import { AppShell } from '@/components/app-shell'
import { RequireAccess, RequireAuth } from '@/components/route-guards'
import { Toaster } from '@/components/ui/sonner'
import { ME_KEY } from '@/hooks/use-me'
import { ApiError } from '@/lib/api'
import { CompaniesPage } from '@/pages/companies/companies-list'
import { CompanyProfilePage } from '@/pages/companies/company-profile'
import { ChangePasswordPage } from '@/pages/change-password'
import { EmployeePage } from '@/pages/feedback/employee-page'
import { EmployeesPage } from '@/pages/feedback/employees-list'
import { FeedbackDetailPage } from '@/pages/feedback/feedback-detail'
import { FeedbackInboxPage } from '@/pages/feedback/feedback-inbox'
import { FeedbackLayout } from '@/pages/feedback/feedback-layout'
import { HotelRatingsPage } from '@/pages/feedback/hotel-ratings'
import { NotFoundPage } from '@/pages/forbidden'
import { MergeReviewPage } from '@/pages/guests/duplicates/merge-review'
import { PossibleDuplicatesPage } from '@/pages/guests/duplicates/possible-duplicates'
import { GuestProfilePage } from '@/pages/guests/guest-profile'
import { GuestsPage } from '@/pages/guests/guests-list'
import { UpcomingOccasionsPage } from '@/pages/guests/upcoming-occasions'
import { HomePage } from '@/pages/home'
import { FollowUpsPage } from '@/pages/leads/follow-ups'
import { LeadDetailPage } from '@/pages/leads/lead-detail'
import { LeadsBoardPage } from '@/pages/leads/leads-board'
import { LeadsLayout } from '@/pages/leads/leads-layout'
import { LeadsListPage } from '@/pages/leads/leads-list'
import { CampaignsPage } from '@/pages/marketing/campaigns'
import { EmailListPage } from '@/pages/marketing/email-list'
import { EmailUploadsPage } from '@/pages/marketing/email-uploads'
import { MarketingLayout } from '@/pages/marketing/marketing-layout'
import { ContactImportDetailPage } from '@/pages/settings/contact-imports/contact-import-detail'
import { ContactImportHistoryPage } from '@/pages/settings/contact-imports/contact-import-history'
import { HotelsPage } from '@/pages/settings/hotels'
import { MergeDetailPage } from '@/pages/settings/merge-detail'
import { MergeHistoryPage } from '@/pages/settings/merge-history'
import { OccasionsPage } from '@/pages/settings/occasions'
import { SettingsLayout } from '@/pages/settings/settings-layout'
import { StaffUsersPage } from '@/pages/settings/staff-users'
import { TagsPage } from '@/pages/settings/tags'
import { StaysPage } from '@/pages/stays/stays-list'
import { SignInPage } from '@/pages/sign-in'

// The imports read spreadsheets with SheetJS, which is large, so they load
// only when someone opens Import bookings, Upload responses or Import contacts.
const ImportBookingsPage = lazy(() =>
  import('@/pages/stays/import/import-bookings').then((m) => ({ default: m.ImportBookingsPage })),
)
const UploadResponsesPage = lazy(() =>
  import('@/pages/feedback/upload-responses').then((m) => ({ default: m.UploadResponsesPage })),
)
const ImportContactsPage = lazy(() =>
  import('@/pages/settings/contact-imports/import-contacts').then((m) => ({ default: m.ImportContactsPage })),
)

// A 401 means the session ended (12 hours idle, signed out everywhere,
// deactivated); a PASSWORD_CHANGE_REQUIRED 403 means an admin reset the password.
// Re-reading /me lets the route guards send the user to the right screen.
function onApiError(error: Error) {
  if (error instanceof ApiError && (error.status === 401 || error.code === 'PASSWORD_CHANGE_REQUIRED')) {
    queryClient.invalidateQueries({ queryKey: ME_KEY })
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // /me failing is how the guards learn the user is signed out; re-reading it would loop
    onError: (error, query) => query.queryKey[0] !== ME_KEY[0] && onApiError(error),
  }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
})

const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInPage /> },
  {
    path: '/change-password',
    element: (
      <RequireAuth allowPendingPassword>
        <ChangePasswordPage />
      </RequireAuth>
    ),
  },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'guests',
        element: (
          <RequireAccess area="guests">
            <Outlet />
          </RequireAccess>
        ),
        children: [
          { index: true, element: <GuestsPage /> },
          { path: 'occasions', element: <UpcomingOccasionsPage /> },
          {
            path: 'duplicates',
            element: (
              <RequireAccess area="mergeGuests" access="edit">
                <Outlet />
              </RequireAccess>
            ),
            children: [
              { index: true, element: <PossibleDuplicatesPage /> },
              { path: 'review', element: <MergeReviewPage /> },
            ],
          },
          { path: ':id', element: <GuestProfilePage /> },
        ],
      },
      {
        path: 'stays',
        element: (
          <RequireAccess area="stays">
            <Outlet />
          </RequireAccess>
        ),
        children: [
          { index: true, element: <StaysPage /> },
          {
            path: 'import',
            element: (
              <RequireAccess area="stays" access="edit">
                <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
                  <ImportBookingsPage />
                </Suspense>
              </RequireAccess>
            ),
          },
        ],
      },
      {
        path: 'leads',
        element: (
          <RequireAccess area="leads">
            <Outlet />
          </RequireAccess>
        ),
        children: [
          {
            element: <LeadsLayout />,
            children: [
              { index: true, element: <LeadsBoardPage /> },
              { path: 'list', element: <LeadsListPage /> },
              {
                path: 'follow-ups',
                element: (
                  <RequireAccess area="leads" access="edit">
                    <FollowUpsPage />
                  </RequireAccess>
                ),
              },
            ],
          },
          { path: ':id', element: <LeadDetailPage /> },
        ],
      },
      {
        path: 'companies',
        element: (
          <RequireAccess area="leads">
            <Outlet />
          </RequireAccess>
        ),
        children: [
          { index: true, element: <CompaniesPage /> },
          { path: ':id', element: <CompanyProfilePage /> },
        ],
      },
      {
        path: 'feedback',
        element: (
          <RequireAccess area="feedback">
            <Outlet />
          </RequireAccess>
        ),
        children: [
          {
            element: <FeedbackLayout />,
            children: [
              { index: true, element: <FeedbackInboxPage /> },
              { path: 'ratings', element: <HotelRatingsPage /> },
              {
                path: 'employees',
                element: (
                  <RequireAccess area="employees">
                    <EmployeesPage />
                  </RequireAccess>
                ),
              },
            ],
          },
          {
            path: 'employees/:id',
            element: (
              <RequireAccess area="employees">
                <EmployeePage />
              </RequireAccess>
            ),
          },
          {
            path: 'upload',
            element: (
              <RequireAccess area="feedback" access="edit">
                <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
                  <UploadResponsesPage />
                </Suspense>
              </RequireAccess>
            ),
          },
          { path: ':id', element: <FeedbackDetailPage /> },
        ],
      },
      {
        path: 'marketing',
        element: (
          <RequireAccess area="marketingExport">
            <MarketingLayout />
          </RequireAccess>
        ),
        children: [
          { index: true, element: <Navigate to="email-list" replace /> },
          { path: 'email-list', element: <EmailListPage /> },
          {
            path: 'campaigns',
            element: (
              <RequireAccess area="campaigns">
                <CampaignsPage />
              </RequireAccess>
            ),
          },
          {
            path: 'uploads',
            element: (
              <RequireAccess area="guestConsent" access="edit">
                <EmailUploadsPage />
              </RequireAccess>
            ),
          },
        ],
      },
      {
        path: 'settings',
        element: (
          <RequireAccess area="settings" access="edit">
            <SettingsLayout />
          </RequireAccess>
        ),
        children: [
          { index: true, element: <Navigate to="staff-users" replace /> },
          { path: 'staff-users', element: <StaffUsersPage /> },
          { path: 'hotels', element: <HotelsPage /> },
          { path: 'occasions', element: <OccasionsPage /> },
          { path: 'tags', element: <TagsPage /> },
          { path: 'merges', element: <MergeHistoryPage /> },
          { path: 'merges/:id', element: <MergeDetailPage /> },
          {
            path: 'contact-imports',
            element: (
              <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
                <ImportContactsPage />
              </Suspense>
            ),
          },
          { path: 'contact-imports/history', element: <ContactImportHistoryPage /> },
          { path: 'contact-imports/:id', element: <ContactImportDetailPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  )
}
