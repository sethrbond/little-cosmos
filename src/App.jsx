import { useState, useEffect, useCallback, useRef, Component, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './AuthContext.jsx'
import { supabase } from './supabaseClient.js'
import AuthScreen from './AuthScreen.jsx'
import LandingPage from './LandingPage.jsx'

// Route-level code splitting — only one screen renders at a time
const WorldSelector = lazy(() => import('./WorldSelector.jsx'))
const OurWorld = lazy(() => import('./OurWorld.jsx'))
const WelcomeLetterScreen = lazy(() => import('./WelcomeLetterScreen.jsx'))
const CinematicOnboarding = lazy(() => import('./CinematicOnboarding.jsx'))
import { getAllWelcomeLetters, markLetterRead } from './supabaseWelcomeLetters.js'
import { loadMyWorlds, loadMyWorldSubtitle, acceptInvite, getInviteInfo, getPendingWorldInvites, getPendingWorldInvitesForLetter, ensurePersonalWorld, clearWorldCaches } from './supabaseWorlds.js'
import { getPendingRequests, getMyConnections } from './supabaseConnections.js'

// Bump this to reset all onboarding/tour flags for every user
const ONBOARD_VERSION = 'v3'

const safeGet = (key) => { try { return localStorage.getItem(key) } catch { return null } }
const safeSet = (key, val) => { try { localStorage.setItem(key, val) } catch {} }
const safeRemove = (key) => { try { localStorage.removeItem(key) } catch {} }
const obKey = (name) => `${ONBOARD_VERSION}_${name}`

function LoadingScreen() {
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

class ScreenErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(err, info) { console.error('[ScreenErrorBoundary]', err, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#0c0a12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '"Palatino Linotype", serif', color: '#e8e0d0', gap: 16, padding: 32 }}>
          <div style={{ fontSize: 28, opacity: 0.7 }}>Something went wrong</div>
          <div role="alert" style={{ fontSize: 13, opacity: 0.4, maxWidth: 400, textAlign: 'center' }}>{this.state.error?.message || 'Unknown error'}</div>
          <button onClick={() => { this.setState({ error: null }); window.location.reload() }} style={{ marginTop: 16, padding: '10px 28px', background: 'rgba(200,170,110,0.15)', border: '1px solid rgba(200,170,110,0.3)', borderRadius: 8, color: '#e8e0d0', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' }}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

function PasswordResetModal({ onDone }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 10) { setError('Password must be at least 10 characters'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) { setError(error.message); return }
    setSuccess(true)
    setTimeout(onDone, 1500)
  }

  const modalCard = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '36px 32px',
    width: 340, maxWidth: '90vw',
    backdropFilter: 'blur(12px)',
  }
  const modalInp = {
    width: '100%', padding: '10px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: '#e8e0d0',
    fontSize: 15, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
    marginBottom: 12,
  }
  const modalBtn = {
    width: '100%', padding: '11px 0',
    background: 'linear-gradient(135deg, #c9a96e, #b8944f)',
    border: 'none', borderRadius: 8,
    color: '#1a1520', fontSize: 15,
    fontWeight: 600, fontFamily: 'inherit',
    cursor: 'pointer', marginTop: 4,
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Set new password" style={{ position: 'fixed', inset: 0, background: '#0c0a12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '"Palatino Linotype", serif', color: '#e8e0d0', zIndex: 10000 }}>
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: 2, opacity: 0.9 }}>Little Cosmos</div>
        <div style={{ fontSize: 13, opacity: 0.4, marginTop: 4 }}>Create a new password</div>
      </div>
      <div style={modalCard}>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Password Updated</div>
            <div style={{ fontSize: 14, opacity: 0.6 }}>Redirecting...</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, textAlign: 'center' }}>Set New Password</div>
            <input style={modalInp} type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoFocus />
            <input style={modalInp} type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            {error && <div style={{ color: '#e57373', fontSize: 13, marginBottom: 8 }}>{error}</div>}
            <button style={{ ...modalBtn, opacity: saving ? 0.6 : 1 }} disabled={saving} type="submit">
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function AppInner() {
  const { user, userId, loading, emailVerified, passwordRecovery, clearPasswordRecovery, signOut } = useAuth()
  const [authMode, setAuthMode] = useState(null) // null = landing, 'login' | 'signup'

  const [worldMode, setWorldMode] = useState(() => safeGet('worldMode'))
  const [activeWorldId, setActiveWorldId] = useState(() => safeGet('activeWorldId'))
  const [activeWorldName, setActiveWorldName] = useState(() => safeGet('activeWorldName'))
  const [activeWorldRole, setActiveWorldRole] = useState(() => safeGet('activeWorldRole'))
  const [activeWorldType, setActiveWorldType] = useState(() => safeGet('activeWorldType'))
  const [welcomeLetters, setWelcomeLetters] = useState([])
  const [letterChecked, setLetterChecked] = useState(false)
  const [worlds, setWorlds] = useState([])
  const [worldsLoaded, setWorldsLoaded] = useState(false)
  const [invitePending, setInvitePending] = useState(null)
  const [connections, setConnections] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [pendingWorldInvites, setPendingWorldInvites] = useState([])
  const [myWorldSubtitle, setMyWorldSubtitle] = useState(null)
  const [myWorldColors, setMyWorldColors] = useState(null)
  const [personalWorldId, setPersonalWorldId] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [transitionColor, setTransitionColor] = useState('#0c0a12')
  const [showCinematic, setShowCinematic] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)
  const [errorToast, setErrorToast] = useState(null)
  const errorToastTimer = useRef(null)
  const transitionTimers = useRef([])
  const showErrorToast = useCallback((msg) => {
    if (errorToastTimer.current) clearTimeout(errorToastTimer.current)
    setErrorToast(msg)
    errorToastTimer.current = setTimeout(() => { setErrorToast(null); errorToastTimer.current = null }, 4000)
  }, [])

  // Cleanup all tracked timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(errorToastTimer.current)
      transitionTimers.current.forEach(clearTimeout)
    }
  }, [])

  // User's display name from auth metadata
  const userDisplayName = user?.user_metadata?.display_name || ''

  // Check for welcome letter on login
  useEffect(() => {
    if (!user?.email) { setLetterChecked(true); return }
    getAllWelcomeLetters(user.email).then(letters => {
      setWelcomeLetters(letters)
      setLetterChecked(true)
    }).catch(err => { console.error('[welcome letter]', err); showErrorToast('Could not load welcome letters'); setLetterChecked(true) })
  }, [user?.email])

  // Load user's shared worlds + connections + ensure personal world exists
  // Also auto-accept any pending world invites so shared worlds appear immediately
  useEffect(() => {
    if (!userId) { setWorldsLoaded(true); return }
    (async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { console.error("[loadData] NO SESSION"); setWorldsLoaded(true); return }
      try {
        // First pass: load everything including pending invites
        const results = await Promise.allSettled([
          loadMyWorlds(userId),
          getMyConnections(userId),
          getPendingRequests(user?.email),
          getPendingWorldInvites(user?.email),
          loadMyWorldSubtitle(userId),
          ensurePersonalWorld(userId),
        ])
        const val = (i) => results[i].status === 'fulfilled' ? results[i].value : null
        const w = val(0) || []
        const conn = val(1) || []
        const pending = val(2) || []
        const worldInvites = val(3) || []
        const myInfo = val(4)
        const pwId = val(5)
        results.forEach((r, i) => { if (r.status === 'rejected') console.error('[loadData]', i, 'failed:', r.reason) })
        setConnections(conn)
        setPendingRequests(pending)
        setMyWorldSubtitle(myInfo?.subtitle ?? '')
        setMyWorldColors({ customPalette: myInfo?.customPalette || {}, customScene: myInfo?.customScene || {} })
        if (pwId) setPersonalWorldId(pwId)

        // Auto-accept any pending world invites so shared worlds appear immediately
        if (worldInvites && worldInvites.length > 0) {
          console.log(`[autoAccept] Found ${worldInvites.length} pending invite(s), auto-accepting...`)
          for (const inv of worldInvites) {
            try {
              const result = await acceptInvite(inv.token)
              console.log(`[autoAccept] ${inv.worldName}: ${result?.ok ? 'accepted' : result?.error || 'failed'}`)
            } catch (e) { console.error('[autoAccept] error:', e) }
          }
          // Reload worlds now that invites are accepted
          const freshWorlds = await loadMyWorlds(userId)
          setWorlds(freshWorlds)
          setPendingWorldInvites([])
        } else {
          setWorlds(w)
          setPendingWorldInvites([])
        }
        setWorldsLoaded(true)
      } catch (err) { console.error('[loadData]', err); setWorldsLoaded(true) }
    })()
  }, [userId, user?.email])

  // Check for invite token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('invite')
    if (token && /^[a-zA-Z0-9-]{1,128}$/.test(token)) {
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
      if (!info) { showErrorToast("This invite link has expired or isn\u2019t valid. Ask your friend to send a new one."); return }
      const worldName = info.worlds?.name || 'a shared world'
      setConfirmModal({
        message: `You've been invited to join "${worldName}"!\n\nWould you like to accept this invitation?`,
        confirmLabel: 'Accept Invitation',
        onConfirm: () => {
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
              showErrorToast(result?.error || 'Failed to accept invite.')
            }
          }).catch(err => { console.error('[acceptInvite]', err); showErrorToast('Something went wrong accepting the invite. Please try again.') })
        }
      })
    }).catch(err => { console.error('[getInviteInfo]', err); showErrorToast('Could not load invite details. Please check your connection and try again.') })
  }, [invitePending, userId])

  // Brand new users: show cinematic onboarding (always, regardless of how they arrived)
  useEffect(() => {
    if (!userId || !worldsLoaded) return
    const hasVisited = safeGet(obKey(`cosmos_hasVisited_${userId}`))
    if (!hasVisited) {
      setShowCinematic(true)
    }
  }, [userId, worldsLoaded])

  // Dynamic document title
  useEffect(() => {
    if (!worldMode) { document.title = 'My Cosmos — Little Cosmos'; return }
    if (worldMode === 'my') { document.title = 'My World — Little Cosmos'; return }
    document.title = `${activeWorldName || 'Shared World'} — Little Cosmos`
  }, [worldMode, activeWorldName])

  useEffect(() => {
    const onPopState = () => { if (worldMode) switchWorld() }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [worldMode, switchWorld])

  const handleSignOut = useCallback(() => {
    safeRemove('worldMode')
    safeRemove('activeWorldId')
    safeRemove('activeWorldName')
    safeRemove('activeWorldRole')
    safeRemove('activeWorldType')
    clearWorldCaches()
    signOut()
  }, [signOut])

  const selectWorld = useCallback((mode, worldId = null, worldName = null, worldRole = null, worldType = null) => {
    window.history.pushState({ cosmos: true }, '', window.location.pathname)
    // Determine accent color for zoom transition
    const colors = { partner: '#1a1230', friends: '#0e1028', family: '#181210', my: '#121820' }
    setTransitionColor(colors[worldType] || colors[mode] || '#0c0a12')
    setTransitioning(true)

    // Delay the actual world mount until zoom animation completes
    const t1 = setTimeout(() => {
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
      const t2 = setTimeout(() => setTransitioning(false), 400)
      transitionTimers.current.push(t2)
    }, 600)
    transitionTimers.current.push(t1)
  }, [])

  const switchWorld = useCallback(() => {
    // Fade to dark overlay first, then unmount the world
    setTransitionColor('#0c0a12')
    setTransitioning(true)

    const t1 = setTimeout(() => {
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

      // Clear overlay after WorldSelector has time to mount its scene
      const t2 = setTimeout(() => setTransitioning(false), 500)
      transitionTimers.current.push(t2)

      // Refresh data in background (WorldSelector already has previous data to render with)
      if (userId) {
        Promise.allSettled([
          loadMyWorlds(userId),
          getMyConnections(userId),
          getPendingRequests(user?.email),
          getPendingWorldInvites(user?.email),
          loadMyWorldSubtitle(userId),
        ]).then((results) => {
          const val = (i) => results[i].status === 'fulfilled' ? results[i].value : null
          setWorlds(val(0) || [])
          setConnections(val(1) || [])
          setPendingRequests(val(2) || [])
          setPendingWorldInvites(val(3) || [])
          const myInfo = val(4)
          setMyWorldSubtitle(myInfo?.subtitle ?? '')
          setMyWorldColors({ customPalette: myInfo?.customPalette || {}, customScene: myInfo?.customScene || {} })
        }).catch(err => console.error('[switchWorld] refresh error:', err))
      }
    }, 400)
    transitionTimers.current.push(t1)
  }, [userId, user?.email])

  // Show auth screen as soon as we know there's no user (don't wait for letter/worlds)
  if (loading) {
    return <LoadingScreen />
  }

  // Password recovery: user clicked reset link in email, Supabase auto-logged them in
  if (passwordRecovery && user) {
    return <PasswordResetModal onDone={clearPasswordRecovery} />
  }

  if (!user) {
    // Check for invite token — go straight to auth if present
    const hasInvite = invitePending || new URLSearchParams(window.location.search).has('invite')
    if (authMode || hasInvite) return <AuthScreen initialMode={authMode || 'login'} onBack={() => setAuthMode(null)} />
    return <LandingPage onSignIn={() => setAuthMode('login')} onSignUp={() => setAuthMode('signup')} />
  }

  if (!emailVerified) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0c0a12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '"Palatino Linotype", serif', color: '#e8e0d0', gap: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 24, opacity: 0.8 }}>Check your email</div>
        <div style={{ fontSize: 14, opacity: 0.5, maxWidth: 360, lineHeight: 1.6 }}>
          We sent a verification link to <span style={{ color: '#c9a96e' }}>{user.email}</span>. Click it to activate your account.
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', background: 'rgba(200,170,110,0.15)', border: '1px solid rgba(200,170,110,0.3)', borderRadius: 8, color: '#e8e0d0', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}>I've verified — refresh</button>
          <button onClick={signOut} style={{ padding: '10px 24px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e8e0d0', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', opacity: 0.6 }}>Sign out</button>
        </div>
      </div>
    )
  }

  // For logged-in users, wait for letter check and worlds to load
  // Determine main content — confirm modal overlays on top of any screen
  let content
  if (!letterChecked || !worldsLoaded) {
    content = <LoadingScreen />
  } else if (welcomeLetters.length > 0) {
    // Show welcome letters before anything else (one at a time)
    const currentLetter = welcomeLetters[0]
    content = (
      <WelcomeLetterScreen
        letter={currentLetter}
        onEnter={async () => {
          markLetterRead(currentLetter.id).catch(err => console.error('[markLetterRead]', err))
          // Auto-accept any world invite associated with this letter
          try {
            const invites = await getPendingWorldInvitesForLetter(currentLetter)
            for (const inv of invites) {
              const result = await acceptInvite(inv.token)
              if (!result?.ok && !result?.already_member) console.warn('[welcomeLetter] invite accept failed:', result)
            }
            // Refresh worlds list so the shared world appears on cosmos
            if (userId) {
              const w = await loadMyWorlds(userId)
              setWorlds(w)
            }
          } catch (err) {
            console.error('[welcomeLetter] auto-accept error:', err)
          }
          setWelcomeLetters(prev => prev.slice(1))
        }}
      />
    )
  } else if (showCinematic) {
    // Cinematic onboarding for brand-new users — lands on cosmos screen after
    content = (
      <ScreenErrorBoundary>
        <CinematicOnboarding
          userId={userId}
          personalWorldId={personalWorldId}
          onComplete={() => {
            safeSet(obKey(`cosmos_hasVisited_${userId}`), '1')
            setShowCinematic(false)
          }}
        />
      </ScreenErrorBoundary>
    )
  } else if (!worldMode) {
    content = (
      <>
        <ScreenErrorBoundary>
          <WorldSelector
            onSelect={selectWorld}
            onSignOut={handleSignOut}
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
            myWorldColors={myWorldColors}
            personalWorldId={personalWorldId}
          />
        </ScreenErrorBoundary>
      </>
    )
  } else if (worldMode === 'our' && !activeWorldId) {
    // Safety: shared world mode but no worldId — redirect to cosmos instead of using legacy DB
    console.warn('[App] worldMode=our but no activeWorldId, redirecting to cosmos')
    safeRemove('worldMode')
    setWorldMode(null)
    content = null
  } else {
    content = (
      <OurWorld
        worldMode={worldMode}
        worldId={activeWorldId}
        worldName={activeWorldName}
        worldRole={activeWorldRole}
        worldType={activeWorldType}
        onSwitchWorld={switchWorld}
      />
    )
  }

  return (
    <>
      <Suspense fallback={<LoadingScreen />}>
        {content}
      </Suspense>
      {transitioning && (
        <div aria-hidden="true" style={{
          position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
          background: transitionColor,
          animation: 'cosmosFadeIn 0.4s ease forwards',
        }} />
      )}
      <div aria-live="polite" role="status" style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          display: errorToast ? 'block' : 'none',
          background: 'rgba(20,16,30,0.92)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
          padding: '12px 24px', color: '#e8e0d0', fontSize: 13,
          fontFamily: '"Palatino Linotype", serif', letterSpacing: '0.2px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 10001,
          maxWidth: '90vw', textAlign: 'center',
          animation: 'cosmosToastIn 0.3s ease',
        }}>
          {errorToast}
        </div>
      <style>{`
        @keyframes cosmosToastIn { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes cosmosFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      {confirmModal && (
        <div role="dialog" aria-modal="true" aria-label="Confirm action" style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setConfirmModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1e1930', borderRadius: 16, padding: '24px 28px', maxWidth: 360, width: '90%', boxShadow: '0 12px 48px rgba(0,0,0,.25)', border: '1px solid rgba(196,138,168,0.12)', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#e8e0d0', lineHeight: 1.6, marginBottom: 20, fontFamily: 'inherit', whiteSpace: 'pre-line' }}>{confirmModal.message}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmModal(null)} style={{ padding: '8px 20px', background: 'transparent', border: '1px solid rgba(184,174,200,0.2)', borderRadius: 10, color: '#a098a8', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => { const fn = confirmModal.onConfirm; setConfirmModal(null); fn(); }} style={{ padding: '8px 20px', background: 'rgba(196,138,168,0.12)', border: '1px solid rgba(196,138,168,0.2)', borderRadius: 10, color: '#c48aa8', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>{confirmModal.confirmLabel || 'Confirm'}</button>
            </div>
          </div>
        </div>
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
