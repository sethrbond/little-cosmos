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

    // Safety timeout: if INITIAL_SESSION never fires (network issue, SDK bug),
    // stop showing the loading screen after 8 seconds so users aren't stuck forever
    const timeout = setTimeout(() => setLoading(false), 8000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
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
