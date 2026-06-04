import React from 'react'

// size  : taille en px (défaut 12)
// color : couleur du trait actif (défaut '#fff' pour fonds colorés, passer 'var(--green)' sur fond blanc)
export default function Spinner({ size = 12, color = '#fff' }) {
  const track = color === '#fff' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.12)'
  return (
    <>
      <style>{`@keyframes _spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{
        display: 'inline-block', width: size, height: size,
        border: `2px solid ${track}`,
        borderTopColor: color, borderRadius: '50%',
        animation: '_spin 0.6s linear infinite',
        verticalAlign: 'middle', flexShrink: 0,
      }} />
    </>
  )
}
