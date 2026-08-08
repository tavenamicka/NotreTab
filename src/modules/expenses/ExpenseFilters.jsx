import React from 'react'
import { CATEGORIES } from '../../utils/balance'
import { formatMonth } from '../../utils/format'

export default function ExpenseFilters({ filter, setFilter, availableMonths }) {
  const monthIdx = filter.month ? availableMonths.indexOf(filter.month) : -1
  const canPrev = monthIdx < availableMonths.length - 1
  const canNext = monthIdx > 0

  const navMonth = (dir) => {
    if (dir === -1 && canPrev) setFilter(f => ({ ...f, month: availableMonths[monthIdx + 1] }))
    if (dir === +1 && canNext) setFilter(f => ({ ...f, month: availableMonths[monthIdx - 1] }))
  }

  const setMonth = (m) => setFilter(f => ({ ...f, month: m }))
  const toggleCat = (key) => setFilter(f => ({ ...f, category: f.category === key ? null : key }))
  const clearAll = () => setFilter({ month: null, year: null, category: null, search: '' })
  const hasFilter = !!(filter.month || filter.category || filter.search)

  const navBtn = (onClick, disabled, label) => (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      padding: '5px 9px', background: 'transparent', border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      color: disabled ? 'var(--text-tertiary)' : 'var(--text)',
      fontFamily: 'inherit', fontSize: '12px', lineHeight: 1,
    }}>
      {label}
    </button>
  )

  const chip = (active, onClick, label) => (
    <button type="button" onClick={onClick} style={{
      padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
      border: `0.5px solid ${active ? 'var(--green)' : 'var(--border-hover)'}`,
      background: active ? 'var(--green-light)' : 'transparent',
      color: active ? 'var(--green-dark)' : 'var(--text-secondary)',
      fontSize: '11px', fontFamily: 'inherit', transition: 'all 0.15s',
    }}>
      {label}
    </button>
  )

  return (
    <div style={{ marginBottom: '14px' }}>
      {/* Ligne 1 : navigation mois + recherche */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {navBtn(() => navMonth(-1), !filter.month || !canPrev, '◄')}
          <div
            onClick={() => filter.month && setMonth(null)}
            style={{
              fontSize: '12px', fontWeight: 500, minWidth: '110px', textAlign: 'center',
              padding: '5px 4px', cursor: filter.month ? 'pointer' : 'default',
              color: filter.month ? 'var(--text)' : 'var(--text-tertiary)',
            }}
            title={filter.month ? 'Cliquer pour voir tout' : ''}
          >
            {filter.month ? formatMonth(filter.month) : 'Tout'}
          </div>
          {navBtn(() => navMonth(+1), !filter.month || !canNext, '►')}
        </div>

        {/* Accès rapide aux mois disponibles */}
        {availableMonths.length > 0 && !filter.month && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {availableMonths.slice(0, 4).map(m => (
              <button key={m} type="button" onClick={() => setMonth(m)} style={{
                padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                border: '0.5px solid var(--border-hover)', background: 'transparent',
                color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'inherit', transition: 'all 0.15s',
              }}>
                {formatMonth(m).split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {hasFilter && (
          <button type="button" onClick={clearAll} style={{
            marginLeft: 'auto', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
            border: '0.5px solid var(--border-hover)', background: 'transparent',
            color: 'var(--text-tertiary)', fontSize: '11px', fontFamily: 'inherit',
          }}>
            Effacer ✕
          </button>
        )}

        <input
          value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          placeholder="Rechercher…"
          style={{
            padding: '5px 10px', border: '0.5px solid var(--border-hover)',
            borderRadius: 'var(--radius)', fontSize: '12px',
            background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit',
            marginLeft: hasFilter ? 0 : 'auto', width: '140px',
          }}
        />
      </div>

      {/* Ligne 2 : catégories */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button key={key} type="button" onClick={() => toggleCat(key)} style={{
            padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
            border: `0.5px solid ${filter.category === key ? 'var(--green)' : 'var(--border-hover)'}`,
            background: filter.category === key ? 'var(--green-light)' : 'transparent',
            color: filter.category === key ? 'var(--green-dark)' : 'var(--text-secondary)',
            fontSize: '11px', fontFamily: 'inherit', transition: 'all 0.15s',
          }}>
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>
    </div>
  )
}
