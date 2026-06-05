import React, { useState, useEffect, useMemo } from 'react'
import Avatar from '../components/Avatar'
import Btn from '../components/Btn'
import { computeBalances, simplifyDebts } from '../utils/balance'
import { useToast } from '../utils/ToastContext'
import { formatDate } from '../utils/format'
import { api } from '../utils/api'
import { supabase } from '../utils/supabase'

export default function Reminders({ group, groupId, members, expenses, payments, reminders, onRefresh }) {
  const toast = useToast()

  const [autoEnabled, setAutoEnabled] = useState(group?.reminderSettings?.autoEnabled ?? true)
  const [weeklySummary, setWeeklySummary] = useState(group?.reminderSettings?.weeklySummary ?? false)
  const [sent, setSent] = useState({})
  const [emailLoading, setEmailLoading] = useState({})

  // Sync state when switching groups
  useEffect(() => {
    setAutoEnabled(group?.reminderSettings?.autoEnabled ?? true)
    setWeeklySummary(group?.reminderSettings?.weeklySummary ?? false)
  }, [group?.id])

  const debts = useMemo(
    () => simplifyDebts(computeBalances(expenses, payments, members)),
    [expenses, payments, members]
  )
  const getMember = id => members.find(m => String(m.id) === String(id))

  const sendReminder = async (debt) => {
    try {
      await api.createReminder({
        groupId,
        fromId: debt.to,
        toId: debt.from,
        amount: debt.amount,
        sentAt: new Date().toISOString(),
        status: 'sent'
      })
      setSent(s => ({ ...s, [`${debt.from}-${debt.to}`]: true }))
      onRefresh()
    } catch {
      toast.error('Impossible d\'envoyer le rappel.')
    }
  }

  const sendEmailReminder = async (debt) => {
    const debtor = getMember(debt.from)
    const creditor = getMember(debt.to)
    const key = `${debt.from}-${debt.to}`

    if (!debtor?.email) {
      toast.error(`${debtor?.name ?? 'Ce membre'} n'a pas d'adresse email renseignée.`)
      return
    }

    setEmailLoading(s => ({ ...s, [key]: true }))
    try {
      const { error } = await supabase.functions.invoke('send-reminder', {
        body: {
          groupName: group?.name ?? 'NotreTab',
          fromMemberName: creditor?.name ?? 'Un membre',
          toMemberEmail: debtor.email,
          toMemberName: debtor?.name ?? 'Un membre',
          amount: debt.amount,
        },
      })

      if (error) throw error

      // Enregistrer le rappel dans la base
      await api.createReminder({
        groupId,
        fromId: debt.to,
        toId: debt.from,
        amount: debt.amount,
        sentAt: new Date().toISOString(),
        status: 'email_sent'
      })

      setSent(s => ({ ...s, [key]: true }))
      toast.success(`Rappel envoyé à ${debtor.name} !`)
      onRefresh()
    } catch (e) {
      toast.error('Impossible d\'envoyer le rappel par email.')
    } finally {
      setEmailLoading(s => ({ ...s, [key]: false }))
    }
  }

  const updateSettings = async (next) => {
    try {
      await api.updateGroup(groupId, { reminderSettings: next })
    } catch {
      toast.error('Impossible de sauvegarder les paramètres.')
      // Revert optimistic state
      setAutoEnabled(group?.reminderSettings?.autoEnabled ?? true)
      setWeeklySummary(group?.reminderSettings?.weeklySummary ?? false)
    }
  }

  const handleToggle = (field, newVal) => {
    const next = {
      autoEnabled: field === 'autoEnabled' ? newVal : autoEnabled,
      weeklySummary: field === 'weeklySummary' ? newVal : weeklySummary,
    }
    if (field === 'autoEnabled') setAutoEnabled(newVal)
    else setWeeklySummary(newVal)
    updateSettings(next)
  }

  const Toggle = ({ value, onChange }) => (
    <div onClick={() => onChange(!value)} style={{
      width: 36, height: 20, borderRadius: 20, cursor: 'pointer',
      background: value ? 'var(--green)' : 'var(--border-hover)',
      position: 'relative', transition: 'background 0.2s', flexShrink: 0
    }}>
      <div style={{
        width: 16, height: 16, background: '#fff', borderRadius: '50%',
        position: 'absolute', top: 2,
        left: value ? 18 : 2, transition: 'left 0.2s'
      }} />
    </div>
  )

  const sectionTitle = (t) => (
    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '10px', marginTop: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t}</div>
  )

  return (
    <div>
      {sectionTitle('Dettes en attente de remboursement')}
      {debts.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', border: '0.5px dashed var(--border)', borderRadius: 'var(--radius)' }}>
          🎉 Tout le monde est à jour !
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {debts.map((debt, i) => {
            const debtor = getMember(debt.from)
            const creditor = getMember(debt.to)
            const key = `${debt.from}-${debt.to}`
            const wasSent = sent[key]
            const isEmailLoading = emailLoading[key]
            const hasEmail = !!debtor?.email
            return (
              <div key={i} style={{ padding: '12px 14px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg)' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--red-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🔔</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>
                    {debtor?.name} doit {debt.amount.toFixed(2)} € à {creditor?.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {wasSent ? '✅ Rappel envoyé' : 'Rappel automatique activé'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <Btn
                    style={{ padding: '5px 12px', fontSize: '12px' }}
                    onClick={() => sendReminder(debt)}
                    disabled={wasSent}
                  >
                    {wasSent ? 'Envoyé' : 'Marquer'}
                  </Btn>
                  <Btn
                    style={{
                      padding: '5px 10px', fontSize: '12px',
                      background: hasEmail && !wasSent && !isEmailLoading ? 'var(--bg-secondary)' : undefined,
                      opacity: !hasEmail || wasSent ? 0.5 : 1,
                    }}
                    onClick={() => !wasSent && !isEmailLoading && sendEmailReminder(debt)}
                    disabled={wasSent || isEmailLoading || !hasEmail}
                    title={!hasEmail ? 'Cet utilisateur n\'a pas d\'email renseigné' : 'Envoyer un rappel par email'}
                  >
                    {isEmailLoading ? '…' : '✉️'}
                  </Btn>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {reminders.length > 0 && <>
        {sectionTitle('Historique des rappels')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {reminders.map(r => {
            const to = getMember(r.toId)
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }}>
                <Avatar initials={to?.initials} color={to?.color} textColor={to?.textColor} size={28} />
                <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Rappel envoyé à <strong style={{ color: 'var(--text)' }}>{to?.name}</strong> — {r.amount.toFixed(2)} €
                  {r.status === 'email_sent' && <span style={{ marginLeft: 6, fontSize: '11px', background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 10, padding: '1px 6px' }}>✉️ email</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  {formatDate(r.sentAt)}
                </div>
              </div>
            )
          })}
        </div>
      </>}

      {sectionTitle('Paramètres des rappels')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          { label: 'Rappels automatiques', sub: 'Activés après 7 jours de retard', val: autoEnabled, field: 'autoEnabled' },
          { label: 'Résumé hebdomadaire', sub: 'Récap des dettes chaque lundi', val: weeklySummary, field: 'weeklySummary' },
        ].map(({ label, sub, val, field }) => (
          <div key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sub}</div>
            </div>
            <Toggle value={val} onChange={(newVal) => handleToggle(field, newVal)} />
          </div>
        ))}
      </div>
    </div>
  )
}
