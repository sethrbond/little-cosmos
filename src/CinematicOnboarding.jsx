import { useState, useEffect, useRef, useCallback } from 'react'
import { geocodeSearch } from './geocode.js'
import { createMyWorldDB } from './supabaseMyWorld.js'
import { ensurePersonalWorld } from './supabaseWorlds.js'

/* CinematicOnboarding.jsx — Immersive first-time experience
   Shown once for brand-new users before they enter their cosmos.
   Starfield zoom → typography reveal → "Where's home?" → orbs appear → zoom into My World */

const F = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif"

// Floating orb definitions — My World center, two distant decorative orbs
const ORBS = [
  { id: 'my', label: 'My World', x: 50, y: 50, size: 54, color: '#7ca8c4', glow: 'rgba(124,168,196,0.35)', delay: 0 },
  { id: 'deco1', label: '', x: 22, y: 38, size: 18, color: '#9070a8', glow: 'rgba(144,112,168,0.2)', delay: 0.3 },
  { id: 'deco2', label: '', x: 76, y: 62, size: 14, color: '#c9a96e', glow: 'rgba(200,170,110,0.2)', delay: 0.5 },
  { id: 'deco3', label: '', x: 35, y: 72, size: 11, color: '#e8b8d0', glow: 'rgba(232,184,208,0.15)', delay: 0.7 },
  { id: 'deco4', label: '', x: 68, y: 30, size: 13, color: '#a0c0e8', glow: 'rgba(160,192,232,0.15)', delay: 0.6 },
]

