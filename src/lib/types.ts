import type { Permissions, StaffRole } from './permissions'
import type { ConsentChannel, ConsentSource, ConsentStatus, NotOnListReason } from './consent'
import type { ChangeField, ContactDecision, ContactRowGroup, ContactRowOutcome } from './contact-imports'
import type { DuplicateReason } from './duplicates'
import type { Department, FeedbackTab, Sentiment } from './feedback'
import type { ContactMethodKind, ContactMethodStatus, ContactType, LifecycleStage, Market } from './guests'
import type { PreferenceCategory, PreferenceKind, SpecialDateOccasion } from './knowledge'
import type {
  CompanyStatus,
  CompanyType,
  InteractionDirection,
  InteractionKind,
  LeadSource,
  LeadStatus,
  LostReason,
} from './leads'
import type { QuickView, StayChannel, StayStatus } from './stays'

// "Last updated by …" – `by` is null when the system made the change.
export interface LastUpdated {
  at: string
  by: string | null
}

export interface Me {
  id: number
  username: string
  firstName: string
  lastName: string | null
  role: StaffRole
  roleLabel: string
  propertyId: string | null
  mustChangePassword: boolean
  permissions: Permissions
}

export interface StaffUser {
  id: number
  firstName: string
  lastName: string | null
  username: string | null
  email: string | null
  role: StaffRole
  propertyId: string | null
  propertyName: string | null
  isActive: boolean
  mustChangePassword: boolean | null
  lastSignInAt: string | null
  lastUpdated: LastUpdated
}

export interface Property {
  id: string
  name: string
  location: string | null
  propertyType: string | null
  webUrl: string | null
  isActive: boolean
  lastUpdated: LastUpdated
}

export interface Occasion {
  id: number
  name: string
  sortOrder: number
  isActive: boolean
  lastUpdated: LastUpdated
}

export interface Country {
  code: string
  name: string
  dialCode: string | null
}

export interface PropertyOption {
  id: string
  name: string
  location: string | null
}

export interface OccasionOption {
  id: number
  name: string
}

export interface Tag {
  id: number
  name: string
  isActive: boolean // false = retired: not in the picker, kept on guests
  guests: number // how many guests have it
  lastUpdated: LastUpdated
}

// ---------- campaigns ----------
// Marketing → Campaigns. Each has a public form at `link`; every form sent
// becomes a lead for the owner.
export interface Campaign {
  id: number
  name: string
  slug: string // the form's address; made from the name once, kept on rename, can be changed by hand
  link: string
  isActive: boolean // false = closed: the form says the campaign has ended
  owner: { id: number; name: string; isActive: boolean } // isActive false = they've left
  leads: number
  open: number
  booked: number
  createdAt: string
  lastUpdated: LastUpdated
}

export interface TagOption {
  id: number
  name: string
}

// ---------- guests (Module 2) ----------
export interface GuestListRow {
  id: number
  firstName: string | null
  lastName: string | null
  contactType: ContactType
  lifecycleStage: LifecycleStage
  market: Market
  countryCode: string | null
  country: string | null
  company: string | null
  email: string | null // primary
  phone: string | null // primary
  hotels: string | null // 'Mayur Lodge, Rock Villa'
  stayCount: number
  lastStay: string | null // 'YYYY-MM-DD'
}

export interface GuestList {
  rows: GuestListRow[]
  total: number
  page: number
  pageSize: number
}

export interface ContactMethod {
  id: number
  kind: ContactMethodKind
  value: string
  isPrimary: boolean
  isShared: boolean
  isWhatsapp: boolean | null // null = not yet known
  status: ContactMethodStatus
  lastUpdated: LastUpdated
}

