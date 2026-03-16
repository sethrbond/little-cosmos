import { useState, useMemo } from "react";

/* WelcomeLetterScreen — the "gift moment"
   A full-screen parchment card that fades in when a recipient
   has an unread welcome letter. They read it, click "Enter My Cosmos",
   and the letter dissolves into the globe experience. */

const F = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif";
const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Stars() {
  const stars = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    opacity: 0.15 + Math.random() * 0.25,
    duration: `${3 + Math.random() * 4}s`,
    delay: `${Math.random() * 5}s`,
  })), []);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {stars.map((s, i) => (
        <div key={"star-" + i} style={{
          position: "absolute",
          left: s.left, top: s.top,
          width: 2, height: 2, borderRadius: "50%",
          background: "#e8e0d0",
          opacity: s.opacity,
          animation: prefersReducedMotion ? 'none' : `twinkle ${s.duration} ease-in-out infinite`,
          animationDelay: prefersReducedMotion ? '0s' : s.delay,
        }} />
      ))}
    </div>
  );
}

export default function WelcomeLetterScreen({ letter, onEnter }) {
  const [fading, setFading] = useState(false);
  const [entering, setEntering] = useState(false);

  if (!letter) return null;

  const handleEnter = () => {
    if (entering) return;
    setEntering(true);
    setFading(true);
    setTimeout(() => onEnter(), prefersReducedMotion ? 0 : 800);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "radial-gradient(ellipse at center, #1a1424 0%, #0c0a12 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: F, opacity: fading ? 0 : 1, transition: prefersReducedMotion ? "none" : "opacity 0.8s ease",
    }}>
      {/* Subtle stars behind */}
      <Stars />

      {/* The letter */}
      <div style={{
        position: "relative", zIndex: 2,
        maxWidth: 480, width: "90vw",
        padding: "clamp(28px, 6vw, 48px) clamp(24px, 5vw, 40px)",
        background: "linear-gradient(170deg, rgba(250,248,244,0.97) 0%, rgba(245,241,234,0.95) 100%)",
        borderRadius: 3,
        boxShadow: "0 20px 80px rgba(0,0,0,0.5), 0 2px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.5)",
        animation: prefersReducedMotion ? "none" : "letterIn 1.2s ease forwards",
      }}>
        {/* Subtle texture overlay */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 3,
          background: "repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(180,170,155,0.06) 28px, rgba(180,170,155,0.06) 29px)",
          pointerEvents: "none",
        }} />

        {/* Letter content */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Wax seal */}
          <div style={{
            position: "absolute", top: -28, right: Math.max(-12, -window.innerWidth * 0.02),
            width: 48, height: 48, borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, #d4645a, #a03830 60%, #7a2822)",
            boxShadow: "0 3px 10px rgba(120,30,20,0.4), inset 0 1px 2px rgba(255,200,180,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, color: "rgba(255,220,200,0.7)",
            transform: "rotate(-12deg)",
          }}>
            {letter.from_name ? letter.from_name.charAt(0).toUpperCase() : "♥"}
          </div>

          <div style={{
            fontSize: 15, color: "#3d3552", lineHeight: 2.0,
            whiteSpace: "pre-wrap", fontStyle: "italic",
            letterSpacing: "0.02em", maxHeight: "40vh", overflowY: "auto",
          }}>
            {letter.letter_text}
          </div>

          <div style={{
            marginTop: 28, fontSize: 14, color: "#6b5e7e",
            letterSpacing: "0.08em", fontWeight: 500,
          }}>
            — {letter.from_name || "Someone who loves you"}
          </div>
        </div>

        {/* Enter button */}
        <div style={{ textAlign: "center", marginTop: 36 }}>
          <button onClick={handleEnter} disabled={entering} style={{
            background: "linear-gradient(135deg, #c9a96e, #b8944f)",
            border: "none", borderRadius: 24, padding: "12px 32px",
            color: "#1a1520", fontSize: 14, fontWeight: 600,
            fontFamily: F, cursor: entering ? "default" : "pointer", letterSpacing: "0.06em",
            boxShadow: "0 4px 16px rgba(180,140,60,0.3)",
            transition: prefersReducedMotion ? "none" : "all 0.3s ease",
            opacity: entering ? 0.6 : 1,
          }}
          onMouseEnter={e => { e.target.style.transform = "scale(1.04)"; e.target.style.boxShadow = "0 6px 24px rgba(180,140,60,0.4)"; }}
          onMouseLeave={e => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "0 4px 16px rgba(180,140,60,0.3)"; }}>
            {entering ? "Opening..." : "Enter My Cosmos"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes letterIn {
          from { opacity: 0; transform: translateY(30px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
