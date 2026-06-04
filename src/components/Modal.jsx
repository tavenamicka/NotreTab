import React, { useEffect, useState, useRef, useId } from 'react'

const DURATION = 170 // ms — doit correspondre aux durées CSS (.modal-out: 0.16s, overlay-out: 0.16s)

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])',
  'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '16px',
  },
  box: {
    background: 'var(--bg)', borderRadius: 'var(--radius-lg)',
    border: '0.5px solid var(--border)', padding: '24px',
    width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto',
    position: 'relative',
  },
  title: { fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: 'var(--text)' },
  close: {
    position: 'absolute', top: '12px', right: '12px',
    background: 'none', border: 'none', fontSize: '18px',
    color: 'var(--text-secondary)', cursor: 'pointer',
  },
}

export default function Modal({ open, onClose, title, children }) {
  const [visible, setVisible] = useState(open)
  const [closing, setClosing] = useState(false)
  const timerRef = useRef(null)
  const panelRef = useRef(null)
  const prevFocusRef = useRef(null)
  const titleId = useId()

  // Keyboard Escape (window listener — fiable même si le focus s'échappe)
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])

  // Sauvegarde / restauration du focus
  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement
      const t = setTimeout(() => {
        const focusable = panelRef.current?.querySelectorAll(FOCUSABLE)
        focusable?.[0]?.focus()
      }, 0)
      return () => clearTimeout(t)
    } else if (prevFocusRef.current) {
      prevFocusRef.current.focus()
      prevFocusRef.current = null
    }
  }, [open])

  // Open / close transitions
  useEffect(() => {
    clearTimeout(timerRef.current)
    if (open) {
      setClosing(false)
      setVisible(true)
    } else if (visible) {
      setClosing(true)
      timerRef.current = setTimeout(() => {
        setVisible(false)
        setClosing(false)
      }, DURATION)
    }
    return () => clearTimeout(timerRef.current)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Piège focus — Tab / Shift+Tab restent dans le panneau
  const handleKeyDown = (e) => {
    if (e.key !== 'Tab' || !panelRef.current) return
    const focusable = Array.from(panelRef.current.querySelectorAll(FOCUSABLE))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus() }
    }
  }

  if (!visible) return null

  return (
    <div
      className={closing ? 'modal-overlay-exit' : 'modal-overlay-enter'}
      style={s.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        className={closing ? 'modal-panel-exit' : 'modal-panel-enter'}
        style={s.box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        <button style={s.close} onClick={onClose} aria-label="Fermer">✕</button>
        {title && <div id={titleId} style={s.title}>{title}</div>}
        {children}
      </div>
    </div>
  )
}
