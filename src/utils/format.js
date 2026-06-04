const LOCALE = 'fr-FR'

// "15 mai 2026 · 14:30"
export function formatDateTime(iso) {
  const d = new Date(iso)
  return (
    d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
  )
}

// "15/05/2026"
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(LOCALE)
}

// "Mai 2026" (première lettre majuscule)
export function formatMonth(yyyyMM) {
  const [year, month] = yyyyMM.split('-')
  const label = new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
