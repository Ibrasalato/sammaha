export type NameType = 'qaadan' | 'bakkar'
export type Role = 'owner' | 'committee' | 'admin'

export interface User {
  id: string
  fullName: string
  phone: string
  email: string
  nationalId?: string
  role: Role
  createdAt: string
  /** profile photo (uploaded by the owner) */
  avatarUrl?: string
  /** owner agreed to show the photo publicly (leaderboards) */
  showAvatar?: boolean
  /** false = account suspended by the super admin */
  active?: boolean
}

export interface StaffInput {
  fullName: string
  phone: string
  email: string
  password: string
  role: 'committee' | 'admin'
}

export type RequestStatus =
  | 'pending_payment' // created, deposit not paid yet
  | 'under_review' // deposit paid, waiting for the approval committee
  | 'accepted' // at least one name accepted
  | 'rejected' // committee rejected the whole request → deposit refunded
  | 'cancelled' // cancelled (by owner before payment or by committee) → deposit refunded if paid

export type CandidateStatus = 'pending' | 'accepted' | 'rejected'

export interface Candidate {
  id: string
  name: string
  normalized: string
  status: CandidateStatus
  /** existing names found similar at check time (for the committee) */
  similar: SimilarHit[]
  rejectReason?: string
  auctionId?: string
}

export interface SimilarHit {
  name: string
  type: NameType
  source: 'reserved' | 'request' | 'auction'
  score: number // 0..1, 1 = identical after normalisation
}

export interface LogoRequest {
  id: string
  number: string
  userId: string
  ownerName: string
  type: NameType
  candidates: Candidate[]
  status: RequestStatus
  depositAmount: number
  depositPaid: boolean
  depositState: 'none' | 'held' | 'applied' | 'refunded'
  createdAt: string
  submittedAt?: string
  reviewedAt?: string
  reviewerName?: string
  reviewNote?: string
}

export type AuctionPhase = 'scheduled' | 'live' | 'ended'

export interface Auction {
  id: string
  requestId: string
  candidateId: string
  name: string
  type: NameType
  requesterId: string
  openingPrice: number
  minIncrement: number
  startsAt: string
  endsAt: string
  currentPrice: number
  bidCount: number
  leaderId?: string
  leaderLabel?: string
  settled: boolean
  winnerId?: string
  winnerName?: string
  finalPrice?: number
  wonByRequester?: boolean
}

export interface Bid {
  id: string
  auctionId: string
  userId: string
  bidderLabel: string
  amount: number
  createdAt: string
}

export interface ReservedName {
  id: string
  name: string
  normalized: string
  type: NameType
  ownerId?: string
  ownerName: string
  price: number
  acquiredAt: string
  source: 'auction' | 'legacy'
  /** owner's public photo, only when they chose to show it */
  ownerAvatar?: string
}

export type TxKind = 'topup' | 'deposit' | 'refund' | 'invoice_payment'

export interface WalletTx {
  id: string
  userId: string
  amount: number // + credit, - debit
  kind: TxKind
  note: string
  createdAt: string
}

export interface Invoice {
  id: string
  number: string
  userId: string
  buyerName: string
  buyerPhone: string
  auctionId: string
  name: string
  type: NameType
  total: number // VAT inclusive hammer price
  vat: number
  subtotal: number
  depositApplied: number
  amountDue: number
  status: 'paid' | 'unpaid'
  issuedAt: string
  paidAt?: string
}

export interface NameCheck {
  name: string
  normalized: string
  verdict: 'available' | 'exact' | 'similar' | 'invalid' | 'duplicate'
  message: string
  hits: SimilarHit[]
}

export interface Wallet {
  balance: number
  txs: WalletTx[]
}

export interface PublicStats {
  live: number
  upcoming: number
  reserved: number
  owners: number
}

export interface AdminOverview {
  underReview: number
  awaitingSchedule: number
  live: number
  scheduled: number
  unpaidInvoices: number
  revenue: number
  openTickets: number
}

export interface AuctionFilter {
  phase?: AuctionPhase | 'all'
  type?: NameType | 'all'
  q?: string
}

export interface ReviewDecision {
  candidateId: string
  status: 'accepted' | 'rejected'
  reason?: string
}

export type EventKind = 'mazayin' | 'race' | 'conference' | 'world_day' | 'heritage'

export interface CamelEvent {
  id: string
  title: string
  titleEn: string
  kind: EventKind
  startsOn: string // YYYY-MM-DD
  endsOn: string // YYYY-MM-DD
  approx: boolean // expected date, not yet officially announced
  city: string
  country: string
  description: string
  url?: string
  cityEn?: string
  countryEn?: string
  descriptionEn?: string
}

export interface AppNotification {
  id: string
  userId: string
  kind: 'outbid' | 'won' | 'lost' | 'reviewed' | 'auction_opened' | 'refund' | 'ticket'
  title: string
  body: string
  link?: string
  createdAt: string
  read: boolean
}

// ───────────── contact tickets (complaints, reports, enquiries) ─────────────
export type TicketKind = 'complaint' | 'report' | 'inquiry' | 'suggestion'
export type TicketStatus = 'new' | 'in_progress' | 'answered' | 'closed'
export type TicketPriority = 'normal' | 'urgent'

export interface TicketMessage {
  id: string
  by: 'customer' | 'staff'
  author: string
  body: string
  internal?: boolean // staff-only note, never shown to the customer
  createdAt: string
}

export interface TicketInput {
  kind: TicketKind
  topic: string
  subject: string
  name: string
  phone: string
  email?: string
  refNumber?: string // request, auction, invoice or certificate number
  message: string
}

export interface Ticket extends TicketInput {
  id: string
  number: string // BL-YYNNNN
  userId?: string
  status: TicketStatus
  priority: TicketPriority
  assignee?: string
  messages: TicketMessage[]
  createdAt: string
  updatedAt: string
}
