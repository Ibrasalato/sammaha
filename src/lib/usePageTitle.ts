import { useEffect } from 'react'
import { getLang } from './i18n'

/** Sets the browser tab title: «<page> | سمّها». */
export function usePageTitle(title?: string) {
  useEffect(() => {
    const brand = getLang() === 'ar' ? 'سمّها لأسماء الإبل' : 'Sammha'
    document.title = title ? `${title} | ${brand}` : brand
  }, [title])
}
