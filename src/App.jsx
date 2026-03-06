import { useState } from 'react'
import { AuthProvider, useAuth } from './AuthContext.jsx'
import AuthScreen from './AuthScreen.jsx'
import WorldSelector from './WorldSelector.jsx'
import OurWorld from './OurWorld.jsx'

function AppInner() {
  const { user, loading } = useAuth()
  const [worldMode, setWorldMode] = useState(
    () => localStorage.getItem('worldMode') || null
  )

  const selectWorld = (mode) => {
    localStorage.setItem('worldMode', mode)
    setWorldMode(mode)
  }

  const switchWorld = () => {
    localStorage.removeItem('worldMode')
    setWorldMode(null)
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0c0a12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Palatino Linotype", serif', color: '#e8e0d0', fontSize: 18, opacity: 0.6 }}>
        Loading...
      </div>
    )
  }

  if (!user) return <AuthScreen />

  if (!worldMode) {
    return <WorldSelector onSelect={selectWorld} />
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
