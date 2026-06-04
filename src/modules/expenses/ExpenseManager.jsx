import React, { useState, useMemo } from 'react'
import { computeBalances, simplifyDebts, CATEGORIES, computeMyShare } from '../../utils/balance'
import { useAuth } from '../../utils/AuthContext'
import { useToast } from '../../utils/ToastContext'
import { api } from '../../utils/api'
import Avatar from '../../components/Avatar'
import Btn from '../../components/Btn'
import PaymentModal from '../../components/PaymentModal'
import ExpenseWizard from '../../components/ExpenseWizard'
import ExpenseSummary from './ExpenseSummary'
import ExpenseFilters from './ExpenseFilters'
import ExpenseTimeline from './ExpenseTimeline'
import { useExpenseStats } from './hooks/useExpenseStats'

const initialFilter = { month: null, year: null, category: null, search: '' }

function useClientFilter(expenses) {
  const [filter, setFilter] = useState(initialFilter)

  const availableMonths = useMemo(() => {
    const set = new Set(expenses.map(e => e.month || e.date?.slice(0, 7)).filter(Boolean))
    return [...set].sort().reverse()
  }, [expenses])

  const filtered = useMemo(() => expenses.filter(exp => {
    if (filter.month) {
      const m = exp.month || exp.date?.slice(0, 7)
      if (m !== filter.month) return false
    }
    if (filter.year) {
      const y = exp.year || Number(exp.date?.slice(0, 4))
      if (y !== filter.year) return false
    }
    if (filter.category && exp.category !== filter.category) return false
    if (filter.search) {
      const q = filter.search.toLowerCase()
      if (!exp.description.toLowerCase().includes(q)) return false
    }
    return true
  }), [expenses, filter])

  const byMonth = useMemo(() => filtered.reduce((acc, exp) => {
    const key = exp.month || exp.date?.slice(0, 7) || 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(exp)
    return acc
  }, {}), [filtered])

  return { filter, setFilter, filtered, byMonth, availableMonths }
}

const sectionTitle = (t) => (
  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '10px', marginTop: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
    {t}
  </div>
)

