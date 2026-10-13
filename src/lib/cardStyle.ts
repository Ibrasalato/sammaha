import { useSyncExternalStore } from 'react'

/** Auction card designs the visitor can choose from. The choice is remembered in this browser only. */
export type CardStyle = 'modern' | 'brand' | 'ribbon' | 'classic' | 'minimal' | 'heritage' | 'luxury'
export const CARD_STYLES: CardStyle[] = ['brand', 'ribbon', 'modern', 'classic', 'heritage', 'luxury', 'minimal']
export const CARD_STYLE_LABEL: Record<CardStyle, [string, string]> = {
  modern: ['عصري', 'Modern'],
  brand: ['هوية سمّها', 'Sammha identity'],
  ribbon: ['شريطة', 'Ribbon'],
  classic: ['كلاسيكي', 'Classic'],
  heritage: ['تراثي', 'Heritage'],
  luxury: ['فاخر', 'Luxury'],
  minimal: ['قائمة مختصرة', 'Compact list'],
}

const KEY = 'sammha-card-style-v2'
const listeners = new Set<() => void>()
let current: CardStyle = (() => {
  try {
    const v = localStorage.getItem(KEY) as CardStyle | null
    return v && CARD_STYLES.includes(v) ? v : 'brand'
  } catch { return 'brand' }
})()

export function setCardStyle(s: CardStyle) {
  current = s
  try { localStorage.setItem(KEY, s) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

export function useCardStyle(): CardStyle {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l) } },
    () => current,
    () => 'brand',
  )
}
