import type {
  AppNotification, CamelEvent, AdminOverview, Auction, AuctionFilter, Bid, Invoice, LogoRequest, NameCheck, NameType,
  ActivityFilter, ActivityPage, IcoName, Certificate, CertificatePage, CertificateScope, CertificateVerify, Delegation, DelegationInput, AuditRow, BankAccount, BankAccountInput, BankStatus, DepositRow, DocumentFile, IbanCheck, MarkRow, OwnerCrm, StaffBankAccount, WalletDetail, WalletRow, Withdrawal, WithdrawalStatus,
  AddressInput, AdminSettings, AuctionActionResult, AuctionScope, AuctionView, PersonalInput, StaffRole, TicketRouting, InvestmentItem, ListingMode, NameListing, Preferences, PublicSettings, PublicStats, SecuritySummary, SessionInfo, SettingsChange, SettingsPatch, RequestStatus, ReservedName, ReviewDecision, Role, StaffInput, Ticket, TicketInput, TicketPriority, TicketStatus, User, Wallet,
} from './types'

/** owner sign-up (the address is completed later in the dashboard) */
export interface SignUpInput {
  nationalId: string
  firstName: string
  fatherName: string
  grandfatherName: string
  familyName: string
  birthDate: string
  gender: 'male' | 'female' | ''
  nationality: string
  residenceCountry: string
  residenceCity: string
  /** dialling code without +, e.g. 966 */
  phoneCountry: string
  phone: string
  email: string
  password: string
  /** from startSignUp, with the code texted to the mobile */
  challenge?: string
  code?: string
}

export type PayMethod = 'wallet' | 'card'

export interface OtpChallenge {
  challenge: string
  /** where the code went: 05•••••567 or a•••@mail.com */
  phoneMasked: string
  /** digits in the code (4 by SMS; the email provider may use 6) */
  length?: number
  expiresAt: string
}

/** Everything the UI needs. Implemented by demoApi (localStorage) and httpApi (Sammha API, ASP.NET Core). */
export interface SammhaApi {
  // auth
  currentUser(): Promise<User | null>
  /** sign-up step 1: checks the details and texts a code to the mobile */
  startSignUp(input: SignUpInput): Promise<OtpChallenge>
  /** step 2: the same details with the challenge and code */
  signUp(input: SignUpInput): Promise<User>
  /** step 1: password. portal 'owner' accepts camel owners only, 'staff' committee and admins only.
   *  Returns a challenge; the session starts only after the one-time code (step 2). */
  startSignIn(login: string, password: string, portal: 'owner' | 'staff'): Promise<OtpChallenge>
  completeSignIn(challenge: string, code: string): Promise<User>
  resendOtp(challenge: string): Promise<OtpChallenge>
  changePassword(current: string, next: string): Promise<void>
  signOut(): Promise<void>
  /** ends this account's sessions on every device, this one included */
  signOutEverywhere(): Promise<void>

  // public
  stats(): Promise<PublicStats>
  listAuctions(filter?: AuctionFilter): Promise<Auction[]>
  getAuction(id: string): Promise<AuctionView>
  /** calls back whenever this auction may have changed (other tabs in the demo, realtime in production) */
  subscribeAuction(id: string, onChange: () => void): () => void
  /** production only (SignalR): auction changes for list pages and the signed-in user's new notifications */
  subscribeLive?(handlers: { onAuction?: (a: Auction) => void; onNotification?: (n: AppNotification) => void }): () => void
  listReservedNames(q?: string, type?: NameType | 'all'): Promise<ReservedName[]>
  checkNames(names: string[], type: NameType): Promise<NameCheck[]>
  listEvents(): Promise<CamelEvent[]>
  verifyCertificate(code: string): Promise<ReservedName | null>
  /** an issued certificate (SC-YYYY-NNNNNN); `sig` is the signature code from its QR or print */
  verifyIssuedCertificate(number: string, sig?: string): Promise<CertificateVerify | null>
  myCertificates(): Promise<Certificate[]>
  issueCertificate(input: { scope: CertificateScope; reservedNameId?: string; ownerNameEn?: string }): Promise<Certificate>
  myCertificate(number: string): Promise<Certificate>
  // staff: certificates.manage / names.latin
  staffCertificates(f?: { q?: string; status?: 'active' | 'revoked'; page?: number }): Promise<CertificatePage>
  staffCertificate(number: string): Promise<Certificate>
  revokeCertificate(id: string, reason: string): Promise<Certificate>
  setLatinName(reservedId: string, latin: string): Promise<ReservedName>
  /** names the International Camel Organization owns (the winner did not pay in time) — names.ico */
  icoNames(): Promise<IcoName[]>
  auctionIcoName(reservedId: string, startsAt: string, endsAt: string, openingPrice?: number): Promise<Auction>
  /** contact form: anyone can file a complaint, report or enquiry and gets a tracking number */
  submitTicket(input: TicketInput): Promise<Ticket>
  /** public tracking: needs the ticket number and the mobile number it was filed with */
  trackTicket(number: string, phone: string): Promise<Ticket | null>
  followUpTicket(number: string, phone: string, body: string): Promise<Ticket>

