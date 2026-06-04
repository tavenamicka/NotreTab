import React from 'react'

export default function Avatar({ initials, color = '#E1F5EE', textColor = '#0F6E56', size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: textColor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 500, flexShrink: 0
    }}>
      {initials}
    </div>
  )
}