export interface Guest {
  id: number
  firstName: string | null
  lastName: string | null
  contactType: ContactType
  lifecycleStage: LifecycleStage
  market: Market
  countryCode: string | null
  countryName: string | null
  dialCode: string | null
  companyId: number | null // the travel agent or company they work for
  companyName: string | null
  designation: string | null // job title
  vipReason: string | null
  status: 'active' | 'do_not_contact'
  emails: ContactMethod[] // primary first, then newest
  phones: ContactMethod[]
  summary: { hotels: string | null; stayCount: number; lastStay: string | null }
  tags: { id: number; name: string; isActive: boolean }[]
  merges: { id: number; merged: LastUpdated }[] // duplicates merged into this guest, newest first
  contactImport: { id: number; imported: LastUpdated } | null // the last contact import that changed them (Module 9)
  created: LastUpdated
  lastUpdated: LastUpdated
}

// Another guest who already has an email or phone being entered
export interface GuestMatch {
  id: number
  firstName: string | null
  lastName: string | null
}

// ---------- stays (Module 3) ----------
export interface CompanyOption {
  id: number
  name: string
  companyType: string
}

export interface StayListRow {
  id: number
  contactId: number
  firstName: string | null
  lastName: string | null
  propertyId: string
  hotel: string
  status: StayStatus
  arrivalDate: string | null // 'YYYY-MM-DD'
  departureDate: string | null
  nights: number | null
  roomType: string | null
  adults: number | null
  children: number | null
  channel: StayChannel
  agent: string | null
  occasion: string | null
  bookingReference: string | null
}

export interface StayList {
  rows: StayListRow[]
  total: number
  page: number
  pageSize: number
  today: string // in the hotels' timezone
}

export interface QuickCounts extends Record<QuickView, number> {
  today: string
}

export interface Stay {
  id: number
  guest: {
    id: number
    firstName: string | null
    lastName: string | null
    lifecycleStage: LifecycleStage
    email: string | null // primary
    phone: string | null
  }
  propertyId: string
  hotel: string
  status: StayStatus
  cancellationReason: string | null
  arrivalDate: string | null
  departureDate: string | null
  nights: number | null
  bookingReference: string | null
  roomType: string | null
  adults: number | null
  children: number | null
  roomRevenue: number | null
  currency: string | null
  channel: StayChannel
  bookingCompanyId: number | null
  agent: string | null
  occasionId: number | null
  occasion: string | null
  bookingRemarks: string | null // special requests from the booking system
  leadId: number | null // the lead this stay booked (Module 7)
  feedbackId: number | null // its feedback response (Module 8)
  created: LastUpdated
  lastUpdated: LastUpdated
}

export interface GuestStay {
  id: number
  propertyId: string
  hotel: string
  status: StayStatus
  cancellationReason: string | null
  arrivalDate: string | null
  departureDate: string | null
  nights: number | null
  roomType: string | null
  adults: number | null
  children: number | null
  occasion: string | null
  bookingReference: string | null
}

// The Stays panel on the profile: totals count checked-out stays only.
export interface GuestStays {
  totals: {
    stays: number
    nights: number
    hotels: string[]
    lastStay: string | null
    nextStay: { id: number; arrivalDate: string | null; hotel: string } | null
  }
  stays: GuestStay[] // newest first, cancelled included
}

// ---------- booking import ----------
export interface ImportFieldInfo {
  key: string
  label: string
  required: boolean
  hint: string | null
  headings: string[] // column titles matched automatically
}

export interface ImportSetup {
  fields: ImportFieldInfo[]
  mapping: Record<string, string> // CRM field → file column heading
}

export type ImportOutcome = 'new_guest' | 'existing_guest' | 'update' | 'error' | 'skipped'

export interface ImportRowResult {
  index: number
  outcome: ImportOutcome
  errors: string[]
  warnings: string[]
  // id null: a guest this import creates; rows with the same newKey create one guest together
  guest: { id: number | null; newKey: number | null; name: string } | null
  stayId: number | null
  summary: {
    reference: string | null
    hotel: string | null
    arrival: string | null
    departure: string | null
    guest: string
    email: string | null
    phone: string | null
    status: StayStatus | null
  }
}

export interface ImportPreview {
  rows: ImportRowResult[]
  counts: Record<ImportOutcome, number>
  newGuests: number
}

export interface ImportResult {
  id: number
  added: number
  updated: number
  skipped: number
  newGuests: { id: number; name: string }[]
  doNotContact: { id: number; name: string }[]
  leadsBooked: { id: number; name: string }[] // open leads the new bookings marked booked (id = lead)
  rows: ImportRowResult[]
}

