import { useState, useRef, useEffect } from 'react'

/**
 * SyncIndicator — small status dot showing real-time sync state.
 *
 * Props:
 *   isConnected  (boolean)  — true = green, false = red
 *   lastSync     (Date|null) — last time a sync event was received
 *   palette      (object)    — optional, { primary, text, bg } for theming
 *   style        (object)    — optional, extra styles on the wrapper
 */
export default function SyncIndicator({ isConnected, lastSync, palette = {}, style = {} }) {
  const [hovering, setHovering] = useState(false)
  const injectedRef = useRef(false)

  // Inject keyframes once (not in render path)
  useEffect(() => {
    if (injectedRef.current) return
    const id = 'cosmos-sync-indicator-keyframes'
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id
      s.textContent = `@keyframes cosmosReconnectPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`
      document.head.appendChild(s)
    }
    injectedRef.current = true
  }, [])

  const dotColor = isConnected ? '#4ade80' : '#f87171'
  const pulseColor = isConnected ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'
  const label = isConnected ? 'Connected' : 'Disconnected'
  const syncText = lastSync
    ? `Last sync: ${lastSync.toLocaleTimeString()}`
    : 'No sync events yet'

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'default',
        userSelect: 'none',
        ...style,
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => setHovering(v => !v)}
      aria-label={`${label}. ${syncText}`}
    >
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: dotColor,
        boxShadow: `0 0 6px ${pulseColor}`,
        flexShrink: 0,
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
        animation: isConnected ? undefined : 'cosmosReconnectPulse 2s ease-in-out infinite',
      }} />
      {/* Tooltip */}
      <div style={{
        position: 'absolute',
        left: 'calc(100% + 10px)',
        top: '50%',
        transform: hovering ? 'translateY(-50%)' : 'translateY(-50%) translateX(4px)',
        background: palette.bg || 'rgba(30, 25, 45, 0.95)',
        color: palette.text || '#e8e0f0',
        fontSize: 11,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '6px 10px',
        borderRadius: 6,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        opacity: hovering ? 1 : 0,
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        zIndex: 9999,
        lineHeight: 1.4,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
        <div style={{ opacity: 0.75, fontSize: 10 }}>{syncText}</div>
      </div>
    </div>
  )
}
