// src/components/InviteModal.jsx
import React, { useState } from 'react'
import Modal from './Modal'
import Btn from './Btn'
import Avatar from './Avatar'
import ShareIdLookup from './ShareIdLookup'
import { api } from '../utils/api'
import { AVATAR_COLORS } from '../utils/theme'

const inp = { width: '100%', padding: '8px 10px', border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', fontSize: '13px', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }
const lbl = { fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
        border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)',
        background: active ? 'var(--bg-tertiary)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-secondary)',
        fontWeight: active ? 500 : 400,
      }}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

export default function InviteModal({ open, onClose, groupId, existingMembers, onSaved }) {
  const [mode, setMode] = useState('shareId')   // 'shareId' | 'search'
  const [role, setRole] = useState('member')
  const [loading, setLoading] = useState(false)

  // Mode recherche (comptes ayant activé la visibilité)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searchErr, setSearchErr] = useState('')
  const [searching, setSearching] = useState(false)

  const reset = () => {
    setMode('shareId'); setRole('member')
    setQuery(''); setResults([]); setSearchErr('')
  }

  const close = () => { onClose(); reset() }

  // Refuse un profil déjà présent dans le groupe
  const rejectIfMember = (profile) =>
    existingMembers.some(m => String(m.userId) === String(profile.id))
      ? 'Cette personne fait déjà partie du groupe.'
      : null

  const addProfile = async (profile) => {
    const invalid = rejectIfMember(profile)
    if (invalid) { setSearchErr(invalid); return }
    setLoading(true)
    const palette = AVATAR_COLORS[existingMembers.length % AVATAR_COLORS.length]
    try {
      await api.addMember({
        groupId,
        userId: profile.id,
        name: profile.name,
        email: profile.email,
        role,
        initials: profile.initials,
        color: profile.color || palette.bg,
        textColor: profile.textColor || palette.text,
      })
      onSaved()
      close()
    } finally { setLoading(false) }
  }

  const runSearch = async (val) => {
    setQuery(val); setSearchErr(''); setResults([])
    if (val.trim().length < 2) return
    setSearching(true)
    try {
      const found = await api.searchProfiles(val)
      const filtered = found.filter(u => !existingMembers.some(m => String(m.userId) === String(u.id)))
      if (!filtered.length) {
        setSearchErr("Aucun compte visible ne correspond. Si la personne garde son compte privé, demandez-lui son identifiant de partage.")
      }
      setResults(filtered)
    } catch {
      setSearchErr('Erreur lors de la recherche.')
    } finally { setSearching(false) }
  }

  return (
    <Modal open={open} onClose={close} title="Ajouter un membre">
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <TabBtn active={mode === 'shareId'} onClick={() => { setMode('shareId'); setSearchErr('') }}>
          Par identifiant
        </TabBtn>
        <TabBtn active={mode === 'search'} onClick={() => { setMode('search'); setSearchErr('') }}>
          Par nom ou email
        </TabBtn>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lbl} htmlFor="invite-role">Rôle dans le groupe</label>
        <select id="invite-role" style={inp} value={role} onChange={e => setRole(e.target.value)}>
          <option value="member">Membre</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {mode === 'shareId' ? (
        <ShareIdLookup
          onFound={addProfile}
          validate={rejectIfMember}
          confirmLabel="Ajouter au groupe"
          busy={loading}
        />
      ) : (
        <div>
          <label style={lbl} htmlFor="invite-search">Nom ou email</label>
          <input
            id="invite-search"
            style={inp}
            value={query}
            onChange={e => runSearch(e.target.value)}
            placeholder="Au moins 2 caractères"
            autoComplete="off"
          />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>
            Seules les personnes ayant activé « Être trouvable par nom ou email » dans leur profil apparaissent ici.
          </div>

          {searching && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10 }}>Recherche…</div>
          )}

          {searchErr && (
            <div role="alert" style={{ marginTop: 10, padding: '8px 12px', background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius)', fontSize: 12, lineHeight: 1.5 }}>
              {searchErr}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {results.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => addProfile(u)}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                  padding: '9px 12px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)',
                  background: 'var(--bg)', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}
              >
                <Avatar initials={u.initials} color={u.color} textColor={u.textColor} size={30} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{u.email}</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>Ajouter</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <Btn onClick={close}>Fermer</Btn>
      </div>
    </Modal>
  )
}
