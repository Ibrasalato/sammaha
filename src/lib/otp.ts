export const maskEmail = (e: string) => { const [u, d] = e.split('@'); return d ? `${u.slice(0, 1)}${'•'.repeat(Math.max(u.length - 1, 2))}@${d}` : e }
export const maskPhone = (p: string) => (p.length >= 7 ? `${p.slice(0, 2)}${'•'.repeat(p.length - 5)}${p.slice(-3)}` : p)
/** Western digits only, so the code can be typed on an Arabic keyboard */
export const otpDigits = (s: string) => s.replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\D/g, '')
