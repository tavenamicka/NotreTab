const BASE = '/api'
const TIMEOUT_MS = 10_000

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
  // Auth (simulated via users table)
  getUsers: () => req('/users'),
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

  // Bulk fetches — pour Dashboard (évite N+1)
  getAllMembers:  () => req('/members'),
  getAllExpenses: () => req('/expenses?_sort=date&_order=desc'),
  getAllPayments: () => req('/payments?_sort=createdAt&_order=desc'),

  // Expenses — filtrage temporel
  getExpensesByMonth: (groupId, month) =>
    req(`/expenses?groupId=${groupId}&month=${month}&_sort=date&_order=desc`),
  getExpensesByYear: (groupId, year) =>
    req(`/expenses?groupId=${groupId}&year=${year}&_sort=date&_order=desc`),
  getExpensesByRange: (groupId, from, to) =>
    req(`/expenses?groupId=${groupId}&date_gte=${from}&date_lte=${to}&_sort=date&_order=desc`),

  // Guests (membres sans compte)
  // userId omis intentionnellement — json-server crashe sur userId:null dans getRemovable()
  getGuestsByGroup: (groupId) => req(`/members?groupId=${groupId}&isGuest=true`),
  addGuest: ({ userId: _ignored, invitedByUserId: _ignored2, ...data }) =>
    req('/members', { method: 'POST', body: { ...data, isGuest: true, role: 'guest' } }),
}
