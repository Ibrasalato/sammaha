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
  /** a delegated session: who is acting on this owner's account and what they may do */
  acting?: Acting
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
  ownerId: string
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
  price: number; bidCount: number; bidders: number; winnerName?: string; wonByRequester?: boolean; invoiceNumber?: string; invoiceStatus?: 'paid' | 'unpaid' | 'cancelled'
  vat?: number; certCode?: string; extensions: number; ownerId: string; winnerId?: string
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
export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'rejected'
export interface Withdrawal {
  id: string; number: string; userId: string; ownerName: string; amount: number; iban: string; bankName: string; accountName: string
  status: WithdrawalStatus; byStaff: boolean; createdAt: string; processedAt?: string; processedBy?: string; transferRef?: string; note?: string
  /** direct transfer through the payout gateway */
  payoutProvider?: string; payoutSentAt?: string; payoutError?: string
}
export interface PayoutStatus { enabled: boolean; provider: string }
export interface WalletRow {
  userId: string; ownerName: string; phone?: string; balance: number; totalIn: number; totalOut: number; pendingWithdrawals: number
  txCount: number; lastTxAt?: string; bankStatus?: BankStatus; bankName?: string
}
export interface WalletDetail { wallet: WalletRow; txs: WalletTx[]; withdrawals: Withdrawal[]; bank?: BankAccount }
export interface DepositRow {
  kind: 'request' | 'bid'; requestId?: string; auctionId?: string; userId: string; ownerName: string; reference: string; auctionNumber?: string
  names: string; type: NameType; amount: number; state: 'held' | 'applied' | 'refunded' | 'fee' | 'forfeited'; context: string; at: string
}

export type DelegationScope = 'requests' | 'invest' | 'bids' | 'payments' | 'sales' | 'tickets'
export type DelegationCapacity = 'agent' | 'family' | 'employee' | 'partner' | 'other'
export type DelegationStatus = 'active' | 'scheduled' | 'expired' | 'revoked' | 'awaiting_account'
export interface Acting { delegationId: string; actorId: string; actorName: string; capacity: DelegationCapacity; scopes: DelegationScope[]; endsAt?: string }
export interface Delegation {
  id: string; ownerId: string; ownerName: string; fullName: string; nationalId: string; phone: string; email: string; capacity: DelegationCapacity; capacityLabel: string
  capacityNote?: string; scopes: DelegationScope[]; permanent: boolean; startsAt: string; endsAt?: string; status: DelegationStatus; createdAt: string; lastUsedAt?: string; linked: boolean
}
export interface DelegationInput {
  fullName: string; nationalId: string; phoneCountry: string; phone: string; email: string; capacity: DelegationCapacity | ''; capacityNote?: string
  scopes: DelegationScope[]; permanent: boolean; startsAt?: string; endsAt?: string
}
export interface ActivityEntry {
  id: number; at: string; actorId?: string; actorName: string; actorRole: string; onBehalfOfId?: string; onBehalfOfName?: string
  action: string; category: string; categoryLabel: string; details?: string; success: boolean; error?: string; ip?: string; device?: string
}
export interface ActivityPage { items: ActivityEntry[]; total: number; categories: { key: string; value: string }[] }
export interface ActivityFilter { from?: string; to?: string; category?: string; role?: string; who?: 'me' | 'delegates' | 'as_delegate'; q?: string; failed?: boolean; page?: number; size?: number }

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
  depositState: 'none' | 'held' | 'applied' | 'refunded' | 'fee' | 'forfeited'
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
  /** a re-auction of a name the International Camel Organization owns */
  icoReservedId?: string
  /** the name in Latin letters */
  latin?: string
  id: string
  requestId: string
  candidateId: string
  name: string
  type: NameType
  /** staff views only; public responses carry isRequester instead */
  requesterId?: string
  openingPrice: number
  minIncrement: number
  startsAt: string
  endsAt: string
  currentPrice: number
  bidCount: number
  /** staff views only (user ids are never sent publicly) */
  leaderId?: string
  leaderLabel?: string
  settled: boolean
  /** staff views only */
  winnerId?: string
  /** staff: the full name; public: masked like leaderLabel */
  winnerName?: string
  /** relative to the signed-in caller: they hold the top bid / won / requested this name */
  isLeader?: boolean
  isWinner?: boolean
  isRequester?: boolean
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
  /** staff views only */
  userId?: string
  /** the signed-in caller placed this bid */
  mine?: boolean
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
  /** the caller's own names only; the public registry omits it */
  ownerId?: string
  ownerName: string
  price: number
  acquiredAt: string
  source: 'auction' | 'legacy' | 'compound' | 'investment' | 'resale' | 'exception' | 'transfer'
  /** for a compound name: the owned name it was built on */
  baseName?: string
  /** owner's public photo, only when they chose to show it (public registry: on the owner's first row only) */
  ownerAvatar?: string
  /** an active sale listing of this name, if its owner is selling it */
  listingId?: string
  /** the registry's Latin spelling (staff override or transliteration) */
  latin?: string
  latinOverride?: boolean
  /** demo store only: staff's Latin spelling */
  latinName?: string
  /** «اسم مستثنى»: the winner did not pay in time and the name passed to the organization */
  forfeitedFromId?: string
  forfeitedFromName?: string
  forfeitedAt?: string
  forfeitedPrice?: number
  forfeitedDeposit?: number
  auctionId?: string
  /** approved logo: API path (live) or data URL (demo) */
  logo?: string
  /** the caller's own names only: the camel carrying this name («ربط بشريحة») and its first chip number */
  camelId?: string
  camelChip?: string
  /** the owner's own view: status of the logo they uploaded */
  logoStatus?: LogoStatus
}

