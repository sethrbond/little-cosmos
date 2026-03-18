import { useState, useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'

const FONT = '"Palatino Linotype", "Book Antiqua", Palatino, serif'

// Demo entries with real cities and warm notes
const DEMO_ENTRIES = [
  { city: 'Paris', lat: 48.86, lng: 2.35, dates: 'Sep 12\u201318, 2024', stars: 5,
    note: 'We watched the sunset from Montmartre and promised we\u2019d come back every year.',
    gradient: 'linear-gradient(135deg, #e8a87c, #d4758b)' },
  { city: 'Tokyo', lat: 35.68, lng: 139.69, dates: 'Mar 28 \u2013 Apr 5, 2024', stars: 5,
    note: 'Cherry blossoms everywhere. We sat under that one tree in Ueno Park for three hours and didn\u2019t say a word.',
    gradient: 'linear-gradient(135deg, #f8b4c8, #c084c0)' },
  { city: 'New York', lat: 40.71, lng: -74.01, dates: 'Jan 3\u20138, 2023', stars: 4,
    note: 'Our first apartment was tiny and perfect. We ate pizza on the fire escape at midnight.',
    gradient: 'linear-gradient(135deg, #7eb5d6, #5a8fb0)' },
  { city: 'Iceland', lat: 64.15, lng: -21.94, dates: 'Nov 20\u201326, 2023', stars: 5,
    note: 'The northern lights came out on our last night. We both cried a little, honestly.',
    gradient: 'linear-gradient(135deg, #6dd5c0, #3daa98)' },
  { city: 'Barcelona', lat: 41.39, lng: 2.17, dates: 'Jun 14\u201320, 2024', stars: 4,
    note: 'Anniversary trip. Got lost in the Gothic Quarter and found that tiny wine bar with the candles.',
    gradient: 'linear-gradient(135deg, #f0c27f, #d4945a)' },
  { city: 'Bali', lat: -8.41, lng: 115.19, dates: 'Aug 1\u201312, 2023', stars: 5,
    note: 'Honeymoon. The rice terraces at sunrise, the temple at dusk. Everything glowed.',
    gradient: 'linear-gradient(135deg, #a8e6a3, #68b898)' },
]

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

// Simplified continent outlines (lat/lng polylines, ~30 points per continent)
const CONTINENTS = [
  // Europe
  [[36,-6],[37,0],[38,2],[43,3],[44,8],[46,13],[45,14],[42,18],[40,20],[41,29],[46,30],[48,17],[52,5],[54,10],[56,12],[58,18],[60,25],[65,14],[70,20],[71,28],[68,38],[56,38],[48,40],[42,28],[40,26],[37,24],[36,28],[33,35],[32,20],[35,12],[37,-2],[36,-6]],
  // Africa
  [[35,-1],[37,10],[33,12],[32,0],[28,-13],[22,-17],[14,-17],[5,-1],[4,10],[0,10],[-4,12],[-7,14],[-11,14],[-15,12],[-18,15],[-22,15],[-25,18],[-26,28],[-30,30],[-34,18],[-34,26],[-30,32],[-26,35],[-15,41],[-12,44],[-2,42],[5,44],[10,50],[12,44],[15,40],[20,38],[25,33],[30,33],[33,36],[37,10],[35,-1]],
  // Asia (simplified)
  [[42,28],[42,44],[37,44],[35,52],[28,52],[25,56],[22,60],[18,73],[22,80],[28,85],[24,90],[22,97],[10,99],[8,104],[1,104],[6,108],[10,106],[12,109],[18,107],[22,106],[28,105],[30,112],[35,119],[39,118],[42,130],[45,135],[50,140],[55,135],[60,130],[65,140],[68,170],[70,170],[70,70],[67,60],[62,55],[56,54],[55,50],[60,38],[56,38],[48,40],[42,28]],
  // North America
  [[70,-165],[65,-168],[60,-165],[55,-165],[55,-160],[58,-152],[60,-140],[68,-140],[70,-155],[72,-130],[70,-100],[65,-88],[60,-80],[55,-78],[48,-66],[44,-66],[42,-70],[40,-74],[30,-81],[25,-80],[20,-90],[15,-87],[15,-92],[19,-96],[22,-98],[26,-97],[28,-96],[30,-90],[30,-85],[32,-81],[37,-76],[40,-74],[42,-70],[44,-64],[47,-60],[50,-55],[52,-56],[55,-60],[58,-63],[60,-65],[62,-72],[65,-60],[68,-52],[72,-56],[70,-80],[75,-90],[72,-130],[72,-160],[70,-165]],
  // South America
  [[12,-72],[10,-76],[8,-77],[4,-77],[0,-80],[-5,-81],[-6,-77],[-13,-76],[-15,-75],[-18,-70],[-22,-70],[-28,-65],[-33,-60],[-35,-57],[-38,-58],[-42,-63],[-46,-68],[-50,-74],[-52,-70],[-54,-69],[-54,-64],[-48,-65],[-42,-65],[-38,-56],[-33,-52],[-23,-43],[-22,-40],[-15,-39],[-8,-35],[-2,-50],[2,-52],[5,-60],[8,-62],[10,-72],[12,-72]],
  // Australia
  [[-12,130],[-14,127],[-15,129],[-17,123],[-22,114],[-27,114],[-32,116],[-35,117],[-35,137],[-38,141],[-39,146],[-37,150],[-33,152],[-28,153],[-24,149],[-20,149],[-17,146],[-15,145],[-14,136],[-12,132],[-12,130]],
]

const LAND_DOTS = [
  [48,2],[50,10],[52,20],[46,8],[55,37],[58,12],[40,30],[35,25],[30,-5],[15,-10],[0,20],[-10,25],[-25,28],[5,35],[10,45],
  [30,50],[35,70],[25,80],[40,110],[45,130],[55,80],[60,100],[10,100],[5,105],[-5,120],
  [45,-75],[40,-90],[35,-100],[50,-110],[55,-120],[60,-100],[25,-100],[30,-85],[20,-98],
  [-5,-60],[-15,-50],[-25,-50],[-10,-75],[-20,-65],[-30,-55],
  [-25,130],[-30,140],[-35,145],[-28,135],
]

// Shared globe-building helper
function buildGlobeScene(el, w, h) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100)
  camera.position.z = 3.2

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  el.appendChild(renderer.domElement)

  const globeGeo = new THREE.SphereGeometry(1, 48, 48)
  const globeMat = new THREE.MeshPhongMaterial({
    color: 0x1a1830, emissive: 0x0c0818, specular: 0x333355,
    shininess: 15, transparent: true, opacity: 0.9,
  })
  const globe = new THREE.Mesh(globeGeo, globeMat)
  scene.add(globe)

  const wireMat = new THREE.MeshBasicMaterial({ color: 0x3040a0, wireframe: true, transparent: true, opacity: 0.06 })
  const wire = new THREE.Mesh(globeGeo, wireMat)
  scene.add(wire)

  const coastMat = new THREE.LineBasicMaterial({ color: 0xc9a96e, transparent: true, opacity: 0.15 })
  for (const coast of CONTINENTS) {
    const pts = coast.map(([lat, lng]) => ll2v(lat, lng, 1.002))
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), coastMat))
  }

  const dotGeo = new THREE.SphereGeometry(0.005, 4, 4)
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xc9a96e, transparent: true, opacity: 0.08 })
  for (const [lat, lng] of LAND_DOTS) {
    const m = new THREE.Mesh(dotGeo, dotMat)
    m.position.copy(ll2v(lat, lng, 1.003))
    globe.add(m)
  }

  const glowGeo = new THREE.SphereGeometry(1.08, 48, 48)
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xc9a96e, transparent: true, opacity: 0.04, side: THREE.BackSide })
  scene.add(new THREE.Mesh(glowGeo, glowMat))

  scene.add(new THREE.AmbientLight(0x404060, 0.6))
  const dirLight = new THREE.DirectionalLight(0xe8d0a0, 0.8)
  dirLight.position.set(3, 2, 4)
  scene.add(dirLight)
  const rimLight = new THREE.DirectionalLight(0x6060c0, 0.3)
  rimLight.position.set(-3, -1, -2)
  scene.add(rimLight)

  return { scene, camera, renderer, globe, wire, globeGeo }
}

