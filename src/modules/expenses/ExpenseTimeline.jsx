import React from 'react'
import Avatar from '../../components/Avatar'
import Badge from '../../components/Badge'
import Btn from '../../components/Btn'
import GuestBadge from '../../components/GuestBadge'
import { CATEGORIES, computeMyShare } from '../../utils/balance'
import { formatMonth } from '../../utils/format'

export default function ExpenseTimeline({ byMonth, members, myMemberId, isAdmin, onEdit, onDelete }) {
  const getMember = (id) => members.find(m => String(m.id) === String(id))
  const myId = String(myMemberId)
  const sortedMonths = Object.keys(byMonth).sort().reverse()

  if (sortedMonths.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)', border: '0.5px dashed var(--border)', borderRadius: 'var(--radius)' }}>
        Aucune dépense trouvée
      </div>
    )
  }

  return (
    <div>
      {sortedMonths.map(month => {
        const exps = byMonth[month]
        const monthTotal = exps.reduce((s, e) => s + e.amount, 0)

        return (
          <div key={month} style={{ marginBottom: '24px' }}>
            {/* En-tête de mois */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '6px', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {formatMonth(month)}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                {monthTotal.toFixed(2)} €
              </div>
            </div>

            {/* Lignes de dépenses */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {exps.map(exp => {
                const payer = getMember(exp.paidById)
                const cat = CATEGORIES[exp.category] || CATEGORIES.autre
                const splitIds = exp.splitBetween.map(String)
                const isMine = myMemberId ? splitIds.includes(myId) : false
                const isPayer = String(exp.paidById) === myId
                const shareVal = computeMyShare(exp, myMemberId)
                const share = shareVal !== null ? shareVal.toFixed(2) : null
                const canAct = isAdmin || isPayer

                return (
                  <div key={exp.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px',
                    background: isMine && !isPayer ? 'var(--red-light)' : 'var(--bg)',
                    border: `0.5px solid ${isMine && !isPayer ? 'var(--red)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                  }}>
                    {/* Icône catégorie */}
                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {cat.emoji}
                    </div>

                    {/* Infos */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {exp.description}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <Avatar initials={payer?.initials} color={payer?.color} textColor={payer?.textColor} size={14} />
                        {payer?.name || '?'}
                        {payer?.isGuest && <GuestBadge />}
                        <span>· {exp.date}</span>
                        {exp.note && (
                          <span title={exp.note} style={{ cursor: 'help' }}>· 📝</span>
                        )}
                      </div>
                    </div>

                    {/* Montant + ma part */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500 }}>{exp.amount.toFixed(2)} €</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {share !== null ? `Ma part : ${share} €` : 'Non concerné'}
                      </div>
                    </div>

                    {/* Badge statut */}
                    {isMine && !isPayer
                      ? <Badge variant="danger">À payer</Badge>
                      : isPayer
                      ? <Badge variant="info">Payeur</Badge>
                      : <Badge variant="neutral">—</Badge>
                    }

                    {/* Actions */}
                    {canAct && (
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <Btn style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => onEdit(exp)} title="Modifier">
                          ✏️
                        </Btn>
                        <Btn style={{ padding: '4px 8px', fontSize: '14px' }} onClick={() => onDelete(exp)} title="Supprimer">
                          ✕
                        </Btn>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
