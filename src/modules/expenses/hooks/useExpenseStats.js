import { useMemo } from 'react'
import { computeMyShare } from '../../../utils/balance'

const empty = {
  totalByMonth: {},
  totalByCategory: {},
  myShareTotal: 0,
  avgPerExpense: 0,
  topPayer: null,
  grandTotal: 0,
}

export function computeExpenseStats(expenses, members, currentMemberId) {
  if (!expenses || expenses.length === 0) return { ...empty }

  const totalByMonth = expenses.reduce((acc, exp) => {
    const key = exp.month || exp.date?.slice(0, 7) || 'unknown'
    acc[key] = (acc[key] || 0) + exp.amount
    return acc
  }, {})

  const totalByCategory = expenses.reduce((acc, exp) => {
    const cat = exp.category || 'autre'
    acc[cat] = (acc[cat] || 0) + exp.amount
    return acc
  }, {})

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0)
  const avgPerExpense = grandTotal / expenses.length

  let myShareTotal = 0
  if (currentMemberId) {
    expenses.forEach(exp => {
      const share = computeMyShare(exp, currentMemberId)
      if (share !== null) myShareTotal += share
    })
  }

  const payerTotals = expenses.reduce((acc, exp) => {
    const pid = String(exp.paidById)
    acc[pid] = (acc[pid] || 0) + exp.amount
    return acc
  }, {})

  let topPayer = null
  let topAmount = 0
  Object.entries(payerTotals).forEach(([mid, total]) => {
    if (total > topAmount) {
      topAmount = total
      const member = members?.find(m => String(m.id) === mid)
      topPayer = { memberId: mid, name: member?.name || '?', total }
    }
  })

  return { totalByMonth, totalByCategory, myShareTotal, avgPerExpense, topPayer, grandTotal }
}

export function useExpenseStats(expenses, members, currentMemberId) {
  return useMemo(
    () => computeExpenseStats(expenses, members, currentMemberId),
    [expenses, members, currentMemberId]
  )
}
