import { useCallback } from 'react'
import { SELLER } from '../lib/config'
import { printReport } from '../lib/print'
import { useApp } from '../lib/store'
import { useContact } from './SettingsUi'

/** the website shown on printed reports */
export const SITE = 'sammha.ico.org.sa'

/** printReport with the signed-in staff member and the platform's contact details (from the settings) */
export function usePrint() {
  const { user } = useApp()
  const contact = useContact()
  return useCallback((opts: { title: string; subtitle?: string; el: HTMLElement | null; landscape?: boolean }) => printReport({
    ...opts, by: user?.fullName,
    contact: { email: contact.email, phone: contact.phone, whatsapp: contact.whatsapp, website: SITE, address: SELLER.address, vat: SELLER.vatNumber },
  }), [user?.fullName, contact.email, contact.phone, contact.whatsapp])
}
