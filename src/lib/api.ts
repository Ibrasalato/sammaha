import type {
  AppNotification, CamelEvent, AdminOverview, Auction, AuctionFilter, Bid, Invoice, LogoRequest, NameCheck, NameType,
  PublicStats, RequestStatus, ReservedName, ReviewDecision, Ticket, TicketInput, TicketPriority, TicketStatus, User, Wallet,
} from './types'

export interface SignUpInput {
  fullName: string
  phone: string
  email: string
  nationalId?: string
  password: string
}

export type PayMethod = 'wallet' | 'card'

/** Everything the UI needs. Implemented by demoApi (localStorage) and supabaseApi (Postgres RPC). */
export interface SammhaApi {
  // auth
  currentUser(): Promise<User | null>
  signUp(input: SignUpInput): Promise<User>
  signIn(login: string, password: string): Promise<User>
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
  payDeposit(requestId: string, method: PayMethod): Promise<LogoRequest>
  cancelMyRequest(requestId: string): Promise<void>
  myWallet(): Promise<Wallet>
  topUp(amount: number): Promise<Wallet>
  myInvoices(): Promise<Invoice[]>
  payInvoice(id: string, method: PayMethod): Promise<Invoice>
  myBids(): Promise<(Bid & { auction: Auction })[]>
  myNames(): Promise<ReservedName[]>
  updateMyProfile(p: { avatarUrl?: string | null; showAvatar: boolean }): Promise<User>
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
  saveEvent(e: CamelEvent): Promise<CamelEvent>
  deleteEvent(id: string): Promise<void>
  listTickets(): Promise<Ticket[]>
  getTicket(id: string): Promise<Ticket>
  updateTicket(id: string, patch: { status?: TicketStatus; priority?: TicketPriority; assignee?: string }): Promise<Ticket>
  replyTicket(id: string, body: string, internal: boolean): Promise<Ticket>
}

export class ApiError extends Error {}