// Mini 3D globe for the hero section (interactive -- drag to rotate)
function MiniGlobe() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const w = 320, h = 320
    const { scene, camera, renderer, globe, wire } = buildGlobeScene(el, w, h)

    let isDragging = false, prevX = 0, dragVelocity = 0, autoRotateSpeed = 0.08

    const markerGeo = new THREE.SphereGeometry(0.018, 8, 8)
    const markers = SAMPLE_CITIES.map(({ lat, lng }) => {
      const pos = ll2v(lat, lng, 1.01)
      const mat = new THREE.MeshBasicMaterial({ color: 0xc9a96e, transparent: true, opacity: 0.9 })
      const mesh = new THREE.Mesh(markerGeo, mat)
      mesh.position.copy(pos)
      globe.add(mesh)
      return { mesh, mat, phase: Math.random() * Math.PI * 2 }
    })

    const ringGeo = new THREE.RingGeometry(0.02, 0.04, 16)
    const rings = SAMPLE_CITIES.slice(0, 5).map(({ lat, lng }, i) => {
      const pos = ll2v(lat, lng, 1.015)
      const mat = new THREE.MeshBasicMaterial({ color: 0xc9a96e, transparent: true, opacity: 0, side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(ringGeo, mat)
      mesh.position.copy(pos)
      mesh.lookAt(0, 0, 0)
      globe.add(mesh)
      return { mesh, mat, phase: i * 1.2, scale: 1 }
    })

    const arcMat = new THREE.LineBasicMaterial({ color: 0xc9a96e, transparent: true, opacity: 0.06 })
    const arcPairs = [[0,5],[1,7],[2,8],[3,10],[4,10],[5,6],[6,9],[8,9]]
    for (const [a, b] of arcPairs) {
      const ca = SAMPLE_CITIES[a], cb = SAMPLE_CITIES[b]
      const va = ll2v(ca.lat, ca.lng, 1.002), vb = ll2v(cb.lat, cb.lng, 1.002)
      const mid = new THREE.Vector3().addVectors(va, vb).multiplyScalar(0.5).normalize().multiplyScalar(1.06)
      const curve = new THREE.QuadraticBezierCurve3(va, mid, vb)
      globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(20)), arcMat))
    }

    const onPointerDown = (e) => { isDragging = true; prevX = e.clientX; dragVelocity = 0; el.style.cursor = 'grabbing' }
    const onPointerMove = (e) => {
      if (!isDragging) return
      const dx = e.clientX - prevX
      dragVelocity = dx * 0.003
      globe.rotation.y += dragVelocity
      wire.rotation.y = globe.rotation.y
      prevX = e.clientX
    }
    const onPointerUp = () => { isDragging = false; el.style.cursor = 'grab' }
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    let raf
    const animate = () => {
      const t = Date.now() * 0.001
      if (!isDragging) {
        if (Math.abs(dragVelocity) > 0.0001) { globe.rotation.y += dragVelocity; dragVelocity *= 0.96 }
        else { globe.rotation.y += autoRotateSpeed * 0.016 }
      }
      wire.rotation.y = globe.rotation.y
      for (const m of markers) { m.mat.opacity = 0.5 + Math.sin(t * 1.5 + m.phase) * 0.4 }
      for (const r of rings) {
        const cycle = ((t * 0.5 + r.phase) % 2) / 2
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
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div ref={ref} aria-label="Interactive 3D globe" role="img" style={{
      width: 320, height: 320, marginBottom: 24,
      filter: 'drop-shadow(0 0 40px rgba(200,170,110,0.15))',
      cursor: 'grab',
    }} />
  )
}

