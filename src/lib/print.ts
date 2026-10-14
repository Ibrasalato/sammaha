/**
 * Prints one report: copies the section into a clean window with the site's styles, a header
 * (title, filters, date, who printed it) and page numbers, then opens the print dialog.
 */
export function printReport(opts: { title: string; subtitle?: string; by?: string; el: HTMLElement | null; landscape?: boolean }) {
  if (!opts.el) return
  const w = window.open('', '_blank', 'width=1100,height=800')
  if (!w) { window.print(); return }
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join('\n')
  const when = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date())
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(opts.title)}</title>${styles}
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
  .report-foot { margin-top: 10px; color: #777; font-size: 10px; }
</style></head><body>
<div class="report-head"><div><h1>${esc(opts.title)}</h1>${opts.subtitle ? `<p>${esc(opts.subtitle)}</p>` : ''}</div>
<div style="text-align:left"><b>منصة سمّها · السجل الدولي لأسماء الإبل</b><p>${esc(when)}${opts.by ? ` · طُبع بواسطة ${esc(opts.by)}` : ''}</p></div></div>
${opts.el.outerHTML}
<p class="report-foot">تقرير داخلي، يحتوي بيانات شخصية للعملاء. لا يُشارك خارج المنظمة.</p>
</body></html>`)
  w.document.close()
  w.focus()
  // wait for the styles and fonts before printing
  let printed = false
  const go = () => { if (printed) return; printed = true; try { w.print() } catch { /* closed */ } }
  w.onload = () => setTimeout(go, 300)
  setTimeout(go, 1500)
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
