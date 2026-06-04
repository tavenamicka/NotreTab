import React, { useState } from 'react'
import Modal from './Modal'
import Btn from './Btn'
import { api } from '../utils/api'
import { useAuth } from '../utils/AuthContext'
import { useToast } from '../utils/ToastContext'

const COLORS = ['#1D9E75','#378ADD','#D85A30','#9370DB','#EF9F27','#E24B4A']

const BUDGET_MODES = [
  { id: 'temporal', icon: '🗓', label: 'Temporel' },
  { id: 'thematic', icon: '🏷', label: 'Thématique' },
]
export const BUDGET_THEMES = [
  { id: 'travel',  icon: '✈️', label: 'Voyage' },
  { id: 'event',   icon: '🎉', label: 'Événement' },
  { id: 'project', icon: '💼', label: 'Projet' },
  { id: 'home',    icon: '🏠', label: 'Maison' },
  { id: 'sport',   icon: '🏃', label: 'Sport' },
  { id: 'other',   icon: '🏷', label: 'Autre' },
]

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const CUR_YEAR  = new Date().getFullYear()
const CUR_MONTH = new Date().getMonth() + 1
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => CUR_YEAR - 1 + i)

function buildSubgroupName(mode, month, year) {
  const m = mode === 'auto' ? CUR_MONTH - 1 : month - 1
  const y = mode === 'auto' ? CUR_YEAR     : year
  return `${MONTHS_FR[m]} ${y}`
}

