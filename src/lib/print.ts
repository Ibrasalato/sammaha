/**
 * Prints one report: copies the section into a clean window with the site's styles, a header
 * (title, filters, date, who printed it) and page numbers, then opens the print dialog.
 */
import { getLang, tr } from './i18n'

export interface PrintContact { email?: string; phone?: string; whatsapp?: string; website?: string; address?: string; vat?: string }

export function printReport(opts: { title: string; subtitle?: string; by?: string; el: HTMLElement | null; landscape?: boolean; contact?: PrintContact }) {
  if (!opts.el) return
  const w = window.open('', '_blank', 'width=1100,height=800')
  if (!w) { window.print(); return }
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join('\n')
  const when = new Intl.DateTimeFormat(getLang() === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date())
  const c = opts.contact ?? {}
  const asset = (f: string) => new URL(`./${f}`, location.href.split('#')[0]).href
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  w.document.write(`<!doctype html><html lang="${getLang()}" dir="${getLang() === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(opts.title)}</title>${styles}
<style>
  @page { size: A4 ${opts.landscape ? 'landscape' : 'portrait'}; margin: 12mm 10mm 14mm; }
  html, body { background: #fff !important; }
  body { padding: 0; font-size: 12px; }
  .report-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; border-bottom: 2px solid #1D5C2F; padding-bottom: 8px; margin-bottom: 12px; }
  .report-head h1 { font-size: 20px; margin: 0; }
  .report-head p { margin: 2px 0 0; color: #555; font-size: 12px; }
  .no-print, button, select, input[type=checkbox], .print\\:hidden { display: none !important; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd !important; padding: 4px 6px !important; font-size: 11px !important; vertical-align: top; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .panel { box-shadow: none !important; border: 0 !important; overflow: visible !important; }
  .report-head img { height: 56px; width: auto; }
  .report-brand { display: flex; align-items: center; gap: 12px; }
  .report-foot { margin-top: 14px; padding-top: 8px; border-top: 1px solid #C9A55A; display: flex; align-items: center; justify-content: space-between; gap: 14px; color: #555; font-size: 10.5px; break-inside: avoid; }
  .report-foot img { height: 40px; width: auto; }
  .report-foot .contact { display: flex; flex-wrap: wrap; gap: 4px 14px; justify-content: flex-start; direction: ${getLang() === 'ar' ? 'rtl' : 'ltr'}; }
  .report-foot .contact b { color: #1D5C2F; }
  .report-note { margin-top: 6px; color: #888; font-size: 9.5px; text-align: center; }
</style></head><body>
<div class="report-head">
  <div class="report-brand"><img src="${asset('sammha-logo.svg')}" alt="${tr('سمّها', 'Sammha')}"><div><h1>${esc(opts.title)}</h1>${opts.subtitle ? `<p>${esc(opts.subtitle)}</p>` : ''}</div></div>
  <div style="text-align:${getLang() === 'ar' ? 'left' : 'right'}"><b>${tr('منصة سمّها · السجل الدولي لأسماء الإبل', 'Sammha · International Camel Names Registry')}</b><p style="color:#9C7425;font-weight:700">${tr('لأن الأسماء تصنع المجد', 'Because names make glory')}</p><p>${esc(when)}${opts.by ? ` · ${tr('طُبع بواسطة', 'Printed by')} ${esc(opts.by)}` : ''}</p></div>
</div>
${opts.el.outerHTML}
<div class="report-foot">
  <div class="contact">
    <span><b>${tr('المنظمة الدولية للإبل', 'International Camel Organization')}</b>${c.address ? ` · ${esc(c.address)}` : ''}</span>
    ${c.phone ? `<span>${tr('الهاتف', 'Phone')}: <span dir="ltr">${esc(c.phone)}</span></span>` : ''}
    ${c.whatsapp ? `<span>${tr('واتساب', 'WhatsApp')}: <span dir="ltr">+${esc(c.whatsapp)}</span></span>` : ''}
    ${c.email ? `<span>${tr('البريد', 'Email')}: <span dir="ltr">${esc(c.email)}</span></span>` : ''}
    ${c.website ? `<span>${tr('الموقع', 'Website')}: <span dir="ltr">${esc(c.website)}</span></span>` : ''}
    ${c.vat ? `<span>${tr('الرقم الضريبي', 'VAT No.')}: <span dir="ltr">${esc(c.vat)}</span></span>` : ''}
  </div>
  <img src="${asset('ico-logo.png')}" alt="${tr('المنظمة الدولية للإبل', 'International Camel Organization')}">
</div>
<p class="report-note">${tr('تقرير داخلي، يحتوي بيانات شخصية للعملاء. لا يُشارك خارج المنظمة.', 'Internal report containing customers\' personal data. Not to be shared outside the organization.')}</p>
</body></html>`)
  w.document.close()
  w.focus()
  // wait for the styles and fonts before printing
  let printed = false
  const go = () => { if (printed) return; printed = true; try { w.print() } catch { /* closed */ } }
  w.onload = () => {
    const imgs = [...w.document.images].filter((i) => !i.complete)
    if (!imgs.length) { setTimeout(go, 300); return }
    let left = imgs.length
    imgs.forEach((i) => { i.onload = i.onerror = () => { if (--left === 0) setTimeout(go, 200) } })
  }
  setTimeout(go, 2500)
}

/** CSV with a BOM so Excel opens Arabic correctly */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
