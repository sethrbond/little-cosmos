import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './AuthContext.jsx'
import AuthScreen from './AuthScreen.jsx'
import WorldSelector from './WorldSelector.jsx'
import OurWorld from './OurWorld.jsx'
import WelcomeLetterScreen from './WelcomeLetterScreen.jsx'
import { getWelcomeLetter, markLetterRead } from './supabaseWelcomeLetters.js'

function AppInner() {
  const { user, loading, signOut } = useAuth()
  const [worldMode, setWorldMode] = useState(
    () => localStorage.getItem('worldMode') || null
  )
  const [welcomeLetter, setWelcomeLetter] = useState(null)
  const [letterChecked, setLetterChecked] = useState(false)

  // Check for welcome letter on login
  useEffect(() => {
    if (!user?.email) { setLetterChecked(true); return }
    getWelcomeLetter(user.email).then(letter => {
      setWelcomeLetter(letter)
      setLetterChecked(true)
    }).catch(err => { console.error('[welcome letter]', err); setLetterChecked(true) })
  }, [user?.email])

  const selectWorld = (mode) => {
    localStorage.setItem('worldMode', mode)
    setWorldMode(mode)
  }

  const switchWorld = () => {
    localStorage.removeItem('worldMode')
    setWorldMode(null)
  }

  if (loading || !letterChecked) {
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
    return <WorldSelector onSelect={selectWorld} onSignOut={signOut} worlds={[]} />
  }

  return <OurWorld worldMode={worldMode} onSwitchWorld={switchWorld} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
