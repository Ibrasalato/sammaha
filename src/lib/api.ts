import type {
  AppNotification, CamelEvent, AdminOverview, Auction, AuctionFilter, Bid, Invoice, LogoRequest, NameCheck, NameType,
  PublicStats, RequestStatus, ReservedName, ReviewDecision, Role, StaffInput, Ticket, TicketInput, TicketPriority, TicketStatus, User, Wallet,
} from './types'

export interface SignUpInput {
  fullName: string
  phone: string
  email: string
  nationalId?: string
  password: string
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

/** Everything the UI needs. Implemented by demoApi (localStorage) and supabaseApi (Postgres RPC). */
export interface SammhaApi {
  // auth
  currentUser(): Promise<User | null>
  signUp(input: SignUpInput): Promise<User>
  /** step 1: password. portal 'owner' accepts camel owners only, 'staff' committee and admins only.
   *  Returns a challenge; the session starts only after the one-time code (step 2). */
  startSignIn(login: string, password: string, portal: 'owner' | 'staff'): Promise<OtpChallenge>
  completeSignIn(challenge: string, code: string): Promise<User>
  resendOtp(challenge: string): Promise<OtpChallenge>
  changePassword(current: string, next: string): Promise<void>
  signOut(): Promise<void>

  // public
  stats(): Promise<PublicStats>
  listAuctions(filter?: AuctionFilter): Promise<Auction[]>
  getAuction(id: string): Promise<{ auction: Auction; bids: Bid[] }>
  listReservedNames(q?: string, type?: NameType | 'all'): Promise<ReservedName[]>
  checkNames(names: string[], type: NameType): Promise<NameCheck[]>
  listEvents(): Promise<CamelEvent[]>
  verifyCertificate(code: string): Promise<ReservedName | null>
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
  placeBid(auctionId: string, amount: number): Promise<{ auction: Auction; bids: Bid[] }>

  // approval committee
  overview(): Promise<AdminOverview>
  listRequests(status?: RequestStatus | 'all'): Promise<LogoRequest[]>
  getRequest(id: string): Promise<LogoRequest>
  reviewRequest(id: string, decisions: ReviewDecision[], note?: string): Promise<LogoRequest>
  rejectRequest(id: string, reason: string): Promise<LogoRequest>
  cancelRequest(id: string, reason: string): Promise<LogoRequest>
  awaitingSchedule(): Promise<(LogoRequest['candidates'][number] & { request: LogoRequest })[]>
  scheduleAuctions(candidateIds: string[], startsAt: string, endsAt: string): Promise<Auction[]>
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
}

export class ApiError extends Error {}