export default function ExpenseManager({ groupId, members, expenses, payments, onRefresh }) {
  const { user } = useAuth()
  const toast = useToast()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editingExp, setEditingExp] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [confirmDeleteExp, setConfirmDeleteExp] = useState(null)

  const { filter, setFilter, filtered, byMonth, availableMonths } = useClientFilter(expenses)

  const myMember = members.find(m => String(m.userId) === String(user?.id))
  const myId = myMember?.id
  const isAdmin = myMember?.role === 'admin'

  // Soldes calculés sur TOUTES les dépenses (pas les filtrées)
  const balances = useMemo(() => computeBalances(expenses, payments, members), [expenses, payments, members])
  const simplified = useMemo(() => simplifyDebts(balances), [balances])
  const myBalance = balances[String(myId)] || 0

  // Stats calculées sur les dépenses FILTRÉES
  const stats = useExpenseStats(filtered, members, myId)

  const getMember = (id) => members.find(m => String(m.id) === String(id))

  const exportCSV = () => {
    const name = (id) => members.find(m => String(m.id) === String(id))?.name || '?'
    const share = (exp) => {
      const s = computeMyShare(exp, myId)
      return s !== null ? s.toFixed(2) : ''
    }
    const header = ['Date', 'Description', 'Catégorie', 'Montant (€)', 'Payé par', 'Mode', 'Ma part (€)']
    const rows = filtered.map(e => [
      e.date,
      e.description,
      CATEGORIES[e.category]?.label || e.category,
      e.amount.toFixed(2),
      name(e.paidById),
      e.splitMode,
      share(e),
    ])
    const csv = [header, ...rows]
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dépenses_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const deleteExpense = async (id) => {
    try {
      await api.deleteExpense(id)
      toast.success('Dépense supprimée')
      onRefresh()
    } catch {
      toast.error('Impossible de supprimer la dépense.')
    } finally {
      setConfirmDeleteExp(null)
    }
  }

  const openEdit = (exp) => { setEditingExp(exp); setWizardOpen(true) }
  const closeWizard = () => { setWizardOpen(false); setEditingExp(null) }
  const requestDelete = (exp) => setConfirmDeleteExp(exp)

  return (
    <div style={{ position: 'relative', paddingBottom: '80px' }}>

      {/* KPIs + répartition catégories */}
      <ExpenseSummary stats={stats} myBalance={myBalance} />

      {isAdmin && (
        <div style={{ margin: '10px 0', padding: '6px 12px', background: 'var(--green-light)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--green-dark)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          👑 Vous êtes administrateur de ce groupe
        </div>
      )}

      {/* Soldes simplifiés — toujours sur l'intégralité des données */}
      {simplified.length > 0 && (
        <>
          {sectionTitle('Soldes simplifiés')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {simplified.map((tx, i) => {
              const from = getMember(tx.from)
              const to = getMember(tx.to)
              const isMyDebt = String(tx.from) === String(myId)
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px',
                  border: `0.5px solid ${isMyDebt ? 'var(--red)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  background: isMyDebt ? 'var(--red-light)' : 'var(--bg)',
                }}>
                  <Avatar initials={from?.initials} color={from?.color} textColor={from?.textColor} size={30} />
                  <div style={{ flex: 1, fontSize: '13px' }}>
                    <strong>{from?.name}</strong> → <strong>{to?.name}</strong>
                    {isMyDebt && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--red)', fontWeight: 500 }}>(vous)</span>}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: isMyDebt ? 'var(--red)' : 'var(--text)' }}>
                    {tx.amount.toFixed(2)} €
                  </div>
                  <Btn variant="primary" style={{ padding: '5px 12px', fontSize: '12px' }}
                    onClick={() => setPayModal({ from: tx.from, to: tx.to, amount: tx.amount })}>
                    Régler
                  </Btn>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* État vide — aucune dépense dans le groupe */}
      {expenses.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '12px', border: '0.5px dashed var(--border)', borderRadius: 'var(--radius)', marginTop: '20px' }}>
          <div style={{ fontSize: '36px' }}>💸</div>
          <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text)' }}>Aucune dépense pour l'instant</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Ajoutez la première dépense du groupe pour commencer à suivre les soldes.
          </div>
          <button onClick={() => setWizardOpen(true)} style={{ marginTop: '8px', padding: '8px 20px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Ajouter une dépense
          </button>
        </div>
      ) : (
        <>
          {/* Timeline filtrée */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', marginTop: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {`Dépenses${filtered.length !== expenses.length ? ` (${filtered.length} / ${expenses.length})` : ''}`}
            </div>
            <button onClick={exportCSV} title="Exporter en CSV"
              style={{ padding: '3px 10px', fontSize: '11px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border-hover)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
              ↓ CSV
            </button>
          </div>
          <ExpenseFilters filter={filter} setFilter={setFilter} availableMonths={availableMonths} />
          <ExpenseTimeline
            byMonth={byMonth}
            members={members}
            myMemberId={myId}
            isAdmin={isAdmin}
            onEdit={openEdit}
            onDelete={requestDelete}
          />
        </>
      )}

      {/* Bouton flottant + */}
      <button
        onClick={() => setWizardOpen(true)}
        title="Ajouter une dépense"
        style={{
          position: 'fixed', bottom: '28px', right: '28px',
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--green)', color: '#fff',
          border: 'none', fontSize: '22px', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, transition: 'transform 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        ＋
      </button>

      {/* Confirmation suppression dépense */}
      {confirmDeleteExp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', padding: 24, width: 320, maxWidth: '90%' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Supprimer cette dépense ?</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              « {confirmDeleteExp.description} » — {confirmDeleteExp.amount.toFixed(2)} €
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDeleteExp(null)} style={{ padding: '7px 14px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border-hover)', background: 'transparent', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>Annuler</button>
              <button onClick={() => deleteExpense(confirmDeleteExp.id)} style={{ padding: '7px 14px', borderRadius: 'var(--radius)', border: '0.5px solid var(--red)', background: 'var(--red-light)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--red)', fontWeight: 500 }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Wizard ajout / modification */}
      <ExpenseWizard
        open={wizardOpen}
        onClose={closeWizard}
        groupId={groupId}
        members={members}
        expense={editingExp}
        onSaved={() => { onRefresh(); closeWizard() }}
      />

      {/* Modal remboursement */}
      {payModal && (
        <PaymentModal
          open={!!payModal}
          onClose={() => setPayModal(null)}
          groupId={groupId}
          members={members}
          defaultFrom={payModal.from}
          defaultTo={payModal.to}
          defaultAmount={payModal.amount}
          onSaved={() => { onRefresh(); setPayModal(null) }}
        />
      )}
    </div>
  )
}
