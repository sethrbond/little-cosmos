import { useState, useEffect, useRef, useCallback } from 'react'
import { geocodeSearch } from './geocode.js'
import { createMyWorldDB } from './supabaseMyWorld.js'

/* CinematicOnboarding.jsx — Immersive first-time experience
   Shown once for brand-new users before they enter their cosmos.
   Starfield zoom → typography reveal → "Where's home?" → enter world */

const F = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif"

export default function CinematicOnboarding({ userId, onComplete }) {
  const [phase, setPhase] = useState(0)
  // 0 = starfield zoom + title reveal
  // 1 = subtitle + "where's home" prompt
  // 2 = city search active
  // 3 = city selected, saving + transitioning out
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedCity, setSelectedCity] = useState(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  // Star field animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let W = window.innerWidth, H = window.innerHeight
    canvas.width = W; canvas.height = H

    // Generate stars
    const stars = Array.from({ length: 400 }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: Math.random() * 3 + 0.5,
      size: Math.random() * 1.5 + 0.5,
      brightness: Math.random() * 0.6 + 0.4,
    }))

    let speed = 0.008
    let t = 0
    const draw = () => {
      t++
      ctx.fillStyle = '#06040c'
      ctx.fillRect(0, 0, W, H)

      // Accelerate over first 2 seconds, then cruise
      if (t < 120) speed = 0.004 + (t / 120) * 0.012
      else speed = 0.016

      for (const star of stars) {
        star.z -= speed
        if (star.z <= 0.01) {
          star.z = 3
          star.x = (Math.random() - 0.5) * 2
          star.y = (Math.random() - 0.5) * 2
        }

        const sx = (star.x / star.z) * W * 0.5 + W / 2
        const sy = (star.y / star.z) * H * 0.5 + H / 2
        const scale = (1 - star.z / 3.5) * 2.5
        const r = Math.max(0.3, star.size * scale)
        const alpha = Math.min(1, star.brightness * scale * 1.2)

        // Draw star with glow
        ctx.save()
        ctx.globalAlpha = alpha * 0.3
        ctx.beginPath()
        ctx.arc(sx, sy, r * 3, 0, Math.PI * 2)
        ctx.fillStyle = '#c8b8e0'
        ctx.fill()

        ctx.globalAlpha = alpha
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fillStyle = '#f0e8ff'
        ctx.fill()
        ctx.restore()

        // Streak effect for close stars
        if (star.z < 0.8) {
          const streakLen = (1 - star.z) * 15
          ctx.save()
          ctx.globalAlpha = alpha * 0.4
          ctx.strokeStyle = '#c8b8e0'
          ctx.lineWidth = r * 0.6
          ctx.beginPath()
          const dx = (star.x / star.z) - (star.x / (star.z + speed * 3))
          const dy = (star.y / star.z) - (star.y / (star.z + speed * 3))
          ctx.moveTo(sx, sy)
          ctx.lineTo(sx - dx * W * 0.5 * streakLen * 0.1, sy - dy * H * 0.5 * streakLen * 0.1)
          ctx.stroke()
          ctx.restore()
        }
      }

      // Subtle nebula glow in center
      const gradient = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.35)
      gradient.addColorStop(0, 'rgba(100, 60, 140, 0.04)')
      gradient.addColorStop(0.5, 'rgba(60, 40, 100, 0.02)')
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, W, H)

      animRef.current = requestAnimationFrame(draw)
    }
    draw()

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight
      canvas.width = W; canvas.height = H
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Phase progression timers
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2800)
    return () => clearTimeout(t1)
  }, [])

  // Focus input when phase 2 appears
  useEffect(() => {
    if (phase === 2) setTimeout(() => inputRef.current?.focus(), 300)
  }, [phase])

  // Geocode search
  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return }
    geocodeSearch(query, setResults)
  }, [query])

  const handleSelectCity = useCallback(async (city) => {
    if (!userId) return
    const [name, country, lat, lng] = city
    setSelectedCity({ name, country, lat, lng })
    setSaving(true)
    setPhase(3)

    // Create the "Home" entry in My World
    try {
      const db = createMyWorldDB(userId)
      const today = new Date().toISOString().slice(0, 10)
      await db.saveEntry({
        id: 'e' + Date.now(),
        city: name,
        country: country,
        lat, lng,
        dateStart: today,
        dateEnd: null,
        type: 'home',
        who: 'solo',
        zoomLevel: 1,
        notes: 'Where it all begins.',
        memories: [],
        highlights: [],
        museums: [],
        restaurants: [],
        photos: [],
        stops: [],
        musicUrl: null,
        favorite: true,
        loveNote: '',
      })
    } catch (err) {
      console.error('[onboarding] save home entry:', err)
    }

    // Transition out after a beat
    setTimeout(() => {
      setSaving(false)
      onComplete()
    }, 2200)
  }, [userId, onComplete])

  const handleSkip = useCallback(() => {
    setPhase(3)
    setTimeout(() => onComplete(), 800)
  }, [onComplete])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: '#06040c', overflow: 'hidden',
      fontFamily: F, color: '#e8e0d0',
    }}>
      {/* Starfield canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Phase 3: fade out overlay */}
      {phase === 3 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: '#06040c',
          animation: 'cineFadeIn 1.5s ease forwards',
        }} />
      )}

      {/* Content overlay */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', padding: 20,
      }}>

        {/* Phase 0+: Main title */}
        <div style={{
          opacity: phase >= 0 ? 1 : 0,
          transform: phase >= 0 ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 2s ease 0.8s, transform 2s ease 0.8s',
          textAlign: 'center',
          marginBottom: phase >= 1 ? 30 : 0,
        }}>
          <div style={{
            fontSize: 'clamp(28px, 5vw, 48px)',
            fontWeight: 300,
            letterSpacing: '0.15em',
            color: '#e8e0d0',
            textShadow: '0 0 40px rgba(200,170,110,0.15)',
            lineHeight: 1.3,
          }}>
            Your story begins here
          </div>
        </div>

        {/* Phase 1+: Subtitle + prompt */}
        {phase >= 1 && (
          <div style={{
            textAlign: 'center',
            animation: 'cineSlideUp 1.5s ease forwards',
          }}>
            <div style={{
              fontSize: 'clamp(13px, 2vw, 16px)',
              color: '#a098a8',
              letterSpacing: '0.08em',
              lineHeight: 1.8,
              maxWidth: 440,
              marginBottom: 40,
            }}>
              Every journey, every memory, every place that shaped you
              <span style={{ display: 'block', marginTop: 4, opacity: 0.7 }}>
                — all mapped on your personal globe.
              </span>
            </div>

            {phase < 2 && (
              <button
                onClick={() => setPhase(2)}
                style={{
                  padding: '14px 36px',
                  background: 'linear-gradient(135deg, rgba(200,170,110,0.15), rgba(200,170,110,0.08))',
                  border: '1px solid rgba(200,170,110,0.25)',
                  borderRadius: 28,
                  color: '#c9a96e',
                  fontSize: 15,
                  fontFamily: F,
                  cursor: 'pointer',
                  letterSpacing: '0.1em',
                  transition: 'all 0.4s ease',
                  boxShadow: '0 4px 24px rgba(200,170,110,0.08)',
                  animation: 'cineSlideUp 1s ease 0.5s both',
                }}
                onMouseEnter={e => {
                  e.target.style.background = 'linear-gradient(135deg, rgba(200,170,110,0.25), rgba(200,170,110,0.15))'
                  e.target.style.boxShadow = '0 4px 32px rgba(200,170,110,0.15)'
                  e.target.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  e.target.style.background = 'linear-gradient(135deg, rgba(200,170,110,0.15), rgba(200,170,110,0.08))'
                  e.target.style.boxShadow = '0 4px 24px rgba(200,170,110,0.08)'
                  e.target.style.transform = 'none'
                }}
              >
                Begin
              </button>
            )}
          </div>
        )}

        {/* Phase 2: Where's home search */}
        {phase === 2 && (
          <div style={{
            textAlign: 'center', width: '100%', maxWidth: 420,
            animation: 'cineSlideUp 0.8s ease forwards',
          }}>
            <div style={{
              fontSize: 22, fontWeight: 300,
              letterSpacing: '0.12em', color: '#c9a96e',
              marginBottom: 24,
            }}>
              Where's home?
            </div>

            <div style={{ position: 'relative' }}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search for your city..."
                style={{
                  width: '100%', padding: '14px 20px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(200,170,110,0.2)',
                  borderRadius: 16,
                  color: '#e8e0d0', fontSize: 15,
                  fontFamily: F, outline: 'none',
                  letterSpacing: '0.04em',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.3s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(200,170,110,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(200,170,110,0.2)'}
              />

              {/* Search results */}
              {results.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  marginTop: 8,
                  background: 'rgba(16,12,24,0.95)',
                  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(200,170,110,0.15)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  maxHeight: 280, overflowY: 'auto',
                }}>
                  {results.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectCity(r)}
                      style={{
                        display: 'block', width: '100%',
                        padding: '12px 18px',
                        background: 'none',
                        border: 'none',
                        borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        color: '#e8e0d0', fontSize: 14,
                        fontFamily: F, cursor: 'pointer',
                        textAlign: 'left',
                        letterSpacing: '0.03em',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => e.target.style.background = 'rgba(200,170,110,0.08)'}
                      onMouseLeave={e => e.target.style.background = 'none'}
                    >
                      <span style={{ color: '#e8e0d0' }}>{r[0]}</span>
                      {r[1] && <span style={{ color: '#807888', marginLeft: 8, fontSize: 12 }}>{r[1]}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Skip option */}
            <button
              onClick={handleSkip}
              style={{
                marginTop: 28, background: 'none', border: 'none',
                color: '#605868', fontSize: 12, fontFamily: F,
                cursor: 'pointer', letterSpacing: '0.05em',
              }}
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Phase 3: Selected city confirmation */}
        {phase === 3 && selectedCity && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 15,
            animation: 'cineSlideUp 0.6s ease forwards',
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(200,170,110,0.2), transparent 70%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
              animation: 'cinePulseGlow 2s ease-in-out infinite',
            }}>
              <div style={{ fontSize: 36, animation: 'cineFloat 3s ease-in-out infinite' }}>
                {'\u2302'}
              </div>
            </div>
            <div style={{
              fontSize: 20, color: '#e8e0d0',
              letterSpacing: '0.1em', fontWeight: 300,
            }}>
              {selectedCity.name}
            </div>
            <div style={{
              fontSize: 13, color: '#807888',
              marginTop: 6, letterSpacing: '0.08em',
            }}>
              {selectedCity.country}
            </div>
            <div style={{
              fontSize: 12, color: '#c9a96e',
              marginTop: 20, letterSpacing: '0.1em',
              opacity: 0.7,
            }}>
              Placing your first marker...
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes cineSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cineFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cinePulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(200,170,110,0.1); }
          50% { box-shadow: 0 0 40px rgba(200,170,110,0.2); }
        }
        @keyframes cineFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
