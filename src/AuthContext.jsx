import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabaseClient.js'

const AuthContext = createContext({ session: null, user: null, userId: null, loading: true })

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        if (event === 'INITIAL_SESSION') {
          setLoading(false)
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

  const value = {
    session,
    user: session?.user ?? null,
    userId: session?.user?.id ?? null,
    loading,
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