export interface ImportHistoryRow {
  id: number
  fileName: string
  hotel: string | null
  rowsTotal: number
  added: number
  updated: number
  skipped: number
  newGuests: number
  importedAt: string
  importedBy: string | null
}

// ---------- guest knowledge (Module 4) ----------
// The stay a note or preference was linked to
export interface StayChip {
  id: number
  hotel: string
  arrivalDate: string | null
}

export interface Preference {
  id: number
  kind: PreferenceKind
  category: PreferenceCategory | null
  body: string
  stay: StayChip | null
  created: LastUpdated // who added it, and when
  lastUpdated: LastUpdated
}

export interface Note {
  id: number
  body: string
  contactId: number | null
  leadId: number | null // the lead it was written on (Module 7)
  stay: StayChip | null
  authorId: number | null // null for imported notes
  created: LastUpdated // author and time
  editedAt: string | null // set once the text is changed
}

export interface SpecialDate {
  id: number
  occasion: SpecialDateOccasion
  label: string | null // partner's or child's name, or what "other" is
  month: number
  day: number
  year: number | null
  nextDate: string // 'YYYY-MM-DD'
  daysAway: number
  soon: boolean // within 60 days
  years: number | null // age turning or years married, on the next date
  lastUpdated: LastUpdated
}

export interface UpcomingOccasion {
  id: number
  nextDate: string
  daysAway: number
  occasion: SpecialDateOccasion
  label: string | null
  year: number | null
  years: number | null
  guest: { id: number; firstName: string | null; lastName: string | null; lifecycleStage: LifecycleStage }
  emailConsent: ConsentStatus | null
  canEmail: boolean // on the marketing email list
  lastStayHotel: string | null
  nextStay: { id: number; arrivalDate: string | null; hotel: string } | null
}

export interface UpcomingOccasions {
  today: string
  rows: UpcomingOccasion[]
}

// ---------- consent and the marketing list (Module 5) ----------
export interface ConsentRecord {
  channel: ConsentChannel
  status: ConsentStatus
  source: ConsentSource | null
  evidence: string | null // the wording the guest agreed to
  givenAt: string | null
  lastUpdated: LastUpdated | null // null: no consent row yet (unknown)
  contactImport: { id: number; at: string; by: string | null } | null // set by Settings → Import contacts
}

export interface GuestConsent {
  channels: ConsentRecord[] // email, then WhatsApp
  doNotContact: { at: string; by: string | null } | null
  optInWhileDoNotContact: boolean // an opt-in arrived after do not contact was set
  emailList: { onList: boolean; reasons: NotOnListReason[] }
}

export interface EmailListRow {
  id: number
  firstName: string | null
  lastName: string | null
  email: string
  countryCode: string | null
  country: string | null
  lifecycleStage: LifecycleStage
  hotels: string | null
  lastStay: string | null // 'YYYY-MM-DD'
}

export interface EmailList {
  rows: EmailListRow[]
  total: number // matching the filters
  listTotal: number // everyone who can be emailed
  page: number
  pageSize: number
}

export interface EmailListExport {
  id: number
  exportedAt: string
  summary: string // the filters in words
  count: number
  rows: { firstName: string | null; lastName: string | null; email: string; country: string | null; lastHotel: string | null }[]
}

export interface ExportHistoryRow {
  id: number
  summary: string
  rowCount: number
  exported: LastUpdated // who and when
}

export type UploadKind = 'unsubscribes' | 'bounces'

export interface UploadPreview {
  kind: UploadKind
  total: number // distinct emails in the file
  invalid: string[]
  matched: { email: string; guests: { id: number; firstName: string | null; lastName: string | null; done: boolean }[] }[]
  unmatched: string[]
  changes: number // unsubscribes: guests to opt out; bounces: emails to mark bounced
  unchanged: number // already opted out, or already bounced
}

export interface UploadResult {
  kind: UploadKind
  updated: number
  unchanged: number
  unmatched: string[]
  invalid: string[]
}

