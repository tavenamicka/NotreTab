import React, { useState, useEffect, useMemo } from 'react'
import { api } from '../utils/api'
import { useToast } from '../utils/ToastContext'
import { CATEGORIES } from '../utils/balance'

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const QUARTERS = ['T1', 'T2', 'T3', 'T4']

const BAR_COLORS = {
  restaurant: '#1D9E75', logement: '#D97706', transport: '#2563EB',
  activite: '#7C3AED', courses: '#059669', autre: '#6B7280',
}

const THEMES_MAP = {
  travel:  { emoji: '✈️', label: 'Voyage' },
  event:   { emoji: '🎉', label: 'Événement' },
  project: { emoji: '💼', label: 'Projet' },
  home:    { emoji: '🏠', label: 'Maison' },
  sport:   { emoji: '🏃', label: 'Sport' },
  other:   { emoji: '🏷', label: 'Autre' },
}
const PERIODS_MAP = {
  year:    { emoji: '📅', label: 'Annuel' },
  quarter: { emoji: '📆', label: 'Trimestriel' },
  month:   { emoji: '🗒', label: 'Mensuel' },
}

function NavBtn({ disabled, onClick, label }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 'var(--radius)', fontFamily: 'inherit',
      border: '0.5px solid var(--border-hover)', background: 'transparent',
      cursor: disabled ? 'default' : 'pointer', fontSize: 14,
      color: disabled ? 'var(--text-tertiary)' : 'var(--text)',
      opacity: disabled ? 0.35 : 1,
    }}>{label}</button>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '10px', marginTop: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </div>
  )
}

function matchMonthIdx(name) {
  const n = name.toLowerCase().trim()
  return MONTHS.findIndex(m => {
    const ml = m.toLowerCase()
    return n === ml || n.startsWith(ml.slice(0, 4)) || ml.startsWith(n.slice(0, 4))
  })
}

function matchQuarterIdx(name) {
  const n = name.toLowerCase().trim()
  if (/^(t1|q1|trimestre\s*1|1er?\s*trimestre)/.test(n)) return 0
  if (/^(t2|q2|trimestre\s*2|2[eè]me?\s*trimestre)/.test(n)) return 1
  if (/^(t3|q3|trimestre\s*3|3[eè]me?\s*trimestre)/.test(n)) return 2
  if (/^(t4|q4|trimestre\s*4|4[eè]me?\s*trimestre)/.test(n)) return 3
  return -1
}

