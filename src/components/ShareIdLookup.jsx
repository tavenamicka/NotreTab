// src/components/ShareIdLookup.jsx
import React, { useState } from 'react'
import Btn from './Btn'
import Avatar from './Avatar'
import { api } from '../utils/api'
import { normalizeShareId } from '../utils/shareId'

const inp = {
  width: '100%', padding: '9px 12px',
  border: '0.5px solid var(--border-hover)', borderRadius: 'var(--radius)',
  fontSize: 13, background: 'var(--bg)', color: 'var(--text)',
  fontFamily: 'inherit', outline: 'none',
  letterSpacing: '0.08em', textTransform: 'uppercase',
}

/**
 * Recherche d'un compte par son identifiant de partage.
 * Seule voie d'ajout pour les comptes privés — celui qui saisit le code doit
 * l'avoir reçu de son propriétaire.
 *
 * @param {(profile: object) => void} onFound   appelé quand un profil est confirmé
 * @param {(profile: object) => string|null} validate  message d'erreur à afficher
 *        si le profil trouvé n'est pas ajoutable (déjà membre, soi-même…)
 * @param {string} confirmLabel  libellé du bouton de confirmation
 * @param {boolean} busy         désactive les actions pendant l'ajout
 */
export default function ShareIdLookup({ onFound, validate, confirmLabel = 'Ajouter', busy = false }) {
  const [code, setCode] = useState('')
  const [found, setFound] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canonical = normalizeShareId(code)

  const search = async () => {
    if (!canonical) {
      setError('Identifiant incomplet — format attendu : NT-XXXX-XXXX')
      return
    }
    setLoading(true); setError(''); setFound(null)
    try {
      const profile = await api.findUserByShareId(canonical)
      if (!profile) {
        setError('Aucun compte ne correspond à cet identifiant.')
        return
      }
      const invalid = validate?.(profile)
      if (invalid) { setError(invalid); return }
      setFound(profile)
    } catch {
      setError('Erreur lors de la recherche.')
    } finally {
      setLoading(false)
    }
  }

  const confirm = () => {
    if (!found) return
    onFound(found)
    setCode(''); setFound(null); setError('')
  }

  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
        Identifiant de partage
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          style={{ ...inp, flex: 1 }}
          value={code}
          onChange={e => { setCode(e.target.value); setFound(null); setError('') }}
          onKeyDown={e => e.key === 'Enter' && (found ? confirm() : search())}
          placeholder="NT-XXXX-XXXX"
          aria-label="Identifiant de partage"
          autoComplete="off"
          spellCheck={false}
        />
        <Btn onClick={search} disabled={loading || busy}>
          {loading ? '…' : 'Rechercher'}
        </Btn>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>
        La personne trouve son identifiant dans son profil, section « Visibilité et partage ».
      </div>

      {error && (
        <div role="alert" style={{ marginTop: 10, padding: '8px 12px', background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius)', fontSize: 12 }}>
          {error}
        </div>
      )}

      {found && (
        <>
          <div style={{ marginTop: 10, padding: '12px 14px', background: 'var(--green-light)', borderRadius: 'var(--radius)', border: '0.5px solid var(--green)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar initials={found.initials} color={found.color} textColor={found.textColor} size={34} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--green-dark)' }}>{found.name}</div>
              <div style={{ fontSize: 12, color: 'var(--green-dark)', opacity: 0.8 }}>{found.shareId}</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 18 }}>✓</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <Btn variant="primary" onClick={confirm} disabled={busy}>
              {busy ? '…' : confirmLabel}
            </Btn>
          </div>
        </>
      )}
    </div>
  )
}