// ---------- duplicates and merging (Module 6) ----------
export interface DuplicateSide {
  id: number
  firstName: string | null
  lastName: string | null
  email: string | null // primary
  phone: string | null
  lifecycleStage: LifecycleStage
  stayCount: number // checked out
  lastStay: string | null
}

export interface DuplicatePair {
  a: DuplicateSide // the lower id
  b: DuplicateSide
  reasons: DuplicateReason[]
}

export interface DuplicateList {
  rows: DuplicatePair[]
  total: number // matching the reason filter
  counts: Record<'all' | DuplicateReason, number>
  page: number
  pageSize: number
}

// One column of the merge screen
export interface MergeSide {
  guest: Guest
  consents: { channel: ConsentChannel; status: ConsentStatus }[]
  stays: {
    id: number
    hotel: string
    status: StayStatus
    arrivalDate: string | null
    departureDate: string | null
    bookingReference: string | null
    inBoth: boolean // the other guest has the same stay; the merge keeps it once
  }[]
  notes: { count: number; latest: { id: number; body: string; createdAt: string }[] }
  preferences: { id: number; kind: PreferenceKind; body: string }[]
  specialDates: { id: number; occasion: SpecialDateOccasion; label: string | null; month: number; day: number; year: number | null }[]
  leads: number
}

export interface MergeCompare {
  a: MergeSide
  b: MergeSide
  reasons: DuplicateReason[] // empty when the pair wasn't flagged (merging from a profile)
  notDuplicate: boolean // marked "Not a duplicate" before
  suggestedKeepId: number
}

export interface MergePreview {
  keepId: number
  removeId: number
  sentences: string[]
}

export interface MergeHistoryRow {
  id: number
  merged: LastUpdated // who and when
  keptId: number | null
  keptName: string | null
  removedId: number
  removedName: string | null
  note: string | null
}

export interface MergeHistory {
  rows: MergeHistoryRow[]
  total: number
  page: number
  pageSize: number
}

export interface MergeDetail {
  id: number
  merged: LastUpdated
  note: string | null
  kept: { id: number; name: string | null; deleted: boolean } | null
  removed: {
    id: number
    firstName: string | null
    lastName: string | null
    contactType: ContactType
    lifecycleStage: LifecycleStage
    market: Market
    country: string | null
    countryCode: string | null
    designation: string | null
    vipReason: string | null
    status: 'active' | 'do_not_contact'
    doNotContactAt: string | null
    createdAt: string
    emails: { id: number; value: string; isPrimary: boolean; isShared: boolean; status: ContactMethodStatus }[]
    phones: { id: number; value: string; isPrimary: boolean; isShared: boolean; status: ContactMethodStatus }[]
    consents: { channel: ConsentChannel; status: ConsentStatus; source: ConsentSource | null; givenAt: string | null }[]
    tags: string[]
    detailRecorded: boolean // false for merges made before stays and notes were copied
    stays: {
      id: number
      hotel: string
      arrivalDate: string | null
      departureDate: string | null
      status: StayStatus
      bookingReference: string | null
      keptOnce: boolean // the kept guest had the same stay, so this copy was dropped
    }[]
    notes: { id: number; body: string; createdAt: string }[]
    preferences: { id: number; kind: PreferenceKind; body: string }[]
    specialDates: { id: number; occasion: SpecialDateOccasion; label: string | null; month: number; day: number; year: number | null }[]
    leads: number
    interactions: number
  }
  moved: Record<'emails' | 'phones' | 'stays' | 'notes' | 'preferences' | 'specialDates' | 'leads' | 'interactions', number>
}

// ---------- Settings → Deleted items ----------
export type DeletedKind = 'guests' | 'stays' | 'companies'

export interface DeletedGuestRow {
  id: number
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  stays: number
  deleted: LastUpdated // who and when
}

export interface DeletedStayRow {
  id: number
  guest: { id: number; firstName: string | null; lastName: string | null; deleted: boolean }
  hotel: string
  arrivalDate: string | null
  departureDate: string | null
  bookingReference: string | null
  status: StayStatus
  deleted: LastUpdated
}

