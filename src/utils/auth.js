// src/utils/auth.js
// Session côté navigateur. Depuis le sprint S4, ce fichier ne contient plus
// aucune logique cryptographique : le mot de passe est comparé et haché par le
// serveur (server/auth.cjs). bcryptjs a disparu du bundle, et avec lui la
// nécessité pour l'API de livrer un hash.

import { api, clearLegacyToken } from './api'
import { generateShareId } from './shareId'

const SESSION_KEY = 'notretab_user'

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function setSession(user) {
  const { password, ...safe } = user || {}
  localStorage.setItem(SESSION_KEY, JSON.stringify(safe))
}

/**
 * Efface la session locale. Le cookie d'authentification étant HttpOnly, il ne
 * peut pas être supprimé ici — d'où l'appel serveur, volontairement non
 * bloquant : hors ligne, on veut quand même sortir de l'application.
 */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  clearLegacyToken()
  api.logout().catch(() => {})
}

export async function login(email, password) {
  const { user } = await api.login(email, password)
  clearLegacyToken() // le cookie prend le relais
  return user
}

export async function register(email, password, meta) {
  const initials = meta.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const { user } = await api.register({
    email,
    password,
    name: meta.name,
    initials,
    color: meta.color,
    textColor: meta.textColor,
  })
  clearLegacyToken()
  return user
}

export function updatePassword(currentPassword, newPassword) {
  return api.changePassword(currentPassword, newPassword)
}

/**
 * Tire un identifiant de partage libre.
 * L'espace est de 31^8 (~8.5e11) : la collision est improbable, mais la vérifier
 * coûte une requête et évite deux comptes indiscernables à l'ajout manuel.
 *
 * Note : à l'inscription, c'est le serveur qui alloue l'identifiant — le client
 * n'a pas encore de jeton et ne peut donc pas sonder /users. Cette fonction ne
 * sert plus qu'au rattrapage des comptes antérieurs (ensureShareId), appelé une
 * fois connecté.
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
