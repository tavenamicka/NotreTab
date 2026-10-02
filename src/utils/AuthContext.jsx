import React, { createContext, useContext, useState, useEffect } from 'react'
import { getSession, setSession, clearSession, login as authLogin, ensureShareId } from './auth'
import { api, AuthError } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession())
  const [validating, setValidating] = useState(() => !!getSession())

  // Validation de la session au démarrage. Depuis S4 c'est le serveur qui
  // tranche : GET /auth/me renvoie 401 si le jeton est absent, expiré ou
  // révoqué, et le compte de référence dans la même réponse. Une session
  // survivant dans localStorage sans jeton valide ne donne donc plus accès à
  // rien.
  useEffect(() => {
    if (!user) { setValidating(false); return }
    api.me()
      .then(async ({ user: fresh }) => {
        const added = await ensureShareId(fresh).catch(() => null)
        const merged = { ...fresh, ...(added || {}) }
        setSession(merged)
        setUser(merged)
      })
      .catch((err) => {
        // Seul un refus explicite du serveur ferme la session. Une panne
        // réseau n'en est pas un : l'app est une PWA, démarrer hors ligne doit
        // rester possible avec la session en cache.
        if (err instanceof AuthError) {
          clearSession()
          setUser(null)
        }
      })
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
