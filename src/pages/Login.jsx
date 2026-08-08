import React, { useState } from 'react'
import { register } from '../utils/auth'
import { useAuth } from '../utils/AuthContext'
import { AVATAR_COLORS } from '../utils/theme'
import { authInp, authLbl, AuthLogo } from '../utils/authStyles'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const auth = useAuth()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleLogin = async () => {
    setError(''); setLoading(true)
    try {
      await auth.login(form.email.trim().toLowerCase(), form.password)
    } catch {
      setError('Email ou mot de passe incorrect.')
    } finally { setLoading(false) }
  }

  const handleRegister = async () => {
    setError(''); setLoading(true)
    try {
      if (!form.name.trim())  { setError('Nom requis.'); setLoading(false); return }
      if (!form.email.trim()) { setError('Email requis.'); setLoading(false); return }
      if (form.password.length < 6) { setError('Mot de passe trop court (6 caractères minimum).'); setLoading(false); return }
      if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); setLoading(false); return }

      const palette = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
      await register(form.email.trim().toLowerCase(), form.password, {
        name: form.name.trim(),
        color: palette.bg,
        textColor: palette.text,
      })
      // Connexion automatique après création du compte
      await auth.login(form.email.trim().toLowerCase(), form.password)
    } catch (e) {
      setError(e.message || 'Erreur lors de la création du compte.')
    } finally { setLoading(false) }
  }

  const inp = authInp
  const lbl = authLbl

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <AuthLogo />

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
