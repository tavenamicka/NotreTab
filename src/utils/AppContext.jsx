import React, { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } from 'react'
import { api } from './api'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { useGroup } from '../hooks/useGroup'
import { computeBalances, simplifyDebts } from './balance'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const { user } = useAuth()
  const toast = useToast()

  const [groups, setGroups] = useState([])
  const [activeGroup, setActiveGroup] = useState(null)
  const [activeNav, setActiveNav] = useState('overview')
  const [showDashboard, setShowDashboard] = useState(true)
  const [showProfile, setShowProfile] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [partWizardOpen, setPartWizardOpen] = useState(false)
  const [catPickerOpen, setCatPickerOpen] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [groupModalDefaultType, setGroupModalDefaultType] = useState('occasional')
  const [subgroupParentId, setSubgroupParentId] = useState(null)
  const [expModalOpen, setExpModalOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { members, expenses, payments, reminders, loading, refresh } = useGroup(activeGroup?.id)

  const myMember = useMemo(
    () => members.find(m => String(m.userId) === String(user?.id)),
    [members, user?.id]
  )
  const isGroupAdmin = myMember?.role === 'admin'

  // ── Groups ──

  const loadGroups = useCallback(
    () => api.getGroups().then(g => { setGroups(g); return g }).catch(() => []),
    []
  )

  const refreshGroups = useCallback(
    () => loadGroups().then(g => {
      const updated = g.find(x => x.id === activeGroup?.id)
      if (updated) setActiveGroup(updated)
    }),
    [loadGroups, activeGroup?.id]
  )

  useEffect(() => {
    if (!user) return
    loadGroups().then(g => {
      if (g.length > 0 && !activeGroup) setActiveGroup(g[0])
      const exp = {}
      g.forEach(g2 => { if (g2.parentId) exp[g2.parentId] = true })
      setExpanded(exp)
    })
  }, [user?.id])

  // ── #2 — Auto-add current user if they have no member record in this group ──

  const autoAddedRef = useRef(new Set())

  useEffect(() => {
    if (!activeGroup || !user || loading) return
    const key = `${activeGroup.id}:${user.id}`
    if (autoAddedRef.current.has(key)) return
    const hasRecord = members.some(m => String(m.userId) === String(user.id))
    if (!hasRecord) {
      autoAddedRef.current.add(key)
      api.addMember({
        groupId: activeGroup.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        initials: user.initials,
        color: user.color,
        textColor: user.textColor,
        role: 'member',
        isGuest: false,
      }).then(() => refresh()).catch(() => { autoAddedRef.current.delete(key) })
    }
  }, [activeGroup?.id, loading, members])

  // ── Delete group ──

  // 404 = déjà supprimé (ok) ; 500 = on réessaie une fois après 500 ms
  const tryDelete = async (fn) => {
    try {
      await fn()
    } catch (err) {
      if (err.message?.includes('404')) return
      await sleep(500)
      try { await fn() } catch (e2) {
        if (!e2.message?.includes('404')) console.warn('Delete retry failed:', e2.message)
      }
    }
  }

  const deleteGroup = async (g) => {
    const idsToDelete = [g.id, ...groups.filter(x => String(x.parentId) === String(g.id)).map(x => x.id)]
    for (const gid of idsToDelete) {
      const [mems, exps, pays] = await Promise.all([
        api.getMembersByGroup(gid),
        api.getExpensesByGroup(gid),
        api.getPaymentsByGroup(gid),
      ])
      for (const x of mems) { await tryDelete(() => api.deleteMember(x.id)); await sleep(60) }
      for (const x of exps) { await tryDelete(() => api.deleteExpense(x.id)); await sleep(60) }
      for (const x of pays) { await tryDelete(() => api.deletePayment(x.id)); await sleep(60) }
      await tryDelete(() => api.deleteGroup(gid))
      await sleep(80)
    }
    if (idsToDelete.includes(activeGroup?.id)) {
      const remaining = groups.filter(x => !idsToDelete.includes(x.id))
      setActiveGroup(remaining[0] || null)
    }
    setConfirmDelete(null)
    refreshGroups()
  }

  // ── Navigation helpers ──

  const topGroups = useMemo(() => groups.filter(g => !g.parentId), [groups])
  const subGroups = useCallback(
    (parentId) => groups.filter(g => String(g.parentId) === String(parentId)),
    [groups]
  )

  const selectGroup = (g) => {
    setActiveGroup(g)
    setActiveNav('overview')
    setShowDashboard(false)
    setShowProfile(false)
  }

  const toggleExpand = (id, e) => {
    e.stopPropagation()
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const expandGroup = useCallback(
    (id) => setExpanded(prev => ({ ...prev, [id]: true })),
    []
  )

  const openSubgroupModal = (parentId, e) => {
    e.stopPropagation()
    setSubgroupParentId(parentId)
    setGroupModalOpen(true)
  }

  // ── Reminders badge count ──

  const pendingCount = useMemo(() => {
    if (!myMember || !members.length) return 0
    const debts = simplifyDebts(computeBalances(expenses, payments, members))
    return debts.filter(tx => String(tx.from) === String(myMember.id)).length
  }, [members, expenses, payments, myMember])

  return (
    <AppContext.Provider value={{
      groups, topGroups, subGroups,
      activeGroup, selectGroup,
      members, expenses, payments, reminders, loading, refresh,
      myMember, isGroupAdmin,
      activeNav, setActiveNav,
      showDashboard, setShowDashboard,
      showProfile, setShowProfile,
      expanded, toggleExpand, expandGroup,
      groupModalOpen, setGroupModalOpen,
      groupModalDefaultType, setGroupModalDefaultType,
      subgroupParentId, setSubgroupParentId, openSubgroupModal,
      partWizardOpen, setPartWizardOpen,
      catPickerOpen, setCatPickerOpen,
      expModalOpen, setExpModalOpen,
      inviteModalOpen, setInviteModalOpen,
      confirmDelete, setConfirmDelete,
      deleteGroup, refreshGroups,
      pendingCount,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
