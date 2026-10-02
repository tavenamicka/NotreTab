import React from 'react'

// `rest` est transmis au <button> : sans lui, `title` et surtout `aria-label`
// étaient silencieusement ignorés. Un bouton dont le contenu est une icône n'a
// alors aucun nom accessible — le cas s'est produit en remplaçant les croix ✕
// par un tracé SVG, le caractère servant jusque-là de nom par défaut.
export default function Btn({ children, variant = 'default', onClick, disabled, style = {}, type = 'button', ...rest }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px', borderRadius: 'var(--radius)',
    border: '0.5px solid var(--border-hover)', background: 'transparent',
    fontSize: '13px', fontWeight: 400, cursor: disabled ? 'not-allowed' : 'pointer',
    color: 'var(--text)', transition: 'background 0.15s, opacity 0.15s',
    opacity: disabled ? 0.5 : 1, fontFamily: 'inherit'
  }
  const primary = {
    background: 'var(--green)', color: '#fff',
    border: '0.5px solid var(--green)', fontWeight: 500
  }
  const danger = {
    background: 'var(--red-light)', color: 'var(--red)',
    border: '0.5px solid var(--red)'
  }
  const merged = variant === 'primary' ? { ...base, ...primary } :
                 variant === 'danger'  ? { ...base, ...danger } : base

  return (
    <button type={type} style={{ ...merged, ...style }} onClick={onClick} disabled={disabled} {...rest}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '0.85' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
      {children}
    </button>
  )
}
