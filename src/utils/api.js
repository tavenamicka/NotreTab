import { normalizeShareId } from './shareId'

const BASE = '/api'
const TIMEOUT_MS = 10_000
const LEGACY_TOKEN_KEY = 'notretab_token'

// ── Jeton d'authentification ─────────────────────────────────────────────────
// Depuis le sprint S6, le jeton vit dans un cookie HttpOnly posé par le serveur :
// le navigateur le joint tout seul, et le JavaScript de la page ne peut pas le
// lire. Il n'y a donc plus rien à stocker ici, ni rien à voler par XSS.
//
// Le seul reliquat est la clé localStorage d'avant S6 : on la relit pour ne pas
// couper les sessions déjà ouvertes, on ne l'écrit plus jamais, et elle est
// effacée à la première connexion ou déconnexion. À supprimer une fois passés
// les 30 jours de validité des anciens jetons.
function legacyToken() {
  try { return localStorage.getItem(LEGACY_TOKEN_KEY) } catch { return null }
}

export function clearLegacyToken() {
  try { localStorage.removeItem(LEGACY_TOKEN_KEY) } catch { /* stockage indisponible */ }
}

/** Levée sur 401 : le jeton est absent, expiré ou invalide. */
export class AuthError extends Error {
  constructor(message = 'Session expirée.') {
    super(message)
    this.name = 'AuthError'
  }
}

/** Ne laisse sortir d'un compte que ce qui peut être montré à un tiers. */
function toPublicProfile(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    initials: u.initials,
    color: u.color,
    textColor: u.textColor,
    shareId: u.shareId,
    discoverable: u.discoverable === true,
  }
}

async function req(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const { anonymous, ...rest } = options
  try {
    const legacy = anonymous ? null : legacyToken()
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        // Repli transitoire pour les sessions ouvertes avant S6. Le cas normal
        // n'envoie aucun en-tête : le cookie suffit.
        ...(legacy ? { Authorization: `Bearer ${legacy}` } : {}),
      },
      // Le cookie de session est HttpOnly et same-origin ; explicite plutôt que
      // de dépendre du défaut de fetch.
      credentials: 'same-origin',
      ...rest,
      body: rest.body ? JSON.stringify(rest.body) : undefined,
      signal: controller.signal,
    })

    if (res.status === 401) {
      // Session morte : effacer le reliquat évite que chaque écran retente en
      // boucle avec un jeton qu'on sait invalide.
      if (!anonymous) clearLegacyToken()
      throw new AuthError(await messageOf(res))
    }
    if (!res.ok) {
      const err = new Error(await messageOf(res) || `API error ${res.status}`)
      // Le statut permet à l'appelant de distinguer les cas qui méritent un
      // message spécifique (429 : compte verrouillé) de ceux qui doivent rester
      // volontairement vagues (401 : identifiants).
      err.status = res.status
      throw err
    }
    if (res.status === 204) return null
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Remonte le message d'erreur du serveur plutôt qu'un code HTTP nu. */
async function messageOf(res) {
  try {
    const body = await res.clone().json()
    return typeof body?.error === 'string' ? body.error : ''
  } catch { return '' }
}