  // owner
  myRequests(): Promise<LogoRequest[]>
  createRequest(type: NameType, names: string[]): Promise<LogoRequest>
  /** compound name for a name the owner holds; goes to the committee, registered directly on approval (no auction) */
  createCompoundRequest(reservedId: string, fullName: string): Promise<LogoRequest>
  /** «استثمار الاسم»: one new name; pay the study fee with payDeposit */
  createInvestmentRequest(type: NameType, names: string[]): Promise<LogoRequest>
  myInvestments(): Promise<InvestmentItem[]>
  payDeposit(requestId: string, method: PayMethod): Promise<LogoRequest>
  /** returns the amount refunded to the wallet (0 if the guarantee was not paid yet) */
  cancelMyRequest(requestId: string, reason?: string): Promise<{ refunded: number }>
  /** withdraw one name; withdrawing the last remaining name cancels the request and refunds the guarantee */
  withdrawName(requestId: string, candidateId: string): Promise<{ refunded: number; requestCancelled: boolean }>
  myWallet(): Promise<Wallet>
  topUp(amount: number): Promise<Wallet>
  myInvoices(): Promise<Invoice[]>
  payInvoice(id: string, method: PayMethod): Promise<Invoice>
  myBids(): Promise<(Bid & { auction: Auction })[]>
  myNames(): Promise<ReservedName[]>
  /** «بيع اسم»: put a name the user owns up for sale */
  createListing(reservedId: string, mode: ListingMode, price: number): Promise<NameListing>
  cancelListing(id: string): Promise<NameListing>
  myListings(): Promise<NameListing[]>
  /** fixed-price names on sale now (public) */
  marketListings(): Promise<NameListing[]>
  buyListing(id: string, method: PayMethod): Promise<NameListing>
  /** resale auctions: pay the participation guarantee before bidding */
  payBidDeposit(auctionId: string, method: PayMethod): Promise<AuctionView>
  updateMyProfile(p: { avatarUrl?: string | null; showAvatar: boolean }): Promise<User>
  updateMyAccount(p: { fullName: string; nationalId?: string }): Promise<User>
  /** sends a one-time code to the new email; the email changes only after the code is confirmed */
  requestEmailChange(newEmail: string): Promise<OtpChallenge>
  confirmEmailChange(challenge: string, code: string): Promise<User>
  /** sends a one-time code to the new number */
  requestPhoneChange(newPhone: string): Promise<OtpChallenge>
  confirmPhoneChange(challenge: string, code: string): Promise<User>
  myNotifications(): Promise<AppNotification[]>
  markNotificationsRead(): Promise<void>
  myTickets(): Promise<Ticket[]>
  placeBid(auctionId: string, amount: number): Promise<AuctionView>
  /** automatic bidding: the platform raises for you by the minimum step up to `max` */
  setAutoBid(auctionId: string, max: number): Promise<AuctionView>
  cancelAutoBid(auctionId: string): Promise<AuctionView>
  /** watchlist with reminders an hour before the start and before the end */
  toggleWatch(auctionId: string): Promise<boolean>
  myWatchlist(): Promise<Auction[]>

  // approval committee
  overview(): Promise<AdminOverview>
  listRequests(status?: RequestStatus | 'all'): Promise<LogoRequest[]>
  getRequest(id: string): Promise<LogoRequest>
  reviewRequest(id: string, decisions: ReviewDecision[], note?: string): Promise<LogoRequest>
  rejectRequest(id: string, reason: string): Promise<LogoRequest>
  cancelRequest(id: string, reason: string): Promise<LogoRequest>
  awaitingSchedule(): Promise<(LogoRequest['candidates'][number] & { request: LogoRequest })[]>
  /** staggerMinutes > 0: each mark opens and closes that many minutes after the previous, in the order given */
  scheduleAuctions(candidateIds: string[], startsAt: string, endsAt: string, staggerMinutes?: number): Promise<Auction[]>
  allInvoices(): Promise<Invoice[]>
  markInvoicePaid(id: string): Promise<Invoice>
  listUsers(): Promise<User[]>
  // super admin only
  createStaff(input: StaffInput): Promise<User>
  setUserRole(id: string, role: Role): Promise<User>
  setUserActive(id: string, active: boolean): Promise<User>
  saveEvent(e: CamelEvent): Promise<CamelEvent>
  deleteEvent(id: string): Promise<void>
  listTickets(): Promise<Ticket[]>
  getTicket(id: string): Promise<Ticket>
  updateTicket(id: string, patch: { status?: TicketStatus; priority?: TicketPriority; assignee?: string }): Promise<Ticket>
  replyTicket(id: string, body: string, internal: boolean): Promise<Ticket>

