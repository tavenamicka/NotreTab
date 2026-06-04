import React, { useEffect, useState, useMemo } from 'react'
import { api } from '../utils/api'
import { useAuth } from '../utils/AuthContext'
import { useApp } from '../utils/AppContext'
import { useToast } from '../utils/ToastContext'
import { computeBalances, simplifyDebts, CATEGORIES, computeMyShare } from '../utils/balance'
import Avatar from '../components/Avatar'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'

// ── Haptic helper ─────────────────────────────────────────────
const haptic = (ms = 30) => { try { navigator.vibrate?.(ms) } catch (_) {} }

function computeModuleStats(list, userId) {
  let pending = 0
  const thisMonth = new Date().toISOString().slice(0, 7)
  let monthTotal = 0
  list.forEach(({ members, expenses, payments }) => {
    const myMember = members.find(m => String(m.userId) === String(userId))
    if (!myMember) return
    const debts = simplifyDebts(computeBalances(expenses, payments, members))
    debts.forEach(tx => {
      if (String(tx.from) === String(myMember.id)) pending += tx.amount
    })
    monthTotal += expenses
      .filter(e => (e.month || e.date?.slice(0, 7)) === thisMonth)
      .reduce((s, e) => s + e.amount, 0)
  })
  return { count: list.length, pending, monthTotal }
}

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const { activeGroup, selectGroup, setGroupModalOpen, setGroupModalDefaultType, setCatPickerOpen } = useApp()

  const [groupData, setGroupData] = useState([])
  const [myMemberships, setMyMemberships] = useState([])
  const [loading, setLoading] = useState(true)
  const [moduleView, setModuleView] = useState(null) // null | 'participation' | 'budget'

  // ── Load data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      try {
        const [myMemberships, allMembers, allGroups, allExpenses, allPayments] = await Promise.all([
          api.getMembersByUser(user.id),
          api.getAllMembers(),
          api.getGroups(),
          api.getAllExpenses(),
          api.getAllPayments(),
        ])
        setMyMemberships(myMemberships)
        const myGroupIds = myMemberships.map(m => m.groupId)
        const myGroups = allGroups.filter(g => myGroupIds.includes(g.id))
        const data = myGroups.map(group => ({
          group,
          members:  allMembers.filter(m => String(m.groupId) === String(group.id)),
          expenses: allExpenses.filter(e => e.groupId === group.id),
          payments: allPayments.filter(p => p.groupId === group.id),
        }))
        setGroupData(data)
      } catch {
        toast.error('Impossible de charger le tableau de bord.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.id])

  // ── Derived: global debts ─────────────────────────────────────
  const { globalOwed, globalOwing } = useMemo(() => {
    const owed = []
    const owing = []
    groupData.forEach(({ group, members, expenses, payments }) => {
      const myMember = members.find(m => String(m.userId) === String(user.id))
      if (!myMember) return
      const debts = simplifyDebts(computeBalances(expenses, payments, members))
      debts.forEach(tx => {
        const fromMember = members.find(m => String(m.id) === String(tx.from))
        const toMember   = members.find(m => String(m.id) === String(tx.to))
        if (String(tx.from) === String(myMember.id))
          owed.push({ to: toMember?.name || '?', toMember, amount: tx.amount, groupName: group.name, group })
        if (String(tx.to) === String(myMember.id))
          owing.push({ from: fromMember?.name || '?', fromMember, amount: tx.amount, groupName: group.name, group })
      })
    })
    return { globalOwed: owed, globalOwing: owing }
  }, [groupData, user?.id])

  const totalOwed  = globalOwed.reduce((s, x) => s + x.amount, 0)
  const totalOwing = globalOwing.reduce((s, x) => s + x.amount, 0)
  const netBalance = totalOwing - totalOwed

  // ── Derived: per-module stats ─────────────────────────────────
  const participationData = useMemo(
    () => groupData.filter(d => !d.group.type || d.group.type === 'occasional' || d.group.type === 'ponctuel'),
    [groupData]
  )
  const budgetData = useMemo(
    () => groupData.filter(d => d.group.type === 'budget'),
    [groupData]
  )

  const partStats   = useMemo(() => computeModuleStats(participationData, user?.id), [participationData, user?.id])
  const budgetStats = useMemo(() => computeModuleStats(budgetData,        user?.id), [budgetData,        user?.id])

  // ── Derived: recent expenses ──────────────────────────────────
  const myExpenses = useMemo(() => groupData.flatMap(({ group, members, expenses }) => {
    const myMember = members.find(m => String(m.userId) === String(user.id))
    if (!myMember) return []
    return expenses
      .filter(e => e.splitBetween.map(String).includes(String(myMember.id)))
      .map(e => {
        const payer   = members.find(m => String(m.id) === String(e.paidById))
        const myShare = computeMyShare(e, myMember.id) ?? 0
        return { ...e, groupName: group.name, payer, myShare, isPayer: String(e.paidById) === String(myMember.id) }
      })
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8), [groupData, user?.id])

  // ── Per-group pending amount for current user ─────────────────
  const computePending = (members, expenses, payments) => {
    const myMember = members.find(m => String(m.userId) === String(user?.id))
    if (!myMember) return 0
    const debts = simplifyDebts(computeBalances(expenses, payments, members))
    return debts
      .filter(tx => String(tx.from) === String(myMember.id))
      .reduce((s, tx) => s + tx.amount, 0)
  }

  // ── Navigate to module ────────────────────────────────────────
  const goToModule = (type) => {
    haptic()
    const isPonctuel = type === 'occasional'
    const data = isPonctuel ? participationData : budgetData
    if (data.length > 0) {
      setModuleView(isPonctuel ? 'participation' : 'budget')
    } else if (isPonctuel) {
      setCatPickerOpen(true)
    } else {
      setGroupModalDefaultType(type)
      setGroupModalOpen(true)
    }
  }

  // ── Module list view ─────────────────────────────────────────
  if (moduleView) {
    const isPart = moduleView === 'participation'
    const data = isPart ? participationData : budgetData
    const title = isPart ? 'Participations ponctuelles' : 'Budgets communs'
    const accent = isPart ? 'var(--green)' : '#D97706'
    const accentLight = isPart ? 'var(--green-light)' : 'var(--amber-light)'
    const accentDark = isPart ? 'var(--green-dark)' : '#92400E'
    const onAdd = isPart
      ? () => setCatPickerOpen(true)
      : () => { setGroupModalDefaultType('budget'); setGroupModalOpen(true) }

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => setModuleView(null)} style={{ padding: '6px 12px', background: 'none', border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
            ← Retour
          </button>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{title}</div>
          <button onClick={onAdd} style={{ padding: '6px 14px', background: accent, color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            ＋ {isPart ? 'Nouvelle' : 'Nouveau'}
          </button>
        </div>

        {data.length === 0 ? (
          <div className="db-empty">Aucun groupe pour l'instant.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.map(({ group, members, expenses, payments }) => {
              const pending = computePending(members, expenses, payments)
              return (
                <div
                  key={group.id}
                  onClick={() => { selectGroup(group); setModuleView(null) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: group.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {group.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {members.length} membre{members.length !== 1 ? 's' : ''} · {expenses.length} dépense{expenses.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {pending > 0.01 && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', flexShrink: 0 }}>
                      -{pending.toFixed(2)} €
                    </div>
                  )}
                  <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>→</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <Spinner color="var(--green)" size={20} />
    </div>
  )

  // Clé pour le flash : change à chaque mise à jour du solde
  const balanceKey = netBalance.toFixed(2)

  return (
    <div>

      {/* ── Welcome + solde net ── */}
      <div className="db-welcome anim-slide-up">
        <Avatar initials={user.initials} color={user.color} textColor={user.textColor} size={44} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Bonjour, {user.name.split(' ')[0]} 👋</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            {myMemberships.length} groupe{myMemberships.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="db-welcome-net">
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>Solde net global</div>
          {/* key force re-animation à chaque changement de solde */}
          <div key={balanceKey} className={netBalance >= 0 ? 'balance-pos' : 'balance-neg'}
            style={{ fontSize: 24, fontWeight: 700, color: netBalance >= 0 ? 'var(--green)' : 'var(--red)', display: 'inline-block', padding: '2px 6px' }}>
            {netBalance >= 0 ? '+' : ''}{netBalance.toFixed(2)} €
          </div>
        </div>
      </div>

      {/* ── Deux modules ── */}
      <div className="db-modules anim-stagger-1">

        {/* Module A — Participation ponctuelle */}
        <div
          className="db-module-card green"
          onClick={() => goToModule('occasional')}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && goToModule('occasional')}
        >
          <div className="db-module-icon">🤝</div>
          <div className="db-module-title">Participation<br />Ponctuelle</div>
          <div className="db-module-desc">
            Régler une facture entre amis, une sortie, un cadeau commun — sans groupe préétabli.
          </div>
          <div className="db-module-stats">
            <div className="db-module-stat">
              <span className="db-module-stat-val">{partStats.count}</span>
              <span className="db-module-stat-lbl">Participation{partStats.count !== 1 ? 's' : ''}</span>
            </div>
            {partStats.pending > 0.01 && (
              <div className="db-module-stat">
                <span className="db-module-stat-val" style={{ color: 'var(--red)' }}>
                  {partStats.pending.toFixed(2)} €
                </span>
                <span className="db-module-stat-lbl">En attente</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="db-module-cta"
              onClick={e => { e.stopPropagation(); goToModule('occasional') }}
            >
              {partStats.count > 0 ? 'Voir mes participations →' : 'Créer une participation →'}
            </button>
            {partStats.count > 0 && (
              <button
                className="db-module-cta"
                onClick={e => { e.stopPropagation(); setCatPickerOpen(true) }}
                style={{ background: '#1A7A9A' }}
              >
                ＋ Participation
              </button>
            )}
          </div>
        </div>

        {/* Module B — Budget commun */}
        <div
          className="db-module-card amber"
          onClick={() => goToModule('budget')}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && goToModule('budget')}
        >
          <div className="db-module-icon">📊</div>
          <div className="db-module-title">Budget<br />Commun</div>
          <div className="db-module-desc">
            Voyages, couple, colocation — suivi structuré sur une période ou un thème.
          </div>
          <div className="db-module-stats">
            <div className="db-module-stat">
              <span className="db-module-stat-val">{budgetStats.count}</span>
              <span className="db-module-stat-lbl">Budget{budgetStats.count !== 1 ? 's' : ''}</span>
            </div>
            {budgetStats.monthTotal > 0.01 && (
              <div className="db-module-stat">
                <span className="db-module-stat-val">
                  {budgetStats.monthTotal.toFixed(2)} €
                </span>
                <span className="db-module-stat-lbl">Ce mois</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="db-module-cta"
              onClick={e => { e.stopPropagation(); goToModule('budget') }}
            >
              {budgetStats.count > 0 ? 'Voir mes budgets →' : 'Créer un budget →'}
            </button>
            {budgetStats.count > 0 && (() => {
              const current = (activeGroup?.type === 'budget' || activeGroup?.parentId)
                ? activeGroup
                : budgetData[0]?.group
              if (!current) return null
              return (
                <button
                  className="db-module-cta"
                  onClick={e => { e.stopPropagation(); selectGroup(current) }}
                  style={{ background: '#C07800' }}
                  title={current.name}
                >
                  En cours →
                </button>
              )
            })()}
          </div>
        </div>

      </div>

      {/* ── Stats globales ── */}
      <div className="db-stats-row anim-stagger-2">
        <div className="db-stat-card">
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Je dois</div>
          <div style={{ fontSize: 20, fontWeight: 650, color: 'var(--red)' }}>{totalOwed.toFixed(2)} €</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {globalOwed.length} personne{globalOwed.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="db-stat-card">
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>On me doit</div>
          <div style={{ fontSize: 20, fontWeight: 650, color: 'var(--green)' }}>{totalOwing.toFixed(2)} €</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {globalOwing.length} personne{globalOwing.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="db-stat-card">
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Groupes actifs</div>
          <div style={{ fontSize: 20, fontWeight: 650 }}>{groupData.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {myExpenses.length} dépense{myExpenses.length !== 1 ? 's' : ''} récentes
          </div>
        </div>
      </div>

      {/* ── Ce que je dois ── */}
      {globalOwed.length > 0 && <>
        <div className="db-section-title">Ce que je dois</div>
        <div className="db-debt-list">
          {globalOwed.map((d, i) => (
            <div key={i} className="db-debt-row">
              <Avatar initials={d.toMember?.initials} color={d.toMember?.color} textColor={d.toMember?.textColor} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{d.to}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.groupName}
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--red)', flexShrink: 0 }}>
                {d.amount.toFixed(2)} €
              </div>
              <Badge variant="danger">À rembourser</Badge>
            </div>
          ))}
        </div>
      </>}

      {/* ── Ce qu'on me doit ── */}
      {globalOwing.length > 0 && <>
        <div className="db-section-title">Ce qu'on me doit</div>
        <div className="db-debt-list">
          {globalOwing.map((d, i) => (
            <div key={i} className="db-debt-row">
              <Avatar initials={d.fromMember?.initials} color={d.fromMember?.color} textColor={d.fromMember?.textColor} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{d.from}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.groupName}
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--green)', flexShrink: 0 }}>
                {d.amount.toFixed(2)} €
              </div>
              <Badge variant="success">En attente</Badge>
            </div>
          ))}
        </div>
      </>}

      {globalOwed.length === 0 && globalOwing.length === 0 && (
        <div className="db-empty" style={{ marginTop: 8 }}>🎉 Vous êtes à jour sur tous vos groupes !</div>
      )}

      {/* ── Dépenses récentes ── */}
      <div className="db-section-title">Mes dépenses récentes</div>
      <div className="db-exp-list">
        {myExpenses.length === 0 ? (
          <div className="db-empty">💸 Aucune dépense pour l'instant.</div>
        ) : myExpenses.map(exp => {
          const cat = CATEGORIES[exp.category] || CATEGORIES.autre
          return (
            <div key={exp.id} className="db-exp-row">
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius)', background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {cat.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {exp.description}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {exp.groupName} · {exp.isPayer ? 'Vous avez payé' : `Payé par ${exp.payer?.name || '?'}`}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{exp.amount.toFixed(2)} €</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Part : {exp.myShare.toFixed(2)} €</div>
              </div>
              {exp.isPayer
                ? <Badge variant="info">Payeur</Badge>
                : <Badge variant="warning">Participant</Badge>}
            </div>
          )
        })}
      </div>

    </div>
  )
}
