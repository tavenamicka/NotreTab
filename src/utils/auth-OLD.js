import bcrypt from 'bcryptjs'

const SESSION_KEY = 'notretab_user'
const SALT_ROUNDS = 10

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function setSession(user) {
  const { password, ...safe } = user
  localStorage.setItem(SESSION_KEY, JSON.stringify(safe))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

/** Hache un mot de passe avec bcrypt. */
export function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Vérifie un mot de passe contre son hash bcrypt.
 * Supporte le fallback pour les anciens comptes démo en texte clair
 * (détectés à l'absence du préfixe $2b$) — migration transparente.
 */
export function verifyPassword(password, stored) {
  if (!stored) return Promise.resolve(false)
  // Ancien compte en texte clair (avant migration)
  if (!stored.startsWith('$2')) return Promise.resolve(stored === password)
  return bcrypt.compare(password, stored)
}

/** Indique si un hash doit être migré (texte clair détecté). */
export function isLegacyPassword(stored) {
  return Boolean(stored) && !stored.startsWith('$2')
}
