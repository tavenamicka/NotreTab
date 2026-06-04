import React, { useState } from 'react'
import { api } from '../utils/api'
import { hashPassword, verifyPassword, isLegacyPassword } from '../utils/auth'
import { AVATAR_COLORS } from '../utils/theme'

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleLogin = async () => {
    setError(''); setLoading(true)
    try {
      const users = await api.getUserByEmail(form.email.trim().toLowerCase())
      const user = users[0]
      if (!user) { setError('Email ou mot de passe incorrect.'); return }

      const ok = await verifyPassword(form.password, user.password)
      if (!ok) { setError('Email ou mot de passe incorrect.'); return }

      // Migration transparente : hash le mot de passe en clair au prochain login
      if (isLegacyPassword(user.password)) {
        const hash = await hashPassword(form.password)
        await api.updateUser(user.id, { password: hash }).catch(() => {})
      }

      onLogin(user)
    } catch { setError('Erreur de connexion au serveur.') }
    finally { setLoading(false) }
  }

  const handleRegister = async () => {
    setError(''); setLoading(true)
    try {
      if (!form.name.trim())  { setError('Nom requis.'); return }
      if (!form.email.trim()) { setError('Email requis.'); return }
      if (form.password.length < 6) { setError('Mot de passe trop court (6 caractères minimum).'); return }
      if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return }

      const existing = await api.getUserByEmail(form.email.trim().toLowerCase())
      if (existing.length > 0) { setError('Cet email est déjà utilisé.'); return }

      const initials = form.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
      const palette = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
      const hashed = await hashPassword(form.password)

      const user = await api.createUser({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: hashed,
        initials,
        color: palette.bg,
        textColor: palette.text,
        createdAt: new Date().toISOString()
      })
      onLogin(user)
    } catch { setError('Erreur lors de la création du compte.') }
    finally { setLoading(false) }
  }

  const inp = {
    width: '100%', padding: '10px 12px',
    border: '0.5px solid var(--border-hover)',
    borderRadius: 'var(--radius)', fontSize: '14px',
    background: 'var(--bg)', color: 'var(--text)',
    outline: 'none', fontFamily: 'inherit'
  }
  const lbl = { fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, background: 'var(--green)', borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 12 }}>N</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>NotreTab</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Partagez les dépenses simplement</div>
        </div>

        <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 28 }}>
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: 3, marginBottom: 24 }}>
            {[['login', 'Connexion'], ['register', 'Inscription']].map(([id, label]) => (
              <button key={id} onClick={() => { setMode(id); setError('') }} style={{
                flex: 1, padding: '7px', border: 'none', borderRadius: 'var(--radius)',
                background: mode === id ? 'var(--bg)' : 'transparent',
                fontSize: 13, fontWeight: mode === id ? 500 : 400,
                color: mode === id ? 'var(--text)' : 'var(--text-secondary)',
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: mode === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s'
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'register' && (
              <div>
                <label style={lbl}>Nom complet</label>
                <input style={inp} placeholder="Marie Dupont" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
            )}
            <div>
              <label style={lbl}>Email</label>
              <input style={inp} type="email" placeholder="vous@email.com" value={form.email}
                onChange={e => set('email', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && mode === 'login' && handleLogin()} />
            </div>
            <div>
              <label style={lbl}>Mot de passe</label>
              <input style={inp} type="password" placeholder="••••••••" value={form.password}
                onChange={e => set('password', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && mode === 'login' && handleLogin()} />
            </div>
            {mode === 'register' && (
              <div>
                <label style={lbl}>Confirmer le mot de passe</label>
                <input style={inp} type="password" placeholder="••••••••" value={form.confirm}
                  onChange={e => set('confirm', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRegister()} />
              </div>
            )}
          </div>

          {error && (
            <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius)', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            onClick={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
            style={{ width: '100%', marginTop: 20, padding: '10px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}
          >
            {loading ? 'Chargement…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>

        </div>
      </div>
    </div>
  )
}
