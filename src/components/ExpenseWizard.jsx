import React, { useState, useEffect, useRef } from 'react'
import Modal from './Modal'
import Btn from './Btn'
import Avatar from './Avatar'
import GuestBadge from './GuestBadge'
import { api } from '../utils/api'
import { CATEGORIES } from '../utils/balance'
import { enrichExpensePayload } from '../modules/expenses'
import { useToast } from '../utils/ToastContext'
import Spinner from './Spinner'

const SPLIT_MODES = [
  { id: 'equal',   label: 'Parts égales' },
  { id: 'custom',  label: 'Pourcentages' },
  { id: 'amounts', label: 'Montants' },
]

const memberIds = (members) => members.map(m => String(m.id))

function defaultForm(expense, members) {
  return {
    description:   expense?.description  || '',
    amount:        expense?.amount       || '',
    paidById:      expense?.paidById
      ? String(expense.paidById)
      : members[0] ? String(members[0].id) : '',
    splitBetween:  expense?.splitBetween
      ? expense.splitBetween.map(String).filter(id => members.some(m => String(m.id) === id))
      : memberIds(members),
    splitMode:     expense?.splitMode    || 'equal',
    customShares:  expense?.customShares || {},
    customAmounts: expense?.customAmounts || {},
    date:          expense?.date         || new Date().toISOString().split('T')[0],
    category:      expense?.category     || 'autre',
    note:          expense?.note         || '',
  }
}

function StepDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i < current ? 20 : 8,
          height: 8,
          borderRadius: 4,
          background: i < current ? 'var(--green)' : 'var(--border-hover)',
          transition: 'all 0.2s',
        }} />
      ))}
    </div>
  )
}