export type LogoStatus = 'pending' | 'approved' | 'rejected'
/** a logo waiting for (or after) the committee's review */
export interface LogoRow {
  id: string; reservedId: string; name: string; type: NameType; ownerId: string; ownerName: string; fileName: string; status: LogoStatus
  rejectReason?: string; uploadedAt: string; reviewedAt?: string; reviewedBy?: string
}

export type TransferStatus = 'pending_payment' | 'awaiting_recipient' | 'under_review' | 'completed' | 'rejected' | 'declined' | 'cancelled'
export type TransferReason = 'sale' | 'gift' | 'inheritance' | 'other'
/** «نقل ملكية اسم»: owner → recipient accepts → committee approves */
export interface NameTransfer {
  id: string; number: string; reservedId: string; name: string; type: NameType; fromId: string; fromName: string; toId: string; toName: string
  reason: TransferReason; note?: string; fee: number; status: TransferStatus; createdAt: string; respondedAt?: string; reviewedAt?: string
  reviewerName?: string; reviewNote?: string; completedAt?: string; cancelledAt?: string; fromPhone?: string; toPhone?: string
  /** demo store only */
  feePaidAt?: string
}
export interface MyTransfers { outgoing: NameTransfer[]; incoming: NameTransfer[]; fee: number }

export interface IcoName {
  id: string; name: string; latin: string; type: NameType; forfeitedFromName?: string; forfeitedFromId?: string; forfeitedAt?: string
  forfeitedPrice?: number; forfeitedDeposit?: number; certCode: string; auction?: Auction
}

export type CertificateScope = 'mark' | 'portfolio'
/** valid | partial (some marks changed hands) | superseded (none still held) | revoked */
export type CertificateStatus = 'valid' | 'partial' | 'superseded' | 'revoked'
export interface CertificateItem { id: string; name: string; latin: string; type: NameType; typeLabel: string; acquiredAt: string; registryCode: string; source: string; baseName?: string; current: 'valid' | 'transferred' | 'removed' }
export interface Certificate {
  id: string; number: string; scope: CertificateScope; ownerId: string; ownerNameAr: string; ownerNameEn: string; nationalIdMasked?: string; nationality?: string
  issuedAt: string; signature: string; status: CertificateStatus; revokedAt?: string; revokeReason?: string; items: CertificateItem[]; itemCount: number
}
export interface CertificateVerify {
  number: string; scope: CertificateScope; ownerNameAr: string; ownerNameEn: string; nationality?: string; issuedAt: string; status: CertificateStatus
  signatureMatches?: boolean; revokedAt?: string; revokeReason?: string; items: CertificateItem[]
}
export interface CertificatePage { items: Certificate[]; total: number }

export type TxKind = 'topup' | 'deposit' | 'refund' | 'invoice_payment' | 'service_fee' | 'investment_payout' | 'bid_deposit' | 'sale_payout' | 'purchase' | 'withdrawal' | 'adjustment' | 'fine'

export interface WalletTx {
  id: string
  userId: string
  amount: number // + credit, - debit
  kind: TxKind
  note: string
  createdAt: string
}

