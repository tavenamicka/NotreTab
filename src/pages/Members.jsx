import React, { useState } from 'react'
import Avatar from '../components/Avatar'
import Badge from '../components/Badge'
import Btn from '../components/Btn'
import InviteModal from '../components/InviteModal'
import { computeBalances } from '../utils/balance'
import { useAuth } from '../utils/AuthContext'
import { useToast } from '../utils/ToastContext'
import { api } from '../utils/api'

export default function Members({ groupId, members, expenses, payments, onRefresh }) {
  const { user } = useAuth()
  const toast = useToast()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const balances = computeBalances(expenses, payments, members)

  const myMember = members.find(m => String(m.userId) === String(user?.id))
  const isAdmin = myMember?.role === 'admin'

  const toggleRole = async (m) => {
    if (!isAdmin) return
    try {
      await api.updateMember(m.id, { role: m.role === 'admin' ? 'member' : 'admin' })
      onRefresh()
    } catch {
      toast.error('Impossible de modifier le rôle.')
    }
  }

  const removeMember = async (id) => {
    try {
      await api.deleteMember(id)
      onRefresh()
    } catch {
      toast.error('Impossible de retirer ce membre.')
    } finally {
      setConfirmRemove(null)
    }
  }

  const sectionTitle = (t) => (
    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '10px', marginTop: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t}</div>
  )

  return (
    <div>
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
          <Btn variant="primary" onClick={() => setInviteOpen(true)}>+ Inviter un membre</Btn>
        </div>
      )}

      {sectionTitle('Membres & soldes')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {members.map(m => {
          const bal = balances[String(m.id)] || 0
          const maxAbs = Math.max(...Object.values(balances).map(Math.abs)) || 1
          const pct = Math.min(100, Math.abs(bal) / maxAbs * 100)
          const isMe = String(m.userId) === String(user?.id)
          return (
            <div key={m.id} style={{ background: 'var(--bg)', border: `0.5px solid ${isMe ? 'var(--green)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Avatar initials={m.initials} color={m.color} textColor={m.textColor} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                  {m.name} {isMe && <span style={{ fontSize: 11, color: 'var(--green-dark)' }}>(vous)</span>}
                </div>
                <div style={{ fontSize: '12px', marginTop: '2px', color: bal >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                  {bal >= 0 ? '+' : ''}{bal.toFixed(2)} €
                </div>
                <div style={{ height: '3px', background: 'var(--bg-tertiary)', borderRadius: '2px', marginTop: '6px' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: bal >= 0 ? 'var(--green)' : 'var(--red)', borderRadius: '2px', transition: 'width 0.3s' }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {sectionTitle('Droits d\'accès')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {members.map(m => {
          const isMe = String(m.userId) === String(user?.id)
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }}>
              <Avatar initials={m.initials} color={m.color} textColor={m.textColor} size={28} />
              <div style={{ flex: 1, fontSize: '13px' }}>
                {m.name} {isMe && <span style={{ fontSize: 11, color: 'var(--green-dark)' }}>(vous)</span>}
              </div>
              {m.email && <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{m.email}</div>}
              <Badge variant={m.role === 'admin' ? 'success' : 'neutral'}>{m.role === 'admin' ? 'Admin' : 'Membre'}</Badge>
              {isAdmin && !isMe && (
                <>
                  <Btn style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => toggleRole(m)}>
                    {m.role === 'admin' ? '↓ Membre' : '↑ Admin'}
                  </Btn>
                  <Btn style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setConfirmRemove(m)}>✕</Btn>
                </>
              )}
            </div>
          )
        })}
      </div>

      {!isAdmin && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-secondary)' }}>
          Seuls les administrateurs peuvent inviter ou retirer des membres.
        </div>
      )}

      {confirmRemove && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', padding: 24, width: 320, maxWidth: '90%' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Retirer ce membre ?</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{confirmRemove.name} sera retiré du groupe.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmRemove(null)} style={{ padding: '7px 14px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border-hover)', background: 'transparent', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>Annuler</button>
              <button onClick={() => removeMember(confirmRemove.id)} style={{ padding: '7px 14px', borderRadius: 'var(--radius)', border: '0.5px solid var(--red)', background: 'var(--red-light)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--red)', fontWeight: 500 }}>Retirer</button>
            </div>
          </div>
        </div>
      )}

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        groupId={groupId}
        existingMembers={members}
        onSaved={onRefresh}
      />
    </div>
  )
}
