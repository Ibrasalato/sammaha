import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type Lang = 'ar' | 'en'
const KEY = 'sammha-lang'

let current: Lang = (() => {
  try { return (localStorage.getItem(KEY) as Lang) || 'ar' } catch { return 'ar' }
})()

/** Current language for non-React helpers (formatters). */
export const getLang = () => current
export const locale = () => (current === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB')

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (ar: string, en: string) => string; en: boolean }
const LangCtx = createContext<Ctx>(null as unknown as Ctx)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current)
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title = lang === 'ar' ? 'سمّها | منصة اقتناء أسماء الشعارات' : 'Sammha | International Camel Names Registry'
  }, [lang])
  const setLang = useCallback((l: Lang) => {
    current = l
    try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
    setLangState(l)
  }, [])
  const t = useCallback((ar: string, en: string) => (lang === 'ar' ? ar : en), [lang])
  return <LangCtx.Provider value={{ lang, setLang, t, en: lang === 'en' }}>{children}</LangCtx.Provider>
}

export const useLang = () => useContext(LangCtx)

export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang()
  return (
    <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className={className} lang={lang === 'ar' ? 'en' : 'ar'}
      aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>
      {lang === 'ar' ? 'English' : 'العربية'}
    </button>
  )
}

/** Pick the string for the current language. The route tree remounts on switch, so this is safe in render. */
export const tr = (ar: string, en: string) => (current === 'ar' ? ar : en)
