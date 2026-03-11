import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'

const FONT = '"Palatino Linotype", "Book Antiqua", Palatino, serif'

// Sample cities for the mini globe markers
const SAMPLE_CITIES = [
  { lat: 48.86, lng: 2.35 },   // Paris
  { lat: 35.68, lng: 139.69 },  // Tokyo
  { lat: -33.87, lng: 151.21 }, // Sydney
  { lat: 40.71, lng: -74.01 },  // New York
  { lat: -22.91, lng: -43.17 }, // Rio
  { lat: 51.51, lng: -0.13 },   // London
  { lat: 41.90, lng: 12.50 },   // Rome
  { lat: 37.57, lng: 126.98 },  // Seoul
  { lat: 1.35, lng: 103.82 },   // Singapore
  { lat: 28.61, lng: 77.21 },   // Delhi
  { lat: -34.60, lng: -58.38 }, // Buenos Aires
  { lat: 55.76, lng: 37.62 },   // Moscow
]

function ll2v(lat, lng, r) {
  const phi = (90 - lat) * Math.PI / 180
  const theta = (lng + 180) * Math.PI / 180
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

// Mini 3D globe for the hero section
function MiniGlobe() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const w = 320, h = 320
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.z = 3.2

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(renderer.domElement)

    // Globe sphere — dark with subtle wireframe feel
    const globeGeo = new THREE.SphereGeometry(1, 48, 48)
    const globeMat = new THREE.MeshPhongMaterial({
      color: 0x1a1830,
      emissive: 0x0c0818,
      specular: 0x333355,
      shininess: 15,
      transparent: true,
      opacity: 0.9,
    })
    const globe = new THREE.Mesh(globeGeo, globeMat)
    scene.add(globe)

    // Wireframe overlay for that "techy globe" feel
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x3040a0,
      wireframe: true,
      transparent: true,
      opacity: 0.06,
    })
    const wire = new THREE.Mesh(globeGeo, wireMat)
    scene.add(wire)

    // Atmospheric glow ring
    const glowGeo = new THREE.SphereGeometry(1.08, 48, 48)
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xc9a96e,
      transparent: true,
      opacity: 0.04,
      side: THREE.BackSide,
    })
    scene.add(new THREE.Mesh(glowGeo, glowMat))

    // Markers — glowing dots at sample city locations
    const markerGeo = new THREE.SphereGeometry(0.018, 8, 8)
    const markers = SAMPLE_CITIES.map(({ lat, lng }) => {
      const pos = ll2v(lat, lng, 1.01)
      const mat = new THREE.MeshBasicMaterial({
        color: 0xc9a96e,
        transparent: true,
        opacity: 0.9,
      })
      const mesh = new THREE.Mesh(markerGeo, mat)
      mesh.position.copy(pos)
      globe.add(mesh)
      return { mesh, mat, phase: Math.random() * Math.PI * 2 }
    })

    // Pulse rings around markers
    const ringGeo = new THREE.RingGeometry(0.02, 0.04, 16)
    const rings = SAMPLE_CITIES.slice(0, 5).map(({ lat, lng }, i) => {
      const pos = ll2v(lat, lng, 1.015)
      const mat = new THREE.MeshBasicMaterial({
        color: 0xc9a96e, transparent: true, opacity: 0, side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(ringGeo, mat)
      mesh.position.copy(pos)
      mesh.lookAt(0, 0, 0)
      globe.add(mesh)
      return { mesh, mat, phase: i * 1.2, scale: 1 }
    })

    // Lighting
    scene.add(new THREE.AmbientLight(0x404060, 0.6))
    const dirLight = new THREE.DirectionalLight(0xe8d0a0, 0.8)
    dirLight.position.set(3, 2, 4)
    scene.add(dirLight)
    const rimLight = new THREE.DirectionalLight(0x6060c0, 0.3)
    rimLight.position.set(-3, -1, -2)
    scene.add(rimLight)

    let raf
    const animate = () => {
      const t = Date.now() * 0.001
      globe.rotation.y = t * 0.08
      wire.rotation.y = t * 0.08

      // Marker breathing
      for (const m of markers) {
        m.mat.opacity = 0.5 + Math.sin(t * 1.5 + m.phase) * 0.4
      }

      // Pulse rings
      for (const r of rings) {
        const cycle = ((t * 0.5 + r.phase) % 2) / 2 // 0..1 over 2s
        r.mat.opacity = Math.max(0, 0.5 - cycle * 0.6)
        const s = 1 + cycle * 3
        r.mesh.scale.set(s, s, 1)
      }

      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div ref={ref} style={{
      width: 320, height: 320, marginBottom: 24,
      filter: 'drop-shadow(0 0 40px rgba(200,170,110,0.15))',
      cursor: 'default',
    }} />
  )
}

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
        <MiniGlobe />
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
        @keyframes landingBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
      `}</style>
    </div>
  )
}
