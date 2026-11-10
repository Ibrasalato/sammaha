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

/** one-time setup of the app shell: bar colour, splash, back button, deep links */
export async function initNative() {
  if (!IS_NATIVE) return
  document.documentElement.classList.add('native')
  const [{ App }, { StatusBar, Style }, { SplashScreen }, { Browser }] = await Promise.all([
    import('@capacitor/app'), import('@capacitor/status-bar'), import('@capacitor/splash-screen'), import('@capacitor/browser'),
  ])
  try { await StatusBar.setStyle({ style: Style.Light }); if (Capacitor.getPlatform() === 'ios') await StatusBar.setOverlaysWebView({ overlay: true }); if (Capacitor.getPlatform() === 'android') await StatusBar.setBackgroundColor({ color: '#E4F1E9' }) } catch { /* not supported */ }
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
    } catch { /* ignore */ }
  })
  // the owner closed the payment page by hand: treat it as not completed, the webhook still settles real payments
  Browser.addListener('browserFinished', () => onPayment?.('closed'))
  await SplashScreen.hide().catch(() => {})
}
