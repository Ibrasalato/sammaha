/** فردي (مفاريد): قعدان وبكار؛ ومنقية */
export type NameType = 'qaadan' | 'bakkar' | 'manqiya'
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
  /** staff: the permission keys this account holds, and its staff role */
  permissions?: string[]
  staffRoleId?: string
  staffRoleName?: string
  /** owners: personal details, address and how complete the profile is */
  profile?: OwnerProfile
}

export interface OwnerProfile {
  firstName?: string
  fatherName?: string
  grandfatherName?: string
  familyName?: string
  birthDate?: string
  gender?: 'male' | 'female'
  nationality?: string
  residenceCountry?: string
  residenceCity?: string
  altPhone?: string
  addressCountry?: string
  addressCity?: string
  district?: string
  postalCode?: string
  street?: string
  emailVerified: boolean
  /** 0–100 */
  completion: number
  missing: ('personal' | 'email' | 'address')[]
}

export interface AddressInput {
  addressCountry: string
  addressCity: string
  district: string
  postalCode: string
  street?: string
  altPhone?: string
  altPhoneCountry?: string
}

export interface PersonalInput {
  firstName: string
  fatherName: string
  grandfatherName: string
  familyName: string
  birthDate: string
  gender: 'male' | 'female' | ''
  nationality: string
  residenceCountry: string
  residenceCity: string
  nationalId?: string
}

export interface StaffRole {
  id: string
  name: string
  description?: string
  permissions: string[]
  isSystem: boolean
  members: number
}

export interface TicketRouting {
  restrictToHandlers: boolean
  handlers: Record<TicketKind, string[]>
  emails: Record<TicketKind, string>
  staff: { id: string; fullName: string; role: Role; staffRoleName?: string; canReply: boolean; active: boolean }[]
}

/** which auctions an action applies to */
export interface AuctionScope { ids?: string[]; all?: boolean; type?: NameType }
export interface AuctionActionResult { affected: number; skipped: { id: string; name: string; reason: string }[] }

export type MatchRelation = 'exact' | 'article' | 'gender' | 'plural' | 'singular' | 'similar'
export interface AuditMatch { name: string; type: NameType; source: SimilarHit['source']; score: number; relation: MatchRelation; price?: number; priceKind?: 'sold' | 'current'; at?: string }
export interface AuditRow {
  requestId: string; number: string; kind: string; type: NameType; ownerName: string; requestStatus: RequestStatus; submittedAt?: string
  candidateId: string; name: string; status: CandidateStatus; rejectReason?: string; verdict: 'exact' | 'similar' | 'clear'; matches: AuditMatch[]; topPrice?: AuditMatch
}

export interface OwnedName { id: string; name: string; type: NameType; price: number; acquiredAt: string; source: string; certCode: string }
export interface OwnerCrm {
  id: string; nationalId?: string; fullName: string; nationality?: string; residenceCountry?: string; residenceCity?: string
  phone: string; altPhone?: string; email: string; emailVerified: boolean; active: boolean; createdAt: string; lastLoginAt?: string
  completion: number; names: OwnedName[]; totalValue: number; requests: number; openRequests: number; masked: boolean
}

export interface MarkRow {
  auctionId: string; number: string; name: string; type: NameType; kind: 'request' | 'investment' | 'resale'; requestNumber?: string; listingNumber?: string
  ownerName: string; status: 'scheduled' | 'live' | 'paused' | 'settling' | 'sold' | 'cancelled'; startsAt: string; endsAt: string; openingPrice: number
  price: number; bidCount: number; bidders: number; winnerName?: string; wonByRequester?: boolean; invoiceNumber?: string; invoiceStatus?: 'paid' | 'unpaid'
  vat?: number; certCode?: string; extensions: number
}

