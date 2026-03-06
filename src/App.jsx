import { useState, useEffect, useCallback } from 'react'
import { AuthProvider, useAuth } from './AuthContext.jsx'
import AuthScreen from './AuthScreen.jsx'
import WorldSelector from './WorldSelector.jsx'
import OurWorld from './OurWorld.jsx'
import WelcomeLetterScreen from './WelcomeLetterScreen.jsx'
import { getWelcomeLetter, markLetterRead } from './supabaseWelcomeLetters.js'
import { loadMyWorlds, acceptInvite, getInviteInfo } from './supabaseWorlds.js'

function AppInner() {
  const { user, userId, loading, signOut } = useAuth()
  const [worldMode, setWorldMode] = useState(
    () => localStorage.getItem('worldMode') || null
  )
  const [activeWorldId, setActiveWorldId] = useState(
    () => localStorage.getItem('activeWorldId') || null
  )
  const [activeWorldName, setActiveWorldName] = useState(
    () => localStorage.getItem('activeWorldName') || null
  )
  const [activeWorldRole, setActiveWorldRole] = useState(
    () => localStorage.getItem('activeWorldRole') || null
  )
  const [welcomeLetter, setWelcomeLetter] = useState(null)
  const [letterChecked, setLetterChecked] = useState(false)
  const [worlds, setWorlds] = useState([])
  const [worldsLoaded, setWorldsLoaded] = useState(false)
  const [invitePending, setInvitePending] = useState(null)

  // User's display name from auth metadata
  const userDisplayName = user?.user_metadata?.display_name || ''

  // Check for welcome letter on login
  useEffect(() => {
    if (!user?.email) { setLetterChecked(true); return }
    getWelcomeLetter(user.email).then(letter => {
      setWelcomeLetter(letter)
      setLetterChecked(true)
    }).catch(err => { console.error('[welcome letter]', err); setLetterChecked(true) })
  }, [user?.email])

  // Load user's shared worlds
  useEffect(() => {
    if (!userId) { setWorldsLoaded(true); return }
    loadMyWorlds(userId).then(w => {
      setWorlds(w)
      setWorldsLoaded(true)
    }).catch(err => { console.error('[loadMyWorlds]', err); setWorldsLoaded(true) })
  }, [userId])

  // Check for invite token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('invite')
    if (token) {
      setInvitePending(token)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Process invite after login
  useEffect(() => {
    if (!invitePending || !userId) return
    const token = invitePending
    setInvitePending(null)

    getInviteInfo(token).then(info => {
      if (!info) { alert('This invite link is invalid or expired.'); return }
      const worldName = info.worlds?.name || 'a shared world'
      if (confirm(`You've been invited to join "${worldName}". Accept?`)) {
        acceptInvite(token).then(result => {
          if (result?.ok) {
            loadMyWorlds(userId).then(w => {
              setWorlds(w)
              const joined = w.find(x => x.id === result.world_id)
              selectWorld('our', result.world_id, worldName, joined?.role || 'member')
            })
          } else {
            alert(result?.error || 'Failed to accept invite.')
          }
        })
      }
    })
  }, [invitePending, userId])

  // Auto-route brand new users straight to My World (first login ever)
  useEffect(() => {
    if (!userId || !worldsLoaded || worldMode) return
    const hasVisited = localStorage.getItem('cosmos_hasVisited')
    if (!hasVisited) {
      localStorage.setItem('cosmos_hasVisited', '1')
      selectWorld('my')
    }
  }, [userId, worldsLoaded, worldMode])

  const selectWorld = useCallback((mode, worldId = null, worldName = null, worldRole = null) => {
    localStorage.setItem('worldMode', mode)
    setWorldMode(mode)
    if (worldId) {
      localStorage.setItem('activeWorldId', worldId)
      localStorage.setItem('activeWorldName', worldName || '')
      localStorage.setItem('activeWorldRole', worldRole || 'owner')
      setActiveWorldId(worldId)
      setActiveWorldName(worldName)
      setActiveWorldRole(worldRole || 'owner')
    } else {
      localStorage.removeItem('activeWorldId')
      localStorage.removeItem('activeWorldName')
      localStorage.removeItem('activeWorldRole')
      setActiveWorldId(null)
      setActiveWorldName(null)
      setActiveWorldRole(null)
    }
  }, [])

  const switchWorld = useCallback(() => {
    localStorage.removeItem('worldMode')
    localStorage.removeItem('activeWorldId')
    localStorage.removeItem('activeWorldName')
    localStorage.removeItem('activeWorldRole')
    setWorldMode(null)
    setActiveWorldId(null)
    setActiveWorldName(null)
    setActiveWorldRole(null)
    if (userId) loadMyWorlds(userId).then(setWorlds).catch(() => {})
  }, [userId])

  if (loading || !letterChecked || !worldsLoaded) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0c0a12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Palatino Linotype", serif', color: '#e8e0d0', fontSize: 18, opacity: 0.6 }}>
        Loading...
      </div>
    )
  }

  if (!user) return <AuthScreen />

  // Show welcome letter before anything else
  if (welcomeLetter) {
    return (
      <WelcomeLetterScreen
        letter={welcomeLetter}
        onEnter={() => {
          markLetterRead(welcomeLetter.id).catch(err => console.error('[markLetterRead]', err))
          setWelcomeLetter(null)
        }}
      />
    )
  }

  if (!worldMode) {
    return (
      <WorldSelector
        onSelect={selectWorld}
        onSignOut={signOut}
        worlds={worlds}
        onWorldsChange={setWorlds}
        userId={userId}
        userDisplayName={userDisplayName}
      />
    )
  }

  return (
    <OurWorld
      worldMode={worldMode}
      worldId={activeWorldId}
      worldName={activeWorldName}
      worldRole={activeWorldRole}
      onSwitchWorld={switchWorld}
    />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