export default function CinematicOnboarding({ userId, personalWorldId, onComplete }) {
  const [phase, setPhase] = useState(0)
  // 0 = starfield zoom + title reveal
  // 1 = subtitle + "Begin" button
  // 2 = city search active
  // 3 = city selected, brief confirmation
  // 4 = text fades, orbs appear from starfield
  // 5 = zoom into My World orb → transition out
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedCity, setSelectedCity] = useState(null)
  const inputRef = useRef(null)
  const orbZoomRef = useRef(false)

  // Star field animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let W = window.innerWidth, H = window.innerHeight
    canvas.width = W; canvas.height = H

    const isMobile = W < 768
    const stars = Array.from({ length: isMobile ? 200 : 400 }, () => ({
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

      // Slow down stars during orb phase, speed up during zoom
      if (orbZoomRef.current) {
        speed = Math.min(speed + 0.002, 0.06)
      } else if (t < 120) {
        speed = 0.004 + (t / 120) * 0.012
      } else {
        speed = 0.016
      }

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

      // Nebula glow
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

  // Phase progression: auto-advance from 0 to 1
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2800)
    return () => clearTimeout(t1)
  }, [])

  // Focus input when phase 2 appears
  useEffect(() => {
    if (phase === 2) {
      const t = setTimeout(() => inputRef.current?.focus(), 300)
      return () => clearTimeout(t)
    }
  }, [phase])

  // Geocode search
  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return }
    geocodeSearch(query, setResults)
  }, [query])

  // Phase 3 → 4: city confirmation shows briefly, then orbs appear
  useEffect(() => {
    if (phase !== 3) return
    const t = setTimeout(() => setPhase(4), 1800)
    return () => clearTimeout(t)
  }, [phase])

  // Phase 4: orbs float — user clicks "Explore My Cosmos" to proceed
  // (no auto-advance — wait for user interaction)

  // Phase 5: zoom completes → transition to My World
  useEffect(() => {
    if (phase !== 5) return
    const t = setTimeout(() => {
      onComplete()
    }, 1600)
    return () => clearTimeout(t)
  }, [phase, onComplete])

  const handleSelectCity = useCallback(async (city) => {
    if (!userId) return
    const [name, country, lat, lng] = city
    setQuery('')
    setResults([])
    setSelectedCity({ name, country, lat, lng })
    setPhase(3)

    // Create the "Home" entry in My World
    try {
      const pwId = personalWorldId || await ensurePersonalWorld(userId)
      if (!pwId) { console.error('[onboarding] failed to get personal world'); return }
      const db = createMyWorldDB(pwId, userId)
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
  }, [userId, personalWorldId])

  const handleSkip = useCallback(() => {
    setPhase(4)
  }, [])

  // Whether text content (title, subtitle, search) should be visible
  const showText = phase <= 3

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: '#06040c', overflow: 'hidden',
      fontFamily: F, color: '#e8e0d0',
    }}>
      {/* Starfield canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Phase 5: zoom overlay — cosmos transition */}
      {phase === 5 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 60, height: 60,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #c9a96e, #806030 60%, #0c0a12)',
            animation: 'orbZoomExpand 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            boxShadow: '0 0 80px rgba(200,170,110,0.4), 0 0 200px rgba(200,170,110,0.15)',
          }} />
        </div>
      )}

      {/* Content overlay — text phases */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', padding: 20,
        opacity: showText ? 1 : 0,
        transition: 'opacity 0.8s ease',
        pointerEvents: showText ? 'auto' : 'none',
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
        {phase >= 1 && phase <= 2 && (
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

        {/* Phase 3: Selected city confirmation (brief) */}
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

      {/* Phase 4+: Floating orbs emerge from the cosmos */}
      {phase >= 4 && phase < 5 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 15,
          pointerEvents: 'none',
        }}>
          {ORBS.map((orb) => (
            <div key={orb.id} style={{
              position: 'absolute',
              left: `${orb.x}%`, top: `${orb.y}%`,
              transform: 'translate(-50%, -50%)',
              animation: `orbAppear 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${orb.delay}s both, orbFloat 4s ease-in-out ${orb.delay + 1.2}s infinite`,
            }}>
              {/* Glow ring */}
              <div style={{
                position: 'absolute', inset: -orb.size * 0.4,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${orb.glow}, transparent 70%)`,
                animation: `orbPulse 3s ease-in-out ${orb.delay}s infinite`,
              }} />
              {/* Orb body */}
              <div style={{
                width: orb.size, height: orb.size,
                borderRadius: '50%',
                background: `radial-gradient(circle at 35% 35%, ${orb.color}dd, ${orb.color}60 50%, ${orb.color}20 80%)`,
                boxShadow: `0 0 ${orb.size * 0.6}px ${orb.glow}, inset 0 -${orb.size * 0.15}px ${orb.size * 0.3}px rgba(0,0,0,0.3)`,
                border: `1px solid ${orb.color}30`,
              }} />
              {/* Label for My World orb */}
              {orb.label && (
                <div style={{
                  position: 'absolute', top: '100%', left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: 10,
                  fontSize: 11, letterSpacing: '0.12em',
                  color: '#c9d0dc', whiteSpace: 'nowrap',
                  textShadow: '0 0 12px rgba(124,168,196,0.4)',
                  animation: `cineSlideUp 0.8s ease ${orb.delay + 0.4}s both`,
                }}>
                  {orb.label}
                </div>
              )}
            </div>
          ))}

          {/* "Explore My Cosmos" button — user-initiated */}
          <div style={{
            position: 'absolute', bottom: '15%', left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            animation: 'cineSlideUp 1s ease 1.2s both',
            pointerEvents: 'auto',
          }}>
            <div style={{
              fontSize: 'clamp(16px, 3vw, 22px)',
              fontWeight: 300,
              letterSpacing: '0.12em',
              color: '#e8e0d0',
              textShadow: '0 0 30px rgba(200,170,110,0.15)',
              marginBottom: 20,
            }}>
              Your cosmos awaits
            </div>
            <button
              onClick={() => {
                setPhase(5)
                orbZoomRef.current = true
              }}
              style={{
                padding: '14px 40px',
                background: 'linear-gradient(135deg, rgba(200,170,110,0.18), rgba(200,170,110,0.08))',
                border: '1px solid rgba(200,170,110,0.3)',
                borderRadius: 28,
                color: '#c9a96e',
                fontSize: 15,
                fontFamily: F,
                cursor: 'pointer',
                letterSpacing: '0.1em',
                transition: 'all 0.4s ease',
                boxShadow: '0 4px 24px rgba(200,170,110,0.1)',
              }}
              onMouseEnter={e => {
                e.target.style.background = 'linear-gradient(135deg, rgba(200,170,110,0.3), rgba(200,170,110,0.15))'
                e.target.style.boxShadow = '0 6px 36px rgba(200,170,110,0.2)'
                e.target.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                e.target.style.background = 'linear-gradient(135deg, rgba(200,170,110,0.18), rgba(200,170,110,0.08))'
                e.target.style.boxShadow = '0 4px 24px rgba(200,170,110,0.1)'
                e.target.style.transform = 'none'
              }}
            >
              Explore My Cosmos
            </button>
          </div>
        </div>
      )}

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
        @keyframes orbAppear {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
          60% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(-8px); }
        }
        @keyframes orbPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes orbZoomExpand {
          0% { transform: scale(1); opacity: 1; border-radius: 50%; }
          40% { transform: scale(3); opacity: 1; border-radius: 50%; }
          70% { transform: scale(12); opacity: 1; border-radius: 40%; }
          100% { transform: scale(60); opacity: 1; border-radius: 0; }
        }
      `}</style>
    </div>
  )
}
