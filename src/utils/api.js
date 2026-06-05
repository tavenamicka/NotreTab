import { supabase } from './supabase'

export const api = {
  // Groups
  getGroups: async () => {
    const { data, error } = await supabase.from('groups').select('*')
    if (error) throw new Error(error.message)
    return data
  },
  getGroup: async (id) => {
    const { data, error } = await supabase.from('groups').select('*').eq('id', id).single()
    if (error) throw new Error(error.message)
    return data
  },
  createGroup: async (body) => {
    const { data, error } = await supabase.from('groups').insert(body).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  updateGroup: async (id, body) => {
    const { data, error } = await supabase.from('groups').update(body).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  deleteGroup: async (id) => {
    const { error } = await supabase.from('groups').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return null
  },

  // Members
  getMembersByGroup: async (groupId) => {
    const { data, error } = await supabase.from('members').select('*').eq('groupId', groupId)
    if (error) throw new Error(error.message)
    return data
  },
  getMembersByUser: async (userId) => {
    const { data, error } = await supabase.from('members').select('*').eq('userId', userId)
    if (error) throw new Error(error.message)
    return data
  },
  addMember: async (body) => {
    const safe = { ...body }
    if (safe.userId == null) delete safe.userId
    if (safe.invitedByUserId == null) delete safe.invitedByUserId
    const { data, error } = await supabase.from('members').insert(safe).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  updateMember: async (id, body) => {
    const { data, error } = await supabase.from('members').update(body).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  deleteMember: async (id) => {
    const { error } = await supabase.from('members').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return null
  },

  // Expenses
  getExpensesByGroup: async (groupId) => {
    const { data, error } = await supabase.from('expenses').select('*')
      .eq('groupId', groupId).order('date', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  },
  createExpense: async (body) => {
    const { data, error } = await supabase.from('expenses').insert(body).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  updateExpense: async (id, body) => {
    const { data, error } = await supabase.from('expenses').update(body).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  deleteExpense: async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return null
  },

  // Payments
  getPaymentsByGroup: async (groupId) => {
    const { data, error } = await supabase.from('payments').select('*')
      .eq('groupId', groupId).order('createdAt', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  },
  createPayment: async (body) => {
    const { data, error } = await supabase.from('payments').insert(body).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  deletePayment: async (id) => {
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return null
  },

  // Reminders
  getRemindersByGroup: async (groupId) => {
    const { data, error } = await supabase.from('reminders').select('*').eq('groupId', groupId)
    if (error) throw new Error(error.message)
    return data
  },
  createReminder: async (body) => {
    const { data, error } = await supabase.from('reminders').insert(body).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  updateReminder: async (id, body) => {
    const { data, error } = await supabase.from('reminders').update(body).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data
  },

  // Bulk (Dashboard)
  getAllMembers: async () => {
    const { data, error } = await supabase.from('members').select('*')
    if (error) throw new Error(error.message)
    return data
  },
  getAllExpenses: async () => {
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  },
  getAllPayments: async () => {
    const { data, error } = await supabase.from('payments').select('*').order('createdAt', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  },

  // Filtrage temporel
  getExpensesByMonth: async (groupId, month) => {
    const { data, error } = await supabase.from('expenses').select('*')
      .eq('groupId', groupId).eq('month', month).order('date', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  },
  getExpensesByYear: async (groupId, year) => {
    const { data, error } = await supabase.from('expenses').select('*')
      .eq('groupId', groupId).eq('year', year).order('date', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  },
  getExpensesByRange: async (groupId, from, to) => {
    const { data, error } = await supabase.from('expenses').select('*')
      .eq('groupId', groupId).gte('date', from).lte('date', to).order('date', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  },

  // Users / Profiles
  getUserByEmail: async (email) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('email', email)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  // Guests
  getGuestsByGroup: async (groupId) => {
    const { data, error } = await supabase.from('members').select('*')
      .eq('groupId', groupId).eq('isGuest', true)
    if (error) throw new Error(error.message)
    return data
  },
  addGuest: async ({ userId: _a, invitedByUserId: _b, ...body }) => {
    const { data, error } = await supabase.from('members')
      .insert({ ...body, isGuest: true, role: 'guest' }).select().single()
    if (error) throw new Error(error.message)
    return data
  },
}