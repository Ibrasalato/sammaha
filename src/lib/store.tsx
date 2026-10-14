import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SammhaApi } from './api'
import { IS_DEMO } from './config'
import { demoApi } from './demoApi'
import { httpApi } from './httpApi'
import type { PublicSettings, User } from './types'
import { DEFAULT_SETTINGS, publicOf } from './demoSettings'
import { localizeError } from './serverText'
import { RULES } from './config'

/**
 * The backend speaks Arabic only; this wrapper puts error messages into the UI language.
 * Every method call is forwarded unchanged; a rejected promise (or a synchronous throw) has its
 * error's `message` translated in place, so its class (`ApiError`) and other fields are kept.
 * Non-function properties and non-promise results pass through untouched.
 */
function withLocalizedErrors<T extends object>(target: T): T {
  const cache = new Map<PropertyKey, unknown>()
  return new Proxy(target, {
    get(t, prop, receiver) {
      const value = Reflect.get(t, prop, receiver)
      if (typeof value !== 'function') return value
      const hit = cache.get(prop)
      if (hit && (hit as { __orig?: unknown }).__orig === value) return hit
      const wrapped = (...args: unknown[]) => {
        let out: unknown
        try {
          out = (value as (...a: unknown[]) => unknown).apply(t, args)
        } catch (e) {
          throw localizeError(e)
        }
        if (out && typeof (out as PromiseLike<unknown>).then === 'function') {
          return Promise.resolve(out as PromiseLike<unknown>).catch((e: unknown) => { throw localizeError(e) })
        }
        return out
      }
      Object.defineProperty(wrapped, '__orig', { value })
      cache.set(prop, wrapped)
      return wrapped
    },
  })
}

export const api: SammhaApi = withLocalizedErrors(IS_DEMO ? demoApi : httpApi)

interface Toast { id: number; text: string; tone: 'ok' | 'bad' }
interface Ctx {
  user: User | null
  ready: boolean
  setUser: (u: User | null) => void
  toast: (text: string, tone?: Toast['tone']) => void
  /** platform switches set by the super admin (open services, banner, maintenance, password rule) */
  settings: PublicSettings
  reloadSettings: () => Promise<void>
}

const AppCtx = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(AppCtx)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  const [settings, setSettings] = useState<PublicSettings>(() => publicOf(DEFAULT_SETTINGS))
  const reloadSettings = useCallback(async () => {
    try {
      const s = await api.publicSettings()
      // the guarantee and the payment deadline are admin settings; texts across the site read them from RULES
      if (typeof s.depositAmount === 'number') RULES.depositAmount = s.depositAmount
      if (typeof s.paymentDeadlineHours === 'number') RULES.paymentDeadlineHours = s.paymentDeadlineHours
      setSettings(s)
    } catch { /* keep the last known */ }
  }, [])

  useEffect(() => {
    reloadSettings()
    const t = setInterval(reloadSettings, 60_000)
    const onFocus = () => { if (document.visibilityState === 'visible') reloadSettings() }
    document.addEventListener('visibilitychange', onFocus)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onFocus) }
  }, [reloadSettings])

  useEffect(() => {
    api.currentUser().then(setUser).catch(() => setUser(null)).finally(() => setReady(true))
  }, [])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++seq.current
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  return (
    <AppCtx.Provider value={{ user, ready, setUser, toast, settings, reloadSettings }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 print:hidden" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded-lg px-4 py-2.5 text-[15px] font-semibold shadow-lg ${t.tone === 'ok' ? 'bg-pine text-paper' : 'bg-bad text-paper'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  )
}

/** Small async loader with reload. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = [], pollMs?: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const reload = useCallback(() => {
    return fnRef.current().then((d) => { setData(d); setError(null) }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    setLoading(true)
    reload()
    if (!pollMs) return
    const t = setInterval(reload, pollMs)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, error, loading, reload, setData }
}

export function useNow(intervalMs = 1000) {
  const [t, setT] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), intervalMs)
    return () => clearInterval(i)
  }, [intervalMs])
  return t
}
