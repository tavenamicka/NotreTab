import React, { useState } from 'react'
import Modal from './Modal'
import Btn from './Btn'
import { api } from '../utils/api'
import { AVATAR_COLORS } from '../utils/theme'

export default function InviteModal({ open, onClose, groupId, existingMembers, onSaved }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [found, setFound] = useState(null) // existing user found by email

  const searchUser = async () => {
    if (!email.trim()) return
    setError(''); setFound(null)
    try {
      const users = await api.getUserByEmail(email.trim().toLowerCase())
      if (users.length > 0) {
        // Check not already in group
        const alreadyIn = existingMembers.some(m => m.email?.toLowerCase() === email.trim().toLowerCase())
        if (alreadyIn) { setError('Cet utilisateur est déjà dans le groupe.'); return }
        setFound(users[0])
      } else {
        setError('Aucun compte trouvé avec cet email. L\'utilisateur doit d\'abord créer un compte.')
      }
    } catch { setError('Erreur de recherche.') }
  }

  const handleAdd = async () => {
    if (!found) return
    setLoading(true)
    const palette = AVATAR_COLORS[existingMembers.length % AVATAR_COLORS.length]
    try {
      await api.addMember({
        groupId,
        userId: found.id,
        name: found.name,
        email: found.email,
        role,
        initials: found.initials,
        color: found.color || palette.bg,
        textColor: found.textColor || palette.text,
      })
      onSaved()
      setEmail(''); setFound(null); setRole('member'); setError('')
      onClose()
    } finally { setLoading(false) }
  }

  const inp = { width: '100%', padding: '8px 10px', border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', fontSize: '13px', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }
  const lbl = { fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }

  return (
    <Modal open={open} onClose={() => { onClose(); setFound(null); setError(''); setEmail('') }} title="Inviter un membre">
      <div style={{ marginBottom: '12px' }}>
        <label style={lbl}>Email du membre</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input style={{ ...inp, flex: 1 }} type="email" value={email} onChange={e => { setEmail(e.target.value); setFound(null); setError('') }}
            placeholder="email@exemple.com"
            onKeyDown={e => e.key === 'Enter' && searchUser()} />
          <Btn onClick={searchUser}>Rechercher</Btn>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius)', fontSize: 12 }}>
          {error}
        </div>
      )}

      {found && (
        <div style={{ marginBottom: 12, padding: '12px 14px', background: 'var(--green-light)', borderRadius: 'var(--radius)', border: '0.5px solid var(--green)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: found.color, color: found.textColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{found.initials}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--green-dark)' }}>{found.name}</div>
            <div style={{ fontSize: 12, color: 'var(--green-dark)', opacity: 0.8 }}>{found.email}</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 18 }}>✓</span>
        </div>
      )}

      {found && (
        <div style={{ marginBottom: '12px' }}>
          <label style={lbl}>Rôle</label>
          <select style={inp} value={role} onChange={e => setRole(e.target.value)}>
            <option value="member">Membre</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <Btn onClick={() => { onClose(); setFound(null); setError(''); setEmail('') }}>Annuler</Btn>
        <Btn variant="primary" onClick={handleAdd} disabled={loading || !found}>
          {loading ? '...' : 'Ajouter'}
        </Btn>
      </div>
    </Modal>
  )
}
