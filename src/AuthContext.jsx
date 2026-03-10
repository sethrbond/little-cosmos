import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabaseClient.js'

const AuthContext = createContext({ session: null, user: null, userId: null, loading: true, passwordRecovery: false })

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        if (event === 'INITIAL_SESSION') {
          setLoading(false)
        }
        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true)
        }
        if (event === 'TOKEN_REFRESHED' && !session) {
          // Token refresh failed — session expired
          supabase.auth.signOut().catch(() => {})
          setSession(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null
  const emailVerified = !!user?.email_confirmed_at

  const value = {
    session,
    user,
    userId: user?.id ?? null,
    loading,
    emailVerified,
    passwordRecovery,
    clearPasswordRecovery: () => setPasswordRecovery(false),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
