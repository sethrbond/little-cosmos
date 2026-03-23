import React from "react";

export default function EmptyState({ P, config, isViewer, worldType, isMyWorld, modalDispatch, isMobile }) {
  const emptyMsg = {
    partner: { icon: "\u{1F4AB}", title: "Your story begins here", desc: "Add your first memory together to bring your shared world to life.", hint: "Every pin on this globe is a chapter in your story." },
    friends: { icon: "\u{1F5FA}", title: "Adventures await", desc: "Add your first trip to start mapping your crew's adventures together.", hint: "Track every road trip, festival, and reunion." },
    family:  { icon: "\u{1F3E1}", title: "Every journey starts here", desc: "Add your first memory to start building your family's travel story.", hint: "From weekend getaways to dream vacations." },
  };
  const msg = isMyWorld
    ? { icon: "\u{1F30D}", title: "Your world awaits", desc: "Add your first trip to start building your personal travel map.", hint: "Track every adventure, from weekend escapes to distant horizons." }
    : emptyMsg[worldType] || emptyMsg.partner;
  return (
    <div style={{ position: "absolute", top: "46%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 12, textAlign: "center", maxWidth: 380, animation: "fadeIn 1.2s ease" }}>
      <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle, ${P.rose}18, transparent 70%)`, animation: "heartPulse 3s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 6, borderRadius: "50%", border: `1px dashed ${P.rose}20`, animation: "emptyOrbit 12s linear infinite" }} />
        <div style={{ position: "absolute", inset: 16, borderRadius: "50%", border: `1px dashed ${P.sky}15`, animation: "emptyOrbit 8s linear infinite reverse" }} />
        <div style={{ position: "absolute", inset: 28, borderRadius: "50%", border: `1px dashed ${P.gold}10`, animation: "emptyOrbit 16s linear infinite" }} />
        <div style={{ fontSize: 44, position: "relative", zIndex: 1, animation: "emptyFloat 4s ease-in-out infinite" }}>{msg.icon}</div>
      </div>
      <div style={{ fontSize: 22, color: P.text, letterSpacing: ".06em", fontWeight: 500, opacity: 0.9 }}>{msg.title}</div>
      <div style={{ fontSize: 13, color: P.textMuted, marginTop: 10, lineHeight: 1.8, letterSpacing: ".04em", maxWidth: 320, margin: "10px auto 0" }}>{msg.desc}</div>
      {!isViewer && (
        <button onClick={() => modalDispatch({ type: 'OPEN', name: 'showAdd' })} style={{
          marginTop: 24, padding: "13px 32px", background: `linear-gradient(135deg, ${P.rose}35, ${P.sky}35)`,
          border: `1px solid ${P.rose}20`, borderRadius: 24, color: P.text, fontSize: 13,
          fontFamily: "inherit", cursor: "pointer", letterSpacing: ".06em", transition: "all .3s",
          boxShadow: `0 2px 12px ${P.rose}15, 0 4px 20px ${P.sky}10`,
        }}
        onMouseEnter={e => { e.target.style.background = `linear-gradient(135deg, ${P.rose}50, ${P.sky}50)`; e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = `0 4px 16px ${P.rose}25, 0 8px 28px ${P.sky}15`; }}
        onMouseLeave={e => { e.target.style.background = `linear-gradient(135deg, ${P.rose}35, ${P.sky}35)`; e.target.style.transform = "none"; e.target.style.boxShadow = `0 2px 12px ${P.rose}15, 0 4px 20px ${P.sky}10`; }}>
          + {isMyWorld ? "Add Your First Trip" : worldType === "friends" ? "Add Your First Trip" : "Add Your First Memory"}
        </button>
      )}
      <div style={{ fontSize: 11, color: P.textFaint, marginTop: 20, letterSpacing: ".05em", lineHeight: 1.6, opacity: 0.7, fontStyle: "italic" }}>{msg.hint}</div>
      {!isMobile && !isViewer && (
        <div style={{ fontSize: 9, color: P.textFaint, marginTop: 16, letterSpacing: ".08em", opacity: 0.4 }}>
          press <span style={{ background: `${P.rose}12`, padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>N</span> to quick-add &nbsp;&middot;&nbsp; <span style={{ background: `${P.rose}12`, padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>?</span> for shortcuts
        </div>
      )}
    </div>
  );
}
