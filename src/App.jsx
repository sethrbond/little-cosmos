import { useState } from 'react'
import WorldSelector from './WorldSelector.jsx'
import OurWorld from './OurWorld.jsx'

function App() {
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

  if (!worldMode) {
    return <WorldSelector onSelect={selectWorld} />
  }

  return <OurWorld worldMode={worldMode} onSwitchWorld={switchWorld} />
}

export default App
