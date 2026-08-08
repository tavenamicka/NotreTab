import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../utils/api'
import { useToast } from '../utils/ToastContext'

export function useGroup(groupId) {
  const toast = useToast()
  const [members, setMembers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [payments, setPayments] = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const genRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!groupId) return
    const gen = ++genRef.current
    setLoading(true)
    try {
      const [m, e, p, r] = await Promise.allSettled([
        api.getMembersByGroup(groupId),
        api.getExpensesByGroup(groupId),
        api.getPaymentsByGroup(groupId),
        api.getRemindersByGroup(groupId),
      ])
      if (gen !== genRef.current) return
      if (m.status === 'fulfilled') setMembers(m.value)
      if (e.status === 'fulfilled') setExpenses(e.value)
      if (p.status === 'fulfilled') setPayments(p.value)
      if (r.status === 'fulfilled') setReminders(r.value)
    } finally {
      if (gen === genRef.current) setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    refresh()
    return () => { genRef.current++ }
  }, [refresh])

  return { members, expenses, payments, reminders, loading, refresh }
}
