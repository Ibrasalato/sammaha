import type { ReservedName } from './types'

/** Certificate number derived from the registry record id: SMC-XXXXXXXX */
export function certNo(r: Pick<ReservedName, 'id'>) {
  const clean = r.id.replace(/[^a-z0-9]/gi, '').toUpperCase()
  return `SMC-${clean.slice(-8).padStart(8, '0')}`
}

export function verifyUrl(r: Pick<ReservedName, 'id'>) {
  const base = location.href.split('#')[0]
  return `${base}#/verify/${certNo(r)}`
}