export interface DeletedCompanyRow {
  id: number
  name: string
  companyType: CompanyType
  deleted: LastUpdated
}

interface DeletedPage<K extends DeletedKind, R> {
  kind: K
  rows: R[]
  total: number
  page: number
  pageSize: number
  counts: Record<DeletedKind, number>
}

export type DeletedItems =
  | DeletedPage<'guests', DeletedGuestRow>
  | DeletedPage<'stays', DeletedStayRow>
  | DeletedPage<'companies', DeletedCompanyRow>

// ---------- sales: leads, conversations and companies (Module 7) ----------
export interface StaffOption {
  id: number
  firstName: string
  lastName: string | null
  isActive: boolean
}

export interface LinkedStay {
  id: number
  hotel: string
  arrivalDate: string | null
  status?: StayStatus // on lead cards: a booking cancelled after the lead booked shows struck through
}

// A lead on the board, the list, My follow-ups and the profile panel
export interface LeadCard {
  id: number
  status: LeadStatus
  source: LeadSource
  campaign: { id: number; name: string } | null // the campaign whose form they sent (source 'campaign')
  contactId: number
  firstName: string | null
  lastName: string | null
  propertyId: string | null
  hotel: string | null
  checkIn: string | null // 'YYYY-MM-DD'
  checkOut: string | null
  adults: number | null
  children: number | null
  occasion: string | null
  owner: { id: number; name: string } | null
  followUpOn: string | null // 'YYYY-MM-DD'
  quotedValue: number | null
  currency: string | null
  lostReason: LostReason | null
  stay: LinkedStay | null // booked with no stay = "stay to link"
  createdAt: string
  updatedAt: string
}

export interface Lead extends LeadCard {
  person: {
    id: number
    firstName: string | null
    lastName: string | null
    lifecycleStage: LifecycleStage
    email: string | null
    phone: string | null
  }
  occasionId: number | null
  created: LastUpdated
  lastUpdated: LastUpdated
  today: string
}

export interface LeadList {
  rows: LeadCard[]
  total: number
  page: number
  pageSize: number
  today: string
}

export interface LeadBoard {
  today: string
  closedDays: number // booked and lost show this many days back
  columns: Record<LeadStatus, LeadCard[]>
}

export interface LeadCards {
  today: string
  rows: LeadCard[]
}

export interface InteractionItem {
  type: 'interaction'
  id: number
  kind: InteractionKind
  direction: InteractionDirection | null
  at: string // when it happened
  summary: string | null
  staffId: number | null // who had the conversation
  staffName: string | null
  leadId: number | null
  feedbackId: number | null // following up a feedback response (Module 8)
  contactId: number | null
  person: string | null
  companyId: number | null
  company: string | null
  authorId: number | null // who logged it
  logged: LastUpdated
}

export interface NoteItem {
  type: 'note'
  id: number
  at: string
  body: string
  contactId: number | null
  leadId: number | null
  authorId: number | null
  created: LastUpdated
  editedAt: string | null
}

export interface StatusItem {
  type: 'status'
  id: number
  at: string
  from: LeadStatus | null // null: the lead was created
  to: LeadStatus
  lostReason: LostReason | null
  automatic: boolean // booked when the booking arrived
  stay: LinkedStay | null
  by: string | null
}

export type TimelineItem = InteractionItem | NoteItem | StatusItem

export interface CompanyRow {
  id: number
  name: string
  companyType: CompanyType
  countryCode: string | null
  country: string | null
  status: CompanyStatus
  accountOwner: { id: number; name: string } | null
  people: number
  staysLastYear: number // arrived in the last 12 months, or still to come
  lastContact: string | null
}

export interface Company extends CompanyRow {
  address: string | null
  website: string | null
  commissionNotes: string | null
  staysTotal: number
  created: LastUpdated
  lastUpdated: LastUpdated
}

export interface CompanyPerson {
  id: number
  firstName: string | null
  lastName: string | null
  contactType: ContactType
  lifecycleStage: LifecycleStage
  designation: string | null
  email: string | null
  phone: string | null
  stayCount: number
}

