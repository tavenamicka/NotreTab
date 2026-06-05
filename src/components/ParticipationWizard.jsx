import React, { useState, useEffect, useRef } from 'react'
import Modal from './Modal'
import Avatar from './Avatar'
import Spinner from './Spinner'
import { api } from '../utils/api'
import { useAuth } from '../utils/AuthContext'
import { useToast } from '../utils/ToastContext'
import { CATEGORIES } from '../utils/balance'
import { enrichExpensePayload } from '../modules/expenses'

// ── Helpers ───────────────────────────────────────────────────
const haptic = (ms = 40) => { try { navigator.vibrate?.(ms) } catch (_) {} }

const GROUP_COLORS = ['#1D9E75', '#378ADD', '#D85A30', '#9370DB', '#EF9F27', '#E24B4A']

function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

// ── Step dots ─────────────────────────────────────────────────
function StepDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i < current ? 22 : 8, height: 8, borderRadius: 4,
          background: i < current ? 'var(--green)' : 'var(--border-hover)',
          transition: 'all 0.2s',
        }} />
      ))}
    </div>
  )
}

// ── Participant chip ──────────────────────────────────────────
function ParticipantChip({ p, isCreator, isPayer, onRemove, onSetPayer }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 'var(--radius)',
      border: isPayer ? '1.5px solid var(--green)' : '0.5px solid var(--border)',
      background: isPayer ? 'var(--green-light)' : 'var(--bg)',
      transition: 'border-color 0.15s, background 0.15s',
      cursor: onSetPayer ? 'pointer' : 'default',
    }} onClick={onSetPayer}>
      <Avatar initials={p.initials} color={p.color} textColor={p.textColor || '#fff'} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.name} {isCreator ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>(vous)</span> : null}
        </div>
        {p.email && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>}
        {p.isGuest && <span style={{ fontSize: 10, background: '#FFF3CD', color: '#856404', padding: '1px 6px', borderRadius: 10, fontWeight: 500 }}>Invité</span>}
      </div>
      {isPayer && (
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green-dark)', flexShrink: 0 }}>A payé ✓</span>
      )}
      {!isCreator && !isPayer && onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove(p.id) }} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 16, color: 'var(--text-tertiary)', lineHeight: 1,
          padding: '2px 4px', borderRadius: 4,
        }}>×</button>
      )}
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────
export default function ParticipationWizard({ open, onClose, onSaved }) {
  const { user } = useAuth()
  const toast = useToast()

  const [step, setStep] = useState(1)
  const [stepDir, setStepDir] = useState('forward') // 'forward' | 'back'
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  // Step 1 — La facture
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('autre')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  // Step 2 — Les participants
  const creatorParticipant = user ? {
    id: `u-${user.id}`,
    userId: user.id,
    name: user.name,
    email: user.email,
    initials: user.initials,
    color: user.color,
    textColor: user.textColor,
    isGuest: false,
    isCreator: true,
  } : null

  const [participants, setParticipants] = useState([])
  const [payerId, setPayerId] = useState(creatorParticipant?.id || '')

  // Participant search
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResult, setSearchResult] = useState(null) // null | 'loading' | user | 'notfound'
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')

  // Step 3 — Répartition
  const [splitMode, setSplitMode] = useState('equal')
  const [customShares, setCustomShares] = useState({})  // id → percentage
  const [customAmounts, setCustomAmounts] = useState({}) // id → amount

  const descRef = useRef(null)

  // ── Reset on open ─────────────────────────────────────────────
  useEffect(() => {
    if (!open || !creatorParticipant) return
    setStep(1)
    setDescription('')
    setAmount('')
    setCategory('autre')
    setDate(new Date().toISOString().split('T')[0])
    setParticipants([creatorParticipant])
    setPayerId(creatorParticipant.id)
    setSplitMode('equal')
    setCustomShares({})
    setCustomAmounts({})
    setErrors({})
    setSearchEmail('')
    setSearchResult(null)
    setShowGuestForm(false)
    setGuestName('')
    setGuestEmail('')
    setTimeout(() => descRef.current?.focus(), 60)
  }, [open])

  // ── Search by email ───────────────────────────────────────────
  const searchTimeout = useRef(null)
  useEffect(() => {
    if (!searchEmail.trim() || !searchEmail.includes('@')) {
      setSearchResult(null)
      return
    }
    clearTimeout(searchTimeout.current)
    setSearchResult('loading')
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await api.getUserByEmail(searchEmail.trim().toLowerCase())
        const found = Array.isArray(res) ? res[0] : res
        if (found) setSearchResult(found)
        else setSearchResult('notfound')
      } catch {
        setSearchResult('notfound')
      }
    }, 400)
    return () => clearTimeout(searchTimeout.current)
  }, [searchEmail])

  // ── Participant actions ───────────────────────────────────────
  const alreadyAdded = (userId) =>
    participants.some(p => p.userId && String(p.userId) === String(userId))

  const addRegisteredUser = (u) => {
    if (alreadyAdded(u.id)) { toast.error('Déjà ajouté'); return }
    const p = {
      id: `u-${u.id}`,
      userId: u.id,
      name: u.name,
      email: u.email,
      initials: u.initials || initials(u.name),
      color: u.color || '#6b6b6b',
      textColor: u.textColor || '#fff',
      isGuest: false,
    }
    setParticipants(prev => [...prev, p])
    setSearchEmail('')
    setSearchResult(null)
  }

  const addGuest = () => {
    if (!guestName.trim()) return
    const g = {
      id: `g-${Date.now()}`,
      userId: null,
      name: guestName.trim(),
      email: guestEmail.trim() || '',
      initials: initials(guestName),
      color: GROUP_COLORS[participants.length % GROUP_COLORS.length],
      textColor: '#fff',
      isGuest: true,
    }
    setParticipants(prev => [...prev, g])
    setGuestName('')
    setGuestEmail('')
    setShowGuestForm(false)
  }

  const removeParticipant = (id) => {
    setParticipants(prev => prev.filter(p => p.id !== id))
    if (payerId === id) setPayerId(creatorParticipant?.id || '')
  }

  // ── Validation ────────────────────────────────────────────────
  const validateStep1 = () => {
    const e = {}
    if (!description.trim() || description.trim().length < 2)
      e.description = 'Description trop courte (2 caractères min)'
    const amt = parseFloat(amount)
    if (!amt || amt <= 0 || amt > 99999)
      e.amount = 'Montant invalide (0,01 – 99 999 €)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep2 = () => {
    const e = {}
    if (participants.length < 2) e.participants = 'Ajoutez au moins un autre participant'
    if (!payerId) e.payer = 'Indiquez qui a payé'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep3 = () => {
    const e = {}
    const total = parseFloat(amount)
    if (splitMode === 'custom') {
      const sum = participants.reduce((s, p) => s + parseFloat(customShares[p.id] || 0), 0)
      if (Math.abs(sum - 100) > 0.5) e.split = `Total des pourcentages : ${sum.toFixed(1)} % (doit être 100 %)`
    }
    if (splitMode === 'amounts') {
      const sum = participants.reduce((s, p) => s + parseFloat(customAmounts[p.id] || 0), 0)
      if (Math.abs(sum - total) > 0.01) e.split = `Total des montants : ${sum.toFixed(2)} € (doit être ${total.toFixed(2)} €)`
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Répartition preview ───────────────────────────────────────
  const getShare = (p) => {
    const total = parseFloat(amount) || 0
    if (splitMode === 'equal') return total / participants.length
    if (splitMode === 'custom') return (total * (parseFloat(customShares[p.id] || 0) / 100))
    if (splitMode === 'amounts') return parseFloat(customAmounts[p.id] || 0)
    return 0
  }

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep3()) return
    setSaving(true)
    haptic(50)
    try {
      const total = parseFloat(amount)
      const color = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)]
      const groupName = description.trim().slice(0, 40)

      // 1 — Create ephemeral group
      const group = await api.createGroup({
        name: groupName,
        color,
        initials: initials(groupName),
        type: 'ponctuel',
        parentId: null,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      })

      // 2 — Add members sequentially
      // Note: userId omis pour les guests — json-server crashe sur userId:null dans getRemovable()
      const memberMap = {} // participantId → memberId
      for (const p of participants) {
        const payload = {
          groupId: group.id,
          name: p.name,
          email: p.email || '',
          initials: p.initials,
          color: p.color,
          textColor: p.textColor,
          role: p.isCreator ? 'admin' : 'member',
          isGuest: p.isGuest,
        }
        if (p.userId) payload.userId = p.userId
        const m = await api.addMember(payload)
        memberMap[p.id] = m.id
      }

      // 3 — Resolve payer member id
      const paidByMemberId = memberMap[payerId]
      const splitBetweenIds = participants.map(p => memberMap[p.id])

      // 4 — Build expense payload
      const expenseData = enrichExpensePayload({
        groupId: group.id,
        description: description.trim(),
        amount: total,
        paidById: paidByMemberId,
        splitBetween: splitBetweenIds,
        splitMode,
        customShares: splitMode === 'custom'
          ? Object.fromEntries(participants.map(p => [memberMap[p.id], parseFloat(customShares[p.id] || 0)]))
          : {},
        customAmounts: splitMode === 'amounts'
          ? Object.fromEntries(participants.map(p => [memberMap[p.id], parseFloat(customAmounts[p.id] || 0)]))
          : {},
        date,
        category,
        note: '',
        createdAt: new Date().toISOString(),
      })

      await api.createExpense(expenseData)

      haptic(60)
      toast.success('Participation créée !')
      onSaved(group)
    } catch (err) {
      toast.error('Erreur lors de la création. Réessayez.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // ── Step navigation ───────────────────────────────────────────
  const nextStep = () => {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setErrors({})
    setStepDir('forward')
    setStep(s => s + 1)
  }

  const prevStep = () => {
    setErrors({})
    setStepDir('back')
    setStep(s => s - 1)
  }

  // ── Render helpers ────────────────────────────────────────────
  const field = (label, children, error, inputId) => (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={inputId} style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {error && <div role="alert" style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{error}</div>}
    </div>
  )

  const inputStyle = (hasError) => ({
    width: '100%', padding: '9px 12px', border: `0.5px solid ${hasError ? 'var(--red)' : 'var(--border-hover)'}`,
    borderRadius: 'var(--radius)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
    background: 'var(--bg)', color: 'var(--text)',
    transition: 'border-color 0.15s',
  })

  // ── Render ────────────────────────────────────────────────────
  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--text)' }}>
              {step === 1 ? '🧾 La facture' : step === 2 ? '👥 Les participants' : '⚖️ La répartition'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Participation ponctuelle</div>
          </div>
          <StepDots current={step} total={3} />
        </div>

        {/* ── STEP 1 — Facture ── */}
        {step === 1 && (
          <div key="step-1" className={stepDir === 'forward' ? 'step-forward' : 'step-back'}>
            {field('Description', (
              <input
                id="pw-desc"
                ref={descRef}
                style={inputStyle(!!errors.description)}
                placeholder="Ex : Dîner au restaurant, Cadeau d'anniversaire…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && nextStep()}
                maxLength={80}
              />
            ), errors.description, 'pw-desc')}

            {field('Montant total', (
              <div style={{ position: 'relative' }}>
                <input
                  id="pw-amount"
                  type="number" min="0.01" step="0.01" max="99999"
                  style={{ ...inputStyle(!!errors.amount), paddingRight: 32 }}
                  placeholder="0,00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && nextStep()}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>€</span>
              </div>
            ), errors.amount, 'pw-amount')}

            {field('Catégorie', (
              <select
                style={{ ...inputStyle(false), cursor: 'pointer' }}
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            ))}

            {field('Date', (
              <input
                type="date"
                style={inputStyle(false)}
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            ))}
          </div>
        )}

        {/* ── STEP 2 — Participants ── */}
        {step === 2 && (
          <div key="step-2" className={stepDir === 'forward' ? 'step-forward' : 'step-back'}>
            {/* Recap facture */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--green-light)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>{CATEGORIES[category]?.emoji || '💳'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{description}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green-dark)' }}>{parseFloat(amount || 0).toFixed(2)} €</div>
            </div>

            {/* Participants list */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Participants — cliquez sur un nom pour indiquer qui a payé
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {participants.map(p => (
                  <ParticipantChip
                    key={p.id}
                    p={p}
                    isCreator={p.isCreator}
                    isPayer={payerId === p.id}
                    onSetPayer={() => setPayerId(p.id)}
                    onRemove={!p.isCreator ? removeParticipant : null}
                  />
                ))}
              </div>
              {errors.participants && <div role="alert" style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>{errors.participants}</div>}
              {errors.payer && <div role="alert" style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{errors.payer}</div>}
            </div>

            {/* Search by email */}
            {!showGuestForm && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Ajouter par email
                </div>
                <input
                  type="email"
                  style={inputStyle(false)}
                  placeholder="email@exemple.com"
                  value={searchEmail}
                  onChange={e => setSearchEmail(e.target.value)}
                />
                {searchResult === 'loading' && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    <Spinner size={14} /> Recherche…
                  </div>
                )}
                {searchResult && searchResult !== 'loading' && searchResult !== 'notfound' && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-secondary)' }}>
                    <Avatar initials={searchResult.initials || initials(searchResult.name)} color={searchResult.color || '#6b6b6b'} textColor={searchResult.textColor || '#fff'} size={28} />
                    <div style={{ flex: 1, fontSize: 13 }}>
                      <div style={{ fontWeight: 500 }}>{searchResult.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{searchResult.email}</div>
                    </div>
                    {alreadyAdded(searchResult.id)
                      ? <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Déjà ajouté</span>
                      : <button onClick={() => addRegisteredUser(searchResult)} style={{ padding: '5px 12px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Ajouter</button>
                    }
                  </div>
                )}
                {searchResult === 'notfound' && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Aucun compte trouvé.{' '}
                    <button onClick={() => { setShowGuestForm(true); setGuestEmail(searchEmail) }} style={{ background: 'none', border: 'none', color: 'var(--green-dark)', fontWeight: 500, cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>
                      Ajouter comme invité
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Guest form */}
            {showGuestForm && (
              <div style={{ padding: '12px 14px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-secondary)', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Ajouter un invité</div>
                <input
                  style={{ ...inputStyle(false), marginBottom: 8 }}
                  placeholder="Prénom Nom *"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                />
                <input
                  type="email"
                  style={{ ...inputStyle(false), marginBottom: 10 }}
                  placeholder="Email (optionnel)"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setShowGuestForm(false); setGuestName(''); setGuestEmail('') }}
                    style={{ flex: 1, padding: '7px 0', border: '0.5px solid var(--border-hover)', background: 'transparent', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
                    Annuler
                  </button>
                  <button onClick={addGuest} disabled={!guestName.trim()}
                    style={{ flex: 1, padding: '7px 0', background: !guestName.trim() ? 'var(--bg-tertiary)' : 'var(--green)', color: !guestName.trim() ? 'var(--text-tertiary)' : '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: guestName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                    Ajouter
                  </button>
                </div>
              </div>
            )}

            {!showGuestForm && (
              <button onClick={() => setShowGuestForm(true)}
                style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>
                + Ajouter un invité sans compte
              </button>
            )}
          </div>
        )}

        {/* ── STEP 3 — Répartition ── */}
        {step === 3 && (
          <div key="step-3" className={stepDir === 'forward' ? 'step-forward' : 'step-back'}>
            {/* Recap */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--green-light)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>{CATEGORIES[category]?.emoji || '💳'}</span>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{description}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green-dark)' }}>{parseFloat(amount || 0).toFixed(2)} €</div>
            </div>

            {/* Mode tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'var(--bg-secondary)', padding: 4, borderRadius: 'var(--radius)' }}>
              {[{ id: 'equal', label: 'Parts égales' }, { id: 'custom', label: 'Pourcentages' }, { id: 'amounts', label: 'Montants' }].map(m => (
                <button key={m.id} onClick={() => setSplitMode(m.id)} style={{
                  flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: splitMode === m.id ? 600 : 400, fontFamily: 'inherit',
                  background: splitMode === m.id ? 'var(--bg)' : 'transparent',
                  color: splitMode === m.id ? 'var(--text)' : 'var(--text-secondary)',
                  boxShadow: splitMode === m.id ? 'var(--shadow)' : 'none',
                  transition: 'all 0.15s',
                }}>{m.label}</button>
              ))}
            </div>

            {/* Répartition table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {participants.map(p => {
                const share = getShare(p)
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }}>
                    <Avatar initials={p.initials} color={p.color} textColor={p.textColor || '#fff'} size={28} />
                    <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{p.name}{p.isCreator && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}> (vous)</span>}</div>

                    {splitMode === 'equal' && (
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{share.toFixed(2)} €</div>
                    )}

                    {splitMode === 'custom' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="number" min="0" max="100" step="1"
                          style={{ width: 64, padding: '5px 8px', border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', fontSize: 13, textAlign: 'right', fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
                          value={customShares[p.id] || ''}
                          onChange={e => setCustomShares(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="0"
                        />
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>%</span>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 52, textAlign: 'right' }}>{share.toFixed(2)} €</span>
                      </div>
                    )}

                    {splitMode === 'amounts' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="number" min="0" step="0.01"
                          style={{ width: 80, padding: '5px 8px', border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', fontSize: 13, textAlign: 'right', fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
                          value={customAmounts[p.id] || ''}
                          onChange={e => setCustomAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="0,00"
                        />
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>€</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Total check */}
            {splitMode !== 'equal' && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4, textAlign: 'right' }}>
                {splitMode === 'custom' && (() => {
                  const sum = participants.reduce((s, p) => s + parseFloat(customShares[p.id] || 0), 0)
                  return <span style={{ color: Math.abs(sum - 100) < 0.5 ? 'var(--green)' : 'var(--red)' }}>{sum.toFixed(1)} % / 100 %</span>
                })()}
                {splitMode === 'amounts' && (() => {
                  const sum = participants.reduce((s, p) => s + parseFloat(customAmounts[p.id] || 0), 0)
                  const total = parseFloat(amount || 0)
                  return <span style={{ color: Math.abs(sum - total) < 0.01 ? 'var(--green)' : 'var(--red)' }}>{sum.toFixed(2)} € / {total.toFixed(2)} €</span>
                })()}
              </div>
            )}

            {errors.split && <div role="alert" style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{errors.split}</div>}
          </div>
        )}

        {/* ── Footer buttons ── */}
        <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {step > 1 && (
              <button onClick={prevStep} style={{ padding: '8px 16px', border: '0.5px solid var(--border-hover)', background: 'transparent', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
                ← Retour
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', border: '0.5px solid var(--border-hover)', background: 'transparent', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
              Annuler
            </button>
            {step < 3 ? (
              <button onClick={nextStep} style={{ padding: '8px 20px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Suivant →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={saving} style={{ padding: '8px 20px', background: saving ? 'var(--bg-tertiary)' : 'var(--green)', color: saving ? 'var(--text-tertiary)' : '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s' }}>
                {saving ? <><Spinner size={14} /> Création…</> : '✓ Créer et enregistrer'}
              </button>
            )}
          </div>
        </div>

      </div>
    </Modal>
  )
}