export default function GroupModal({ open, onClose, onSaved, groups = [], parentId = null, defaultType = 'occasional' }) {
  const { user } = useAuth()
  const toast = useToast()

  const [name,             setName]             = useState('')
  const [color,            setColor]            = useState(COLORS[0])
  const [type,             setType]             = useState(defaultType)
  const [selectedParent,   setSelectedParent]   = useState(parentId || '')
  const [importMembers,    setImportMembers]    = useState(true)
  const [loading,          setLoading]          = useState(false)
  const [budgetMode,       setBudgetMode]       = useState('temporal')
  const [budgetPeriod,     setBudgetPeriod]     = useState('year')
  const [budgetTheme,      setBudgetTheme]      = useState('travel')
  const [budgetYear,       setBudgetYear]       = useState(CUR_YEAR)
  const [subgroupDateMode, setSubgroupDateMode] = useState('auto')
  const [subgroupMonth,    setSubgroupMonth]    = useState(CUR_MONTH)
  const [subgroupYear,     setSubgroupYear]     = useState(CUR_YEAR)

  // Derived
  const parentGroup        = selectedParent ? groups.find(g => String(g.id) === String(selectedParent)) : null
  const isSubgroup         = !!selectedParent
  const isTemporalSub      = isSubgroup && parentGroup?.type === 'budget' && parentGroup?.budgetMode === 'temporal'
  const isTemporalBudget   = !isSubgroup && type === 'budget' && budgetMode === 'temporal'
  const topLevelGroups     = groups.filter(g => !g.parentId)

  // Reset on open
  React.useEffect(() => {
    if (!open) return
    const initParent = parentId || ''
    const pg = initParent ? groups.find(g => String(g.id) === String(initParent)) : null
    const isTempSub = !!initParent && pg?.type === 'budget' && pg?.budgetMode === 'temporal'

    setColor(COLORS[0])
    setType(defaultType)
    setSelectedParent(initParent)
    setImportMembers(true)
    setBudgetMode('temporal')
    setBudgetPeriod('year')
    setBudgetTheme('travel')
    setBudgetYear(CUR_YEAR)
    setSubgroupDateMode('auto')
    setSubgroupMonth(CUR_MONTH)
    setSubgroupYear(CUR_YEAR)
    setName(isTempSub ? buildSubgroupName('auto', CUR_MONTH, CUR_YEAR) : '')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill name when date option changes (temporal subgroup)
  React.useEffect(() => {
    if (isTemporalSub) {
      setName(buildSubgroupName(subgroupDateMode, subgroupMonth, subgroupYear))
    }
  }, [subgroupDateMode, subgroupMonth, subgroupYear, isTemporalSub])

  // Validation
  const canSubmit = isTemporalBudget ? !!budgetYear : !!name.trim()

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    const effectiveName = isTemporalBudget ? `Budget ${budgetYear}` : name.trim()
    const initials = effectiveName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    try {
      const groupPayload = {
        name: effectiveName,
        color: selectedParent
          ? (groups.find(g => String(g.id) === String(selectedParent))?.color || color)
          : color,
        initials,
        parentId: selectedParent || null,
        type: selectedParent ? null : type,
        createdAt: new Date().toISOString(),
      }

      if (type === 'budget' && !selectedParent) {
        groupPayload.budgetMode = budgetMode
        if (budgetMode === 'temporal') {
          groupPayload.budgetPeriod = budgetPeriod
          groupPayload.budgetYear   = budgetYear
        }
        if (budgetMode === 'thematic') groupPayload.budgetTheme = budgetTheme
      }

      if (isTemporalSub) {
        groupPayload.subgroupMonth = subgroupDateMode === 'auto' ? CUR_MONTH : subgroupMonth
        groupPayload.subgroupYear  = subgroupDateMode === 'auto' ? CUR_YEAR  : subgroupYear
      }

      const group = await api.createGroup(groupPayload)

      if (user && group?.id) {
        await api.addMember({
          groupId: group.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          initials: user.initials,
          color: user.color,
          textColor: user.textColor,
          role: 'admin',
          isGuest: false,
        })

        if (selectedParent && importMembers) {
          const parentMembers = await api.getMembersByGroup(selectedParent)
          const toImport = parentMembers.filter(
            m => !m.isGuest && String(m.userId) !== String(user.id)
          )
          for (const m of toImport) {
            await api.addMember({
              groupId: group.id,
              userId: m.userId,
              name: m.name,
              email: m.email,
              initials: m.initials,
              color: m.color,
              textColor: m.textColor,
              role: m.role,
              isGuest: false,
            })
          }
        }
      }

      onSaved()
    } catch {
      toast.error('Erreur lors de la création du groupe. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  const inp = { width: '100%', padding: '8px 10px', border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', fontSize: '13px', background: 'var(--bg)', color: 'var(--text)' }
  const lbl = { fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }

  const handleBudgetModeChange = (mode) => {
    setBudgetMode(mode)
    if (mode === 'temporal') setSelectedParent('')
  }

  const btnStyle = (active) => ({
    flex: 1, padding: '8px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
    border: `0.5px solid ${active ? 'var(--green)' : 'var(--border-hover)'}`,
    background: active ? 'var(--green-light)' : 'transparent',
    color: active ? 'var(--green-dark)' : 'var(--text-secondary)',
    fontSize: '12px', fontFamily: 'inherit', fontWeight: active ? 500 : 400,
    transition: 'all 0.15s', textAlign: 'center',
  })

  return (
    <Modal open={open} onClose={onClose} title={isSubgroup ? 'Nouveau sous-groupe' : 'Nouveau groupe'}>

      {/* ── Période de début (sous-groupe temporel uniquement) ── */}
      {isTemporalSub && (
        <div style={{ marginBottom: '14px' }}>
          <label style={lbl}>Période de début</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            {[
              { id: 'auto',   icon: '📍', label: 'Mois en cours', sub: `${MONTHS_FR[CUR_MONTH - 1]} ${CUR_YEAR}` },
              { id: 'manual', icon: '🗓', label: 'Choisir',        sub: 'Sélection manuelle' },
            ].map(opt => (
              <button key={opt.id} type="button" onClick={() => setSubgroupDateMode(opt.id)}
                style={{ ...btnStyle(subgroupDateMode === opt.id), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 8px' }}>
                <span style={{ fontSize: 18 }}>{opt.icon}</span>
                <span style={{ fontWeight: subgroupDateMode === opt.id ? 600 : 400 }}>{opt.label}</span>
                <span style={{ fontSize: 11, color: subgroupDateMode === opt.id ? 'var(--green)' : 'var(--text-tertiary)' }}>{opt.sub}</span>
              </button>
            ))}
          </div>
          {subgroupDateMode === 'manual' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="gm-sub-month" style={lbl}>Mois</label>
                <select id="gm-sub-month" style={inp} value={subgroupMonth} onChange={e => setSubgroupMonth(Number(e.target.value))}>
                  {MONTHS_FR.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="gm-sub-year" style={lbl}>Année</label>
                <select id="gm-sub-year" style={inp} value={subgroupYear} onChange={e => setSubgroupYear(Number(e.target.value))}>
                  {YEAR_OPTIONS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Nom (masqué pour budget temporel — auto-généré à partir de l'année) ── */}
      {!isTemporalBudget && (
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="gm-name" style={lbl}>
            Nom
            {isTemporalSub && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 6 }}>
                (pré-rempli, modifiable)
              </span>
            )}
          </label>
          <input
            id="gm-name"
            style={inp}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={isSubgroup ? (isTemporalSub ? 'Ex : Mai 2026' : 'Ex : Semaine 1') : 'Ex : Vacances été 2025'}
          />
        </div>
      )}

      {/* ── Groupe parent (masqué pour budget temporel) ── */}
      {topLevelGroups.length > 0 && !isTemporalBudget && (
        <div style={{ marginBottom: '12px' }}>
          <label style={lbl}>Groupe parent (optionnel)</label>
          <select style={inp} value={selectedParent} onChange={e => setSelectedParent(e.target.value)}>
            <option value="">— Aucun (groupe principal) —</option>
            {topLevelGroups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          {isSubgroup && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Ce groupe apparaîtra sous "{groups.find(g => String(g.id) === String(selectedParent))?.name}"
            </div>
          )}
        </div>
      )}

      {/* ── Import membres ── */}
      {isSubgroup && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={importMembers}
              onChange={e => setImportMembers(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: 'var(--green)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>
              Importer les membres du groupe parent
            </span>
          </label>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', marginLeft: '23px' }}>
            Les invités ne sont pas importés
          </div>
        </div>
      )}

      {/* ── Type (top-level uniquement) ── */}
      {!isSubgroup && (
        <div style={{ marginBottom: '14px' }}>
          <label style={lbl}>Type</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'occasional', icon: '🤝', label: 'Participation occasionnelle' },
              { id: 'budget',     icon: '📊', label: 'Budget commun' },
            ].map(t => (
              <button key={t.id} type="button" onClick={() => setType(t.id)} style={btnStyle(type === t.id)}>
                <div style={{ fontSize: 16, marginBottom: 2 }}>{t.icon}</div>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Config budget (top-level uniquement) ── */}
      {!isSubgroup && type === 'budget' && (
        <div style={{ marginBottom: '14px' }}>
          <label style={lbl}>Mode de budget</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            {BUDGET_MODES.map(m => (
              <button key={m.id} type="button" onClick={() => handleBudgetModeChange(m.id)} style={btnStyle(budgetMode === m.id)}>
                <div style={{ fontSize: 16, marginBottom: 2 }}>{m.icon}</div>
                {m.label}
              </button>
            ))}
          </div>

          {budgetMode === 'temporal' && (
            <>
              {/* Année obligatoire */}
              <div>
                <label htmlFor="gm-budget-year" style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 4 }}>
                  Année du budget
                  <span style={{ color: 'var(--red)', fontWeight: 600 }}>*</span>
                </label>
                <select
                  id="gm-budget-year"
                  style={{
                    ...inp,
                    border: `0.5px solid ${!budgetYear ? 'var(--red)' : 'var(--border-hover)'}`,
                  }}
                  value={budgetYear || ''}
                  onChange={e => setBudgetYear(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">— Sélectionner une année —</option>
                  {YEAR_OPTIONS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                {!budgetYear && (
                  <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '4px' }}>
                    L'année est obligatoire pour un budget temporel
                  </div>
                )}
              </div>
            </>
          )}

          {budgetMode === 'thematic' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {BUDGET_THEMES.map(t => (
                <button key={t.id} type="button" onClick={() => setBudgetTheme(t.id)}
                  style={{
                    padding: '6px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
                    border: `0.5px solid ${budgetTheme === t.id ? 'var(--green)' : 'var(--border-hover)'}`,
                    background: budgetTheme === t.id ? 'var(--green-light)' : 'transparent',
                    color: budgetTheme === t.id ? 'var(--green-dark)' : 'var(--text-secondary)',
                    fontSize: '12px', fontFamily: 'inherit', fontWeight: budgetTheme === t.id ? 500 : 400,
                    transition: 'all 0.15s',
                  }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Couleur (top-level uniquement) ── */}
      {!isSubgroup && (
        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Couleur</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setColor(c)} style={{
                width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                border: color === c ? '3px solid var(--text)' : '3px solid transparent',
                transition: 'border 0.15s',
              }} />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Annuler</Btn>
        <Btn variant="primary" onClick={handleSubmit} disabled={loading || !canSubmit}>
          {loading ? '...' : isSubgroup ? 'Créer le sous-groupe' : 'Créer le groupe'}
        </Btn>
      </div>
    </Modal>
  )
}