// ============================================================
// Full-screen demo experience
// ============================================================
function DemoExperience({ onClose, onSignUp }) {
  const ref = useRef(null)
  const [activeEntry, setActiveEntry] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [storyFinished, setStoryFinished] = useState(false)
  const [showAddTooltip, setShowAddTooltip] = useState(false)
  const sceneRef = useRef(null)
  const playingRef = useRef(false)
  const cancelStoryRef = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const w = window.innerWidth, h = window.innerHeight
    const { scene, camera, renderer, globe, wire } = buildGlobeScene(el, w, h)
    camera.position.z = 2.8

    // Demo markers (larger, breathing)
    const markerGeo = new THREE.SphereGeometry(0.028, 12, 12)
    const demoMarkers = DEMO_ENTRIES.map(({ lat, lng }, i) => {
      const pos = ll2v(lat, lng, 1.012)
      const mat = new THREE.MeshBasicMaterial({ color: 0xc9a96e, transparent: true, opacity: 0.9 })
      const mesh = new THREE.Mesh(markerGeo, mat)
      mesh.position.copy(pos)
      mesh.userData = { entryIndex: i }
      globe.add(mesh)
      return { mesh, mat, phase: i * 1.1 }
    })

    // Pulse rings for demo markers
    const ringGeo = new THREE.RingGeometry(0.03, 0.055, 16)
    const demoRings = DEMO_ENTRIES.map(({ lat, lng }, i) => {
      const pos = ll2v(lat, lng, 1.018)
      const mat = new THREE.MeshBasicMaterial({ color: 0xc9a96e, transparent: true, opacity: 0, side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(ringGeo, mat)
      mesh.position.copy(pos)
      mesh.lookAt(0, 0, 0)
      globe.add(mesh)
      return { mesh, mat, phase: i * 0.8 }
    })

    // Travel arcs between demo cities
    const arcMat = new THREE.LineBasicMaterial({ color: 0xc9a96e, transparent: true, opacity: 0.1 })
    for (const [a, b] of [[0,4],[1,5],[2,3],[0,2],[4,5],[3,0]]) {
      const ca = DEMO_ENTRIES[a], cb = DEMO_ENTRIES[b]
      const va = ll2v(ca.lat, ca.lng, 1.002), vb = ll2v(cb.lat, cb.lng, 1.002)
      const mid = new THREE.Vector3().addVectors(va, vb).multiplyScalar(0.5).normalize().multiplyScalar(1.08)
      const curve = new THREE.QuadraticBezierCurve3(va, mid, vb)
      globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), arcMat))
    }

    // Drag interaction
    let isDragging = false, prevX = 0, prevY = 0, dragVelocity = 0
    const onPointerDown = (e) => { isDragging = true; prevX = e.clientX; prevY = e.clientY; dragVelocity = 0; el.style.cursor = 'grabbing' }
    const onPointerMove = (e) => {
      if (!isDragging) return
      const dx = e.clientX - prevX, dy = e.clientY - prevY
      dragVelocity = dx * 0.003
      globe.rotation.y += dx * 0.003
      globe.rotation.x = Math.max(-0.8, Math.min(0.8, globe.rotation.x + dy * 0.003))
      wire.rotation.y = globe.rotation.y
      wire.rotation.x = globe.rotation.x
      prevX = e.clientX; prevY = e.clientY
    }
    const onPointerUp = () => { isDragging = false; el.style.cursor = 'grab' }

    // Raycast click detection for markers
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let pointerDownPos = null
    const onPDown2 = (e) => { pointerDownPos = { x: e.clientX, y: e.clientY } }
    const onClick = (e) => {
      if (playingRef.current) return
      if (pointerDownPos) {
        const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y)
        if (dist > 6) return
      }
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(demoMarkers.map(m => m.mesh))
      if (intersects.length > 0) {
        const idx = intersects[0].object.userData.entryIndex
        if (idx !== undefined) setActiveEntry(idx)
      }
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerdown', onPDown2)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    el.addEventListener('click', onClick)

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    sceneRef.current = { globe, wire, camera, renderer, scene, demoMarkers }

    let raf
    const animate = () => {
      const t = Date.now() * 0.001
      if (!isDragging && !playingRef.current) {
        if (Math.abs(dragVelocity) > 0.0001) { globe.rotation.y += dragVelocity; dragVelocity *= 0.96 }
        else { globe.rotation.y += 0.04 * 0.016 }
      }
      wire.rotation.y = globe.rotation.y
      wire.rotation.x = globe.rotation.x

      for (const m of demoMarkers) {
        m.mat.opacity = 0.6 + Math.sin(t * 1.5 + m.phase) * 0.35
        const sc = 1 + Math.sin(t * 2 + m.phase) * 0.15
        m.mesh.scale.setScalar(sc)
      }
      for (const r of demoRings) {
        const cycle = ((t * 0.5 + r.phase) % 2.5) / 2.5
        r.mat.opacity = Math.max(0, 0.4 - cycle * 0.5)
        const s = 1 + cycle * 3.5
        r.mesh.scale.set(s, s, 1)
      }

      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      renderer.dispose()
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerdown', onPDown2)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('click', onClick)
      window.removeEventListener('resize', onResize)
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  // Fly to a city by rotating the globe
  const flyTo = useCallback((entryIndex, duration = 1200) => {
    return new Promise((resolve) => {
      const s = sceneRef.current
      if (!s) { resolve(); return }
      const { globe, wire } = s
      const entry = DEMO_ENTRIES[entryIndex]
      const targetY = -(entry.lng + 180) * Math.PI / 180 + Math.PI
      const targetX = -(entry.lat) * Math.PI / 180 * 0.3
      const startY = globe.rotation.y, startX = globe.rotation.x
      let dy = targetY - startY
      dy = dy - Math.round(dy / (2 * Math.PI)) * 2 * Math.PI
      const start = Date.now()
      const step = () => {
        const p = Math.min(1, (Date.now() - start) / duration)
        const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
        globe.rotation.y = startY + dy * ease
        globe.rotation.x = startX + (targetX - startX) * ease
        wire.rotation.y = globe.rotation.y
        wire.rotation.x = globe.rotation.x
        if (p < 1) requestAnimationFrame(step); else resolve()
      }
      step()
    })
  }, [])

  // Play Story auto-fly sequence
  const playStory = useCallback(async () => {
    if (playingRef.current) return
    playingRef.current = true
    setIsPlaying(true)
    setActiveEntry(null)
    setStoryFinished(false)

    let cancelled = false
    cancelStoryRef.current = () => { cancelled = true }

    for (let i = 0; i < DEMO_ENTRIES.length; i++) {
      if (cancelled) break
      await flyTo(i, 1400)
      if (cancelled) break
      setActiveEntry(i)
      await new Promise(r => setTimeout(r, 2800))
      if (cancelled) break
      if (i < DEMO_ENTRIES.length - 1) setActiveEntry(null)
      await new Promise(r => setTimeout(r, 400))
    }

    playingRef.current = false
    setIsPlaying(false)
    if (!cancelled) { setActiveEntry(null); setStoryFinished(true) }
    cancelStoryRef.current = null
  }, [flyTo])

  const handleClose = () => {
    if (cancelStoryRef.current) cancelStoryRef.current()
    playingRef.current = false
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: '#0c0a12',
      animation: 'demoFadeIn 0.6s ease-out',
    }}>
      {/* Globe canvas */}
      <div ref={ref} style={{ position: 'absolute', inset: 0, cursor: 'grab' }} />

      {/* Toolbar */}
      <div style={{
        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 10, zIndex: 10001,
        background: 'rgba(12,10,18,0.7)', backdropFilter: 'blur(12px)',
        borderRadius: 14, padding: '8px 12px',
        border: '1px solid rgba(200,170,110,0.15)',
      }}>
        {/* Add (disabled) */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseEnter={() => setShowAddTooltip(true)}
            onMouseLeave={() => setShowAddTooltip(false)}
            style={{
              background: 'rgba(200,170,110,0.08)', border: '1px solid rgba(200,170,110,0.2)',
              borderRadius: 10, padding: '8px 18px', color: 'rgba(200,170,110,0.4)',
              fontSize: 13, fontFamily: FONT, cursor: 'default',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 16 }}>+</span> Add
          </button>
          {showAddTooltip && (
            <div style={{
              position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
              marginTop: 8, padding: '8px 14px', borderRadius: 8,
              background: 'rgba(30,25,40,0.95)', border: '1px solid rgba(200,170,110,0.2)',
              fontSize: 12, color: '#c9a96e', whiteSpace: 'nowrap',
              animation: 'demoFadeIn 0.2s ease-out',
            }}>
              Sign up to add your own
            </div>
          )}
        </div>

        {/* Play Story */}
        <button
          onClick={isPlaying ? undefined : playStory}
          style={{
            background: isPlaying ? 'rgba(200,170,110,0.15)' : 'rgba(200,170,110,0.1)',
            border: '1px solid rgba(200,170,110,0.3)',
            borderRadius: 10, padding: '8px 18px', color: '#c9a96e',
            fontSize: 13, fontFamily: FONT, cursor: isPlaying ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => { if (!isPlaying) e.currentTarget.style.background = 'rgba(200,170,110,0.2)' }}
          onMouseLeave={e => { if (!isPlaying) e.currentTarget.style.background = 'rgba(200,170,110,0.1)' }}
        >
          <span style={{ fontSize: 14 }}>{'\u25B6'}</span> {isPlaying ? 'Playing...' : 'Play Story'}
        </button>

        {/* Close Demo */}
        <button
          onClick={handleClose}
          style={{
            background: 'rgba(200,170,110,0.08)', border: '1px solid rgba(200,170,110,0.2)',
            borderRadius: 10, padding: '8px 18px', color: '#c9a96e',
            fontSize: 13, fontFamily: FONT, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,170,110,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(200,170,110,0.08)' }}
        >
          Close Demo
        </button>
      </div>

      {/* Entry card */}
      {activeEntry !== null && (
        <div style={{
          position: 'absolute', right: 32, top: '50%', transform: 'translateY(-50%)',
          width: 320, zIndex: 10002,
          animation: 'demoCardSlideIn 0.4s ease-out',
        }}>
          <div style={{
            borderRadius: 20, overflow: 'hidden',
            background: 'rgba(18,14,28,0.92)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(200,170,110,0.15)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            {/* Gradient photo placeholder */}
            <div style={{
              height: 140, background: DEMO_ENTRIES[activeEntry].gradient,
              display: 'flex', alignItems: 'flex-end', padding: 16, position: 'relative',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(18,14,28,0.6), transparent)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: '#fff', letterSpacing: 0.5, fontFamily: FONT }}>
                  {DEMO_ENTRIES[activeEntry].city}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontFamily: FONT }}>
                  {DEMO_ENTRIES[activeEntry].dates}
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 20px 20px' }}>
              <div style={{ marginBottom: 12, fontSize: 14, letterSpacing: 2 }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} style={{ color: i < DEMO_ENTRIES[activeEntry].stars ? '#c9a96e' : 'rgba(200,170,110,0.2)' }}>
                    {'\u2605'}
                  </span>
                ))}
              </div>
              <p style={{
                fontSize: 14, lineHeight: 1.7, color: 'rgba(232,224,208,0.75)',
                fontStyle: 'italic', margin: 0, fontFamily: FONT,
              }}>
                &ldquo;{DEMO_ENTRIES[activeEntry].note}&rdquo;
              </p>
            </div>
          </div>
          {!isPlaying && (
            <button onClick={() => setActiveEntry(null)} style={{
              display: 'block', margin: '10px auto 0', background: 'none',
              border: 'none', color: 'rgba(200,170,110,0.5)', fontSize: 12,
              fontFamily: FONT, cursor: 'pointer',
            }}>
              click anywhere to close
            </button>
          )}
        </div>
      )}

      {/* Story-finished CTA overlay */}
      {storyFinished && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 10003,
          textAlign: 'center', animation: 'demoFadeIn 0.8s ease-out',
        }}>
          <div style={{
            background: 'rgba(12,10,18,0.9)', backdropFilter: 'blur(20px)',
            borderRadius: 24, padding: '40px 48px',
            border: '1px solid rgba(200,170,110,0.2)',
            boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
          }}>
            <div style={{
              fontSize: 24, fontWeight: 300, color: '#e8e0d0',
              fontFamily: FONT, letterSpacing: 1, marginBottom: 8,
            }}>
              Imagine this with <em>your</em> memories.
            </div>
            <p style={{ fontSize: 14, color: 'rgba(200,170,110,0.6)', marginBottom: 28, fontFamily: FONT }}>
              Every trip, every note, every place that matters.
            </p>
            <button onClick={onSignUp} style={{
              padding: '14px 44px',
              background: 'linear-gradient(135deg, #c9a96e, #b8944f)',
              border: 'none', borderRadius: 12, color: '#1a1520',
              fontSize: 16, fontWeight: 600, fontFamily: FONT,
              cursor: 'pointer', letterSpacing: 0.5,
              boxShadow: '0 4px 24px rgba(200,170,110,0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 32px rgba(200,170,110,0.4)' }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 24px rgba(200,170,110,0.3)' }}>
              Start Your Cosmos &rarr;
            </button>
            <button onClick={() => setStoryFinished(false)} style={{
              display: 'block', margin: '14px auto 0', background: 'none',
              border: 'none', color: 'rgba(200,170,110,0.5)', fontSize: 13,
              fontFamily: FONT, cursor: 'pointer',
            }}>
              keep exploring
            </button>
          </div>
        </div>
      )}

      {/* Bottom banner */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10002,
        background: 'linear-gradient(to top, rgba(12,10,18,0.95), rgba(12,10,18,0.7), transparent)',
        padding: '60px 24px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 15, color: 'rgba(232,224,208,0.7)', fontFamily: FONT, fontStyle: 'italic' }}>
          This could be your story.
        </span>
        <button onClick={onSignUp} style={{
          padding: '10px 28px',
          background: 'linear-gradient(135deg, #c9a96e, #b8944f)',
          border: 'none', borderRadius: 10, color: '#1a1520',
          fontSize: 14, fontWeight: 600, fontFamily: FONT,
          cursor: 'pointer', letterSpacing: 0.5,
          boxShadow: '0 4px 20px rgba(200,170,110,0.25)',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.target.style.transform = 'translateY(0)' }}>
          Start Your Cosmos &rarr;
        </button>
      </div>

      <style>{`
        @keyframes demoFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes demoCardSlideIn {
          from { opacity: 0; transform: translateY(-50%) translateX(30px); }
          to { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
      `}</style>
    </div>
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
  return <canvas ref={ref} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
}