export interface CompanyStay {
  id: number
  contactId: number
  firstName: string | null
  lastName: string | null
  hotel: string
  status: StayStatus
  arrivalDate: string | null
  departureDate: string | null
  nights: number | null
  bookingReference: string | null
}

export interface CompanyStays {
  rows: CompanyStay[]
  total: number
  page: number
  pageSize: number
}

// ---------- Module 8: feedback and employees ----------
export interface FeedbackRow {
  id: number
  submittedAt: string
  stayId: number
  propertyId: string
  hotel: string
  arrivalDate: string | null
  departureDate: string | null
  contactId: number
  firstName: string | null
  lastName: string | null
  rating: number | null
  review: string | null
  needsFollowUp: boolean // 1 or 2 stars, not yet followed up
  followedUpAt: string | null
  mentions: number | null // employees mentioned; null for roles that don't see them
}

export interface FeedbackList {
  rows: FeedbackRow[]
  total: number
  counts: Record<FeedbackTab, number>
  page: number
  pageSize: number
}

export interface Mention {
  id: number
  sentiment: Sentiment
  comment: string | null
  nameAsWritten: string | null // what the guest wrote, e.g. "the waiter with glasses"
  employee: {
    id: number
    firstName: string
    lastName: string | null
    jobTitle: string | null
    department: Department
    isActive: boolean
    hotel: string | null
  } | null // null: not linked yet
}

export interface Feedback {
  id: number
  rating: number | null
  review: string | null
  submittedAt: string
  needsFollowUp: boolean
  followUp: { at: string; by: string | null; outcome: string } | null
  stay: {
    id: number
    propertyId: string
    hotel: string
    status: StayStatus
    arrivalDate: string | null
    departureDate: string | null
    nights: number | null
    bookingReference: string | null
  }
  guest: {
    id: number
    firstName: string | null
    lastName: string | null
    lifecycleStage: LifecycleStage
    email: string | null
    phone: string | null
  }
  mentions: Mention[] | null // null for roles that may not see them
  created: LastUpdated
  lastUpdated: LastUpdated
}

// The Feedback panels on the guest profile and the stay
export interface FeedbackPanelRow {
  id: number
  stayId: number
  hotel: string
  arrivalDate: string | null
  departureDate: string | null
  rating: number | null
  review: string | null
  submittedAt: string
  needsFollowUp: boolean
  followedUpAt: string | null
}

// Add response: the stays found by guest name or booking reference
export interface FeedbackStayOption {
  id: number
  propertyId: string
  hotel: string
  contactId: number
  firstName: string | null
  lastName: string | null
  arrivalDate: string | null
  departureDate: string | null
  bookingReference: string | null
  status: StayStatus
  feedbackId: number | null // the response it already has
}

export interface HotelRating {
  id: string
  name: string
  responses: number
  avgRating: number | null
  avgRating90Days: number | null
  responses90Days: number
  lowRatings: number
  needsFollowUp: number
  lastResponse: string | null
}

export interface HotelRatings {
  rows: HotelRating[]
  group: Omit<HotelRating, 'id' | 'name'>
}

export type UploadOutcome = 'new' | 'exists' | 'unmatched' | 'error'

export interface ResponseUploadRow {
  row: number
  outcome: UploadOutcome
  problem: string | null
  rating: number | null
  review: string | null
  submittedAt: string | null
  stay: {
    id: number
    contactId: number
    firstName: string | null
    lastName: string | null
    hotel: string
    arrivalDate: string | null
    departureDate: string | null
    bookingReference: string | null
    feedbackId: number | null
  } | null
  raw: Record<string, string>
}

export interface ResponseUpload {
  total: number
  counts: Record<UploadOutcome, number>
  rows: ResponseUploadRow[]
}

export interface EmployeeRow {
  id: number
  firstName: string
  lastName: string | null
  propertyId: string | null // null: works across the group
  hotel: string | null
  department: Department
  jobTitle: string | null
  isActive: boolean
  staffUser: { id: number; name: string } | null // their CRM login
  positive90Days: number
  negative90Days: number
  lastMentioned: string | null
}

