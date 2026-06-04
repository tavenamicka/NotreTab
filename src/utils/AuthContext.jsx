import React, { createContext, useContext, useState, useEffect } from 'react'
import { getSession, setSession, clearSession } from './auth'
import { api } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession())
  const [validating, setValidating] = useState(() => !!getSession())

  useEffect(() => {
    if (!user) { setValidating(false); return }
    api.getUserByEmail(user.email)
      .then(users => {
        if (users.length === 0 || users[0].id !== user.id) {
          clearSession()
          setUser(null)
        }
      })
      .catch(() => {})
      .finally(() => setValidating(false))
  }, [])

  const login = (u) => {
    const { password, ...safe } = u
    setSession(safe)
    setUser(safe)
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
