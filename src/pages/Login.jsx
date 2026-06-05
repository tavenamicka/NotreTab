import React, { useState } from 'react'
import { login, register, resetPassword } from '../utils/auth'
import { useAuth } from '../utils/AuthContext'
import { supabase } from '../utils/supabase'
import { AVATAR_COLORS } from '../utils/theme'
import { authInp, authLbl, AuthLogo } from '../utils/authStyles'

const APP_URL = import.meta.env.VITE_APP_URL ?? window.location.origin

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot' | 'confirmed'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const auth = useAuth()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleLogin = async () => {
    setError(''); setLoading(true)
    try {
      await auth.login(form.email.trim().toLowerCase(), form.password)
    } catch (e) {
      const msg = e.message ?? ''
      if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Votre email n\'est pas encore confirmé. Vérifiez votre boîte mail.')
      } else {
        setError('Email ou mot de passe incorrect.')
      }
    } finally { setLoading(false) }
  }

  const handleRegister = async () => {
    setError(''); setLoading(true)
    try {
      if (!form.name.trim())  { setError('Nom requis.'); setLoading(false); return }
      if (!form.email.trim()) { setError('Email requis.'); setLoading(false); return }
      if (form.password.length < 6) { setError('Mot de passe trop court (6 caractères minimum).'); setLoading(false); return }
      if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); setLoading(false); return }

      const initials = form.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
      const palette = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]

      await register(form.email.trim().toLowerCase(), form.password, {
        name: form.name.trim(),
        initials,
        color: palette.bg,
        textColor: palette.text,
      })

      // Envoyer l'email de bienvenue via Edge Function (non-bloquant)
      supabase.functions.invoke('send-welcome', {
        body: { name: form.name.trim(), email: form.email.trim().toLowerCase() }
      }).catch(() => { /* non-critique */ })

      setMode('confirmed')
    } catch (e) {
      setError(e.message || 'Erreur lors de la création du compte.')
    } finally { setLoading(false) }
  }

  const handleForgot = async () => {
    setError(''); setLoading(true)
    try {
      if (!form.email.trim()) { setError('Saisissez votre adresse email.'); setLoading(false); return }
      await resetPassword(form.email.trim().toLowerCase(), `${APP_URL}`)
      setForgotSent(true)
    } catch (e) {
      setError(e.message || 'Impossible d\'envoyer le lien de réinitialisation.')
    } finally { setLoading(false) }
  }

  const inp = authInp
  const lbl = authLbl

  // Vue : email de confirmation envoyé
  if (mode === 'confirmed') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <AuthLogo />
          <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📬</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Vérifiez votre boîte mail</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              Un email de confirmation a été envoyé à <strong>{form.email}</strong>.
              Veuillez confirmer votre compte avant de vous connecter.
            </div>
            <button
              onClick={() => { setMode('login'); setForm(f => ({ ...f, password: '', confirm: '' })) }}
              style={{ padding: '9px 20px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Aller à la connexion
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Vue : mot de passe oublié
  if (mode === 'forgot') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <AuthLogo />
          <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 28 }}>
            {forgotSent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✉️</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Lien envoyé !</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                  Si un compte correspond à <strong>{form.email}</strong>, vous recevrez un lien de réinitialisation dans quelques instants.
                </div>
                <button
                  onClick={() => { setMode('login'); setForgotSent(false) }}
                  style={{ padding: '9px 20px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Retour à la connexion
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Mot de passe oublié</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                  Saisissez votre email pour recevoir un lien de réinitialisation.
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Email</label>
                  <input style={inp} type="email" placeholder="vous@email.com" value={form.email}
                    onChange={e => set('email', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleForgot()} />
                </div>
                {error && (
                  <div style={{ marginBottom: 14, padding: '8px 12px', background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                    {error}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setMode('login'); setError('') }}
                    style={{ flex: 1, padding: '10px', border: '0.5px solid var(--border-hover)', background: 'transparent', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleForgot}
                    disabled={loading}
                    style={{ flex: 1, padding: '10px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? 'Envoi…' : 'Envoyer le lien'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Vue principale : connexion / inscription
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

          {mode === 'login' && (
            <div style={{ marginTop: 10, textAlign: 'right' }}>
              <button
                onClick={() => { setMode('forgot'); setError(''); setForgotSent(false) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}
              >
                Mot de passe oublié ?
              </button>
            </div>
          )}

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