export interface IbanCheck { valid: boolean; iban: string; country?: string; bankCode?: string; bankName?: string; message: string }
export type BankStatus = 'pending' | 'verified' | 'rejected'
export interface BankAccount {
  iban: string; ibanMasked: string; bankName: string; accountName: string; docName: string; docType: string; status: BankStatus
  rejectReason?: string; updatedAt: string; reviewedAt?: string; reviewedBy?: string
}
export interface BankAccountInput { iban: string; accountName: string; bankName?: string; docName?: string; docType?: string; docBase64?: string }
export interface StaffBankAccount { userId: string; ownerName: string; phone?: string; account: BankAccount }
export interface DocumentFile { name: string; contentType: string; base64: string }
export type WithdrawalStatus = 'pending' | 'completed' | 'rejected'
export interface Withdrawal {
  id: string; number: string; userId: string; ownerName: string; amount: number; iban: string; bankName: string; accountName: string
  status: WithdrawalStatus; byStaff: boolean; createdAt: string; processedAt?: string; processedBy?: string; transferRef?: string; note?: string
}
export interface WalletRow {
  userId: string; ownerName: string; phone?: string; balance: number; totalIn: number; totalOut: number; pendingWithdrawals: number
  txCount: number; lastTxAt?: string; bankStatus?: BankStatus; bankName?: string
}
export interface WalletDetail { wallet: WalletRow; txs: WalletTx[]; withdrawals: Withdrawal[]; bank?: BankAccount }
export interface DepositRow {
  kind: 'request' | 'bid'; requestId?: string; auctionId?: string; userId: string; ownerName: string; reference: string; auctionNumber?: string
  names: string; type: NameType; amount: number; state: 'held' | 'applied' | 'refunded' | 'fee'; context: string; at: string
}

export interface StaffInput {
  fullName: string
  phone: string
  email: string
  password: string
  role: 'committee' | 'admin'
  /** committee members: the staff role that sets their permissions */
  staffRoleId?: string
}

export type RequestStatus =
  | 'pending_payment' // created, deposit not paid yet
  | 'under_review' // deposit paid, waiting for the approval committee
  | 'accepted' // at least one name accepted
  | 'rejected' // committee rejected the whole request → deposit refunded
  | 'cancelled' // cancelled (by owner before payment or by committee) → deposit refunded if paid

export type CandidateStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'

export interface Candidate {
  id: string
  name: string
  normalized: string
  status: CandidateStatus
  /** existing names found similar at check time (for the committee) */
  similar: SimilarHit[]
  rejectReason?: string
  auctionId?: string
  /** the owner withdrew this name from the request */
  withdrawnAt?: string
  /** the owner can still withdraw this name (no auction of it has started) */
  withdrawable?: boolean
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
  /** 'fee' = the non-refundable study fee of a name-investment request */
  depositState: 'none' | 'held' | 'applied' | 'refunded' | 'fee'
  createdAt: string
  submittedAt?: string
  reviewedAt?: string
  reviewerName?: string
  reviewNote?: string
  /** the owner can still cancel (and get the guarantee back): before review, or accepted with no auction started */
  cancellable?: boolean
  cancelledAt?: string
  cancelledBy?: 'owner' | 'committee'
  cancelReason?: string
  /** 'compound' = a compound name for a name the owner already holds; registered on approval, no auction.
   *  'investment' = «استثمار الاسم»: one new name, non-refundable study fee, public auction, 30% of the proceeds to its owner */
  kind?: 'standard' | 'compound' | 'investment'
  baseName?: string
  baseReservedId?: string
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
  /** times the end was pushed back by a last-minute bid */
  extensions?: number
  /** offered through «استثمار الاسم»: its proposer cannot bid on it */
  investment?: boolean
  /** an owner reselling a name they own («بيع اسم»): the listing it belongs to */
  listingId?: string
  /** resale auctions: every bidder pays this participation guarantee first */
  bidDeposit?: number
  /** paused by the administration: no bids; resuming adds the paused time back */
  paused?: boolean
  pausedAt?: string
  pauseReason?: string
  /** cancelled by the administration: closed with no sale */
  cancelled?: boolean
  cancelReason?: string
  /** serial auction number, AU-1001 onwards */
  number?: string
}

export interface Bid {
  id: string
  auctionId: string
  userId: string
  bidderLabel: string
  amount: number
  createdAt: string
  /** placed by the bidder's automatic bidding */
  auto?: boolean
}

/** What the signed-in user has set on one auction */
export interface AuctionMine {
  watching: boolean
  /** active automatic-bidding ceiling, if any */
  autoMax?: number
  /** resale auctions: the participation guarantee is paid */
  depositPaid?: boolean
}

export interface AuctionView {
  auction: Auction
  bids: Bid[]
  mine?: AuctionMine
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
  source: 'auction' | 'legacy' | 'compound' | 'investment' | 'resale'
  /** for a compound name: the owned name it was built on */
  baseName?: string
  /** owner's public photo, only when they chose to show it */
  ownerAvatar?: string
  /** an active sale listing of this name, if its owner is selling it */
  listingId?: string
}

