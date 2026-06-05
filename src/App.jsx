import React, { useState, useEffect } from 'react'
import { api } from './utils/api'
import { useAuth } from './utils/AuthContext'
import { useApp } from './utils/AppContext'
import GroupModal from './components/GroupModal'
import InviteModal from './components/InviteModal'
import ExpenseWizard from './components/ExpenseWizard'
import ParticipationWizard from './components/ParticipationWizard'
import ParticipationCategoryPicker from './components/ParticipationCategoryPicker'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import ExpenseManager from './modules/expenses/ExpenseManager'
import BudgetDashboard from './pages/BudgetDashboard'
import Members from './pages/Members'
import History from './pages/History'
import Reminders from './pages/Reminders'
import Profile from './pages/Profile'

const NAV = [
  { id: 'overview',  label: "Vue d'ensemble", icon: '⊞' },
  { id: 'members',   label: 'Membres',         icon: '👥' },
  { id: 'history',   label: 'Historique',       icon: '🕐' },
  { id: 'reminders', label: 'Rappels',          icon: '🔔' },
]

export default function App() {
  const { user, login, logout, validating, recoveryMode } = useAuth()
  const {
    groups, topGroups, subGroups, activeGroup, selectGroup,
    members, expenses, payments, reminders, loading, refresh,
    isGroupAdmin,
    activeNav, setActiveNav,
    showDashboard, setShowDashboard,
    showProfile, setShowProfile,
    expanded, toggleExpand, expandGroup,
    partWizardOpen, setPartWizardOpen,
    catPickerOpen, setCatPickerOpen,
    groupModalOpen, setGroupModalOpen,
    groupModalDefaultType, setGroupModalDefaultType,
    subgroupParentId, setSubgroupParentId, openSubgroupModal,
    expModalOpen, setExpModalOpen,
    inviteModalOpen, setInviteModalOpen,
    confirmDelete, setConfirmDelete,
    deleteGroup, refreshGroups,
    pendingCount,
  } = useApp()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = () => setDrawerOpen(false)
  const [pickerGroupId, setPickerGroupId] = useState(null)
  const [pickerMembers, setPickerMembers] = useState(null)
  const [deleteCheckExpenses, setDeleteCheckExpenses] = useState([])
  const [deleteCheckLoading, setDeleteCheckLoading] = useState(false)

  // Vérifie les dépenses d'un sous-groupe avant suppression
  useEffect(() => {
    if (!confirmDelete?.parentId) { setDeleteCheckExpenses([]); return }
    setDeleteCheckLoading(true)
    api.getExpensesByGroup(confirmDelete.id)
      .then(setDeleteCheckExpenses)
      .catch(() => setDeleteCheckExpenses([]))
      .finally(() => setDeleteCheckLoading(false))
  }, [confirmDelete?.id])

  const handlePickerCreated = (group, freshMembers) => {
    refreshGroups()
    selectGroup(group)
    setPickerGroupId(group.id)
    setPickerMembers(freshMembers)
    setCatPickerOpen(false)
    setExpModalOpen(true)
  }

  const closeExpModal = () => {
    setExpModalOpen(false)
    setPickerGroupId(null)
    setPickerMembers(null)
  }

  if (validating) return null
  if (recoveryMode) return <ResetPassword />
  if (!user) return <Login />

  const s = {
    app: { display: 'flex', height: '100vh', overflow: 'hidden' },
    sidebar: { width: 228, minWidth: 228, borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', overflowY: 'auto' },
    logo: { padding: '14px 16px', borderBottom: '0.5px solid var(--border)', fontSize: '15px', fontWeight: 600, color: 'var(--green-dark)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
    logoIcon: { width: 28, height: 28, background: 'var(--green)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 },
    userBox: { padding: '10px 12px', margin: '8px', borderRadius: 'var(--radius)', background: 'var(--bg)', border: '0.5px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'border-color 0.15s' },
    nav: { padding: '4px 8px', borderBottom: '0.5px solid var(--border)' },
    navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '13px', color: active ? 'var(--text)' : 'var(--text-secondary)', background: active ? 'var(--bg)' : 'transparent', fontWeight: active ? 500 : 400, marginBottom: '2px', transition: 'background 0.15s', userSelect: 'none' }),
    groups: { padding: '8px', flex: 1 },
    groupsLabel: (accent) => ({ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 10px 6px', display: 'flex', alignItems: 'center', gap: 5, color: accent ?? 'var(--text-tertiary)', fontWeight: accent ? 600 : 400 }),
    groupItem: (active, budget) => ({ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '13px', color: active ? (budget ? '#92400E' : 'var(--green-dark)') : 'var(--text-secondary)', background: active ? (budget ? 'var(--amber-light)' : 'var(--green-light)') : 'transparent', fontWeight: active ? 500 : 400, transition: 'background 0.15s', userSelect: 'none', position: 'relative' }),
    subItem: (active, budget) => ({ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 10px 5px 28px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '12px', color: active ? (budget ? '#92400E' : 'var(--green-dark)') : 'var(--text-secondary)', background: active ? (budget ? 'var(--amber-light)' : 'var(--green-light)') : 'transparent', fontWeight: active ? 500 : 400, transition: 'background 0.15s', userSelect: 'none' }),
    main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    topbar: { padding: '14px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', flexShrink: 0 },
    content: { flex: 1, overflowY: 'auto', padding: '16px 20px' },
  }

  const hamburger = (
    <button
      className="hamburger-btn"
      onClick={() => setDrawerOpen(true)}
      aria-label="Ouvrir le menu"
      style={{ background: 'none', border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)', padding: '5px 10px', lineHeight: 1, flexShrink: 0 }}
    >☰</button>
  )

  return (
    <div style={s.app}>
      {drawerOpen && <div className="drawer-backdrop" onClick={closeDrawer} />}
      <div style={s.sidebar} className={`sidebar-root${drawerOpen ? ' drawer-open' : ''}`}>
        <div style={s.logo}>
          <div style={s.logoIcon}>N</div>
          NotreTab
        </div>

        <div style={{ ...s.userBox, border: `0.5px solid ${showProfile ? 'var(--green)' : 'var(--border)'}` }}
          onClick={() => { setShowProfile(true); setShowDashboard(false); closeDrawer() }} title="Mon profil">
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: user.color, color: user.textColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{user.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Mon profil</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); logout() }} title="Se déconnecter"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-tertiary)', padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}>
            ⏻
          </button>
        </div>

        <div style={s.nav}>
          <div style={s.navItem(showDashboard && !showProfile)} onClick={() => { setShowDashboard(true); setShowProfile(false); closeDrawer() }}>
            <span style={{ fontSize: '14px' }}>🏠</span>
            Tableau de bord
          </div>
          {!showDashboard && !showProfile && NAV.map(n => (
            <div key={n.id} style={s.navItem(activeNav === n.id)} onClick={() => { setActiveNav(n.id); setShowDashboard(false); setShowProfile(false); closeDrawer() }}>
              <span style={{ fontSize: '14px' }}>{n.icon}</span>
              {n.label}
              {n.id === 'reminders' && pendingCount > 0 && (
                <span style={{ marginLeft: 'auto', background: 'var(--red)', color: '#fff', borderRadius: 20, fontSize: 10, padding: '1px 6px', fontWeight: 600 }}>{pendingCount}</span>
              )}
            </div>
          ))}
        </div>

        <div style={s.groups}>
          {/* Participations occasionnelles */}
          <div style={s.groupsLabel('var(--green-dark)')}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', flexShrink: 0 }} />
            Participations
          </div>
          {topGroups.filter(g => g.type !== 'budget').map(g => {
            const children = subGroups(g.id)
            const isOpen = expanded[g.id]
            const active = !showDashboard && !showProfile && activeGroup?.id === g.id
            return (
              <div key={g.id}>
                <div style={s.groupItem(active, false)} onClick={() => { selectGroup(g); closeDrawer() }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                  <span title="Ajouter un sous-groupe" onClick={(e) => openSubgroupModal(g.id, e)} style={{ opacity: 0, fontSize: '13px', padding: '0 2px', color: 'var(--text-tertiary)', lineHeight: 1 }} className="add-sub-btn">＋</span>
                  {isGroupAdmin && activeGroup?.id === g.id && (
                    <span title="Supprimer" onClick={(e) => { e.stopPropagation(); setConfirmDelete(g) }} style={{ opacity: 0, fontSize: '12px', padding: '0 2px', color: 'var(--red)', lineHeight: 1 }} className="del-btn">✕</span>
                  )}
                  {children.length > 0 && (
                    <span onClick={(e) => toggleExpand(g.id, e)} style={{ fontSize: '10px', color: 'var(--text-tertiary)', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', marginLeft: '2px', transition: 'transform 0.2s' }}>▶</span>
                  )}
                </div>
                {isOpen && children.map(sub => (
                  <div key={sub.id} style={{ ...s.subItem(!showDashboard && !showProfile && activeGroup?.id === sub.id, false), position: 'relative' }} onClick={() => { selectGroup(sub); closeDrawer() }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: sub.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.name}</span>
                    {isGroupAdmin && (activeGroup?.id === g.id || activeGroup?.id === sub.id) && (
                      <span title="Supprimer" onClick={(e) => { e.stopPropagation(); setConfirmDelete(sub) }} style={{ opacity: 0, fontSize: '11px', padding: '0 2px', color: 'var(--red)', lineHeight: 1 }} className="del-btn">✕</span>
                    )}
                  </div>
                ))}
                {isOpen && (
                  <div onClick={(e) => openSubgroupModal(g.id, e)} style={{ ...s.subItem(false, false), color: 'var(--text-tertiary)', fontSize: '11px' }}>
                    <span style={{ fontSize: '12px' }}>＋</span> Sous-groupe
                  </div>
                )}
              </div>
            )
          })}
          <div onClick={() => { setCatPickerOpen(true); closeDrawer() }}
            style={{ ...s.groupItem(false, false), color: 'var(--green-dark)', fontSize: '12px', marginTop: '4px' }}>
            ＋ Nouvelle participation
          </div>

          {/* Séparateur */}
          <div style={{ borderTop: '0.5px solid var(--border)', margin: '12px 2px 8px' }} />

          {/* Budgets communs */}
          <div style={s.groupsLabel('#92400E')}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', display: 'inline-block', flexShrink: 0 }} />
            Budgets communs
          </div>
          {topGroups.filter(g => g.type === 'budget').map(g => {
            const children = subGroups(g.id)
            const isOpen = expanded[g.id]
            const active = !showDashboard && !showProfile && activeGroup?.id === g.id
            return (
              <div key={g.id}>
                <div style={s.groupItem(active, true)} onClick={() => { selectGroup(g); closeDrawer() }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                  <span title="Ajouter une période" onClick={(e) => openSubgroupModal(g.id, e)} style={{ opacity: 0, fontSize: '13px', padding: '0 2px', color: 'var(--text-tertiary)', lineHeight: 1 }} className="add-sub-btn">＋</span>
                  {isGroupAdmin && activeGroup?.id === g.id && (
                    <span title="Supprimer" onClick={(e) => { e.stopPropagation(); setConfirmDelete(g) }} style={{ opacity: 0, fontSize: '12px', padding: '0 2px', color: 'var(--red)', lineHeight: 1 }} className="del-btn">✕</span>
                  )}
                  {children.length > 0 && (
                    <span onClick={(e) => toggleExpand(g.id, e)} style={{ fontSize: '10px', color: 'var(--text-tertiary)', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', marginLeft: '2px', transition: 'transform 0.2s' }}>▶</span>
                  )}
                </div>
                {isOpen && children.map(sub => (
                  <div key={sub.id} style={{ ...s.subItem(!showDashboard && !showProfile && activeGroup?.id === sub.id, true), position: 'relative' }} onClick={() => { selectGroup(sub); closeDrawer() }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.name}</span>
                    {isGroupAdmin && (activeGroup?.id === g.id || activeGroup?.id === sub.id) && (
                      <span title="Supprimer" onClick={(e) => { e.stopPropagation(); setConfirmDelete(sub) }} style={{ opacity: 0, fontSize: '11px', padding: '0 2px', color: 'var(--red)', lineHeight: 1 }} className="del-btn">✕</span>
                    )}
                  </div>
                ))}
                {isOpen && (
                  <div onClick={(e) => openSubgroupModal(g.id, e)} style={{ ...s.subItem(false, true), color: '#92400E', opacity: 0.6, fontSize: '11px' }}>
                    <span style={{ fontSize: '12px' }}>＋</span> Période
                  </div>
                )}
              </div>
            )
          })}
          <div onClick={() => { setGroupModalDefaultType('budget'); setSubgroupParentId(null); setGroupModalOpen(true); closeDrawer() }}
            style={{ ...s.groupItem(false, true), color: '#92400E', fontSize: '12px', marginTop: '4px' }}>
            ＋ Nouveau budget
          </div>
        </div>
      </div>

      <style>{`.add-sub-btn, .del-btn { opacity: 0 !important } div:hover > .add-sub-btn, div:hover > .del-btn { opacity: 1 !important }`}</style>

      <div style={s.main}>
        {showProfile ? (
          <>
            <div style={s.topbar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {hamburger}
                <button onClick={() => setShowProfile(false)}
                  style={{ background: 'none', border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', padding: '5px 10px', fontFamily: 'inherit' }}>
                  ← Retour
                </button>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>Mon profil</div>
                  <div className="topbar-meta" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>Informations personnelles et sécurité</div>
                </div>
              </div>
            </div>
            <div style={s.content}><Profile onBack={() => setShowProfile(false)} /></div>
          </>
        ) : showDashboard ? (
          <>
            <div style={s.topbar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {hamburger}
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>Mon espace personnel</div>
                  <div className="topbar-meta" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>Vue globale de vos dépenses et soldes</div>
                </div>
              </div>
            </div>
            <div style={s.content}><Dashboard /></div>
          </>
        ) : (
          <>
            <div style={s.topbar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                {hamburger}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', overflow: 'hidden' }}>
                    {activeGroup?.parentId && (
                      <span className="topbar-breadcrumb" style={{ fontSize: '12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        {groups.find(g => g.id === activeGroup.parentId)?.name} /
                      </span>
                    )}
                    <div style={{ fontSize: '15px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {activeGroup?.name || 'Aucun groupe'}
                    </div>
                    {activeGroup?.parentId && (
                      <span className="topbar-badge" style={{ fontSize: '11px', background: 'var(--green-light)', color: 'var(--green-dark)', padding: '2px 8px', borderRadius: '20px', fontWeight: 500, flexShrink: 0 }}>sous-groupe</span>
                    )}
                    {isGroupAdmin && (
                      <span className="topbar-badge" style={{ fontSize: '11px', background: 'var(--amber-light)', color: '#633806', padding: '2px 8px', borderRadius: '20px', fontWeight: 500, flexShrink: 0 }}>👑 Admin</span>
                    )}
                  </div>
                  <div className="topbar-meta" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                    {members.length} membre{members.length !== 1 ? 's' : ''} · {expenses.length} dépense{expenses.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {isGroupAdmin && (
                  <button className="topbar-invite" onClick={() => setInviteModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border-hover)', background: 'transparent', fontSize: '13px', cursor: 'pointer', color: 'var(--text)', fontFamily: 'inherit' }}>
                    👤 Inviter
                  </button>
                )}
                <button onClick={() => setExpModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: 'var(--radius)', border: '0.5px solid var(--green)', background: 'var(--green)', fontSize: '13px', cursor: 'pointer', color: '#fff', fontWeight: 500, fontFamily: 'inherit' }}>
                  ＋ Dépense
                </button>
              </div>
            </div>

            <div style={s.content}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-tertiary)' }}>Chargement…</div>
              ) : !activeGroup ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
                  <div style={{ fontSize: '32px' }}>💸</div>
                  <div style={{ fontSize: '15px', fontWeight: 500 }}>Bienvenue sur NotreTab</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Créez un groupe pour commencer</div>
                  <button onClick={() => setGroupModalOpen(true)} style={{ marginTop: '8px', padding: '8px 18px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Créer un groupe
                  </button>
                </div>
              ) : activeNav === 'overview' && activeGroup.type === 'budget' && !activeGroup.parentId ? (
                <BudgetDashboard
                  budgetGroup={activeGroup}
                  subGroups={subGroups(activeGroup.id)}
                  budgetGroups={topGroups.filter(g => g.type === 'budget')}
                  onSelectGroup={selectGroup}
                />
              ) : activeNav === 'overview' ? (
                <ExpenseManager groupId={activeGroup.id} members={members} expenses={expenses} payments={payments} onRefresh={refresh} />
              ) : activeNav === 'members' ? (
                <Members groupId={activeGroup.id} members={members} expenses={expenses} payments={payments} onRefresh={refresh} />
              ) : activeNav === 'history' ? (
                <History expenses={expenses} payments={payments} members={members} />
              ) : (
                <Reminders group={activeGroup} groupId={activeGroup.id} members={members} expenses={expenses} payments={payments} reminders={reminders} onRefresh={refresh} />
              )}
            </div>
          </>
        )}
      </div>

      <ParticipationCategoryPicker
        open={catPickerOpen}
        onClose={() => setCatPickerOpen(false)}
        onCreated={handlePickerCreated}
      />

      <ParticipationWizard
        open={partWizardOpen}
        onClose={() => setPartWizardOpen(false)}
        onSaved={(group) => { refreshGroups(); selectGroup(group); setPartWizardOpen(false) }}
      />

      <GroupModal
        open={groupModalOpen}
        onClose={() => { setGroupModalOpen(false); setSubgroupParentId(null) }}
        onSaved={() => { refreshGroups(); if (subgroupParentId) expandGroup(subgroupParentId); setGroupModalOpen(false); setSubgroupParentId(null) }}
        groups={groups}
        parentId={subgroupParentId}
        defaultType={groupModalDefaultType}
      />
      <ExpenseWizard
        open={expModalOpen}
        onClose={closeExpModal}
        groupId={pickerGroupId ?? activeGroup?.id}
        members={pickerMembers ?? members}
        onSaved={() => { refresh(); setPickerGroupId(null); setPickerMembers(null) }}
      />
      <InviteModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        groupId={activeGroup?.id}
        existingMembers={members}
        onSaved={refresh}
      />

      {confirmDelete && (() => {
        const childGroups = groups.filter(x => String(x.parentId) === String(confirmDelete.id))
        const blockedBySubgroups = confirmDelete.type === 'budget' && childGroups.length > 0
        const blockedByExpenses = !!confirmDelete.parentId && deleteCheckExpenses.length > 0
        const blocked = blockedBySubgroups || blockedByExpenses
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', padding: 24, width: 340, maxWidth: '90%' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Supprimer "{confirmDelete.name}" ?</div>
              {blockedBySubgroups && (
                <div style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-light)', border: '0.5px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 16, lineHeight: 1.6 }}>
                  Ce budget contient {childGroups.length} sous-groupe{childGroups.length > 1 ? 's' : ''} ({childGroups.map(s => s.name).join(', ')}). Supprimez-les d'abord.
                </div>
              )}
              {blockedByExpenses && (
                <div style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-light)', border: '0.5px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 16, lineHeight: 1.6 }}>
                  Ce sous-groupe contient {deleteCheckExpenses.length} dépense{deleteCheckExpenses.length > 1 ? 's' : ''}. Supprimez ou validez-les avant de supprimer ce sous-groupe.
                </div>
              )}
              {!blocked && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
                  Ce groupe et toutes ses données seront supprimés définitivement.
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: blocked ? 8 : 0 }}>
                <button onClick={() => setConfirmDelete(null)} style={{ padding: '7px 14px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border-hover)', background: 'transparent', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
                  {blocked ? 'Fermer' : 'Annuler'}
                </button>
                {!blocked && !deleteCheckLoading && (
                  <button onClick={() => deleteGroup(confirmDelete)} style={{ padding: '7px 14px', borderRadius: 'var(--radius)', border: '0.5px solid var(--red)', background: 'var(--red-light)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--red)', fontWeight: 500 }}>Supprimer</button>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
