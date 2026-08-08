import bcrypt from 'bcryptjs'
import { api } from './api'
import { generateShareId } from './shareId'

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

export function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export function verifyPassword(password, stored) {
  if (!stored) return Promise.resolve(false)
  // Fallback pour anciens comptes démo en texte clair (avant bcrypt)
  if (!stored.startsWith('$2')) return Promise.resolve(stored === password)
  return bcrypt.compare(password, stored)
}

export function isLegacyPassword(stored) {
  return Boolean(stored) && !stored.startsWith('$2')
}

export async function login(email, password) {
  const users = await api.getUserByEmail(email)
  if (!users.length) throw new Error('Email ou mot de passe incorrect.')
  const user = users[0]
  const valid = await verifyPassword(password, user.password)
  if (!valid) throw new Error('Email ou mot de passe incorrect.')
  return user
}

/**
 * Tire un identifiant de partage libre.
 * L'espace est de 31^8 (~8.5e11) : la collision est improbable, mais la vérifier
 * coûte une requête et évite deux comptes indiscernables à l'ajout manuel.
 */
export async function allocateShareId(maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateShareId()
    const taken = await api.findUserByShareId(candidate)
    if (!taken) return candidate
  }
  throw new Error("Impossible de générer un identifiant de partage.")
}

/**
 * Backfill pour les comptes créés avant le modèle de visibilité : leur pose un
 * identifiant de partage et les marque explicitement comme non visibles.
 * @returns {Promise<object|null>} les champs ajoutés, ou null s'il n'y avait rien à faire
 */
export async function ensureShareId(user) {
  if (!user || (user.shareId && typeof user.discoverable === 'boolean')) return null
  const updates = {}
  if (!user.shareId) updates.shareId = await allocateShareId()
  if (typeof user.discoverable !== 'boolean') updates.discoverable = false
  await api.updateUser(user.id, updates)
  return updates
}

export async function register(email, password, meta) {
  const existing = await api.getUserByEmail(email)
  if (existing.length > 0) throw new Error('Un compte avec cet email existe déjà.')
  const hash = await hashPassword(password)
  const initials = meta.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return api.createUser({
    email,
    password: hash,
    name: meta.name,
    initials,
    color: meta.color,
    textColor: meta.textColor,
    shareId: await allocateShareId(),
    discoverable: false,     // privé par défaut — à activer depuis le profil
    createdAt: new Date().toISOString(),
  })
}

export async function updatePassword(userId, newPassword) {
  const hash = await hashPassword(newPassword)
  return api.updateUser(userId, { password: hash })
}
