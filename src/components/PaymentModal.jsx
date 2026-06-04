import React, { useState, useEffect } from 'react'
import Modal from './Modal'
import Btn from './Btn'
import { api } from '../utils/api'
import { useToast } from '../utils/ToastContext'
import Spinner from './Spinner'

function makeForm(defaultFrom, defaultTo, defaultAmount) {
  return {
    fromId: defaultFrom || '',
    toId:   defaultTo   || '',
    amount: defaultAmount || '',
    note:   '',
    date:   new Date().toISOString().split('T')[0],
  }
}

export default function PaymentModal({ open, onClose, groupId, members, defaultFrom, defaultTo, defaultAmount, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(() => makeForm(defaultFrom, defaultTo, defaultAmount))
  const [loading, setLoading] = useState(false)

  // Réinitialise le formulaire à chaque ouverture avec les nouvelles valeurs par défaut
  useEffect(() => {
    if (open) setForm(makeForm(defaultFrom, defaultTo, defaultAmount))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.fromId || !form.toId || !form.amount) return
    setLoading(true)
    try {
      await api.createPayment({
        ...form,
        groupId,
        amount: parseFloat(form.amount),
        createdAt: new Date().toISOString(),
      })
      toast.success('Paiement enregistré')
      onSaved()
      onClose()
    } catch {
      toast.error('Impossible d\'enregistrer le paiement.')
    } finally {
      setLoading(false)
    }
  }

  const inp = { width: '100%', padding: '8px 10px', border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', fontSize: '13px', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }
  const lbl = { fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }

  return (
    <Modal open={open} onClose={onClose} title="Enregistrer un paiement">
      <div style={{ marginBottom: '12px' }}>
        <label style={lbl}>De</label>
        <select style={inp} value={form.fromId} onChange={e => set('fromId', e.target.value)}>
          <option value="">— sélectionner —</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={lbl}>À</label>
        <select style={inp} value={form.toId} onChange={e => set('toId', e.target.value)}>
          <option value="">— sélectionner —</option>
          {members.filter(m => String(m.id) !== String(form.fromId)).map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        <div>
          <label style={lbl}>Montant (€)</label>
          <input style={inp} type="number" min="0.01" step="0.01"
            value={form.amount} onChange={e => set('amount', e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Date</label>
          <input style={inp} type="date" value={form.date}
            onChange={e => set('date', e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={lbl}>Note (optionnel)</label>
        <input style={inp} value={form.note}
          onChange={e => set('note', e.target.value)}
          placeholder="Ex : virement Lydia" />
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <Btn onClick={onClose}>Annuler</Btn>
        <Btn variant="primary" onClick={handleSubmit}
          disabled={loading || !form.fromId || !form.toId || !form.amount}>
          {loading ? <Spinner /> : 'Confirmer'}
        </Btn>
      </div>
    </Modal>
  )
}
