/**
 * Compute per-member balances for a group.
 * Returns { memberId: number } — positive = owed money, negative = owes money
 */
export function computeBalances(expenses, payments, members) {
  const bal = {}
  members.forEach(m => bal[String(m.id)] = 0)

  expenses.forEach(exp => {
    const splitIds = (exp.splitBetween ?? []).map(String)
    const payerId = String(exp.paidById)
    if (bal[payerId] !== undefined) bal[payerId] += exp.amount

    if (exp.splitMode === 'custom' && exp.customShares && Object.keys(exp.customShares).length > 0) {
      splitIds.forEach(mid => {
        const pct = parseFloat(exp.customShares[mid] || 0) / 100
        if (bal[mid] !== undefined) bal[mid] -= exp.amount * pct
      })
    } else if (exp.splitMode === 'amounts' && exp.customAmounts && Object.keys(exp.customAmounts).length > 0) {
      splitIds.forEach(mid => {
        const amt = parseFloat(exp.customAmounts[mid] || 0)
        if (bal[mid] !== undefined) bal[mid] -= amt
      })
    } else {
      const share = exp.amount / splitIds.length
      splitIds.forEach(mid => {
        if (bal[mid] !== undefined) bal[mid] -= share
      })
    }
  })

  payments.forEach(pay => {
    const fromId = String(pay.fromId)
    const toId = String(pay.toId)
    if (bal[fromId] !== undefined) bal[fromId] += pay.amount
    if (bal[toId] !== undefined) bal[toId] -= pay.amount
  })

  return bal
}

/**
 * Simplify debts: returns array of { from, to, amount }
 */
export function simplifyDebts(balances) {
  const debtors = []
  const creditors = []

  Object.entries(balances).forEach(([id, bal]) => {
    if (bal < -0.01) debtors.push({ id: String(id), amount: -bal })
    else if (bal > 0.01) creditors.push({ id: String(id), amount: bal })
  })

  const transactions = []
  let i = 0, j = 0

  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]
    const c = creditors[j]
    const amount = Math.min(d.amount, c.amount)
    transactions.push({ from: d.id, to: c.id, amount: Math.round(amount * 100) / 100 })
    d.amount -= amount
    c.amount -= amount
    if (d.amount < 0.01) i++
    if (c.amount < 0.01) j++
  }

  return transactions
}

/**
 * Calcule la part d'un membre dans une dépense.
 * Retourne null si le membre n'est pas concerné.
 */
export function computeMyShare(exp, memberId) {
  if (!memberId) return null
  const mid = String(memberId)
  const splitIds = (exp.splitBetween ?? []).map(String)
  if (!splitIds.includes(mid)) return null
  if (exp.splitMode === 'custom' && exp.customShares?.[mid])
    return exp.amount * parseFloat(exp.customShares[mid]) / 100
  if (exp.splitMode === 'amounts' && exp.customAmounts?.[mid])
    return parseFloat(exp.customAmounts[mid])
  return exp.amount / splitIds.length
}

export const CATEGORIES = {
  restaurant: { label: 'Restaurant', emoji: '🍽️', bg: '#E1F5EE' },
  logement: { label: 'Logement', emoji: '🏨', bg: '#FAEEDA' },
  transport: { label: 'Transport', emoji: '✈️', bg: '#E6F1FB' },
  activite: { label: 'Activité', emoji: '🛥️', bg: '#E6F1FB' },
  courses: { label: 'Courses', emoji: '🛒', bg: '#E1F5EE' },
  autre: { label: 'Autre', emoji: '💳', bg: '#EEEDFE' },
}
