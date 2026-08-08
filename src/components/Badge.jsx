import React from 'react'

const VARIANTS = {
  success: { background: '#E1F5EE', color: '#0F6E56' },
  danger:  { background: '#FAECE7', color: '#993C1D' },
  warning: { background: '#FAEEDA', color: '#854F0B' },
  neutral: { background: 'var(--bg-secondary)', color: 'var(--text-secondary)' },
  info:    { background: '#E6F1FB', color: '#185FA5' },
}

export default function Badge({ variant = 'neutral', children }) {
  return (
    <span style={{
      ...VARIANTS[variant],
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: '20px',
      fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap'
    }}>
      {children}
    </span>
  )
}
