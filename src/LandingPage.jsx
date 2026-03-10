import { useState, useEffect, useRef } from 'react'

const FONT = '"Palatino Linotype", "Book Antiqua", Palatino, serif'

// Twinkling star field (canvas-based, lightweight)
function StarField() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    let raf
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.5 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.8 + 0.3,
    }))
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const draw = () => {
      const t = Date.now() * 0.001
      ctx.clearRect(0, 0, c.width, c.height)
      for (const s of stars) {
        const a = 0.3 + Math.sin(t * s.speed + s.phase) * 0.3
        ctx.globalAlpha = a
        ctx.fillStyle = '#e8e0d0'
        ctx.beginPath()
        ctx.arc(s.x * c.width, s.y * c.height, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
}

const features = [
  {
    icon: '🌍',
    title: 'Pin It to the Globe',
    desc: 'Every trip becomes a glowing marker on a 3D globe you can spin, zoom, and fly through. Your own little planet.',
  },
  {
    icon: '💕',
    title: 'Worlds to Share',
    desc: 'A couples world. A friends world. A family world. Each one has its own colors, its own vibe, its own story.',
  },
  {
    icon: '📸',
    title: 'Relive Everything',
    desc: 'Photos, notes, highlights. Play them back as a cinematic journey or a year-in-review recap you can screenshot and share.',
  },
  {
    icon: '✨',
    title: 'It Breathes',
    desc: 'Shooting stars cross the sky. Aurora shifts with your mood. Night shadow follows the real sun. Your globe is alive.',
  },
  {
    icon: '🏆',
    title: 'Milestones That Matter',
    desc: 'Your first trip abroad. Your farthest point from home. 10,000 miles traveled. The app remembers what you might forget.',
  },
  {
    icon: '💌',
    title: 'Invite with a Letter',
    desc: 'Send a welcome letter sealed in wax. They open it, join your world, and start pinning adventures alongside yours.',
  },
]

export default function LandingPage({ onSignIn, onSignUp }) {
  const [scrollY, setScrollY] = useState(0)
  const [visible, setVisible] = useState(new Set())
  const featureRefs = useRef([])

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => { setScrollY(window.scrollY); ticking = false }) }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) setVisible(prev => new Set([...prev, e.target.dataset.idx]))
        })
      },
      { threshold: 0.2 }
    )
    featureRefs.current.forEach(el => el && obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const heroOpacity = Math.max(0, 1 - scrollY / 500)
  const heroTranslate = scrollY * 0.3

  return (
    <div style={{ background: '#0c0a12', minHeight: '100vh', color: '#e8e0d0', fontFamily: FONT, overflowX: 'hidden' }}>
      <StarField />

      {/* Nav bar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 32px',
        background: scrollY > 50 ? 'rgba(12,10,18,0.85)' : 'transparent',
        backdropFilter: scrollY > 50 ? 'blur(12px)' : 'none',
        transition: 'background 0.3s, backdrop-filter 0.3s',
      }}>
        <div style={{ fontSize: 20, fontWeight: 300, letterSpacing: 2, opacity: 0.9 }}>Little Cosmos</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onSignIn} style={{
            background: 'none', border: '1px solid rgba(200,170,110,0.3)',
            borderRadius: 8, padding: '8px 20px', color: '#c9a96e',
            fontSize: 14, fontFamily: FONT, cursor: 'pointer',
            transition: 'border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={e => { e.target.style.borderColor = 'rgba(200,170,110,0.6)'; e.target.style.color = '#dcc088' }}
          onMouseLeave={e => { e.target.style.borderColor = 'rgba(200,170,110,0.3)'; e.target.style.color = '#c9a96e' }}>Sign In</button>
          <button onClick={onSignUp} style={{
            background: 'linear-gradient(135deg, #c9a96e, #b8944f)',
            border: 'none', borderRadius: 8, padding: '8px 20px', color: '#1a1520',
            fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 4px 16px rgba(200,170,110,0.3)' }}
          onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = 'none' }}>Get Started</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
        opacity: heroOpacity, transform: `translateY(${heroTranslate}px)`,
      }}>
        <div style={{
          width: 100, height: 100, borderRadius: '50%', marginBottom: 36,
          background: 'radial-gradient(circle, rgba(200,170,110,0.12) 0%, rgba(180,140,200,0.06) 50%, transparent 70%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'landingPulse 4s ease-in-out infinite',
          boxShadow: '0 0 60px rgba(200,170,110,0.08)',
        }}>
          <div style={{ fontSize: 48, filter: 'drop-shadow(0 0 12px rgba(200,170,110,0.3))' }}>🌍</div>
        </div>
        <h1 style={{
          fontSize: 'clamp(36px, 7vw, 64px)', fontWeight: 300,
          letterSpacing: 4, margin: 0, lineHeight: 1.2,
          background: 'linear-gradient(135deg, #f0e8d8 30%, #c9a96e 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Little Cosmos
        </h1>
        <p style={{
          fontSize: 'clamp(16px, 2.5vw, 20px)', opacity: 0.5,
          marginTop: 16, fontWeight: 300, letterSpacing: 1.5,
          fontStyle: 'italic',
        }}>
          a travel diary that lives on a globe
        </p>
        <p style={{
          fontSize: 'clamp(14px, 1.8vw, 17px)', opacity: 0.35,
          marginTop: 28, maxWidth: 480, lineHeight: 1.8,
        }}>
          Pin your adventures. Create shared worlds with the people you love.
          Watch your little cosmos grow with every trip.
        </p>
        <button onClick={onSignUp} style={{
          marginTop: 44, padding: '15px 48px',
          background: 'linear-gradient(135deg, #c9a96e, #b8944f)',
          border: 'none', borderRadius: 12, color: '#1a1520',
          fontSize: 17, fontWeight: 600, fontFamily: FONT,
          cursor: 'pointer', letterSpacing: 0.5,
          boxShadow: '0 4px 24px rgba(200,170,110,0.25), 0 1px 3px rgba(0,0,0,0.2)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 32px rgba(200,170,110,0.35), 0 2px 6px rgba(0,0,0,0.2)' }}
        onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 24px rgba(200,170,110,0.25), 0 1px 3px rgba(0,0,0,0.2)' }}>
          Start Your Cosmos
        </button>
        <div style={{ fontSize: 12, opacity: 0.25, marginTop: 16 }}>Free forever. No credit card.</div>
        <div style={{
          marginTop: 48, opacity: 0.2, fontSize: 13,
          animation: 'landingBounce 2s ease-in-out infinite',
        }}>
          ↓
        </div>
      </section>

      {/* Features */}
      <section style={{
        position: 'relative', zIndex: 1,
        padding: '80px 24px 120px', maxWidth: 960, margin: '0 auto',
      }}>
        <h2 style={{
          textAlign: 'center', fontSize: 'clamp(24px, 4vw, 36px)',
          fontWeight: 300, letterSpacing: 2, marginBottom: 64, opacity: 0.8,
        }}>
          More than a map. A living memory.
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32,
        }}>
          {features.map((f, i) => (
            <div
              key={i}
              ref={el => featureRefs.current[i] = el}
              data-idx={i}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 16, padding: '32px 28px',
                backdropFilter: 'blur(8px)',
                opacity: visible.has(String(i)) ? 1 : 0,
                transform: visible.has(String(i)) ? 'translateY(0)' : 'translateY(24px)',
                transition: `opacity 0.6s ${i * 0.1}s, transform 0.6s ${i * 0.1}s`,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 16, filter: 'drop-shadow(0 2px 8px rgba(200,170,110,0.15))' }}>{f.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 10, color: '#c9a96e', letterSpacing: 0.3 }}>{f.title}</div>
              <div style={{ fontSize: 14, opacity: 0.45, lineHeight: 1.8 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof / bottom CTA */}
      <section style={{
        position: 'relative', zIndex: 1,
        padding: '80px 24px 120px', textAlign: 'center',
      }}>
        <div style={{
          fontSize: 'clamp(20px, 3.5vw, 32px)', fontWeight: 300,
          letterSpacing: 1.5, opacity: 0.7, marginBottom: 16,
        }}>
          Your cosmos is waiting
        </div>
        <p style={{
          fontSize: 15, opacity: 0.35, maxWidth: 420, margin: '0 auto 36px',
          lineHeight: 1.7,
        }}>
          Create your first world in under a minute. Add a trip. Watch it glow.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onSignUp} style={{
            padding: '13px 40px',
            background: 'linear-gradient(135deg, #c9a96e, #b8944f)',
            border: 'none', borderRadius: 12, color: '#1a1520',
            fontSize: 16, fontWeight: 600, fontFamily: FONT,
            cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 4px 20px rgba(200,170,110,0.2)',
          }}
          onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 28px rgba(200,170,110,0.35)' }}
          onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 20px rgba(200,170,110,0.2)' }}>
            Start Your Cosmos
          </button>
          <button onClick={onSignIn} style={{
            padding: '13px 40px',
            background: 'none', border: '1px solid rgba(200,170,110,0.3)',
            borderRadius: 12, color: '#c9a96e',
            fontSize: 16, fontFamily: FONT, cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={e => e.target.style.borderColor = 'rgba(200,170,110,0.6)'}
          onMouseLeave={e => e.target.style.borderColor = 'rgba(200,170,110,0.3)'}>
            Sign In
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        position: 'relative', zIndex: 1,
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '24px 32px', textAlign: 'center',
        fontSize: 12, opacity: 0.2, letterSpacing: 0.5,
      }}>
        Little Cosmos
      </footer>

      <style>{`
        @keyframes landingPulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes landingBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
      `}</style>
    </div>
  )
}
