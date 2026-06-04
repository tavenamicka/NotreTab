import React from 'react'
import { CATEGORIES } from '../utils/balance'
import { formatDateTime } from '../utils/format'

export default function History({ expenses, payments, members }) {
  const getMember = id => members.find(m => String(m.id) === String(id))

  const events = [
    ...expenses.map(e => ({ type: 'expense', date: e.createdAt, data: e })),
    ...payments.map(p => ({ type: 'payment', date: p.createdAt, data: p })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  const fmt = formatDateTime

  return (
    <div>
      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Historique des transactions
      </div>
      {events.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', border: '0.5px dashed var(--border)', borderRadius: 'var(--radius)' }}>
          Aucune transaction pour l'instant.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {events.map((ev, i) => {
          if (ev.type === 'expense') {
            const e = ev.data
            const cat = CATEGORIES[e.category] || CATEGORIES.autre
            const payer = getMember(e.paidById)
            return (
              <div key={`exp-${e.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--text)' }}>
                    {cat.emoji} Dépense ajoutée : <strong>{e.description}</strong>
                    {payer && <span style={{ color: 'var(--text-secondary)' }}> par {payer.name}</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{fmt(ev.date)}</div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{e.amount.toFixed(2)} €</div>
              </div>
            )
          } else {
            const p = ev.data
            const from = getMember(p.fromId)
            const to = getMember(p.toId)
            return (
              <div key={`pay-${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--text)' }}>
                    💸 <strong>{from?.name || '?'}</strong> a remboursé <strong>{to?.name || '?'}</strong>
                    {p.note && <span style={{ color: 'var(--text-secondary)' }}> — {p.note}</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{fmt(ev.date)}</div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--green)' }}>+ {p.amount.toFixed(2)} €</div>
              </div>
            )
          }
        })}
      </div>
    </div>
  )
}
