import { useEffect, useState } from 'react'
import { getLang, tr } from '../lib/i18n'

export const SLIDES: { src: string; alt: string; pos?: string }[] = [
  { src: './hero/camels-parade.webp', alt: 'قطيع من الإبل البيضاء في ساحة المهرجان', pos: 'center 40%' },
  { src: './hero/mazayin.webp', alt: 'منقيات الإبل في مسابقة المزاين', pos: 'center 45%' },
  { src: './hero/camels-sky.webp', alt: 'إبل بيضاء تسير في الصحراء', pos: 'center 40%' },
  { src: './hero/festival-white.webp', alt: 'الإبل البيضاء في ميدان العرض', pos: 'center 35%' },
  { src: './hero/sunset.webp', alt: 'ناقة عند الغروب في الصحراء', pos: 'center 30%' },
]

const INTERVAL = 6500

/** Background slideshow: slow cross-fade with a gentle zoom on each photo. */
export function HeroSlides() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    // preload the rest after first paint
    SLIDES.slice(1).forEach((s) => { const im = new Image(); im.src = s.src })
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || paused) return
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), INTERVAL)
    return () => clearInterval(t)
  }, [paused])

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden={false}>
      {SLIDES.map((s, k) => (
        <img key={s.src} src={s.src} alt={k === i ? s.alt : ''} loading={k === 0 ? 'eager' : 'lazy'}
          className={`slide absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-in-out ${k === i ? 'slide-on opacity-100' : 'opacity-0'}`}
          style={{ objectPosition: s.pos }} />
      ))}
      {/* legibility: dark pine wash, stronger behind the text (start side) */}
      <div className={`absolute inset-0 ${getLang() === 'ar' ? 'bg-gradient-to-l' : 'bg-gradient-to-r'} from-pine/90 via-pine/45 to-transparent`} />
      <div className="absolute inset-0 bg-gradient-to-t from-pine/70 via-transparent to-pine/30" />
      <div className="absolute end-6 top-5 z-10 flex items-center gap-2">
        {SLIDES.map((s, k) => (
          <button key={s.src} onClick={() => setI(k)} aria-label={tr(`الصورة ${k + 1}`, `Slide ${k + 1}`)} aria-current={k === i}
            className={`h-1.5 rounded-full transition-all ${k === i ? 'w-8 bg-gold' : 'w-3 bg-paper/50 hover:bg-paper'}`} />
        ))}
        <button onClick={() => setPaused(!paused)} className="ms-2 rounded border border-paper/30 px-2 text-[12px] font-bold text-paper/80 hover:text-paper" aria-label={paused ? tr('تشغيل العرض', 'Play slideshow') : tr('إيقاف العرض', 'Pause slideshow')}>
          {paused ? tr('تشغيل', 'Play') : tr('إيقاف', 'Pause')}
        </button>
      </div>
    </div>
  )
}
