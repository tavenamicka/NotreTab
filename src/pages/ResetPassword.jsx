import React, { useState } from 'react'
import { updatePassword } from '../utils/auth'
import { useAuth } from '../utils/AuthContext'
import { useToast } from '../utils/ToastContext'
import { authInp, authLbl, AuthLogo } from '../utils/authStyles'

export default function ResetPassword() {
  const { logout, exitRecoveryMode } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setError('')
    if (form.password.length < 6) { setError('Mot de passe trop court (6 caractères minimum).'); return }
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return }

    setLoading(true)
    try {
      await updatePassword(form.password)
      toast.success('Mot de passe modifié !')
      // Déconnexion pour forcer une reconnexion propre
      await logout()
    } catch (e) {
      setError(e.message || 'Erreur lors de la mise à jour du mot de passe.')
    } finally { setLoading(false) }
  }

  const inp = authInp
  const lbl = authLbl

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <AuthLogo subtitle="Réinitialisation du mot de passe" />

        <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nouveau mot de passe</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
            Choisissez un nouveau mot de passe pour votre compte.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={lbl}>Nouveau mot de passe</label>
              <input style={inp} type="password" placeholder="••••••••" value={form.password}
                onChange={e => set('password', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            <div>
              <label style={lbl}>Confirmer le mot de passe</label>
              <input style={inp} type="password" placeholder="••••••••" value={form.confirm}
                onChange={e => set('confirm', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius)', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: '100%', marginTop: 20, padding: '10px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}
          >
            {loading ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
          </button>

          <button
            onClick={exitRecoveryMode}
            style={{ width: '100%', marginTop: 10, padding: '9px', background: 'transparent', color: 'var(--text-secondary)', border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
