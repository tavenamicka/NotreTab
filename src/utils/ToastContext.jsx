import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

const EXIT_DURATION = 220 // ms — doit correspondre à toast-out dans CSS
let _nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts]     = useState([])
  const [exiting, setExiting]   = useState(new Set())
  const timersRef = useRef({})   // id → setTimeout handle

  // Démarre l'animation de sortie, puis supprime après la durée
  const dismiss = useCallback((id) => {
    setExiting(prev => new Set([...prev, id]))
    timersRef.current[`exit-${id}`] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      setExiting(prev => { const s = new Set(prev); s.delete(id); return s })
      delete timersRef.current[`exit-${id}`]
    }, EXIT_DURATION)
  }, [])

  const addToast = useCallback((message, type = 'error') => {
    const id = ++_nextId
    setToasts(prev => [...prev, { id, message, type }])
    // Auto-dismiss après 4 s (commence l'animation de sortie à 3,78 s)
    timersRef.current[id] = setTimeout(() => dismiss(id), 3780)
    return id
  }, [dismiss])

  const value = {
    error:   (msg) => addToast(msg, 'error'),
    success: (msg) => addToast(msg, 'success'),
    info:    (msg) => addToast(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={{
        position: 'fixed', bottom: 16, right: 16,
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 9999, maxWidth: 340,
        pointerEvents: 'none',  // laisse passer les clics sur le fond sauf bouton ✕
      }}>
        {toasts.map(t => {
          const isError   = t.type === 'error'
          const isSuccess = t.type === 'success'
          const isExiting = exiting.has(t.id)
          return (
            <div
              key={t.id}
              className={isExiting ? 'toast-exit' : 'toast-enter'}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                border: `0.5px solid ${isError ? 'var(--red)' : isSuccess ? 'var(--green)' : 'var(--border-hover)'}`,
                background: isError ? 'var(--red-light)' : isSuccess ? 'var(--green-light)' : 'var(--bg)',
                color: isError ? 'var(--red)' : isSuccess ? 'var(--green-dark)' : 'var(--text)',
                fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                pointerEvents: 'auto',
              }}
            >
              <span style={{ flexShrink: 0, fontSize: 15 }}>
                {isError ? '⚠' : isSuccess ? '✓' : 'ℹ'}
              </span>
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'inherit', opacity: 0.5, fontSize: 14,
                  lineHeight: 1, padding: '0 2px', flexShrink: 0,
                }}
              >✕</button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