export default function ExpenseWizard({ open, onClose, groupId, members: propMembers, onSaved, expense }) {
  const toast = useToast()
  const editing = !!expense
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => defaultForm(expense, propMembers))
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState(propMembers)
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [guestForm, setGuestForm] = useState({ name: '', email: '' })
  const [guestLoading, setGuestLoading] = useState(false)
  const [showMemberSearch, setShowMemberSearch] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [memberSearchErr, setMemberSearchErr] = useState('')
  const [memberSearchLoading, setMemberSearchLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const descRef = useRef(null)
  const initKey = useRef('')

  useEffect(() => { setMembers(propMembers) }, [propMembers])

  useEffect(() => {
    const key = `${open}-${expense?.id || 'new'}-${propMembers.map(m => m.id).join(',')}`
    if (open && propMembers.length > 0 && key !== initKey.current) {
      initKey.current = key
      setStep(1)
      setForm(defaultForm(expense, propMembers))
      setErrors({})
      setShowGuestForm(false)
      setGuestForm({ name: '', email: '' })
      setShowMemberSearch(false)
      setMemberQuery('')
      setMemberResults([])
      setMemberSearchErr('')
    }
    if (!open) initKey.current = ''
  }, [open, expense?.id, propMembers])

  useEffect(() => {
    if (open && step === 1 && descRef.current) {
      const t = setTimeout(() => descRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open, step])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── Validation ──

  const validateStep1 = () => {
    const e = {}
    if (!form.description.trim() || form.description.trim().length < 2)
      e.description = 'Description trop courte (2 caractères min)'
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0 || amt > 99999)
      e.amount = 'Montant invalide (entre 0,01 et 99 999 €)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep2 = () => {
    const e = {}
    if (form.splitBetween.length === 0) {
      e.split = 'Sélectionnez au moins un membre'
    } else if (form.splitMode === 'custom') {
      const total = form.splitBetween.reduce((s, id) => s + parseFloat(form.customShares[id] || 0), 0)
      if (Math.abs(total - 100) > 0.5) e.split = 'Le total des pourcentages doit être 100%'
    } else if (form.splitMode === 'amounts') {
      const total = form.splitBetween.reduce((s, id) => s + parseFloat(form.customAmounts[id] || 0), 0)
      const amt = parseFloat(form.amount) || 0
      if (Math.abs(total - amt) > 0.01)
        e.split = `Le total des montants doit être ${amt.toFixed(2)} €`
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const goNext = () => {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setErrors({})
    setStep(s => s + 1)
  }

  const goBack = () => { setErrors({}); setStep(s => s - 1) }

  // ── Split helpers ──

  const toggleSplit = (id) => {
    const sid = String(id)
    set('splitBetween', form.splitBetween.includes(sid)
      ? form.splitBetween.filter(x => x !== sid)
      : [...form.splitBetween, sid])
  }

  const setSplitMode = (mode) => {
    setForm(f => ({
      ...f,
      splitMode: mode,
      splitBetween: mode === 'equal' ? memberIds(members) : f.splitBetween,
    }))
  }

  const setCustomShare = (id, val) => {
    const sid = String(id)
    const entered = parseFloat(val) || 0
    const others = form.splitBetween.filter(x => x !== sid)
    if (others.length === 0) {
      setForm(f => ({ ...f, customShares: { ...f.customShares, [sid]: Math.min(100, entered) } }))
      return
    }
    const remaining = Math.max(0, 100 - entered)
    const otherTotal = others.reduce((s, oid) => s + parseFloat(form.customShares[oid] || 0), 0)
    const newShares = { ...form.customShares, [sid]: val }
    if (otherTotal > 0) {
      others.forEach(oid => {
        newShares[oid] = parseFloat(((parseFloat(form.customShares[oid] || 0) / otherTotal) * remaining).toFixed(2))
      })
    } else {
      const eq = parseFloat((remaining / others.length).toFixed(2))
      others.forEach((oid, i) => {
        if (i === others.length - 1) {
          const assigned = others.slice(0, -1).reduce((s, x) => s + parseFloat(newShares[x] || 0), 0)
          newShares[oid] = parseFloat((remaining - assigned).toFixed(2))
        } else {
          newShares[oid] = eq
        }
      })
    }
    setForm(f => ({ ...f, customShares: newShares }))
  }

  const setCustomAmount = (id, val) => {
    const sid = String(id)
    const total = parseFloat(form.amount) || 0
    const entered = parseFloat(val) || 0
    const others = form.splitBetween.filter(x => x !== sid)
    if (others.length === 0) {
      setForm(f => ({ ...f, customAmounts: { ...f.customAmounts, [sid]: val } }))
      return
    }
    const remaining = Math.max(0, total - entered)
    const otherTotal = others.reduce((s, oid) => s + parseFloat(form.customAmounts[oid] || 0), 0)
    const newAmounts = { ...form.customAmounts, [sid]: val }
    if (otherTotal > 0) {
      others.forEach(oid => {
        newAmounts[oid] = parseFloat(((parseFloat(form.customAmounts[oid] || 0) / otherTotal) * remaining).toFixed(2))
      })
    } else {
      const eq = parseFloat((remaining / others.length).toFixed(2))
      others.forEach((oid, i) => {
        if (i === others.length - 1) {
          const assigned = others.slice(0, -1).reduce((s, x) => s + parseFloat(newAmounts[x] || 0), 0)
          newAmounts[oid] = parseFloat((remaining - assigned).toFixed(2))
        } else {
          newAmounts[oid] = eq
        }
      })
    }
    setForm(f => ({ ...f, customAmounts: newAmounts }))
  }

  // ── Guest ──

  const addGuest = async () => {
    if (guestForm.name.trim().length < 2) return
    setGuestLoading(true)
    try {
      const name = guestForm.name.trim()
      const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
      const guest = await api.addGuest({
        groupId,
        userId: null,
        name,
        email: guestForm.email.trim() || null,
        initials,
        color: '#F3E8FF',
        textColor: '#6B21A8',
        invitedByUserId: null,
      })
      setMembers(prev => [...prev, guest])
      setForm(f => ({ ...f, splitBetween: [...f.splitBetween, String(guest.id)] }))
      setShowGuestForm(false)
      setGuestForm({ name: '', email: '' })
    } finally {
      setGuestLoading(false)
    }
  }

  // ── Member search (invite existing user) ──

  const handleMemberQueryChange = async (val) => {
    setMemberQuery(val)
    setMemberSearchErr('')
    setMemberResults([])
    if (val.trim().length < 2) return
    setMemberSearchLoading(true)
    try {
      const results = await api.searchProfiles(val)
      const filtered = results.filter(u => !members.some(m => String(m.userId) === String(u.id)))
      if (!filtered.length) setMemberSearchErr('Aucun compte trouvé.')
      setMemberResults(filtered)
    } catch {
      setMemberSearchErr('Erreur lors de la recherche.')
    } finally {
      setMemberSearchLoading(false)
    }
  }

  const addFoundMember = async (profile) => {
    setMemberSearchLoading(true)
    try {
      const newMember = await api.addMember({
        groupId,
        userId: profile.id,
        name: profile.name,
        email: profile.email,
        initials: profile.initials,
        color: profile.color,
        textColor: profile.textColor,
        role: 'member',
        isGuest: false,
      })
      setMembers(prev => [...prev, newMember])
      setForm(f => ({ ...f, splitBetween: [...f.splitBetween, String(newMember.id)] }))
      setShowMemberSearch(false)
      setMemberQuery('')
      setMemberResults([])
      setMemberSearchErr('')
    } finally {
      setMemberSearchLoading(false)
    }
  }

  // ── Preview ──

  const computePreview = () => {
    const total = parseFloat(form.amount) || 0
    const n = form.splitBetween.length
    if (n === 0) return []
    if (form.splitMode === 'custom') {
      return form.splitBetween.map(id => ({
        id,
        amount: total * (parseFloat(form.customShares[id] || 0) / 100),
        pct: parseFloat(form.customShares[id] || 0),
      }))
    }
    if (form.splitMode === 'amounts') {
      return form.splitBetween.map(id => ({
        id,
        amount: parseFloat(form.customAmounts[id] || 0),
        pct: total > 0 ? (parseFloat(form.customAmounts[id] || 0) / total) * 100 : 0,
      }))
    }
    return form.splitBetween.map(id => ({ id, amount: total / n, pct: 100 / n }))
  }

  const totalCustomPct = form.splitMode === 'custom'
    ? form.splitBetween.reduce((s, id) => s + parseFloat(form.customShares[id] || 0), 0)
    : 100

  const totalCustomAmt = form.splitMode === 'amounts'
    ? form.splitBetween.reduce((s, id) => s + parseFloat(form.customAmounts[id] || 0), 0)
    : parseFloat(form.amount) || 0

  const preview = computePreview()

  // ── Submit ──

  // Preserve the original ID type (number vs string) from json-server
  const coerceId = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 && String(n) === String(v) ? n : v }

  const handleSubmit = async () => {
    if (!validateStep2()) { setStep(2); return }
    setLoading(true)
    try {
      const payer = members.find(m => String(m.id) === String(form.paidById))
      const raw = {
        description:     form.description.trim(),
        amount:          parseFloat(form.amount),
        paidById:        coerceId(form.paidById),
        paidByUserId:    payer?.userId || null,
        paidByName:      payer?.name   || '',
        splitBetween:    form.splitBetween.map(coerceId),
        splitMode:       form.splitMode,
        customShares:    form.splitMode === 'custom'  ? form.customShares  : {},
        customAmounts:   form.splitMode === 'amounts' ? form.customAmounts : {},
        date:            form.date,
        category:        form.category,
        note:            form.note.trim() || null,
        groupId,
        isSettlement:    false,
        createdAt:       editing ? expense.createdAt : new Date().toISOString(),
        updatedAt:       editing ? new Date().toISOString() : null,
        createdByUserId: payer?.userId || null,
      }
      const payload = enrichExpensePayload(raw)
      if (editing) await api.updateExpense(expense.id, payload)
      else         await api.createExpense(payload)
      toast.success(editing ? 'Dépense modifiée' : 'Dépense ajoutée')
      onSaved()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  // ── Shared styles ──

  const inp = {
    width: '100%', padding: '8px 10px',
    border: '0.5px solid var(--border-hover)',
    borderRadius: 'var(--radius)', fontSize: '13px',
    background: 'var(--bg)', color: 'var(--text)',
    fontFamily: 'inherit', boxSizing: 'border-box',
  }
  const lbl  = { fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }
  const grp  = { marginBottom: '14px' }
  const err  = { fontSize: '11px', color: 'var(--red)', marginTop: '4px' }
  const chip = (active, bg) => ({
    padding: '5px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
    border: `0.5px solid ${active ? 'var(--green)' : 'var(--border-hover)'}`,
    background: active ? (bg || 'var(--green-light)') : 'transparent',
    color: active ? 'var(--green-dark)' : 'var(--text-secondary)',
    fontWeight: active ? 500 : 400, fontFamily: 'inherit', transition: 'all 0.15s',
  })

  const title = editing
    ? `Modifier — Étape ${step}/3`
    : `Nouvelle dépense — Étape ${step}/3`

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ marginBottom: '20px', marginTop: '-4px' }}>
        <StepDots current={step} total={3} />
      </div>

      {/* ══════════════ ÉTAPE 1 — Essentiel ══════════════ */}
      {step === 1 && (
        <div>
          <div style={grp}>
            <label htmlFor="ew-desc" style={lbl}>Description</label>
            <input
              id="ew-desc"
              ref={descRef}
              style={{ ...inp, borderColor: errors.description ? 'var(--red)' : undefined }}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && goNext()}
              placeholder="Ex : Restaurant du soir"
            />
            {errors.description && <div role="alert" style={err}>{errors.description}</div>}
          </div>

          <div style={grp}>
            <label htmlFor="ew-amount" style={lbl}>Montant (€)</label>
            <input
              id="ew-amount"
              style={{ ...inp, borderColor: errors.amount ? 'var(--red)' : undefined }}
              type="number" min="0.01" step="0.01"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && goNext()}
              placeholder="0.00"
            />
            {errors.amount && <div role="alert" style={err}>{errors.amount}</div>}
          </div>

          <div style={grp}>
            <label style={lbl}>Payé par</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {members.map(m => {
                const active = String(m.id) === String(form.paidById)
                return (
                  <button key={m.id} type="button" onClick={() => set('paidById', String(m.id))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '5px 10px', borderRadius: '20px', cursor: 'pointer',
                      border: `0.5px solid ${active ? 'var(--green)' : 'var(--border-hover)'}`,
                      background: active ? 'var(--green-light)' : 'transparent',
                      color: active ? 'var(--green-dark)' : 'var(--text-secondary)',
                      fontSize: '12px', fontFamily: 'inherit', transition: 'all 0.15s',
                    }}>
                    <Avatar initials={m.initials} color={m.color} textColor={m.textColor} size={20} />
                    {m.name.split(' ')[0]}
                    {m.isGuest && <GuestBadge />}
                  </button>
                )
              })}
              <button type="button"
                onClick={() => { setShowGuestForm(v => !v); setShowMemberSearch(false) }}
                style={{
                  padding: '5px 10px', borderRadius: '20px', cursor: 'pointer',
                  border: '0.5px dashed var(--border-hover)',
                  background: showGuestForm ? 'var(--bg-secondary)' : 'transparent',
                  color: 'var(--text-secondary)', fontSize: '12px', fontFamily: 'inherit',
                }}>
                + Invité
              </button>
              <button type="button"
                onClick={() => { setShowMemberSearch(v => !v); setShowGuestForm(false) }}
                style={{
                  padding: '5px 10px', borderRadius: '20px', cursor: 'pointer',
                  border: '0.5px dashed var(--border-hover)',
                  background: showMemberSearch ? 'var(--bg-secondary)' : 'transparent',
                  color: 'var(--text-secondary)', fontSize: '12px', fontFamily: 'inherit',
                }}>
                + Membre existant
              </button>
            </div>

            {showGuestForm && (
              <div style={{ marginTop: '10px', padding: '10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input style={inp} placeholder="Nom (obligatoire)"
                  value={guestForm.name}
                  onChange={e => setGuestForm(g => ({ ...g, name: e.target.value }))} />
                <input style={inp} placeholder="Email (optionnel)"
                  value={guestForm.email}
                  onChange={e => setGuestForm(g => ({ ...g, email: e.target.value }))} />
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <Btn onClick={() => setShowGuestForm(false)}>Annuler</Btn>
                  <Btn variant="primary" onClick={addGuest}
                    disabled={guestLoading || guestForm.name.trim().length < 2}>
                    {guestLoading ? <Spinner /> : 'Ajouter'}
                  </Btn>
                </div>
              </div>
            )}

            {showMemberSearch && (
              <div style={{ marginTop: '10px', padding: '10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inp, paddingRight: 32 }}
                    placeholder="Nom ou email (2 caractères min)…"
                    value={memberQuery}
                    onChange={e => handleMemberQueryChange(e.target.value)}
                    autoFocus
                  />
                  {memberSearchLoading && (
                    <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
                      <Spinner size={14} />
                    </div>
                  )}
                </div>
                {memberSearchErr && (
                  <div style={{ fontSize: '11px', color: 'var(--red)' }}>{memberSearchErr}</div>
                )}
                {memberResults.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '0.5px solid var(--border)' }}>
                    <Avatar initials={u.initials} color={u.color} textColor={u.textColor} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{u.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{u.email}</div>
                    </div>
                    <Btn variant="primary" onClick={() => addFoundMember(u)} disabled={memberSearchLoading}>
                      Ajouter
                    </Btn>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Btn onClick={() => { setShowMemberSearch(false); setMemberQuery(''); setMemberResults([]); setMemberSearchErr('') }}>
                    Annuler
                  </Btn>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Btn onClick={onClose}>Annuler</Btn>
            <Btn variant="primary" onClick={goNext} disabled={members.length === 0}>
              Suivant →
            </Btn>
          </div>
        </div>
      )}

      {/* ══════════════ ÉTAPE 2 — Répartition ══════════════ */}
      {step === 2 && (
        <div>
          <div style={grp}>
            <label style={lbl}>Mode de répartition</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {SPLIT_MODES.map(m => (
                <button key={m.id} type="button" onClick={() => setSplitMode(m.id)}
                  style={chip(form.splitMode === m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div style={grp}>
            <label style={lbl}>Membres concernés</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {members.map(m => {
                const sid = String(m.id)
                const checked = form.splitBetween.includes(sid)
                const share = preview.find(p => p.id === sid)
                return (
                  <button key={m.id} type="button" onClick={() => toggleSplit(m.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      padding: '8px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
                      border: `0.5px solid ${checked ? 'var(--green)' : 'var(--border)'}`,
                      background: checked ? 'var(--green-light)' : 'transparent',
                      fontFamily: 'inherit', transition: 'all 0.15s', minWidth: '60px',
                    }}>
                    <Avatar
                      initials={m.initials}
                      color={checked ? m.color : '#ccc'}
                      textColor={checked ? m.textColor : '#999'}
                      size={28}
                    />
                    <span style={{ fontSize: '11px', color: checked ? 'var(--green-dark)' : 'var(--text-secondary)', fontWeight: checked ? 500 : 400 }}>
                      {m.name.split(' ')[0]}
                    </span>
                    {checked && share && (
                      <span style={{ fontSize: '10px', color: 'var(--green-dark)', fontWeight: 600 }}>
                        {share.amount.toFixed(2)} €
                      </span>
                    )}
                    {m.isGuest && <GuestBadge />}
                  </button>
                )
              })}
            </div>
            {errors.split && <div role="alert" style={err}>{errors.split}</div>}
          </div>

          {/* Pourcentages personnalisés */}
          {form.splitMode === 'custom' && form.splitBetween.length > 0 && (
            <div style={grp}>
              {form.splitBetween.map(id => {
                const m = members.find(x => String(x.id) === id)
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div style={{ fontSize: '13px', flex: 1 }}>{m?.name || id}</div>
                    <input style={{ ...inp, width: '72px', textAlign: 'right' }}
                      type="number" min="0" max="100" step="1"
                      value={form.customShares[id] || ''}
                      onChange={e => setCustomShare(id, e.target.value)}
                      placeholder="0" />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>%</span>
                  </div>
                )
              })}
              <div style={{ fontSize: '12px', fontWeight: 500, color: Math.abs(totalCustomPct - 100) < 0.5 ? 'var(--green-dark)' : 'var(--red)' }}>
                Total : {totalCustomPct.toFixed(0)}%{Math.abs(totalCustomPct - 100) < 0.5 ? ' ✓' : ' (doit être 100%)'}
              </div>
            </div>
          )}

          {/* Montants fixes */}
          {form.splitMode === 'amounts' && form.splitBetween.length > 0 && (
            <div style={grp}>
              {form.splitBetween.map(id => {
                const m = members.find(x => String(x.id) === id)
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div style={{ fontSize: '13px', flex: 1 }}>{m?.name || id}</div>
                    <input style={{ ...inp, width: '90px', textAlign: 'right' }}
                      type="number" min="0" step="0.01"
                      value={form.customAmounts[id] || ''}
                      onChange={e => setCustomAmount(id, e.target.value)}
                      placeholder="0.00" />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>€</span>
                  </div>
                )
              })}
              <div style={{ fontSize: '12px', fontWeight: 500, color: Math.abs(totalCustomAmt - (parseFloat(form.amount) || 0)) < 0.01 ? 'var(--green-dark)' : 'var(--red)' }}>
                Total : {totalCustomAmt.toFixed(2)} € / {parseFloat(form.amount || 0).toFixed(2)} €
                {Math.abs(totalCustomAmt - (parseFloat(form.amount) || 0)) < 0.01 ? ' ✓' : ''}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <Btn onClick={goBack}>← Retour</Btn>
            <Btn variant="primary" onClick={goNext}>Suivant →</Btn>
          </div>
        </div>
      )}

      {/* ══════════════ ÉTAPE 3 — Détails ══════════════ */}
      {step === 3 && (
        <div>
          <div style={grp}>
            <label style={lbl}>Catégorie</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <button key={key} type="button" onClick={() => set('category', key)}
                  style={chip(form.category === key, cat.bg)}>
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', ...grp }}>
            <div>
              <label style={lbl}>Date</label>
              <input style={inp} type="date" value={form.date}
                onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Note (optionnel)</label>
              <input style={inp} value={form.note}
                onChange={e => set('note', e.target.value)}
                placeholder="Remarque…" />
            </div>
          </div>

          {/* Récapitulatif final */}
          {form.splitBetween.length > 0 && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Récapitulatif
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
                {form.description} — {parseFloat(form.amount || 0).toFixed(2)} €
              </div>
              {preview.map(s => {
                const m = members.find(x => String(x.id) === s.id)
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    <span>{m?.name || s.id}{m?.isGuest && <> <GuestBadge /></>}</span>
                    <span style={{ fontWeight: 500, color: 'var(--text)' }}>{s.amount.toFixed(2)} €</span>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <Btn onClick={goBack}>← Retour</Btn>
            <Btn variant="primary" onClick={handleSubmit} disabled={loading}>
              {loading ? <Spinner /> : editing ? 'Modifier' : '✓ Ajouter'}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}