export interface Employee extends Omit<EmployeeRow, 'positive90Days' | 'negative90Days' | 'lastMentioned'> {
  counts: {
    positive: number
    negative: number
    positive90Days: number
    negative90Days: number
    lastMentioned: string | null
  }
  created: LastUpdated
  lastUpdated: LastUpdated
}

export interface EmployeeOption {
  id: number
  firstName: string
  lastName: string | null
  jobTitle: string | null
  department: Department
  propertyId: string | null
  hotel: string | null
}

export interface EmployeeMention {
  id: number
  feedbackId: number
  submittedAt: string
  sentiment: Sentiment
  comment: string | null
  nameAsWritten: string | null
  stayRating: number | null
  stayId: number
  hotel: string
  arrivalDate: string | null
  departureDate: string | null
  guest: { id: number; firstName: string | null; lastName: string | null }
}

export interface LoginOption {
  id: number
  firstName: string
  lastName: string | null
  role: StaffRole
  employeeId: number | null // the employee it is linked to already
}

export interface StaffListPlan {
  total: number
  counts: { new: number; exists: number; error: number }
  rows: {
    row: number
    outcome: 'new' | 'exists' | 'error'
    problem: string | null
    note: string | null
    firstName: string | null
    lastName: string | null
    department: Department
    jobTitle: string | null
  }[]
}

// ---------- contact import (Module 9) ----------
export interface ContactImportSetup {
  fields: ImportFieldInfo[]
  mapping: Record<string, string> // CRM field → file column heading
  allowed: { countries: { code: string; name: string }[]; hotels: { id: string; name: string }[]; tags: string[] }
}

// One line of the side-by-side comparison; values as stored (type key, country code, consent status)
export interface ContactComparison {
  field: ChangeField
  crm: string | null
  file: string | null
  changes: boolean // Update would change it
}

export interface ContactMatch {
  contactId: number
  name: string
  by: ('email' | 'phone')[]
  doNotContact: boolean
  comparison: ContactComparison[]
}

export interface ContactImportRow {
  index: number // position in the file's rows, from 0
  group: ContactRowGroup
  outcome: ContactRowOutcome
  errors: string[]
  warnings: string[]
  summary: { name: string; email: string | null; phone: string | null }
  matches: ContactMatch[] // rows already in the CRM: the email match first
  decision: ContactDecision | null
  contactId: number | null
}

export interface ContactImportSummary {
  rows: number
  groups: Record<ContactRowGroup, number>
  outcomes: Record<ContactRowOutcome, number>
  changedContacts: number
  primaryChanges: number
  optedBackIn: Record<ConsentChannel, number>
  optedOut: Record<ConsentChannel, number>
  doNotContactOptIns: number
  newCompanies: string[]
}

export interface ContactImportPreview {
  rows: ContactImportRow[]
  summary: ContactImportSummary
}

export interface ContactRowChoice {
  index: number
  decision: ContactDecision
  contactId?: number
}

export interface ContactImportDetails {
  newContacts: { id: number; name: string; row: number }[]
  newCompanies: { id: number; name: string }[]
  doNotContact: { id: number; name: string }[]
}

export interface ContactImportResultRow {
  row: number // from 1
  outcome: ContactRowOutcome
  contactId: number | null
  reason: string | null
}

export interface ContactImportResult extends ContactImportDetails {
  id: number
  counts: Record<ContactRowOutcome, number>
  rows: ContactImportResultRow[]
}

export interface ContactImportHistoryRow {
  id: number
  fileName: string
  rowsTotal: number
  created: number
  updated: number
  addedAgain: number
  ignored: number
  errors: number
  imported: LastUpdated
}

export interface ContactImportDetail extends ContactImportHistoryRow {
  mapping: Record<string, string>
  details: ContactImportDetails
}

export interface ContactImportChange {
  id: number
  row: number
  contactId: number
  contactName: string | null // null: merged away since
  contactDeleted: boolean
  field: ChangeField
  oldValue: string | null
  newValue: string | null
}

export interface ContactImportResults {
  fileName: string
  mapping: Record<string, string>
  results: (ContactImportResultRow & { values: Record<string, string> })[]
}
