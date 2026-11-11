import { Capacitor } from '@capacitor/core'
import { tr } from './i18n'

/* ───────── phone-only touches: haptics, Face ID / fingerprint, the app lock setting ───────── */

const native = () => Capacitor.isNativePlatform()

/** a short vibration: tap (light), success (a bid went through) or warning (outbid) */
export async function haptic(kind: 'tap' | 'success' | 'warning' = 'tap') {
  if (!native()) return
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics')
    if (kind === 'tap') await Haptics.impact({ style: ImpactStyle.Light })
    else await Haptics.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Warning })
  } catch { /* no haptics */ }
}

export async function biometricAvailable() {
  if (!native()) return false
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    return (await NativeBiometric.isAvailable({ useFallback: true })).isAvailable
  } catch { return false }
}

/** Face ID / fingerprint, falling back to the phone passcode. Resolves true when the owner is verified. */
export async function verifyOwner(reason: string) {
  if (!native()) return true
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    await NativeBiometric.verifyIdentity({ reason, title: tr('سمّها', 'Sammha'), subtitle: reason, useFallback: true, negativeButtonText: tr('إلغاء', 'Cancel') })
    return true
  } catch { return false }
}

const KEY = 'sammha.applock.v1'
/** «قفل التطبيق»: ask for Face ID when the app opens and before large bids */
export function lockEnabled() { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
export function setLockEnabled(on: boolean) { try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* private mode */ } }
/** bids at or above this amount ask for Face ID when the lock is on */
export const BIG_BID = 5000