const features = [
  {
    icon: '\u{1F30D}',
    title: 'Your Little Planet',
    desc: 'Add a trip and watch it glow. Spin the globe to find it again. Zoom in close. It\'s all yours.',
  },
  {
    icon: '\u{1F495}',
    title: 'For You & Your Person',
    desc: 'Hide love letters on the globe. Leave notes on each other\'s entries. Watch your story connect across the map like a thread.',
  },
  {
    icon: '\u{1F4F8}',
    title: 'A Scrapbook That Spins',
    desc: 'Photos show up like little polaroids. Press play and the whole thing comes alive \u2014 your memories, in order, right where they happened.',
  },
  {
    icon: '\u2728',
    title: 'It Has a Heartbeat',
    desc: 'Shooting stars drift by. The aurora shifts colors. Night falls on the globe when it\'s nighttime for real. Little things you\'ll notice over time.',
  },
  {
    icon: '\u{1F382}',
    title: 'It Remembers',
    desc: 'Your first trip together. The farthest you\'ve been from home. Your anniversary. It keeps track so you don\'t have to.',
  },
  {
    icon: '\u{1F48C}',
    title: 'Send a Letter',
    desc: 'Invite someone with a handwritten welcome letter. They open it, join your world, and start adding their own memories.',
  },
]