export interface Invoice {
  /** the payment request number (PR-…) before payment; `number` becomes the tax invoice number (INV-…) once paid */
  requestNumber?: string
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
  status: 'paid' | 'unpaid' | 'cancelled'
  /** an auction win must be paid by then; after it the win is cancelled and the guarantee forfeited */
  dueAt?: string
  cancelledAt?: string
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
  /** auction: the minimum (opening) price; instant: the fixed sale price (⃁, VAT inclusive) */
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
  kind: 'outbid' | 'won' | 'lost' | 'reviewed' | 'auction_opened' | 'auction_update' | 'refund' | 'ticket' | 'reminder' | 'delegation' | 'certificate' | 'legacy' | 'transfer' | 'violation' | 'exemption' | 'ban'
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
  /** the guarantee for a mark request and for entering an auction */
  depositAmount: number
  /** hours an auction winner has to pay */
  paymentDeadlineHours: number
  /** fee for moving a name to another owner (VAT included), paid by card */
  transferFee: number
  transferOpen: boolean
  transferClosedNote?: string
  /** e-services shown as «قريبًا» (not accepting yet) */
  comingSoon: ServiceKey[]
  /** service prices set by the admin */
  investFee: number
  compoundFee: number
  resaleCommission: number
  instantCommission: number
  /** «إعدادات المزادات» in force: opening prices (فردي and منقية), the minimum raise and the default auction length */
  openingPrice: number
  manqiyaOpeningPrice: number
  minIncrement: number
  auctionDays: number
  /** the admin's description of each e-service (empty = the built-in text) */
  /** the payment channels on offer (mada, card, applepay) and who processes them */
  paymentChannels?: ('mada' | 'card' | 'applepay')[]
  paymentProvider?: string
  serviceTexts?: Partial<Record<ServiceKey, { ar?: string; en?: string; termsAr?: string; termsEn?: string }>>
}

export type ServiceKey = 'requests' | 'compound' | 'resale' | 'instant' | 'investment' | 'transfer'

/** the fees and rules in force (the admin's values where set, otherwise the server configuration) */
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
  manqiyaOpeningPrice: number
  auctionDays: number
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

/** «إبلي»: a camel registered to the owner on the camel registry platform */
export interface OwnedCamel {
  id: string
  /** the camel's id on the registry platform */
  externalId?: string
  name?: string
  /** up to 4 microchip numbers */
  chipNumbers: string[]
  sex?: 'male' | 'female' | string
  color?: string
  /** breed or category, as the registry gives it */
  type?: string
  age?: string
  status?: string
  /** the owner's registered name this camel carries */
  reservedId?: string
  reservedName?: string
  reservedType?: NameType
  linkedAt?: string
  syncedAt?: string
}

export interface MyCamels {
  camels: OwnedCamel[]
  lastSyncedAt?: string
  /** false until the platform is linked with the camel registry */
  connected: boolean
}

// ───────────── «المخالفات»: fines and penalties issued to owners ─────────────

/** a kind of violation managed in the settings; amount 0 = a penalty without a fine */
export interface ViolationType {
  id: string
  name: string
  nameEn?: string
  amount: number
  active: boolean
  /** «تقبل التسوية بتسجيل اسم»: the owner may settle it by registering a name for the camel */
  allowsNameResolution: boolean
  createdAt: string
  /** violations issued with this type (a used type is switched off, not deleted) */
  used: number
}

/** a festival violations are issued at (managed in settings → «المخالفات») */
export interface Festival {
  id: string
  name: string
  nameEn?: string
  year?: number
  /** yyyy-mm-dd */
  startsOn?: string
  endsOn?: string
  active: boolean
  createdAt: string
  /** violations issued at it (a used festival is switched off, not deleted) */
  used: number
}

/** unpaid: a fine waiting for payment; recorded: a penalty without a fine */
export type ViolationStatus = 'unpaid' | 'paid' | 'recorded' | 'cancelled' | 'resolved_name' | 'banned'
/** how an unpaid violation was closed: paid and kept taking part, settled by registering a name, or barred from the festival */
export type ViolationResolution = 'paid_continue' | 'resolved_name' | 'banned'

export interface Violation {
  id: string
  /** VL-YYYY-NNNNN */
  number: string
  ownerId: string
  ownerName: string
  /** staff only: masked unless owners.full */
  ownerPhone?: string
  typeId: string
  typeName: string
  typeNameEn?: string
  amount: number
  description: string
  attachmentName?: string
  attachmentType?: string
  status: ViolationStatus
  issuedAt: string
  /** staff only */
  issuedByName?: string
  /** the receipt: fines are not subject to VAT, so no tax invoice is issued */
  paidAt?: string
  paymentId?: string
  paymentMethod?: string
  cancelledAt?: string
  cancelReason?: string
  /** staff only */
  cancelledByName?: string
  /** the festival it was issued at (name as it was) and the camel's chip number */
  festivalId?: string
  festivalName?: string
  camelChip?: string
  /** the type lets the owner settle it by registering a name */
  allowsNameResolution: boolean
  resolution?: ViolationResolution
  resolvedAt?: string
  /** staff only */
  resolvedByName?: string
  /** staff's note on a name settlement, or the reason for a ban */
  resolutionNote?: string
}

