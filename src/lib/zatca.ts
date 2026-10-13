import QRCode from 'qrcode'
import { SELLER } from './config'
import type { Invoice } from './types'

/**
 * ZATCA (Fatoora) phase-1 simplified tax invoice QR: TLV fields
 * 1 seller name, 2 VAT number, 3 timestamp, 4 total incl. VAT, 5 VAT amount — base64 encoded.
 * Phase-2 (integration with the Fatoora portal, cryptographic stamp) is done server-side.
 */
export function zatcaTlvBase64(inv: Pick<Invoice, 'issuedAt' | 'total' | 'vat'>): string {
  const enc = new TextEncoder()
  const fields: [number, string][] = [
    [1, SELLER.name],
    [2, SELLER.vatNumber],
    [3, new Date(inv.issuedAt).toISOString()],
    [4, inv.total.toFixed(2)],
    [5, inv.vat.toFixed(2)],
  ]
  const parts: number[] = []
  for (const [tag, value] of fields) {
    const bytes = enc.encode(value)
    parts.push(tag, bytes.length, ...bytes)
  }
  let bin = ''
  for (const b of parts) bin += String.fromCharCode(b)
  return btoa(bin)
}

export function zatcaQrDataUrl(inv: Pick<Invoice, 'issuedAt' | 'total' | 'vat'>): Promise<string> {
  return QRCode.toDataURL(zatcaTlvBase64(inv), { margin: 1, width: 180, color: { dark: '#221E1A', light: '#FFFFFF' } })
}