export type TxKind = 'topup' | 'deposit' | 'refund' | 'invoice_payment' | 'service_fee' | 'investment_payout' | 'bid_deposit' | 'sale_payout' | 'purchase' | 'withdrawal' | 'adjustment'

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
  /** name investment: the proposer's share of the proceeds, paid to their wallet once this invoice is paid */
  ownerShare?: number
  ownerShareTo?: string
  ownerSharePaid?: boolean
  /** set when the invoice is for a name sold by its owner («بيع اسم») */
  listingId?: string
}

/** «بيع اسم»: an owner selling a name they own, in a resale auction or at a fixed price */
export type ListingMode = 'auction' | 'instant'
export type ListingStatus = 'scheduled' | 'live' | 'sold' | 'unsold' | 'expired' | 'cancelled'
export interface NameListing {
  id: string
  number: string
  reservedId: string
  name: string
  type: NameType
  sellerId: string
  mode: ListingMode
  /** auction: the minimum (opening) price; instant: the fixed sale price (SAR, VAT inclusive) */
  price: number
  /** the platform's commission on the final value (0.10 auction, 0.15 instant) */
  commissionRate: number
  status: ListingStatus
  createdAt: string
  /** auction: when bidding opens (72 hours after listing); instant: when it went on sale */
  startsAt: string
  endsAt: string
  auctionId?: string
  /** the sale value (hammer price or fixed price) */
  soldPrice?: number
  soldAt?: string
  /** what the seller receives after commission, and whether it reached their wallet */
  payout?: number
  payoutPaid?: boolean
  /** the auction's current price, for display */
  currentPrice?: number
  bidCount?: number
}

/** One «استثمار الاسم» request as its owner sees it */
/** One name offered in «استثمار الاسم» (a request holds up to three). */
export interface InvestmentItem {
  request: LogoRequest
  candidate: Candidate
  auction?: Auction
  /** 30% of the sale before VAT, once the auction sold to a bidder */
  share?: number
  sharePaid?: boolean
  /** the name went back to its owner because nobody bid */
  keptByOwner?: boolean
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
  kind: 'outbid' | 'won' | 'lost' | 'reviewed' | 'auction_opened' | 'auction_update' | 'refund' | 'ticket' | 'reminder'
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
  /** staff view: the staff member it is assigned to */
  assigneeId?: string
}

// ───────────── platform settings (super admin) and personal settings ─────────────
/** What every visitor sees: open services, banner, contact details, password rule. */
export interface PublicSettings {
  requestsOpen: boolean
  requestsClosedNote?: string
  compoundOpen: boolean
  compoundClosedNote?: string
  resaleAuctionOpen: boolean
  instantSaleOpen: boolean
  saleClosedNote?: string
  investmentOpen: boolean
  investmentClosedNote?: string
  signupOpen: boolean
  supportEmail: string
  supportPhone: string
  whatsApp: string
  /** shown only while the banner is on */
  announcement?: string
  announcementTone: 'info' | 'warn' | 'ok'
  maintenance: boolean
  maintenanceNote?: string
  passwordMinLength: number
  staffIdleMinutes: number
}

/** fees and rules from the server configuration (read-only in the dashboard) */
export interface PlatformRules {
  depositAmount: number
  namesPerRequest: number
  openingPrice: number
  minIncrement: number
  extendMinutes: number
  vatRate: number
  investFee: number
  investOwnerShare: number
  investMaxNames: number
  resaleNoticeHours: number
  resaleAuctionDays: number
  resaleCommission: number
  resaleBidDeposit: number
  instantSaleHours: number
  instantCommission: number
}

export interface AdminSettings extends Omit<PublicSettings, 'announcement'> {
  announcementOn: boolean
  announcement?: string
  maxLoginAttempts: number
  lockoutMinutes: number
  updatedAt?: string
  updatedBy?: string
  rules: PlatformRules
}

export type SettingsPatch = Partial<Omit<AdminSettings, 'rules' | 'updatedAt' | 'updatedBy'>>

export interface SettingsChange {
  id: number
  at: string
  userName: string
  field: string
  oldValue?: string
  newValue?: string
}

/** SMS / WhatsApp copies per category (in-app notices always arrive) */
export interface Preferences {
  notifyOutbid: boolean
  notifyReminders: boolean
  notifyResults: boolean
  notifyRequests: boolean
}

export interface SessionInfo {
  id: string
  signedInAt: string
  lastActiveAt: string
  expiresAt: string
  ip?: string
  device?: string
  current: boolean
}

export interface SecuritySummary {
  lastLoginAt?: string
  activeSessions: number
  passwordMinLength: number
}
