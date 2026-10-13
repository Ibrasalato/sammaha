import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SammhaApi } from './api'
import { IS_DEMO } from './config'
import { demoApi } from './demoApi'
import { supabaseApi } from './supabaseApi'
import type { User } from './types'

export const api: SammhaApi = IS_DEMO ? demoApi : supabaseApi

interface Toast { id: number; text: string; tone: 'ok' | 'bad' }
interface Ctx {
  user: User | null
  ready: boolean
  setUser: (u: User | null) => void
  toast: (text: string, tone?: Toast['tone']) => void
}

const AppCtx = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(AppCtx)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  useEffect(() => {
    api.currentUser().then(setUser).catch(() => setUser(null)).finally(() => setReady(true))
  }, [])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++seq.current
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  return (
    <AppCtx.Provider value={{ user, ready, setUser, toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded-lg px-4 py-2.5 text-[15px] font-semibold shadow-lg ${t.tone === 'ok' ? 'bg-ink text-paper' : 'bg-bad text-paper'}`}>
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
