import React, { useState, useEffect } from 'react'
import { useAuth } from '../utils/AuthContext'
import { useToast } from '../utils/ToastContext'
import { api } from '../utils/api'
import { login, updatePassword } from '../utils/auth'
import { AVATAR_COLORS } from '../utils/theme'
import Avatar from '../components/Avatar'
import Btn from '../components/Btn'

// ── Petit composant section ─────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
        {children}
      </div>
    </div>
  )
}

// ── Petit composant champ ───────────────────────────────────────────────────
function Field({ label, children }) {
  const lbl = { fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  )
}

const inp = {
  width: '100%', padding: '9px 12px',
  border: '0.5px solid var(--border-hover)',
  borderRadius: 'var(--radius)', fontSize: 13,
  background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit',
  outline: 'none'
}

// ═══════════════════════════════════════════════════════════════════════════
export default function Profile({ onBack }) {
  const { user, updateUser, logout } = useAuth()
  const toast = useToast()

  // ── État : infos personnelles ─────────────────────────────────────────────
  const [name, setName] = useState(user.name)
  const colorIdx = AVATAR_COLORS.findIndex(c => c.bg === user.color)
  const [selectedColor, setSelectedColor] = useState(colorIdx >= 0 ? colorIdx : 0)
  const [savingProfile, setSavingProfile] = useState(false)

  // ── État : mot de passe ───────────────────────────────────────────────────
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false })
  const [savingPw, setSavingPw] = useState(false)

  // ── État : statistiques ───────────────────────────────────────────────────
  const [stats, setStats] = useState({ groups: 0, loading: true })

  // ── État : suppression du compte ──────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  useEffect(() => {
    api.getMembersByUser(user.id)
      .then(m => setStats({ groups: m.length, loading: false }))
      .catch(() => setStats({ groups: 0, loading: false }))
  }, [user.id])

  // ── Enregistrer le profil ─────────────────────────────────────────────────
  const saveProfile = async () => {
    const trimmed = name.trim()
    if (!trimmed) { toast.error('Le nom ne peut pas être vide.'); return }
    setSavingProfile(true)
    try {
      const palette = AVATAR_COLORS[selectedColor]
      const initials = trimmed.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
      const updates = { name: trimmed, initials, color: palette.bg, textColor: palette.text }
      await api.updateUser(user.id, updates)
      updateUser(updates)
      toast.success('Profil mis à jour.')
    } catch {
      toast.error('Impossible de sauvegarder le profil.')
    } finally { setSavingProfile(false) }
  }

  const profileChanged =
    name.trim() !== user.name || selectedColor !== (AVATAR_COLORS.findIndex(c => c.bg === user.color) ?? 0)

  // ── Changer le mot de passe ───────────────────────────────────────────────
  const changePassword = async () => {
    if (!pw.current || !pw.next || !pw.confirm) { toast.error('Tous les champs sont requis.'); return }
    if (pw.next.length < 6) { toast.error('Mot de passe trop court (6 caractères minimum).'); return }
    if (pw.next !== pw.confirm) { toast.error('Les mots de passe ne correspondent pas.'); return }
    setSavingPw(true)
    try {
      await login(user.email, pw.current)
      await updatePassword(pw.next)
      setPw({ current: '', next: '', confirm: '' })
      toast.success('Mot de passe modifié.')
    } catch (err) {
      const msg = err.message?.toLowerCase()
      toast.error(msg?.includes('invalid') ? 'Mot de passe actuel incorrect.' : 'Impossible de modifier le mot de passe.')
    } finally { setSavingPw(false) }
  }

  // ── Supprimer le compte ───────────────────────────────────────────────────
  const deleteAccount = async () => {
    setDeletingAccount(true)
    try {
      const memberships = await api.getMembersByUser(user.id)
      for (const m of memberships) {
        await api.deleteMember(m.id)
        await new Promise(r => setTimeout(r, 60))
      }
      await api.deleteUser(user.id)
      logout()
    } catch {
      toast.error('Impossible de supprimer le compte.')
      setDeleteConfirm(false)
    } finally { setDeletingAccount(false) }
  }

  const palette = AVATAR_COLORS[selectedColor]

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>

      {/* En-tête carte identité */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 24 }}>
        <Avatar initials={user.initials} color={user.color} textColor={user.textColor} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{user.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{user.email}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {stats.loading ? '…' : `${stats.groups} groupe${stats.groups !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* Informations personnelles */}
      <Section title="Informations personnelles">
        <Field label="Nom complet">
          <input
            style={inp}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Votre nom"
          />
        </Field>

        <Field label="Email">
          <input
            style={{ ...inp, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
            value={user.email}
            readOnly
            title="L'email ne peut pas être modifié"
          />
        </Field>

        <Field label="Couleur de l'avatar">
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            {AVATAR_COLORS.map((c, i) => (
              <div
                key={i}
                onClick={() => setSelectedColor(i)}
                title={`Couleur ${i + 1}`}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: c.bg, cursor: 'pointer', flexShrink: 0,
                  border: selectedColor === i
                    ? '3px solid var(--text)'
                    : '3px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: c.text,
                  transition: 'border 0.15s'
                }}
              >
                {selectedColor === i ? user.initials.slice(0, 1) : ''}
              </div>
            ))}
          </div>
          {profileChanged && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar initials={user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)} color={palette.bg} textColor={palette.text} size={28} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Aperçu</span>
            </div>
          )}
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn
            variant="primary"
            onClick={saveProfile}
            disabled={savingProfile || !profileChanged}
          >
            {savingProfile ? 'Enregistrement…' : 'Enregistrer'}
          </Btn>
        </div>
      </Section>

      {/* Changer le mot de passe */}
      <Section title="Mot de passe">
        {[
          { key: 'current', label: 'Mot de passe actuel' },
          { key: 'next',    label: 'Nouveau mot de passe' },
          { key: 'confirm', label: 'Confirmer le nouveau mot de passe' },
        ].map(({ key, label }) => (
          <Field key={key} label={label}>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inp, paddingRight: 36 }}
                type={showPw[key] ? 'text' : 'password'}
                value={pw[key]}
                onChange={e => setPw(p => ({ ...p, [key]: e.target.value }))}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && changePassword()}
              />
              <button
                type="button"
                onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1, padding: 0
                }}
                title={showPw[key] ? 'Masquer' : 'Afficher'}
              >
                {showPw[key] ? '🙈' : '👁'}
              </button>
            </div>
          </Field>
        ))}

        {pw.next && pw.next.length < 6 && (
          <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10, marginTop: -8 }}>
            Minimum 6 caractères
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn
            variant="primary"
            onClick={changePassword}
            disabled={savingPw || !pw.current || !pw.next || !pw.confirm}
          >
            {savingPw ? 'Modification…' : 'Modifier le mot de passe'}
          </Btn>
        </div>
      </Section>

      {/* Zone de danger */}
      <Section title="Zone de danger">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Supprimer mon compte</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Votre compte et toutes vos adhésions de groupe seront supprimés définitivement.
            </div>
          </div>
          {!deleteConfirm ? (
            <Btn variant="danger" onClick={() => setDeleteConfirm(true)}>
              Supprimer mon compte
            </Btn>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => setDeleteConfirm(false)}>Annuler</Btn>
              <Btn variant="danger" onClick={deleteAccount} disabled={deletingAccount}>
                {deletingAccount ? 'Suppression…' : 'Confirmer la suppression'}
              </Btn>
            </div>
          )}
        </div>
      </Section>

    </div>
  )
}