export default function LandingPage({ onSignIn, onSignUp }) {
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [scrollY, setScrollY] = useState(0)
  const [visible, setVisible] = useState(new Set())
  const [showDemo, setShowDemo] = useState(false)
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

  const heroOpacity = prefersReducedMotion ? 1 : Math.max(0, 1 - scrollY / 500)
  const heroTranslate = prefersReducedMotion ? 0 : scrollY * 0.3

  return (
    <div style={{ background: '#0c0a12', minHeight: '100vh', color: '#e8e0d0', fontFamily: FONT, overflowX: 'hidden' }}>
      <StarField />

      {/* Demo overlay */}
      {showDemo && <DemoExperience onClose={() => setShowDemo(false)} onSignUp={onSignUp} />}

      {/* Nav bar */}
      <nav aria-label="Main navigation" style={{
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
          for the moments you never want to lose
        </p>
        <p style={{
          fontSize: 'clamp(14px, 1.8vw, 17px)', opacity: 0.55,
          marginTop: 28, maxWidth: 460, lineHeight: 1.8,
        }}>
          A universe that fills up with your stories. Add photos, scribble notes, share it with your favorite people.
        </p>
        {/* CTA buttons: Start Your Cosmos + Try the Demo */}
        <div style={{ display: 'flex', gap: 14, marginTop: 44, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={onSignUp} style={{
            padding: '15px 48px',
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
          <button onClick={() => setShowDemo(true)} style={{
            padding: '15px 36px',
            background: 'transparent',
            border: '1px solid rgba(200,170,110,0.35)',
            borderRadius: 12, color: '#c9a96e',
            fontSize: 17, fontWeight: 400, fontFamily: FONT,
            cursor: 'pointer', letterSpacing: 0.5,
            transition: 'border-color 0.2s, background 0.2s, transform 0.2s',
          }}
          onMouseEnter={e => { e.target.style.borderColor = 'rgba(200,170,110,0.6)'; e.target.style.background = 'rgba(200,170,110,0.06)'; e.target.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.target.style.borderColor = 'rgba(200,170,110,0.35)'; e.target.style.background = 'transparent'; e.target.style.transform = 'translateY(0)' }}>
            Try the Demo
          </button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 16 }}>Free forever. No credit card.</div>
        <div aria-hidden="true" style={{
          marginTop: 48, opacity: 0.5, fontSize: 13,
          animation: prefersReducedMotion ? 'none' : 'landingBounce 2s ease-in-out infinite',
        }}>
          {'\u2193'}
        </div>
      </section>

      {/* How it works -- 3 steps */}
      <section style={{
        position: 'relative', zIndex: 1,
        padding: '60px 24px 80px', maxWidth: 800, margin: '0 auto',
      }}>
        <h2 style={{
          textAlign: 'center', fontSize: 'clamp(20px, 3.5vw, 30px)',
          fontWeight: 300, letterSpacing: 2, marginBottom: 48, opacity: 0.6,
        }}>
          The gist
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
          {/* Connecting line */}
          <div style={{ position: 'absolute', left: 28, top: 32, bottom: 32, width: 1, background: 'linear-gradient(to bottom, transparent, rgba(200,170,110,0.15), rgba(200,170,110,0.15), transparent)' }} />
          {[
            { num: '1', title: 'Create your universe', desc: 'Just you? You and your partner? The whole crew? Make a world for them. It gets its own colors and everything.', icon: '\u{1F319}' },
            { num: '2', title: 'Fill it with memories', desc: 'Pick the city. Throw in some photos. Write what you remember before you forget it. A little light appears on the globe.', icon: '\u{1F4CD}' },
            { num: '3', title: 'Come back to it', desc: 'Press play to watch your whole story unfold. It gets better every time you add something new.', icon: '\u2728' },
          ].map((step, i) => (
            <div key={"step-" + i} style={{
              display: 'flex', gap: 24, alignItems: 'flex-start', padding: '20px 0',
              position: 'relative',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(200,170,110,0.06)', border: '1px solid rgba(200,170,110,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, zIndex: 1,
              }}>{step.icon}</div>
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontSize: 11, color: '#c9a96e', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6, opacity: 0.7 }}>Step {step.num}</div>
                <div style={{ fontSize: 18, fontWeight: 400, marginBottom: 6, opacity: 0.85 }}>{step.title}</div>
                <div style={{ fontSize: 14, opacity: 0.55, lineHeight: 1.7 }}>{step.desc}</div>
              </div>
            </div>
          ))}
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
          What's inside
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32,
        }}>
          {features.map((f, i) => (
            <div
              key={"feat-" + i}
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
              <div style={{ fontSize: 14, opacity: 0.55, lineHeight: 1.8 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* World types showcase */}
      <section style={{
        position: 'relative', zIndex: 1,
        padding: '40px 24px 80px', maxWidth: 800, margin: '0 auto',
      }}>
        <h2 style={{
          textAlign: 'center', fontSize: 'clamp(20px, 3.5vw, 28px)',
          fontWeight: 300, letterSpacing: 2, marginBottom: 12, opacity: 0.7,
        }}>
          Make it yours
        </h2>
        <p style={{ textAlign: 'center', fontSize: 14, opacity: 0.55, marginBottom: 40, lineHeight: 1.6 }}>
          Every world has its own colors, its own features, its own feeling.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          {[
            { name: 'My World', desc: 'Just yours', color: '#c9a96e', icon: '\u{1F30D}' },
            { name: 'Partner', desc: 'Love letters & all', color: '#d4a0b0', icon: '\u{1F495}' },
            { name: 'Friends', desc: 'For the group chat', color: '#7090c0', icon: '\u{1F46F}' },
            { name: 'Family', desc: 'Every reunion, every trip', color: '#c4956a', icon: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}' },
          ].map((w, i) => (
            <div key={"world-" + i} style={{
              padding: '24px 20px', borderRadius: 16, textAlign: 'center',
              background: `linear-gradient(145deg, ${w.color}08, ${w.color}03)`,
              border: `1px solid ${w.color}18`,
              transition: 'transform 0.3s, border-color 0.3s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = `${w.color}35` }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = `${w.color}18` }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{w.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: w.color, marginBottom: 4, letterSpacing: 0.3 }}>{w.name}</div>
              <div style={{ fontSize: 11, opacity: 0.55 }}>{w.desc}</div>
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
          That's it. That's the whole thing.
        </div>
        <p style={{
          fontSize: 15, opacity: 0.55, maxWidth: 420, margin: '0 auto 36px',
          lineHeight: 1.7,
        }}>
          Add one memory. Watch it glow. This is yours.
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
        fontSize: 12, opacity: 0.5, letterSpacing: 0.5,
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
