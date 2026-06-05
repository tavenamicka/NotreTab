import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabase'
import { login as authLogin, logout as authLogout, updateUser as authUpdateUser } from './auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [validating, setValidating] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser(formatUser(data.session.user))
      }
      setValidating(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
        setUser(session?.user ? formatUser(session.user) : null)
      } else {
        setUser(session?.user ? formatUser(session.user) : null)
        if (event === 'SIGNED_OUT') setRecoveryMode(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  function formatUser(u) {
    return {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name ?? '',
      initials: u.user_metadata?.initials ?? '',
      color: u.user_metadata?.color ?? '#9FE1CB',
      textColor: u.user_metadata?.textColor ?? '#085041',
    }
  }

  const login = async (email, password) => {
    const u = await authLogin(email, password)
    setUser(formatUser(u))
    return u
  }

  const logout = async () => {
    await authLogout()
    setUser(null)
    setRecoveryMode(false)
  }

  const updateUser = async (updates) => {
    const u = await authUpdateUser(updates)
    setUser(formatUser(u))
    return u
  }

  const exitRecoveryMode = () => setRecoveryMode(false)

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, validating, recoveryMode, exitRecoveryMode }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}