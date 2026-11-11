import { Capacitor } from '@capacitor/core'

/** true inside the Android / iOS app (the Capacitor shell), false in a normal browser */
export const IS_NATIVE = Capacitor.isNativePlatform() || import.meta.env.VITE_FORCE_NATIVE === '1'

/** the public site: card payments return through it, and it hands the owner back to the app (public/app-return.html) */
const SITE = (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://ibrasalato.github.io/sammaha/'

/** where the payment page sends the owner afterwards: the site's bridge page, which opens sammha://payment?state=… */
export const nativeReturnUrl = () => `${SITE.replace(/\/?$/, '/')}app-return.html`

type Handler = (state: string) => void
let onPayment: Handler | null = null
/** the payment bridge opened the app: close the in-app browser and tell whoever is waiting */
export function listenPaymentReturn(h: Handler) { onPayment = h }

/** open the gateway page in the in-app browser (the app keeps running behind it) */
export async function openInApp(url: string) {
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url, presentationStyle: 'fullscreen' })
}

/** open an external link (WhatsApp, a PDF, a map) outside the app */
export async function openExternal(url: string) {
  if (!IS_NATIVE) { window.open(url, '_blank', 'noopener'); return }
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url })
}

export type ThemePref = 'auto' | 'light' | 'dark'
const THEME_KEY = 'sammha.theme'
const mq = window.matchMedia('(prefers-color-scheme: dark)')
export function themePref(): ThemePref { try { return (localStorage.getItem(THEME_KEY) as ThemePref) || 'auto' } catch { return 'auto' } }
async function applyTheme() {
  const p = themePref()
  const dark = p === 'dark' || (p === 'auto' && mq.matches)
  document.documentElement.classList.toggle('dark', dark)
  try { const { StatusBar, Style } = await import('@capacitor/status-bar'); await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }); if (Capacitor.getPlatform() === 'android') await StatusBar.setBackgroundColor({ color: dark ? '#0D1512' : '#FFFFFF' }) } catch { /* not supported */ }
}
/** «المظهر» in the account screen: auto (follow the phone), light or dark */
export function setThemePref(p: ThemePref) {
  try { localStorage.setItem(THEME_KEY, p) } catch { /* private mode */ }
  void applyTheme()
}

/** one-time setup of the app shell: bar colour, splash, back button, deep links */
export async function initNative() {
  if (!IS_NATIVE) return
  document.documentElement.classList.add('native')
  // dark mode: the owner's choice in «حسابي», or the phone setting
  mq.addEventListener('change', () => { void applyTheme() })
  const [{ App }, { StatusBar, Style }, { SplashScreen }, { Browser }] = await Promise.all([
    import('@capacitor/app'), import('@capacitor/status-bar'), import('@capacitor/splash-screen'), import('@capacitor/browser'),
  ])
  try { await StatusBar.setStyle({ style: Style.Light }); if (Capacitor.getPlatform() === 'ios') await StatusBar.setOverlaysWebView({ overlay: true }) } catch { /* not supported */ }
  await applyTheme()
  // Android back: go back in the app, and leave only from the first screen
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && location.hash.replace(/^#\/?/, '') !== '') history.back()
    else App.exitApp()
  })
  // sammha://payment?state=paid|pending|failed — the payment page handed control back
  App.addListener('appUrlOpen', ({ url }) => {
    try {
      const u = new URL(url)
      if (u.protocol === 'sammha:' && u.host === 'payment') {
        Browser.close().catch(() => {})
        onPayment?.(u.searchParams.get('state') ?? 'pending')
      }
      // sammha://auctions/<id> — tapped on the lock-screen live activity
      if (u.protocol === 'sammha:' && u.host === 'auctions') location.hash = `#/auctions${u.pathname}`

    } catch { /* ignore */ }
  })
  // a tapped alert opens its auction
  import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
    LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
      const url = (e.notification.extra as { url?: string } | undefined)?.url
      if (url) location.hash = `#${url}`
    }).catch(() => {})
  }).catch(() => {})
  // the owner closed the payment page by hand: treat it as not completed, the webhook still settles real payments
  Browser.addListener('browserFinished', () => onPayment?.('closed'))
  await SplashScreen.hide().catch(() => {})
}
