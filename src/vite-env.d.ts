/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** Sammha API (ASP.NET Core) base URL; empty = in-browser demo */
  readonly VITE_API_URL?: string
  readonly VITE_CHAT_WEBHOOK_URL?: string
  readonly VITE_TICKET_WEBHOOK_URL?: string
}
