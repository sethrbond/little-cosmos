import { fmtDate } from "./geodata.js";

export default function CelebrationOverlay({ celebrationData, onClose, P, config }) {
  const cd = celebrationData || { type: 'first', message: 'Your First Entry!', sub: '' };
  const isAnniv = cd.type === 'anniversary';
  const isMilestone = cd.type === 'milestone';
  const showConfetti = isAnniv || isMilestone;
  const celebIcon = isAnniv ? "\uD83D\uDC95" : isMilestone ? (cd.message.includes("Countries") ? "\uD83D\uDDFA" : cd.message.includes("Miles") ? "\uD83D\uDE80" : "\u2728") : "\u2728";
  const accentColor = isAnniv ? P.heart : isMilestone ? P.goldWarm : P.goldWarm;
  return (
    <div role="alert" aria-label="Celebration" style={{ position: "fixed", inset: 0, zIndex: 250, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto", cursor: "pointer", background: showConfetti ? `radial-gradient(ellipse at center, ${accentColor}15, transparent 70%)` : 'transparent', animation: "fadeIn .4s ease" }}
      onClick={onClose}>
      {/* Confetti particles */}
      {showConfetti && Array.from({ length: isMilestone ? 16 : 24 }, (_, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${10 + Math.random() * 80}%`,
          top: "-5%",
          width: 6 + Math.random() * 6,
          height: 6 + Math.random() * 6,
          borderRadius: Math.random() > 0.5 ? "50%" : "2px",
          background: [P.heart, P.goldWarm, P.rose, P.sky, P.lavender, '#f0c0d0'][i % 6],
          opacity: 0.8,
          animation: `confettiFall ${2 + Math.random() * 3}s ${Math.random() * 1.5}s ease-in forwards`,
        }} />
      ))}
      <div style={{ textAlign: "center", animation: "celebrationPop .6s cubic-bezier(0.34, 1.56, 0.64, 1)", zIndex: 1 }}>
        <div style={{ fontSize: isAnniv ? 80 : 64, marginBottom: 12, filter: `drop-shadow(0 0 20px ${accentColor}60)`, animation: isAnniv ? "heartPulse 1.5s ease infinite" : "none" }}>
          {celebIcon}
        </div>
        <div style={{ fontSize: isAnniv ? 28 : isMilestone ? 24 : 22, fontWeight: isAnniv ? 300 : 500, color: P.text, letterSpacing: isAnniv ? ".12em" : "1px", textShadow: `0 0 30px ${accentColor}40, 0 2px 10px rgba(0,0,0,0.6)`, marginBottom: 8, fontFamily: "'Palatino Linotype', Georgia, serif" }}>
          {cd.message}
        </div>
        {cd.sub && <div style={{ fontSize: 12, color: P.textMid, lineHeight: 1.7, maxWidth: 320, margin: "0 auto", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>{cd.sub}</div>}
        {isAnniv && config.startDate && (
          <div style={{ fontSize: 10, color: P.textFaint, marginTop: 12, letterSpacing: ".1em" }}>
            Since {fmtDate(config.startDate)}
          </div>
        )}
        <div style={{ fontSize: 9, color: P.textFaint, marginTop: 16, opacity: 0.5 }}>tap anywhere to continue</div>
      </div>
    </div>
  );
}
