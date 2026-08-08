import React, { createContext, useContext, useState, useEffect } from 'react'
import { getSession, setSession, clearSession, login as authLogin, ensureShareId } from './auth'
import { api } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession())
  const [validating, setValidating] = useState(() => !!getSession())

  // Validation de la session au démarrage : vérifie que l'utilisateur existe encore
  // en base, et complète les comptes antérieurs au modèle de visibilité.
  useEffect(() => {
    if (!user) { setValidating(false); return }
    api.getUserByEmail(user.email)
      .then(async users => {
        if (users.length === 0 || users[0].id !== user.id) {
          clearSession()
          setUser(null)
          return
        }
        const { password: _pw, ...fresh } = users[0]
        const added = await ensureShareId(fresh).catch(() => null)
        const merged = { ...fresh, ...(added || {}) }
        setSession(merged)
        setUser(merged)
      })
      .catch(() => {})
      .finally(() => setValidating(false))
  }, [])

  const login = async (email, password) => {
    const u = await authLogin(email, password)
    const { password: _, ...safe } = u
    const added = await ensureShareId(safe).catch(() => null)
    const merged = { ...safe, ...(added || {}) }
    setSession(merged)
    setUser(merged)
    return merged
  }

  const logout = () => {
    clearSession()
    setUser(null)
  }

  const updateUser = (updates) => {
    const updated = { ...user, ...updates }
    setSession(updated)
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, validating }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
