import React, { useState, useEffect } from 'react'
import Modal from './Modal'
import Spinner from './Spinner'
import { api } from '../utils/api'
import { useAuth } from '../utils/AuthContext'
import { useToast } from '../utils/ToastContext'
import { CATEGORIES } from '../utils/balance'

const CAT_COLORS = {
  restaurant: '#D85A30',
  courses:    '#1D9E75',
  transport:  '#378ADD',
  activite:   '#9370DB',
  logement:   '#EF9F27',
  autre:      '#6B6B8A',
}

export default function ParticipationCategoryPicker({ open, onClose, onCreated }) {
  const { user } = useAuth()
  const toast = useToast()
  const [creating, setCreating] = useState(null)

  useEffect(() => { if (!open) setCreating(null) }, [open])

  const handleSelect = async (key) => {
    if (creating) return
    setCreating(key)
    try {
      const cat = CATEGORIES[key]
      const color = CAT_COLORS[key] || '#1D9E75'
      const ini = cat.label.slice(0, 2).toUpperCase()

      const group = await api.createGroup({
        name: cat.label,
        color,
        initials: ini,
        type: 'occasional',
        parentId: null,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      })

      await new Promise(r => setTimeout(r, 60))

      const memberPayload = {
        groupId: group.id,
        name: user.name,
        email: user.email,
        initials: user.initials,
        color: user.color,
        textColor: user.textColor,
        role: 'admin',
        isGuest: false,
      }
      if (user.id) memberPayload.userId = user.id

      const member = await api.addMember(memberPayload)
      onCreated(group, [member])
    } catch (err) {
      console.error(err)
      toast.error('Impossible de créer la participation. Réessayez.')
    } finally {
      setCreating(null)
    }
  }

  return (
    <Modal open={open} onClose={creating ? undefined : onClose} title="Nouvelle participation">
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        Quel type de dépense souhaitez-vous partager ?
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {Object.entries(CATEGORIES).map(([key, cat]) => {
          const isLoading = creating === key
          const disabled = !!creating
          return (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              disabled={disabled}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '20px 12px',
                border: `0.5px solid ${isLoading ? 'var(--green)' : 'var(--border-hover)'}`,
                borderRadius: 'var(--radius-lg)',
                background: isLoading ? 'var(--green-light)' : disabled ? 'var(--bg-secondary)' : cat.bg,
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                opacity: disabled && !isLoading ? 0.45 : 1,
              }}
            >
              {isLoading
                ? <Spinner size={22} />
                : <span style={{ fontSize: 26, lineHeight: 1 }}>{cat.emoji}</span>}
              <span style={{
                fontSize: 13, fontWeight: 500,
                color: isLoading ? 'var(--green-dark)' : 'var(--text)',
              }}>
                {cat.label}
              </span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