  // settings
  /** public switches: open services, banner, maintenance, contact details, password rule */
  publicSettings(): Promise<PublicSettings>
  // super admin
  adminSettings(): Promise<AdminSettings>
  /** partial update; every change is written to the history */
  updateSettings(patch: SettingsPatch): Promise<AdminSettings>
  settingsHistory(): Promise<SettingsChange[]>
  /** ends every session on the platform except the caller's; returns how many accounts were signed out */
  signOutEveryone(): Promise<number>
  // any signed-in user
  myPreferences(): Promise<Preferences>
  saveMyPreferences(p: Preferences): Promise<Preferences>
  mySessions(): Promise<SessionInfo[]>
  revokeMySession(id: string): Promise<SessionInfo[]>
  mySecurity(): Promise<SecuritySummary>

  // owner profile completion (dashboard)
  updateMyAddress(input: AddressInput): Promise<User>
  updateMyPersonal(input: PersonalInput): Promise<User>
  /** sends a code to the account email; confirming it marks the email verified */
  requestEmailVerification(): Promise<OtpChallenge>
  confirmEmailVerification(challenge: string, code: string): Promise<User>

  // staff roles and permissions
  listRoles(): Promise<StaffRole[]>
  saveRole(id: string | null, input: { name: string; description?: string; permissions: string[] }): Promise<StaffRole>
  deleteRole(id: string): Promise<void>
  setUserStaffRole(userId: string, roleId: string): Promise<User>
  // who handles complaints, reports, enquiries and suggestions, and their inboxes
  ticketRouting(): Promise<TicketRouting>
  saveTicketRouting(input: { restrictToHandlers: boolean; handlers: TicketRouting['handlers']; emails: TicketRouting['emails'] }): Promise<TicketRouting>

  // auction controls (one auction, a selection, or all of them)
  adminAuctions(state?: 'active' | 'live' | 'scheduled' | 'paused' | 'cancelled' | 'ended' | 'all', type?: NameType | 'all'): Promise<Auction[]>
  pauseAuctions(scope: AuctionScope, reason?: string): Promise<AuctionActionResult>
  resumeAuctions(scope: AuctionScope): Promise<AuctionActionResult>
  extendAuctions(scope: AuctionScope, minutes: number): Promise<AuctionActionResult>
  cancelAuctions(scope: AuctionScope, reason: string): Promise<AuctionActionResult>

  // committee audit of requested names
  requestsAudit(status?: RequestStatus | 'all', type?: NameType | 'all'): Promise<AuditRow[]>
  // customers (CRM)
  listOwners(): Promise<OwnerCrm[]>
  logOwnersReport(kind: 'print' | 'csv', count: number, filter?: string): Promise<void>
  // reports
  marksReport(f?: { type?: NameType | 'all'; state?: string; from?: string; to?: string }): Promise<MarkRow[]>
  // owner bank account and refunds
  checkIban(iban: string): Promise<IbanCheck>
  myBankAccount(): Promise<BankAccount | null>
  saveMyBankAccount(input: BankAccountInput): Promise<BankAccount>
  myBankDocument(): Promise<DocumentFile>
  myWithdrawals(): Promise<Withdrawal[]>
  requestWithdrawal(amount: number): Promise<Withdrawal>
  // finance
  bankAccounts(status?: BankStatus | 'all'): Promise<StaffBankAccount[]>
  bankDocument(userId: string): Promise<DocumentFile>
  verifyBankAccount(userId: string): Promise<StaffBankAccount>
  rejectBankAccount(userId: string, reason: string): Promise<StaffBankAccount>
  wallets(): Promise<WalletRow[]>
  walletDetail(userId: string): Promise<WalletDetail>
  directRefund(userId: string, amount: number, transferRef: string, note?: string): Promise<Withdrawal>
  adjustWallet(userId: string, amount: number, reason: string): Promise<WalletRow>
  withdrawals(status?: WithdrawalStatus | 'all'): Promise<Withdrawal[]>
  completeWithdrawal(id: string, transferRef: string): Promise<Withdrawal>
  rejectWithdrawal(id: string, reason: string): Promise<Withdrawal>
  deposits(state?: 'held' | 'all' | 'refunded' | 'applied'): Promise<DepositRow[]>
  refundDeposit(input: { kind: 'request' | 'bid'; requestId?: string; auctionId?: string; userId?: string; reason: string }): Promise<DepositRow>

  // activity log (logs.view)
  activity(f?: ActivityFilter): Promise<ActivityPage>
  /** the owner's own log: own actions, delegates' actions on the account, actions as a delegate */
  myActivity(f?: ActivityFilter): Promise<ActivityPage>
  // account delegation
  myDelegations(): Promise<Delegation[]>
  saveDelegation(id: string | null, input: DelegationInput): Promise<Delegation>
  revokeDelegation(id: string): Promise<Delegation>
  delegatedToMe(): Promise<Delegation[]>
  /** switch into the owner's account as their delegate */
  actAs(delegationId: string): Promise<User>
  /** back to the delegate's own account */
  stopActing(): Promise<User>
}

export class ApiError extends Error {}
