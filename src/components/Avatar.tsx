const TONES = ['bg-pine text-paper', 'bg-gold text-paper', 'bg-info text-paper', 'bg-rose text-paper', 'bg-pine-3 text-paper']

/** Owner photo, or the first letter of the name in a brand colour when there is no (public) photo. */
export function Avatar({ name, src, size = 40, ring }: { name: string; src?: string; size?: number; ring?: boolean }) {
  const clean = name.replace(/^(الأمير|الشيخ|م\.|د\.)\s+/, '').trim()
  const tone = TONES[[...clean].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length]
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  // a lone alef (ا أ إ آ) reads like "!" or "I", so names starting with one show two letters
  const initial = /^[اأإآ]/.test(clean) ? [...clean].slice(0, 2).join('') : clean[0]
  const ringCls = ring ? 'ring-2 ring-gold ring-offset-2 ring-offset-paper' : ''
  return src
    ? <img src={src} alt={name} style={style} className={`shrink-0 rounded-full object-cover ${ringCls}`} />
    : <span style={style} className={`flex shrink-0 items-center justify-center rounded-full font-extrabold ${tone} ${ringCls}`} aria-hidden>{initial}</span>
}

/** Resize a picked image file to a square JPEG data URL (center crop). */
export function resizeToSquare(file: File, size = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = size
      const s = Math.min(img.width, img.height)
      c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
