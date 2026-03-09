import { useState, useEffect, useCallback } from 'react'
import { AuthProvider, useAuth } from './AuthContext.jsx'
import AuthScreen from './AuthScreen.jsx'
import WorldSelector from './WorldSelector.jsx'
import OurWorld from './OurWorld.jsx'
import WelcomeLetterScreen from './WelcomeLetterScreen.jsx'
import CinematicOnboarding from './CinematicOnboarding.jsx'
import { getWelcomeLetter, markLetterRead } from './supabaseWelcomeLetters.js'
import { loadMyWorlds, loadMyWorldSubtitle, acceptInvite, getInviteInfo, getPendingWorldInvites, getPendingWorldInvitesForLetter } from './supabaseWorlds.js'
import { getPendingRequests, getMyConnections } from './supabaseConnections.js'

// Bump this to reset all onboarding/tour flags for every user
const ONBOARD_VERSION = 'v3'

function AppInner() {
  const { user, userId, loading, signOut } = useAuth()
  const safeGet = (key) => { try { return localStorage.getItem(key) } catch { return null } }
  const safeSet = (key, val) => { try { localStorage.setItem(key, val) } catch {} }
  const safeRemove = (key) => { try { localStorage.removeItem(key) } catch {} }
  const obKey = (name) => `${ONBOARD_VERSION}_${name}`

  const [worldMode, setWorldMode] = useState(() => safeGet('worldMode'))
  const [activeWorldId, setActiveWorldId] = useState(() => safeGet('activeWorldId'))
  const [activeWorldName, setActiveWorldName] = useState(() => safeGet('activeWorldName'))
  const [activeWorldRole, setActiveWorldRole] = useState(() => safeGet('activeWorldRole'))
  const [activeWorldType, setActiveWorldType] = useState(() => safeGet('activeWorldType'))
  const [welcomeLetter, setWelcomeLetter] = useState(null)
  const [letterChecked, setLetterChecked] = useState(false)
  const [worlds, setWorlds] = useState([])
  const [worldsLoaded, setWorldsLoaded] = useState(false)
  const [invitePending, setInvitePending] = useState(null)
  const [connections, setConnections] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [pendingWorldInvites, setPendingWorldInvites] = useState([])
  const [myWorldSubtitle, setMyWorldSubtitle] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [transitionColor, setTransitionColor] = useState('#0c0a12')
  const [showCinematic, setShowCinematic] = useState(false)

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

  // Load user's shared worlds + connections
  useEffect(() => {
    if (!userId) { setWorldsLoaded(true); return }
    Promise.all([
      loadMyWorlds(userId),
      getMyConnections(userId),
      getPendingRequests(user?.email),
      getPendingWorldInvites(user?.email),
      loadMyWorldSubtitle(userId),
    ]).then(([w, conn, pending, worldInvites, mySub]) => {
      setWorlds(w)
      setConnections(conn)
      setPendingRequests(pending)
      setPendingWorldInvites(worldInvites || [])
      setMyWorldSubtitle(mySub)
      setWorldsLoaded(true)
    }).catch(err => { console.error('[loadData]', err); setWorldsLoaded(true) })
  }, [userId, user?.email])

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
              // If brand-new user, don't navigate — let cinematic play first.
              // The world will appear on their cosmos screen after cinematic.
              const isNewUser = !safeGet(obKey(`cosmos_hasVisited_${userId}`))
              if (!isNewUser) {
                const joined = w.find(x => x.id === result.world_id)
                selectWorld('our', result.world_id, worldName, joined?.role || 'member', joined?.type || 'shared')
              }
            })
          } else {
            alert(result?.error || 'Failed to accept invite.')
          }
        }).catch(err => { console.error('[acceptInvite]', err); alert('Something went wrong accepting the invite. Please try again.') })
      }
    }).catch(err => { console.error('[getInviteInfo]', err); alert('Could not load invite details. Please check your connection and try again.') })
  }, [invitePending, userId])

  // Brand new users: show cinematic onboarding (always, regardless of how they arrived)
  useEffect(() => {
    if (!userId || !worldsLoaded) return
    const hasVisited = safeGet(obKey(`cosmos_hasVisited_${userId}`))
    if (!hasVisited) {
      // Clear any worldMode that invite processing might have set
      if (worldMode) {
        safeRemove('worldMode')
        setWorldMode(null)
      }
      setShowCinematic(true)
    }
  }, [userId, worldsLoaded])

  // Dynamic document title
  useEffect(() => {
    if (!worldMode) { document.title = 'My Cosmos — Little Cosmos'; return }
    if (worldMode === 'my') { document.title = 'My World — Little Cosmos'; return }
    document.title = `${activeWorldName || 'Shared World'} — Little Cosmos`
  }, [worldMode, activeWorldName])

  const selectWorld = useCallback((mode, worldId = null, worldName = null, worldRole = null, worldType = null) => {
    // Determine accent color for zoom transition
    const colors = { partner: '#1a1230', friends: '#0e1028', family: '#181210', my: '#121820' }
    setTransitionColor(colors[worldType] || colors[mode] || '#0c0a12')
    setTransitioning(true)

    // Delay the actual world mount until zoom animation completes
    setTimeout(() => {
      safeSet('worldMode', mode)
      setWorldMode(mode)
      if (worldId) {
        safeSet('activeWorldId', worldId)
        safeSet('activeWorldName', worldName || '')
        safeSet('activeWorldRole', worldRole || 'owner')
        safeSet('activeWorldType', worldType || '')
        setActiveWorldId(worldId)
        setActiveWorldName(worldName)
        setActiveWorldRole(worldRole || 'owner')
        setActiveWorldType(worldType || null)
      } else {
        safeRemove('activeWorldId')
        safeRemove('activeWorldName')
        safeRemove('activeWorldRole')
        safeRemove('activeWorldType')
        setActiveWorldId(null)
        setActiveWorldName(null)
        setActiveWorldRole(null)
        setActiveWorldType(null)
      }
      // Keep overlay briefly while OurWorld initializes
      setTimeout(() => setTransitioning(false), 400)
    }, 600)
  }, [])

  const switchWorld = useCallback(() => {
    safeRemove('worldMode')
    safeRemove('activeWorldId')
    safeRemove('activeWorldName')
    safeRemove('activeWorldRole')
    safeRemove('activeWorldType')
    setWorldMode(null)
    setActiveWorldId(null)
    setActiveWorldName(null)
    setActiveWorldRole(null)
    setActiveWorldType(null)
    if (userId) {
      Promise.all([
        loadMyWorlds(userId),
        getMyConnections(userId),
        getPendingRequests(user?.email),
        getPendingWorldInvites(user?.email),
        loadMyWorldSubtitle(userId),
      ]).then(([w, conn, pending, worldInvites, mySub]) => {
        setWorlds(w)
        setConnections(conn)
        setPendingRequests(pending)
        setPendingWorldInvites(worldInvites || [])
        setMyWorldSubtitle(mySub)
      }).catch(err => console.error('[switchWorld] refresh error:', err))
    }
  }, [userId, user?.email])

  // Show auth screen as soon as we know there's no user (don't wait for letter/worlds)
  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0c0a12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '"Palatino Linotype", serif', color: '#e8e0d0', gap: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,170,110,0.12), transparent 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'cosmosPulse 2s ease-in-out infinite' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(200,170,110,0.3)', borderTopColor: 'rgba(200,170,110,0.8)', animation: 'cosmosSpin 1s linear infinite' }} />
        </div>
        <div style={{ fontSize: 13, letterSpacing: '0.15em', opacity: 0.5, animation: 'cosmosShimmer 2s ease-in-out infinite' }}>Loading your cosmos</div>
        <style>{`
          @keyframes cosmosSpin { to { transform: rotate(360deg); } }
          @keyframes cosmosPulse { 0%,100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.1); opacity: 1; } }
          @keyframes cosmosShimmer { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        `}</style>
      </div>
    )
  }

  if (!user) return <AuthScreen />

  // For logged-in users, wait for letter check and worlds to load
  if (!letterChecked || !worldsLoaded) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0c0a12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '"Palatino Linotype", serif', color: '#e8e0d0', gap: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,170,110,0.12), transparent 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'cosmosPulse 2s ease-in-out infinite' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(200,170,110,0.3)', borderTopColor: 'rgba(200,170,110,0.8)', animation: 'cosmosSpin 1s linear infinite' }} />
        </div>
        <div style={{ fontSize: 13, letterSpacing: '0.15em', opacity: 0.5, animation: 'cosmosShimmer 2s ease-in-out infinite' }}>Loading your cosmos</div>
        <style>{`
          @keyframes cosmosSpin { to { transform: rotate(360deg); } }
          @keyframes cosmosPulse { 0%,100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.1); opacity: 1; } }
          @keyframes cosmosShimmer { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        `}</style>
      </div>
    )
  }

  // Show welcome letter before anything else
  if (welcomeLetter) {
    return (
      <WelcomeLetterScreen
        letter={welcomeLetter}
        onEnter={async () => {
          markLetterRead(welcomeLetter.id).catch(err => console.error('[markLetterRead]', err))
          // Auto-accept any world invite associated with this letter
          try {
            const invites = await getPendingWorldInvitesForLetter(welcomeLetter)
            for (const inv of invites) {
              const result = await acceptInvite(inv.token)
              if (result?.ok) console.log('[welcomeLetter] auto-accepted invite to', inv.worldName)
            }
            // Refresh worlds list so the shared world appears on cosmos
            if (userId) {
              const w = await loadMyWorlds(userId)
              setWorlds(w)
            }
          } catch (err) {
            console.error('[welcomeLetter] auto-accept error:', err)
          }
          setWelcomeLetter(null)
        }}
      />
    )
  }

  // Cinematic onboarding for brand-new users — lands on cosmos screen after
  if (showCinematic) {
    return (
      <CinematicOnboarding
        userId={userId}
        onComplete={() => {
          safeSet(obKey(`cosmos_hasVisited_${userId}`), '1')
          setShowCinematic(false)
          // worldMode stays null → user lands on cosmos screen
          // Each world's own onboarding tour plays on first entry
        }}
      />
    )
  }

  if (!worldMode) {
    return (
      <>
        <WorldSelector
          onSelect={selectWorld}
          onSignOut={signOut}
          worlds={worlds}
          onWorldsChange={setWorlds}
          userId={userId}
          userEmail={user?.email}
          userDisplayName={userDisplayName}
          connections={connections}
          onConnectionsChange={setConnections}
          pendingRequests={pendingRequests}
          onPendingRequestsChange={setPendingRequests}
          pendingWorldInvites={pendingWorldInvites}
          onPendingWorldInvitesChange={setPendingWorldInvites}
          myWorldSubtitle={myWorldSubtitle}
        />
        {transitioning && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
            background: transitionColor,
            animation: 'cosmosZoomIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          }} />
        )}
        <style>{`
          @keyframes cosmosZoomIn {
            0% { opacity: 0; transform: scale(0.3); border-radius: 50%; }
            60% { opacity: 1; border-radius: 20%; }
            100% { opacity: 1; transform: scale(1); border-radius: 0; }
          }
          @keyframes cosmosFadeOut {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
        `}</style>
      </>
    )
  }

  return (
    <>
      <OurWorld
        worldMode={worldMode}
        worldId={activeWorldId}
        worldName={activeWorldName}
        worldRole={activeWorldRole}
        worldType={activeWorldType}
        onSwitchWorld={switchWorld}
      />
      {transitioning && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
          background: transitionColor,
          animation: 'cosmosFadeOut 0.4s ease-out forwards',
        }} />
      )}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
