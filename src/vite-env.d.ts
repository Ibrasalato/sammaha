/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** Sammha API (ASP.NET Core) base URL; empty = in-browser demo */
  readonly VITE_API_URL?: string
  /** preview builds only: render the app's mobile layout in a normal browser */
  readonly VITE_FORCE_NATIVE?: string
  /** the public site, where card payments return and hand control back to the app */
  readonly VITE_SITE_URL?: string
  readonly VITE_CHAT_WEBHOOK_URL?: string
  readonly VITE_TICKET_WEBHOOK_URL?: string
}
