/* StatsOverlay.jsx — Stats dashboard modal extracted from OurWorld.jsx */

export default function StatsOverlay({ P, stats, expandedStats, reunionStats, milestones, isMyWorld, isPartnerWorld, fmtDate, startRecap, onClose, setTripCardEntry }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Travel stats" onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 45, background: `linear-gradient(135deg, rgba(22,16,40,.82), rgba(30,24,48,.88))`, backdropFilter: "blur(24px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", animation: "fadeIn .4s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto", padding: 32, background: P.card, borderRadius: 22, boxShadow: "0 1px 3px rgba(61,53,82,.04), 0 8px 24px rgba(61,53,82,.06), 0 24px 64px rgba(61,53,82,.1)", cursor: "default" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 400, letterSpacing: ".08em" }}>{isMyWorld ? "📊 My Travel Stats" : "📊 Our Story in Numbers"}</h2>
          <button aria-label="Close stats" onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: P.textFaint, cursor: "pointer", transition: "color .2s" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
          {[
            isPartnerWorld ? { label: "Days Together", value: stats.daysTog, icon: "💕" } : { label: "Days Exploring", value: stats.daysTog, icon: "🧭" },
            { label: "Trips", value: stats.trips, icon: "🗺" },
            { label: "Countries", value: stats.countries, icon: "🌍" },
            { label: "Photos", value: stats.photos, icon: "📷" },
            { label: "Miles Traveled", value: stats.totalMiles.toLocaleString(), icon: "✈️" },
            ...(isPartnerWorld ? [{ label: "Reunions", value: reunionStats.reunions, icon: "🫂" }] : [{ label: "Cities", value: expandedStats.cityCount, icon: "🏙" }]),
          ].map((s, i) => (
            <div key={i} style={{ padding: "14px 16px", background: `linear-gradient(145deg, ${P.parchment}, ${P.cream})`, borderRadius: 14, textAlign: "center", boxShadow: `0 1px 3px ${P.text}04, 0 4px 12px ${P.text}03`, border: `1px solid ${P.rose}06`, transition: "transform .2s, box-shadow .2s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 2px 6px ${P.text}06, 0 8px 20px ${P.text}05`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 1px 3px ${P.text}04, 0 4px 12px ${P.text}03`; }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 400, color: P.text, letterSpacing: ".02em" }}>{s.value}</div>
              <div style={{ fontSize: 8, color: P.textFaint, letterSpacing: ".12em", textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Distance Scoreboard */}
        {isPartnerWorld && <div style={{ padding: "14px 18px", background: `linear-gradient(135deg,${P.blush},${P.lavMist})`, borderRadius: 14, marginBottom: 16, textAlign: "center", boxShadow: `0 1px 4px ${P.text}04` }}>
          <div style={{ fontSize: 8, color: P.textFaint, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 6 }}>The Scoreboard</div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
            <div><span style={{ fontSize: 16, color: P.heart }}>💕</span><div style={{ fontSize: 18, fontWeight: 400 }}>{reunionStats.daysTogether}</div><div style={{ fontSize: 7, color: P.textFaint }}>days together</div></div>
            <div style={{ fontSize: 11, color: reunionStats.togetherWinning ? P.heart : P.textFaint, fontStyle: "italic" }}>vs</div>
            <div><span style={{ fontSize: 16 }}>🌍</span><div style={{ fontSize: 18, fontWeight: 400 }}>{reunionStats.daysApart}</div><div style={{ fontSize: 7, color: P.textFaint }}>days apart</div></div>
          </div>
          <div style={{ fontSize: 10, color: reunionStats.togetherWinning ? P.heart : P.sky, marginTop: 6, fontStyle: "italic" }}>
            {reunionStats.togetherWinning ? "Together is winning 💕" : "Distance makes the heart grow fonder 💙"}
          </div>
        </div>}

        <div style={{ margin: "14px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}20,transparent)` }} />

        <div style={{ fontSize: 8, color: P.textFaint, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 10 }}>Highlights</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {expandedStats.longestTrip.entry && (
            <div style={{ padding: "12px 14px", background: `linear-gradient(135deg, ${P.together}06, ${P.together}03)`, borderRadius: 12, borderLeft: `3px solid ${P.together}`, transition: "transform .2s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateX(2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              <div style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".1em", textTransform: "uppercase" }}>{isPartnerWorld ? "Longest Trip Together" : "Longest Trip"}</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>{expandedStats.longestTrip.entry.city} — {expandedStats.longestTrip.days} days</div>
            </div>
          )}
          {isPartnerWorld && expandedStats.farthestApart.dist > 0 && (
            <div style={{ padding: "12px 14px", background: `linear-gradient(135deg, ${P.sky}06, ${P.sky}03)`, borderRadius: 12, borderLeft: `3px solid ${P.sky}`, transition: "transform .2s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateX(2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              <div style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".1em", textTransform: "uppercase" }}>Farthest Apart</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>{expandedStats.farthestApart.dist.toLocaleString()} miles</div>
            </div>
          )}
          {expandedStats.topCity && (
            <div style={{ padding: "12px 14px", background: `linear-gradient(135deg, ${P.rose}06, ${P.rose}03)`, borderRadius: 12, borderLeft: `3px solid ${P.rose}`, transition: "transform .2s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateX(2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              <div style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".1em", textTransform: "uppercase" }}>{isPartnerWorld ? "Most Visited Together" : "Most Visited"}</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>{expandedStats.topCity[0]} — {expandedStats.topCity[1]} times</div>
            </div>
          )}
          {isPartnerWorld && expandedStats.longestApart > 0 && (
            <div style={{ padding: "12px 14px", background: `linear-gradient(135deg, ${P.lavender}06, ${P.lavender}03)`, borderRadius: 12, borderLeft: `3px solid ${P.lavender}`, transition: "transform .2s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateX(2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              <div style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".1em", textTransform: "uppercase" }}>Longest Apart</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>{expandedStats.longestApart} days</div>
            </div>
          )}
          {expandedStats.avgTripLength > 0 && (
            <div style={{ padding: "12px 14px", background: `linear-gradient(135deg, ${P.rose}06, ${P.rose}03)`, borderRadius: 12, borderLeft: `3px solid ${P.rose}`, transition: "transform .2s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateX(2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              <div style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".1em", textTransform: "uppercase" }}>Average Trip Length</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>{expandedStats.avgTripLength} days</div>
            </div>
          )}
        </div>

        {expandedStats.countryList.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 8, color: P.textFaint, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 6 }}>Countries Visited</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {[...expandedStats.countryList].sort().map(c => (
                <span key={c} style={{ padding: "4px 10px", background: `linear-gradient(145deg, ${P.parchment}, ${P.cream})`, borderRadius: 14, fontSize: 9, color: P.textMid, border: `1px solid ${P.rose}06` }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {expandedStats.years.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 8, color: P.textFaint, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 6 }}>Year in Review</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {expandedStats.years.map(y => (
                <button key={y} onClick={() => startRecap(y)} style={{ padding: "8px 16px", background: `linear-gradient(135deg,${P.blush},${P.lavMist})`, border: `1px solid ${P.rose}12`, borderRadius: 12, cursor: "pointer", fontSize: 10, fontFamily: "inherit", color: P.textMid, transition: "all .25s", boxShadow: `0 1px 4px ${P.text}04` }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px) scale(1.03)"; e.currentTarget.style.boxShadow = `0 3px 12px ${P.text}08`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 1px 4px ${P.text}04`; }}
                >🎬 {y}</button>
              ))}
            </div>
          </div>
        )}

        {milestones.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 8, color: P.textFaint, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 6 }}>Milestones Reached</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {milestones.map(m => (
                <span key={m.days} style={{ padding: "4px 10px", background: `linear-gradient(135deg, ${P.gold}12, ${P.gold}06)`, borderRadius: 14, fontSize: 9, color: P.goldWarm, border: `1px solid ${P.gold}10` }}>◆ {m.label} — {fmtDate(m.date)}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
