import { normalizeShareId } from './shareId'

const BASE = '/api'
const TIMEOUT_MS = 10_000

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
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    if (res.status === 204) return null
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  // Users
  // ⚠️ Pas de getUsers() : le listing global des comptes est volontairement absent
  // (voir le modèle de visibilité ci-dessous et server/privacy-middleware.cjs).

  // Réservé à l'authentification (login / vérification d'unicité à l'inscription).
  // Ne jamais l'utiliser comme canal de découverte : connaître l'email de quelqu'un
  // ne doit pas suffire à l'ajouter à un groupe.
  getUserByEmail: (email) => req(`/users?email=${encodeURIComponent(email)}`),
  createUser: (data) => req('/users', { method: 'POST', body: data }),
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
