import React from 'react'
import { CATEGORIES } from '../../utils/balance'

const BAR_COLORS = {
  restaurant: '#1D9E75',
  logement:   '#D97706',
  transport:  '#2563EB',
  activite:   '#7C3AED',
  courses:    '#059669',
  autre:      '#6B7280',
}

export default function ExpenseSummary({ stats, myBalance }) {
  const { grandTotal, avgPerExpense, topPayer, totalByCategory } = stats

  const card = (label, value, sub, color) => (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: 600, color: color || 'var(--text)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
        {card('Total dépensé', `${grandTotal.toFixed(0)} €`)}
        {card(
          'Mon solde',
          `${myBalance >= 0 ? '+' : ''}${myBalance.toFixed(0)} €`,
          null,
          myBalance >= 0 ? 'var(--green)' : 'var(--red)'
        )}
        {card(
          'Moy. / dépense',
          grandTotal > 0 ? `${avgPerExpense.toFixed(0)} €` : '—',
          topPayer ? `Top payeur : ${topPayer.name}` : null
        )}
      </div>

      {grandTotal > 0 && Object.keys(totalByCategory).length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: '4px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Répartition par catégorie
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(totalByCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([key, amount]) => {
                const cat = CATEGORIES[key] || CATEGORIES.autre
                const pct = (amount / grandTotal) * 100
                const barColor = BAR_COLORS[key] || BAR_COLORS.autre
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span>{cat.emoji} {cat.label}</span>
                      <span>
                        <span style={{ fontWeight: 500 }}>{amount.toFixed(0)} €</span>
                        <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                      <div style={{ height: 4, background: barColor, borderRadius: 2, width: `${pct}%`, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