export const api = {
  // ── Authentification (sprint S4) ───────────────────────────────────────────
  // Le mot de passe est comparé côté serveur. Le navigateur ne voit jamais de
  // hash bcrypt, et il n'existe plus aucune route qui en livre un.
  login: (email, password) =>
    req('/auth/login', { method: 'POST', body: { email, password }, anonymous: true }),
  register: (payload) =>
    req('/auth/register', { method: 'POST', body: payload, anonymous: true }),
  me: () => req('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    req('/auth/password', { method: 'POST', body: { currentPassword, newPassword } }),
  // Le cookie étant HttpOnly, seul le serveur peut l'effacer.
  logout: () => req('/auth/logout', { method: 'POST' }),

  // Users
  // ⚠️ Pas de getUsers() : le listing global des comptes est volontairement absent
  // (voir le modèle de visibilité ci-dessous et server/privacy-middleware.cjs).
  // ⚠️ Pas de getUserByEmail() non plus depuis S4 : la recherche par email n'est
  // plus un filtre autorisé, et l'authentification n'en a plus besoin.
  // ⚠️ Pas de createUser() : la création passe par /auth/register, seul endroit
  // où le mot de passe est haché.
  updateUser: (id, data) => req(`/users/${id}`, { method: 'PATCH', body: data }),
  deleteUser: (id) => req(`/users/${id}`, { method: 'DELETE' }),

  // Groups
  getGroups: () => req('/groups'),
  getGroup: (id) => req(`/groups/${id}`),
  createGroup: (data) => req('/groups', { method: 'POST', body: data }),
  updateGroup: (id, data) => req(`/groups/${id}`, { method: 'PATCH', body: data }),
  deleteGroup: (id) => req(`/groups/${id}`, { method: 'DELETE' }),

  // Members
  getMembersByGroup: (groupId) => req(`/members?groupId=${groupId}`),
  getMembersByUser: (userId) => req(`/members?userId=${userId}`),
  addMember: (data) => {
    const safe = { ...data }
    if (safe.userId == null) delete safe.userId
    if (safe.invitedByUserId == null) delete safe.invitedByUserId
    return req('/members', { method: 'POST', body: safe })
  },
  updateMember: (id, data) => req(`/members/${id}`, { method: 'PATCH', body: data }),
  deleteMember: (id) => req(`/members/${id}`, { method: 'DELETE' }),

  // Expenses
  getExpensesByGroup: (groupId) => req(`/expenses?groupId=${groupId}&_sort=date&_order=desc`),
  createExpense: (data) => req('/expenses', { method: 'POST', body: data }),
  updateExpense: (id, data) => req(`/expenses/${id}`, { method: 'PUT', body: data }),
  deleteExpense: (id) => req(`/expenses/${id}`, { method: 'DELETE' }),

  // Payments
  getPaymentsByGroup: (groupId) => req(`/payments?groupId=${groupId}&_sort=createdAt&_order=desc`),
  createPayment: (data) => req('/payments', { method: 'POST', body: data }),
  deletePayment: (id) => req(`/payments/${id}`, { method: 'DELETE' }),

  // Reminders
  getRemindersByGroup: (groupId) => req(`/reminders?groupId=${groupId}`),
  createReminder: (data) => req('/reminders', { method: 'POST', body: data }),
  updateReminder: (id, data) => req(`/reminders/${id}`, { method: 'PATCH', body: data }),

  // Bulk fetches — évite N+1 sur le Dashboard
  getAllMembers:  () => req('/members'),
  getAllExpenses: () => req('/expenses?_sort=date&_order=desc'),
  getAllPayments: () => req('/payments?_sort=createdAt&_order=desc'),

  // Filtrage temporel
  getExpensesByMonth: (groupId, month) =>
    req(`/expenses?groupId=${groupId}&month=${month}&_sort=date&_order=desc`),
  getExpensesByYear: (groupId, year) =>
    req(`/expenses?groupId=${groupId}&year=${year}&_sort=date&_order=desc`),
  getExpensesByRange: (groupId, from, to) =>
    req(`/expenses?groupId=${groupId}&date_gte=${from}&date_lte=${to}&_sort=date&_order=desc`),

  // Guests (userId omis — json-server crashe sur userId:null dans getRemovable)
  getGuestsByGroup: (groupId) => req(`/members?groupId=${groupId}&isGuest=true`),
  addGuest: ({ userId: _a, invitedByUserId: _b, ...data }) =>
    req('/members', { method: 'POST', body: { ...data, isGuest: true, role: 'guest' } }),

  // ── Modèle de visibilité ───────────────────────────────────────────────────
  // Un compte est privé par défaut (discoverable absent ou false) : il n'apparaît
  // dans aucune recherche. La seule façon de l'ajouter est son identifiant de
  // partage, qu'il communique lui-même. Activer "visible" dans le profil ouvre
  // en plus la recherche par nom / email.

  /**
   * Recherche un compte par son identifiant de partage exact (NT-XXXX-XXXX).
   * Fonctionne quel que soit le réglage de visibilité — c'est le principe :
   * l'identifiant n'est connu que si son propriétaire l'a donné.
   * @returns {Promise<object|null>} profil public, ou null si l'identifiant n'existe pas
   */
  findUserByShareId: async (shareId) => {
    const canonical = normalizeShareId(shareId)
    if (!canonical) return null
    const users = await req(`/users?shareId=${encodeURIComponent(canonical)}`)
    if (!users.length) return null
    return toPublicProfile(users[0])
  },

  /**
   * Recherche live par nom ou email — restreinte aux comptes ayant activé
   * la visibilité publique. Deux requêtes _like, dédoublonnage par id.
   */
  searchProfiles: async (query) => {
    const q = query.trim()
    if (q.length < 2) return []
    const encoded = encodeURIComponent(q)
    const [byName, byEmail] = await Promise.all([
      req(`/users?discoverable=true&name_like=${encoded}`),
      req(`/users?discoverable=true&email_like=${encoded}`),
    ])
    const seen = new Set()
    return [...byName, ...byEmail]
      .filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true })
      .filter(u => u.discoverable === true)   // ceinture + bretelles si l'API ne filtre pas
      .map(toPublicProfile)
      .slice(0, 8)
  },
}
