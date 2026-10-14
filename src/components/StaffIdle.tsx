import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { STAFF_LOGIN_PATH } from '../lib/config'
import { api, useApp } from '../lib/store'

/**
 * Staff dashboards sign out after the idle time the super admin set (Settings → security policy).
 * Activity in any tab of this browser counts; owners are not affected.
 */
export function useStaffIdle() {
  const { user, setUser, toast, settings } = useApp()
  const nav = useNavigate()
  const last = useRef(Date.now())
  const minutes = settings.staffIdleMinutes
  const staff = !!user && user.role !== 'owner'

  useEffect(() => {
    if (!staff || !minutes) return
    const KEY = 'sammha-staff-active'
    const touch = () => {
      const t = Date.now()
      if (t - last.current < 5000) return // throttle
      last.current = t
      try { localStorage.setItem(KEY, String(t)) } catch { /* ignore */ }
    }
    const onStorage = (e: StorageEvent) => { if (e.key === KEY && e.newValue) last.current = Math.max(last.current, Number(e.newValue)) }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((ev) => window.addEventListener(ev, touch, { passive: true }))
    window.addEventListener('storage', onStorage)
    const timer = setInterval(async () => {
      if (Date.now() - last.current < minutes * 60_000) return
      clearInterval(timer)
      await api.signOut()
      setUser(null)
      toast('خرجت من لوحة التحكم بعد فترة خمول، سجّل الدخول من جديد', 'bad')
      nav(STAFF_LOGIN_PATH, { replace: true })
    }, 15_000)
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, touch))
      window.removeEventListener('storage', onStorage)
      clearInterval(timer)
    }
  }, [staff, minutes, setUser, toast, nav])
}
