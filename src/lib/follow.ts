import { Capacitor, registerPlugin } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useSyncExternalStore } from 'react'
import { TYPE_LABEL } from './config'
import { sar } from './format'
import { tr } from './i18n'
import type { Auction } from './types'

/* ───────── «متابعة المزاد» (the bell): which alerts this phone gets for one auction ───────── */

export type FollowPrefs = { outbid: boolean; ending: boolean; result: boolean; live: boolean }
export const DEFAULT_FOLLOW: FollowPrefs = { outbid: true, ending: true, result: true, live: false }
type Entry = FollowPrefs & { name: string; endsAt: string }
type Store = Record<string, Entry>

const KEY = 'sammha.follow.v1'
const subs = new Set<() => void>()
let cache: Store | null = null
function read(): Store {
  if (cache) return cache
  try { cache = JSON.parse(localStorage.getItem(KEY) || '{}') as Store } catch { cache = {} }
  return cache
}
function write(s: Store) {
  cache = s
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode */ }
  subs.forEach((f) => f())
}
export function followed(): Store { return read() }
export function followOf(id: string): Entry | null { return read()[id] ?? null }
/** re-renders when any follow changes */
export function useFollow(id: string): Entry | null {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => read()[id] ?? null)
}

/* ───────── iOS Live Activity (lock screen + Dynamic Island) ───────── */

type LiveArgs = { id: string; name?: string; typeLabel?: string; price: number; endsAt: number; leading: boolean; myBid?: number; ended?: boolean }
interface LivePlugin {
  isAvailable(): Promise<{ available: boolean }>
  start(o: LiveArgs): Promise<{ id: string }>
  update(o: LiveArgs): Promise<{ updated: number }>
  end(o: { id?: string }): Promise<{ ended: number }>
}
const Live = registerPlugin<LivePlugin>('LiveActivity')
export const liveSupported = () => Capacitor.getPlatform() === 'ios'
export async function liveAvailable() {
  if (!liveSupported()) return false
  try { return (await Live.isAvailable()).available } catch { return false }
}
const liveArgs = (a: Auction, myBid?: number): LiveArgs => ({
  id: a.id, name: a.name, typeLabel: TYPE_LABEL[a.type], price: a.finalPrice ?? a.currentPrice, endsAt: Date.parse(a.endsAt),
  leading: !!a.isLeader, myBid, ended: Date.parse(a.endsAt) <= Date.now() || !!a.cancelled,
})
export async function liveUpdate(a: Auction, myBid?: number) {
  if (!liveSupported() || !followOf(a.id)?.live) return
  try { await Live.update(liveArgs(a, myBid)) } catch { /* not running */ }
}

/* ───────── local notifications: work with the app closed, no server needed ───────── */

const native = () => Capacitor.isNativePlatform()
function nid(id: string, kind: number) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return (Math.abs(h) % 100_000_000) * 10 + kind
}
async function allowed() {
  if (!native()) return false
  try {
    const p = await LocalNotifications.checkPermissions()
    if (p.display === 'granted') return true
    return (await LocalNotifications.requestPermissions()).display === 'granted'
  } catch { return false }
}
async function schedule(a: Auction, p: FollowPrefs | null) {
  if (!native()) return
  try { await LocalNotifications.cancel({ notifications: [{ id: nid(a.id, 1) }, { id: nid(a.id, 2) }] }) } catch { /* none */ }
  if (!p || !(await allowed())) return
  const end = Date.parse(a.endsAt)
  const extra = { url: `/auctions/${a.id}` }
  const list = []
  if (p.ending && end - 10 * 60_000 > Date.now()) list.push({ id: nid(a.id, 1), title: tr(`مزاد «${a.name}» يقترب من نهايته`, `«${a.name}» is closing soon`), body: tr('باقي 10 دقائق على انتهاء المزاد. زايد الآن قبل فوات الفرصة.', '10 minutes left. Bid now before it closes.'), schedule: { at: new Date(end - 10 * 60_000), allowWhileIdle: true }, extra })
  if (p.result && end > Date.now()) list.push({ id: nid(a.id, 2), title: tr(`انتهى مزاد «${a.name}»`, `«${a.name}» has ended`), body: tr('افتح التطبيق لمعرفة نتيجة المزاد.', 'Open the app to see the result.'), schedule: { at: new Date(end + 30_000), allowWhileIdle: true }, extra })
  if (list.length) { try { await LocalNotifications.schedule({ notifications: list }) } catch { /* denied */ } }
}
/** an alert right now (used while the app is open or just backgrounded) */
export async function notifyNow(title: string, body: string, url: string) {
  if (!(await allowed())) return
  try { await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 1e9), title, body, extra: { url } }] }) } catch { /* denied */ }
}

/** turn following on (with the chosen alerts) or off (prefs = null) */
export async function setFollow(a: Auction, prefs: FollowPrefs | null, myBid?: number): Promise<{ live: boolean }> {
  const s = { ...read() }
  if (prefs) s[a.id] = { ...prefs, name: a.name, endsAt: a.endsAt }
  else delete s[a.id]
  write(s)
  if (prefs && (prefs.ending || prefs.result || prefs.outbid)) await allowed()
  await schedule(a, prefs)
  let live = false
  if (liveSupported()) {
    try {
      if (prefs?.live) { await Live.start(liveArgs(a, myBid)); live = true } else await Live.end({ id: a.id })
    } catch { live = false }
  }
  return { live }
}

/* ───────── while the app runs: outbid and result alerts, live activity refresh ───────── */

type Seen = { leader: boolean; price: number; ended: boolean }
const seen = new Map<string, Seen>()
/** called by the app shell every few seconds with the auctions this owner follows or bid on */
export function watchTick(items: { a: Auction; myBid?: number }[]) {
  const f = read()
  for (const { a, myBid } of items) {
    const p = f[a.id]
    const ended = Date.parse(a.endsAt) <= Date.now()
    const prev = seen.get(a.id)
    if (prev && p) {
      if (p.outbid && myBid && prev.leader && !a.isLeader && !ended) void notifyNow(tr(`تم تجاوز مزايدتك على «${a.name}»`, `You were outbid on «${a.name}»`), tr(`أعلى مزايدة الآن ${sar(a.currentPrice)}. زايد للعودة إلى الصدارة.`, `Top bid is now ${sar(a.currentPrice)}.`), `/auctions/${a.id}`)
      if (p.result && !prev.ended && ended && myBid) void notifyNow(a.isWinner ? tr(`مبروك! رسا عليك «${a.name}»`, `You won «${a.name}»`) : tr(`انتهى مزاد «${a.name}»`, `«${a.name}» has ended`), a.isWinner ? tr('سدّد الفاتورة خلال المهلة لإصدار الشهادة.', 'Pay the invoice within the deadline.') : tr('لم يرسُ المزاد عليك هذه المرة.', 'You did not win this time.'), `/auctions/${a.id}`)
    }
    if (p?.live && (!prev || prev.price !== a.currentPrice || prev.leader !== !!a.isLeader || prev.ended !== ended)) void liveUpdate(a, myBid)
    seen.set(a.id, { leader: !!a.isLeader, price: a.currentPrice, ended })
  }
  // forget follows of auctions that ended over a day ago
  const stale = Object.entries(f).filter(([, e]) => Date.parse(e.endsAt) < Date.now() - 86_400_000)
  if (stale.length) { const s = { ...f }; stale.forEach(([k]) => delete s[k]); write(s) }
}