export default function BudgetDashboard({ budgetGroup, subGroups, budgetGroups, onSelectGroup }) {
  const toast = useToast()
  const [monthData, setMonthData] = useState({})
  const [loading, setLoading] = useState(true)

  const mode   = budgetGroup.budgetMode   || 'temporal'
  const period = budgetGroup.budgetPeriod || 'year'
  const theme  = budgetGroup.budgetTheme  || null

  const subGroupIds = useMemo(() => subGroups.map(s => s.id).join(','), [subGroups])

  useEffect(() => {
    if (!subGroups.length) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    Promise.all(
      subGroups.map(sg => api.getExpensesByGroup(sg.id).then(exps => ({ id: sg.id, exps })))
    ).then(results => {
      if (cancelled) return
      const data = {}
      results.forEach(({ id, exps }) => {
        const total = exps.reduce((s, e) => s + e.amount, 0)
        const cats = {}
        exps.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount })
        data[id] = { total, cats, count: exps.length }
      })
      setMonthData(data)
    }).catch(() => {
      if (!cancelled) toast.error('Impossible de charger les données du budget.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [budgetGroup.id, subGroupIds])

  // Year navigation — sort budget groups by name
  const sorted = [...budgetGroups].sort((a, b) => a.name.localeCompare(b.name))
  const yearIdx = sorted.findIndex(g => g.id === budgetGroup.id)
  const prevYear = yearIdx > 0 ? sorted[yearIdx - 1] : null
  const nextYear = yearIdx < sorted.length - 1 ? sorted[yearIdx + 1] : null

  // Map sub-groups to months or quarters
  const monthMap = {}
  const quarterMap = {}
  const unmatchedSubs = []
  subGroups.forEach(sg => {
    if (mode === 'temporal' && period === 'quarter') {
      const idx = matchQuarterIdx(sg.name)
      if (idx !== -1) quarterMap[idx] = sg
      else unmatchedSubs.push(sg)
    } else {
      const idx = matchMonthIdx(sg.name)
      if (idx !== -1) monthMap[idx] = sg
      else unmatchedSubs.push(sg)
    }
  })

  // Aggregates
  const yearTotal = Object.values(monthData).reduce((s, d) => s + d.total, 0)
  const yearCats = {}
  Object.values(monthData).forEach(({ cats }) => {
    Object.entries(cats).forEach(([cat, amt]) => {
      yearCats[cat] = (yearCats[cat] || 0) + amt
    })
  })
  const topCats = Object.entries(yearCats).sort((a, b) => b[1] - a[1])


  return (
    <div style={{ paddingBottom: 40 }}>

      {/* Year navigation header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '14px 18px', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <NavBtn disabled={!prevYear} onClick={() => prevYear && onSelectGroup(prevYear)} label="◄" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{budgetGroup.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
            {mode === 'thematic' && theme && THEMES_MAP[theme] && (
              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'var(--green-light)', color: 'var(--green-dark)', fontWeight: 500 }}>
                {THEMES_MAP[theme].emoji} {THEMES_MAP[theme].label}
              </span>
            )}
            {mode === 'temporal' && PERIODS_MAP[period] && (
              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'var(--green-light)', color: 'var(--green-dark)', fontWeight: 500 }}>
                {PERIODS_MAP[period].emoji} {PERIODS_MAP[period].label}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {loading ? 'Chargement…' : `${yearTotal.toFixed(2)} € · ${Object.values(monthData).reduce((s, d) => s + d.count, 0)} dépenses`}
          </div>
        </div>
        <NavBtn disabled={!nextYear} onClick={() => nextYear && onSelectGroup(nextYear)} label="►" />
      </div>

      {/* 12-month grid — temporal/year only */}
      {mode === 'temporal' && period === 'year' && (
        <>
          <SectionTitle>Vue annuelle — cliquez sur un mois pour y accéder</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {MONTHS.map((month, idx) => {
              const sg = monthMap[idx]
              const data = sg ? monthData[sg.id] : null
              return (
                <div key={idx}
                  onClick={() => sg && onSelectGroup(sg)}
                  onMouseEnter={e => { if (sg) e.currentTarget.style.borderColor = 'var(--green)' }}
                  onMouseLeave={e => { if (sg) e.currentTarget.style.borderColor = 'var(--border)' }}
                  style={{
                    padding: '12px 8px', borderRadius: 'var(--radius)', textAlign: 'center',
                    border: sg ? '0.5px solid var(--border)' : '0.5px dashed var(--border)',
                    background: sg ? 'var(--bg)' : 'transparent',
                    cursor: sg ? 'pointer' : 'default',
                    opacity: sg ? 1 : 0.4,
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                    {month.slice(0, 3)}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: data?.total > 0 ? 'var(--text)' : 'var(--text-tertiary)' }}>
                    {loading ? '…' : data ? `${data.total.toFixed(0)} €` : '—'}
                  </div>
                  {data?.count > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {data.count} dép.
                    </div>
                  )}
                  {sg && (
                    <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4, fontWeight: 500 }}>
                      {sg.name}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Quarter grid — temporal/quarter only */}
      {mode === 'temporal' && period === 'quarter' && (
        <>
          <SectionTitle>Vue trimestrielle — cliquez sur un trimestre pour y accéder</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {QUARTERS.map((q, idx) => {
              const sg = quarterMap[idx]
              const data = sg ? monthData[sg.id] : null
              return (
                <div key={idx}
                  onClick={() => sg && onSelectGroup(sg)}
                  onMouseEnter={e => { if (sg) e.currentTarget.style.borderColor = 'var(--green)' }}
                  onMouseLeave={e => { if (sg) e.currentTarget.style.borderColor = 'var(--border)' }}
                  style={{
                    padding: '18px 8px', borderRadius: 'var(--radius)', textAlign: 'center',
                    border: sg ? '0.5px solid var(--border)' : '0.5px dashed var(--border)',
                    background: sg ? 'var(--bg)' : 'transparent',
                    cursor: sg ? 'pointer' : 'default',
                    opacity: sg ? 1 : 0.4,
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 6 }}>
                    {q}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: data?.total > 0 ? 'var(--text)' : 'var(--text-tertiary)' }}>
                    {loading ? '…' : data ? `${data.total.toFixed(0)} €` : '—'}
                  </div>
                  {data?.count > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {data.count} dép.
                    </div>
                  )}
                  {sg && (
                    <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 6, fontWeight: 500 }}>
                      {sg.name}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Sub-groups — label adapts to budget mode */}
      {unmatchedSubs.length > 0 && (
        <>
          <SectionTitle>
            {mode === 'thematic' ? 'Sous-thèmes' :
             mode === 'temporal' && period === 'month' ? 'Sous-groupes' :
             'Autres périodes'}
          </SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {unmatchedSubs.map(sg => {
              const data = monthData[sg.id]
              return (
                <div key={sg.id} onClick={() => onSelectGroup(sg)}
                  style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: sg.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{sg.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {loading ? '…' : data ? `${data.total.toFixed(2)} €` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Category breakdown */}
      {topCats.length > 0 && (
        <>
          <SectionTitle>Répartition annuelle par catégorie</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topCats.map(([cat, amt]) => {
              const catDef = CATEGORIES[cat] || CATEGORIES.autre
              const pct = yearTotal > 0 ? (amt / yearTotal) * 100 : 0
              const barColor = BAR_COLORS[cat] || BAR_COLORS.autre
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span>{catDef.emoji} {catDef.label}</span>
                    <span style={{ fontWeight: 500 }}>
                      {amt.toFixed(2)} €
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && subGroups.length === 0 && (
        <div style={{ marginTop: 24, padding: '40px 24px', textAlign: 'center', border: '0.5px dashed var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>
            {mode === 'thematic' && theme ? THEMES_MAP[theme]?.emoji : '📊'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
            {mode === 'thematic' ? 'Aucun sous-thème défini' : 'Aucune période définie'}
          </div>
          <div style={{ fontSize: 13 }}>
            {mode === 'temporal' && period === 'year' && 'Créez des sous-groupes (ex : "Janvier", "Février") pour suivre votre budget mois par mois.'}
            {mode === 'temporal' && period === 'quarter' && 'Créez des sous-groupes (ex : "T1", "T2") pour suivre votre budget par trimestre.'}
            {mode === 'temporal' && period === 'month' && 'Créez des sous-groupes pour ventiler vos dépenses (ex : par semaine ou catégorie).'}
            {mode === 'thematic' && 'Créez des sous-groupes pour organiser vos dépenses par sous-thème.'}
          </div>
        </div>
      )}
    </div>
  )
}
