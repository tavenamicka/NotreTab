// Enrichit un payload avant envoi : calcule month et year depuis date
export function enrichExpensePayload(payload) {
  const date = payload.date || new Date().toISOString().split('T')[0]
  return {
    ...payload,
    date,
    month: date.slice(0, 7),
    year: Number(date.slice(0, 4)),
  }
}