export interface ViolationPage {
  items: Violation[]
  total: number
  page: number
  size: number
  counts: { all: number; unpaid: number; paid: number; recorded: number; cancelled: number; resolvedName: number; banned: number }
}

/** the owner a violation is issued to (phone and ID masked unless owners.full) */
export interface ViolationOwner { id: string; fullName: string; phone: string; nationalId?: string; /** first chip of each of the owner's camels (KACF) */ chips: string[] }

export interface ViolationInput {
  ownerId?: string
  /** the owner's mobile or identity number, when ownerId is not known */
  owner?: string
  typeId: string
  description: string
  festivalId?: string
  camelChip?: string
  attachment?: { fileName: string; contentType: string; dataBase64: string }
}

/** «طلب استثناء المشاركة بدون اسم»: pending → priced (staff set the fine) → paid (document issued); or rejected / cancelled by the owner */
export type ExemptionStatus = 'pending' | 'priced' | 'paid' | 'rejected' | 'cancelled'

export interface Exemption {
  id: string
  /** EX-YYYY-NNNNN */
  number: string
  ownerId: string
  ownerName: string
  /** staff only: masked unless owners.full */
  ownerPhone?: string
  /** masked unless the staff member has owners.full */
  nationalId?: string
  camelChip: string
  camelType: 'qaadan' | 'bakkar'
  festivalId?: string
  festivalName: string
  /** «الشوط» */
  race?: string
  ownerNote?: string
  status: ExemptionStatus
  createdAt: string
  /** the fine for not naming the camel, set by staff */
  amount?: number
  staffNote?: string
  pricedAt?: string
  /** staff only */
  pricedByName?: string
  rejectedAt?: string
  rejectReason?: string
  rejectedByName?: string
  cancelledAt?: string
  paidAt?: string
  paymentId?: string
  paymentMethod?: string
  /** the exemption document: given once it is paid */
  issuedAt?: string
  signature?: string
  ownerNameEn?: string
  revokedAt?: string
  revokeReason?: string
  revokedByName?: string
}

export interface ExemptionPage {
  items: Exemption[]
  total: number
  page: number
  size: number
  counts: { all: number; pending: number; priced: number; paid: number; rejected: number; cancelled: number }
}

/** an active festival an owner can ask an exemption for */
export interface FestivalOption { id: string; name: string; nameEn?: string; year?: number; startsOn?: string; endsOn?: string }

export interface ExemptionInput { camelChip: string; camelType: 'qaadan' | 'bakkar'; festivalId: string; race?: string; note?: string }

/** public verification of an exemption document; details only with the printed code */
export interface ExemptionVerify {
  number: string
  status: 'valid' | 'revoked'
  signatureMatches?: boolean | null
  issuedAt?: string
  ownerNameAr?: string
  ownerNameEn?: string
  camelChip?: string
  camelType?: 'qaadan' | 'bakkar'
  festivalName?: string
  race?: string
  revokedAt?: string
  revokeReason?: string
}

/** «الحظر»: computed for today (Riyadh) */
export type BanStatus = 'active' | 'scheduled' | 'ended' | 'lifted'

export interface Ban {
  id: string
  /** the account, when the person is registered */
  ownerId?: string
  name: string
  /** masked unless owners.full */
  nationalId?: string
  phone?: string
  reason: string
  /** yyyy-mm-dd, inclusive; no end = until lifted */
  startsOn: string
  endsOn?: string
  status: BanStatus
  /** manual | legacy_blacklist | legacy_excluded */
  source: string
  createdAt: string
  createdByName: string
  liftedAt?: string
  liftedByName?: string
  liftReason?: string
}

export interface BanPage { items: Ban[]; total: number; page: number; size: number; counts: { all: number; active: number; scheduled: number; ended: number; lifted: number } }

/** a registered owner (owner: mobile or ID), or a national ID and a name for someone not registered */
export interface BanInput { owner?: string; nationalId?: string; name?: string; reason: string; startsOn: string; endsOn?: string }

/** the ban in force on the signed-in owner */
export interface MyBan { reason: string; startsOn: string; endsOn?: string }
