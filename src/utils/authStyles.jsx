export const authInp = {
  width: '100%', padding: '10px 12px',
  border: '0.5px solid var(--border-hover)',
  borderRadius: 'var(--radius)', fontSize: '14px',
  background: 'var(--bg)', color: 'var(--text)',
  outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
}

export const authLbl = {
  fontSize: '12px', color: 'var(--text-secondary)',
  display: 'block', marginBottom: '5px',
}

export function AuthLogo({ subtitle = 'Partagez les dépenses simplement' }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <div style={{ width: 52, height: 52, background: 'var(--green)', borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 12 }}>N</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>NotreTab</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{subtitle}</div>
    </div>
  )
}
