import { useState, useEffect } from "react";
import { inputStyle, Lbl, Fld, useFocusTrap } from "./EntryForms.jsx";
import {
  OUR_WORLD_PALETTE, MY_WORLD_PALETTE,
  OUR_WORLD_SCENE, MY_WORLD_SCENE,
  getSharedWorldConfig,
  WORLD_THEMES,
} from "./worldConfigs.js";
import { sendWelcomeLetter, getMyLetters, deleteWelcomeLetter } from "./supabaseWelcomeLetters.js";
import { getWorldMembers, removeWorldMember, updateMemberRole, deleteWorld, leaveWorld, updateWorld } from "./supabaseWorlds.js";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function SettingsPanel({
  config,
  onConfigChange: setConfig,
  palette: P,
  worldType,
  isMyWorld,
  isPartnerWorld,
  isSharedWorld,
  worldId,
  userId,
  members: worldMembers,
  setMembers: setWorldMembers,
  worldRole,
  worldName,
  onClose,
  showToast,
  flushConfigSave,
  handwrittenMode,
  setHandwrittenMode,
  ambientRef,
  ambientPlaying,
  exportData,
  importData,
  onSwitchWorld,
  setShowOnboarding,
  setOnboardStep,
  onboardKey,
  setConfirmModal,
}) {
  // Focus trap
  const settingsTrapRef = useFocusTrap(true);

  // Color picker state
  const [cpOpen, setCpOpen] = useState(null);

  // Welcome letter state
  const [wlEmail, setWlEmail] = useState("");
  const [wlText, setWlText] = useState("");
  const [wlSending, setWlSending] = useState(false);
  const [wlSent, setWlSent] = useState(false);
  const [myLetters, setMyLetters] = useState([]);

  // Load letters on mount
  useEffect(() => {
    if (userId) {
      getMyLetters(userId).then(setMyLetters).catch(() => {});
    }
  }, [userId]);

  const handleClose = () => {
    flushConfigSave();
    onClose();
  };

  // Color picker widget
  const cPick = (label, desc, value, onChange, scene) => {
    const isOpen = cpOpen === label;
    const presets = scene
      ? ["#0a0814","#161028","#18102c","#0c0e16","#101820","#1a1428",
         "#f8e8f4","#f0dce8","#e8d8f0","#d0c0a0","#e0d0b0","#c8b898",
         "#f8b8d0","#f0a0c8","#d8a0f0","#e0c0f0","#80a0c0","#7088a8",
         "#78c058","#70b850","#5a9848","#fce0f0","#d8e0f0","#c8d0e0"]
      : ["#d4a0b9","#e8b8d0","#f0c8d8","#e07a9a","#f08888","#c97a7a",
         "#c0a068","#d4b078","#b08040","#dfc090","#c4a048","#e8c88a",
         "#9bb5d6","#7090a8","#a0c0e8","#b8a5cc","#908098","#c4a8e0",
         "#a8bf94","#7a9a70","#88a890","#faf8f4","#f2f0ec","#e8e4dc",
         "#3d3552","#282830","#504c58","#6b5e7e","#ffffff","#000000"];
    return (
      <div key={label} style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}
          onClick={() => setCpOpen(isOpen ? null : label)}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: value, border: `2px solid ${P.textFaint}40`, flexShrink: 0, boxSizing: "border-box" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: P.text, fontWeight: 500 }}>{scene ? "\u2726 " : ""}{label}</div>
            <div style={{ fontSize: 10, color: P.textFaint, lineHeight: 1.3 }}>{desc}</div>
          </div>
          <div style={{ fontSize: 10, fontFamily: "monospace", color: P.textFaint, flexShrink: 0 }}>{value}</div>
          <div style={{ fontSize: 10, color: P.textFaint, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>{"\u25B6"}</div>
        </div>
        {isOpen && (
          <div style={{ padding: "6px 0 2px 36px" }}>
            {/* Rainbow gradient bar */}
            <canvas width={260} height={28}
              style={{ width: "100%", height: 28, borderRadius: 4, cursor: "crosshair", marginBottom: 6, border: `1px solid ${P.textFaint}20` }}
              ref={el => {
                if (!el) return;
                const ctx = el.getContext("2d");
                if (el._drawn) return;
                el._drawn = true;
                const grad = ctx.createLinearGradient(0, 0, 260, 0);
                ["#ff0000","#ff8000","#ffff00","#80ff00","#00ff00","#00ff80","#00ffff","#0080ff","#0000ff","#8000ff","#ff00ff","#ff0080","#ff0000"].forEach((c, i) => grad.addColorStop(i/12, c));
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 260, 10);
                const grad2 = ctx.createLinearGradient(0, 0, 260, 0);
                ["#ffb0b0","#ffd0a0","#ffffb0","#b0ffb0","#b0ffff","#b0b0ff","#e0b0ff","#ffb0e0"].forEach((c, i) => grad2.addColorStop(i/7, c));
                ctx.fillStyle = grad2;
                ctx.fillRect(0, 10, 260, 9);
                const grad3 = ctx.createLinearGradient(0, 0, 260, 0);
                ["#000000","#1a1020","#2a1828","#182030","#202820","#282018","#382028","#ffffff"].forEach((c, i) => grad3.addColorStop(i/7, c));
                ctx.fillStyle = grad3;
                ctx.fillRect(0, 19, 260, 9);
              }}
              onClick={e => {
                const canvas = e.target;
                const rect = canvas.getBoundingClientRect();
                const x = Math.round((e.clientX - rect.left) / rect.width * 259);
                const y = Math.round((e.clientY - rect.top) / rect.height * 27);
                const ctx = canvas.getContext("2d");
                const px = ctx.getImageData(x, y, 1, 1).data;
                const hex = "#" + [px[0],px[1],px[2]].map(v => v.toString(16).padStart(2,"0")).join("");
                onChange(hex);
              }}
            />
            {/* Preset swatches */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
              {presets.map(c => (
                <div key={c} onClick={() => onChange(c)}
                  style={{ width: 18, height: 18, borderRadius: 3, background: c, cursor: "pointer",
                    border: value === c ? `2px solid ${P.text}` : `1px solid ${P.textFaint}30`,
                    boxSizing: "border-box" }} />
              ))}
            </div>
            {/* Hex input */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: P.textFaint }}>Hex:</span>
              <input type="text" defaultValue={value} key={value}
                onKeyDown={e => { if (e.key === "Enter") { let v = e.target.value.trim(); if (!v.startsWith("#")) v = "#" + v; if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v); }}}
                onBlur={e => { let v = e.target.value.trim(); if (!v.startsWith("#")) v = "#" + v; if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v); }}
                style={{ width: 70, padding: "3px 5px", fontSize: 10, fontFamily: "monospace", background: `${P.textFaint}12`, border: `1px solid ${P.textFaint}20`, borderRadius: 3, color: P.textMid, outline: "none" }} />
              <div style={{ width: 16, height: 16, borderRadius: 3, background: value, border: `1px solid ${P.textFaint}30` }} />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Settings" onClick={handleClose} style={{ position: "absolute", inset: 0, zIndex: 45, background: `linear-gradient(135deg, rgba(22,16,40,.82), rgba(30,24,48,.88))`, backdropFilter: "blur(24px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", animation: "fadeIn .3s ease" }}>
      <div ref={settingsTrapRef} onClick={e => e.stopPropagation()} style={{ width: 400, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto", padding: 30, background: P.card, borderRadius: 22, boxShadow: "0 1px 3px rgba(61,53,82,.04), 0 8px 24px rgba(61,53,82,.06), 0 24px 64px rgba(61,53,82,.1)", cursor: "default" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 400, letterSpacing: ".06em" }}>Settings</h3><button aria-label="Close settings" onClick={handleClose} style={{ background: "none", border: "none", fontSize: 17, color: P.textFaint, cursor: "pointer", transition: "color .2s", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u00D7"}</button></div>
        <Fld l={isMyWorld ? "First Trip Date" : isPartnerWorld ? "Date You Met" : "First Trip Date"} v={config.startDate} t="date" set={v => setConfig({ startDate: v })} />
        <Fld l="Title" v={config.title} set={v => setConfig({ title: v })} />
        <Fld l="Subtitle" v={config.subtitle} set={v => setConfig({ subtitle: v })} />
        {isMyWorld
          ? <Fld l="Traveler Name" v={config.travelerName || ''} set={v => setConfig({ travelerName: v })} ph="Your name" />
          : isPartnerWorld
            ? <>
                <Fld l="Your Name" v={config.youName} set={v => setConfig({ youName: v })} ph="Enter your name" />
                <Fld l="Partner's Name" v={config.partnerName} set={v => setConfig({ partnerName: v })} ph="Enter their name" />
              </>
            : (() => {
                const members = config.members || [];
                const updateMember = (i, name) => { const next = [...members]; next[i] = { name }; setConfig({ members: next }); };
                const addMember = () => setConfig({ members: [...members, { name: "" }] });
                const removeMember = (i) => setConfig({ members: members.filter((_, j) => j !== i) });
                return <div style={{ marginBottom: 12 }}>
                  <Lbl>{worldType === "family" ? "Family Members" : "Group Members"}</Lbl>
                  {members.map((m, i) => (
                    <div key={"member-" + i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                      <input value={m.name || ""} onChange={e => updateMember(i, e.target.value)}
                        placeholder={worldType === "family" ? `Member ${i + 1}` : `Friend ${i + 1}`}
                        style={inputStyle()} />
                      {members.length > 1 && (
                        <button onClick={() => removeMember(i)}
                          style={{ background: "none", border: "none", color: P.textFaint, fontSize: 15, cursor: "pointer", padding: "0 4px" }}>{"\u00D7"}</button>
                      )}
                    </div>
                  ))}
                  <button onClick={addMember}
                    style={{ background: "none", border: `1px dashed ${P.rose}30`, borderRadius: 6, color: P.textMid, fontSize: 10, padding: "5px 10px", cursor: "pointer", width: "100%", fontFamily: "inherit", marginTop: 2 }}>
                    + Add {worldType === "family" ? "family member" : "friend"}
                  </button>
                </div>;
              })()
        }

        <div style={{ margin: "14px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />
        <div style={{ fontSize: 10, color: P.textMid, letterSpacing: ".13em", textTransform: "uppercase", marginBottom: 4, fontWeight: 500 }}>{"\uD83C\uDFA8"} Color Theme</div>
        <p style={{ fontSize: 10, color: P.textFaint, fontStyle: "italic", marginBottom: 10 }}>Interface colors update instantly. Globe/scene colors ({"\u2726"}) save but require a <strong style={{ color: P.textMid }}>page refresh</strong> to take effect.</p>
        {(() => {
          const cp = config.customPalette || {};
          const cs = config.customScene || {};
          const setCP = (key, val) => setConfig({ customPalette: { ...cp, [key]: val } });
          const setCS = (key, val) => setConfig({ customScene: { ...cs, [key]: val } });
          const sharedCfg = (!isMyWorld && worldType) ? getSharedWorldConfig(worldType) : null;
          const baseP = isMyWorld ? MY_WORLD_PALETTE : sharedCfg ? sharedCfg.palette : OUR_WORLD_PALETTE;
          const baseSC = isMyWorld ? MY_WORLD_SCENE : sharedCfg ? sharedCfg.scene : OUR_WORLD_SCENE;
          return <>
            <div style={{ fontSize: 10, color: P.textMid, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6, marginTop: 2 }}>Theme Presets</div>
            <div style={{ marginBottom: 12 }}>
              <select
                value={Object.entries(WORLD_THEMES).find(([k, t]) => JSON.stringify(t.palette) === JSON.stringify(config.customPalette || {}))?.[0] || ""}
                onChange={e => {
                  const theme = WORLD_THEMES[e.target.value];
                  if (theme) {
                    setConfig({ customPalette: theme.palette, customScene: theme.scene });
                    showToast(`${theme.name} theme applied \u2014 reload for scene colors`, "\uD83C\uDFA8", 3000);
                  }
                }}
                style={{ width: "100%", padding: "8px 10px", border: `1px solid ${P.textFaint}30`, borderRadius: 8, fontSize: 10, fontFamily: "inherit", color: P.text, background: P.card, backdropFilter: "blur(12px)", cursor: "pointer", appearance: "none", WebkitAppearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
              >
                <option value="" disabled>Choose a theme...</option>
                {Object.entries(WORLD_THEMES).map(([key, theme]) => (
                  <option key={key} value={key}>{theme.name} {"\u2014"} {theme.description}</option>
                ))}
              </select>
              {(() => {
                const currentKey = Object.entries(WORLD_THEMES).find(([k, t]) => JSON.stringify(t.palette) === JSON.stringify(config.customPalette || {}))?.[0];
                const currentTheme = currentKey ? WORLD_THEMES[currentKey] : null;
                return currentTheme ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, padding: "4px 8px", background: `${P.rose}08`, borderRadius: 6, fontSize: 10, color: P.textMid }}>
                    <div style={{ display: "flex", gap: 2 }}>{currentTheme.preview.map((c, i) => <div key={c+i} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}</div>
                    <span>{currentTheme.name}</span>
                  </div>
                ) : null;
              })()}
            </div>
            <div style={{ fontSize: 10, color: P.textMid, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4, marginTop: 2 }}>Interface Colors</div>
            {cPick("Primary Accent", "Markers, buttons, borders, highlights", cp.rose || baseP.rose, v => setCP("rose", v))}
            {cPick("Secondary Accent", "Cards, backgrounds, subtle accents", cp.sky || baseP.sky, v => setCP("sky", v))}
            {cPick("Highlight Color", "Special entries, gold elements", cp.special || baseP.special, v => setCP("special", v))}
            {cPick(isPartnerWorld ? "Heart / Love Color" : "Highlight / Special", isPartnerWorld ? "Together markers, love features" : "Featured markers, special entries", cp.heart || baseP.heart, v => setCP("heart", v))}
            {cPick("Text Color", "Main text throughout the app", cp.text || baseP.text, v => setCP("text", v))}
            {cPick("Card Background", "Cards, panels, form backgrounds", cp.cream || baseP.cream, v => setCP("cream", v))}

            <div style={{ fontSize: 10, color: P.textMid, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4, marginTop: 10 }}>Globe & Scene Colors</div>
            {cPick("Space Background", "The dark sky behind the globe", cs.bg || baseSC.bg, v => setCS("bg", v), true)}
            {cPick("Globe Surface", "The globe sphere color", cs.sphereColor || baseSC.sphereColor, v => setCS("sphereColor", v), true)}
            {cPick("Glow Aura", "The halo rings around the globe", (cs.glowColors || baseSC.glowColors)[0], v => setCS("glowColors", [v, v+"e8", v+"d0", v+"b8", v+"a0", v+"88", v+"70", v+"58", v+"48", v+"38", v+"28", v+"18"]), true)}
            {cPick("Coastlines", "Country outlines on the globe", cs.coastColor || baseSC.coastColor, v => setCS("coastColor", v), true)}
            {cPick("Particles", "Floating dust particles around globe", cs.particleColor || baseSC.particleColor, v => setCS("particleColor", v), true)}
            {cPick("Stars Tint", "Background star color", cs.starTint || baseSC.starTint, v => setCS("starTint", v), true)}

            <button onClick={() => { setConfig({ customPalette: {}, customScene: {} }); }}
              style={{ marginTop: 10, width: "100%", padding: "8px", background: "transparent", border: `1px dashed ${P.textFaint}30`, borderRadius: 8, cursor: "pointer", fontSize: 10, fontFamily: "inherit", color: P.textMid, transition: "all .2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${P.rose}50`; e.currentTarget.style.color = P.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${P.textFaint}30`; e.currentTarget.style.color = P.textMid; }}>
              Reset All Colors to Default
            </button>
          </>;
        })()}

        <div style={{ margin: "14px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />
        <div style={{ fontSize: 10, color: P.textMid, letterSpacing: ".13em", textTransform: "uppercase", marginBottom: 4, fontWeight: 500 }}>{"\uD83C\uDFB5"} Ambient Music</div>
        <p style={{ fontSize: 10, color: P.textFaint, fontStyle: "italic", marginBottom: 6 }}>Paste an audio URL (.mp3, .ogg, .wav) to play background music while exploring your globe.</p>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={config.ambientMusicUrl || ""} onChange={e => setConfig({ ambientMusicUrl: e.target.value.trim() || "" })} placeholder="https://example.com/song.mp3" style={{ ...inputStyle(), flex: 1 }} />
          {config.ambientMusicUrl && <button onClick={() => { const au = ambientRef.current; if (!au) return; if (ambientPlaying) { au.pause(); } else { au.play().catch(() => {}); } }} style={{ padding: "8px 10px", background: `${P.rose}15`, border: `1px solid ${P.rose}25`, borderRadius: 10, color: P.rose, fontSize: 11, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{ambientPlaying ? "\u23F8 Stop" : "\u25B6 Test"}</button>}
        </div>
        {config.ambientMusicUrl && !/^https?:\/\/.+\..+/.test(config.ambientMusicUrl) && <div style={{ fontSize: 10, color: "#d4846a", marginTop: 4 }}>Enter a valid URL starting with https://</div>}

        <div style={{ margin: "14px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />
        <div style={{ fontSize: 10, color: P.textMid, letterSpacing: ".13em", textTransform: "uppercase", marginBottom: 4, fontWeight: 500 }}>{"\u270D\uFE0F"} Display</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
          <div>
            <div style={{ fontSize: 10, color: P.text }}>Handwritten Notes</div>
            <div style={{ fontSize: 10, color: P.textFaint }}>Show notes in cursive on lined paper</div>
          </div>
          <button onClick={() => { const next = !handwrittenMode; setHandwrittenMode(next); localStorage.setItem("cosmos_handwritten", next ? "1" : "0"); }} style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: handwrittenMode ? P.rose : P.textFaint + "40", position: "relative", transition: "background .2s" }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: handwrittenMode ? 20 : 2, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
          </button>
        </div>

        <div style={{ margin: "14px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />
        <div style={{ fontSize: 10, color: P.textMid, letterSpacing: ".13em", textTransform: "uppercase", marginBottom: 6, fontWeight: 500 }}>Timeline Chapters</div>
        <p style={{ fontSize: 10, color: P.textFaint, fontStyle: "italic", marginBottom: 8 }}>{isMyWorld ? "Name the eras of your travels" : "Name the eras of your relationship"}</p>
        {(config.chapters || []).map((ch, i) => (
          <div key={"ch-" + i} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
            <input value={ch.label} onChange={e => { const chs = [...(config.chapters || [])]; chs[i] = { ...chs[i], label: e.target.value }; setConfig({ chapters: chs }); }} style={{ ...inputStyle(), flex: 1, fontSize: 10 }} placeholder="Chapter name" />
            <input type="date" value={ch.startDate || ""} onChange={e => { const chs = [...(config.chapters || [])]; chs[i] = { ...chs[i], startDate: e.target.value }; setConfig({ chapters: chs }); }} style={{ ...inputStyle(), width: 95, fontSize: 9 }} />
            <input type="date" value={ch.endDate || ""} onChange={e => { const chs = [...(config.chapters || [])]; chs[i] = { ...chs[i], endDate: e.target.value }; setConfig({ chapters: chs }); }} style={{ ...inputStyle(), width: 95, fontSize: 9 }} />
            <button onClick={() => { const chs = (config.chapters || []).filter((_, j) => j !== i); setConfig({ chapters: chs }); }} style={{ background: "none", border: "none", color: "#c9777a", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>{"\u00D7"}</button>
          </div>
        ))}
        <button onClick={() => { setConfig({ chapters: [...(config.chapters || []), { label: "New Chapter", startDate: config.startDate, endDate: todayStr() }] }); }} style={{ width: "100%", padding: "5px", background: `${P.lavender}12`, border: `1px dashed ${P.lavender}40`, borderRadius: 5, cursor: "pointer", fontSize: 10, fontFamily: "inherit", color: P.textMid, marginBottom: 8 }}>+ Add Chapter</button>

        <div style={{ margin: "14px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />
        <div style={{ fontSize: 10, color: P.textMid, letterSpacing: ".13em", textTransform: "uppercase", marginBottom: 6, fontWeight: 500 }}>Welcome Letters</div>
        <p style={{ fontSize: 10, color: P.textFaint, fontStyle: "italic", marginBottom: 8 }}>Write a personal letter that appears when someone you invite first opens their cosmos. They'll see it once, before the globe.</p>
        {wlSent && <div style={{ fontSize: 10, color: "#7ab87a", marginBottom: 8 }}>Letter sent! They'll see it when they sign up.</div>}
        <div style={{ marginBottom: 6 }}>
          <Lbl>Recipient's Email</Lbl>
          <input type="email" value={wlEmail} onChange={e => setWlEmail(e.target.value)} placeholder="their.email@example.com" style={inputStyle()} />
        </div>
        <div style={{ marginBottom: 6 }}>
          <Lbl>Your Letter</Lbl>
          <textarea value={wlText} onChange={e => setWlText(e.target.value)} rows={5}
            placeholder={"This is our world \u2014 every place we've been, every adventure we've shared...\n\nSpin the globe. Click the hearts. This is our story.\n\nI love you."}
            style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.7 }} />
        </div>
        <button
          disabled={wlSending || !wlEmail.trim() || !wlText.trim()}
          onClick={async () => {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wlEmail.trim())) { showToast("Please enter a valid email address", "\u26A0\uFE0F", 3000); return; }
            setWlSending(true); setWlSent(false);
            try {
              const name = isMyWorld ? (config.travelerName || "Someone") : (config.youName || "Someone");
              await sendWelcomeLetter(userId, name, wlEmail.trim(), wlText.trim());
              setWlSent(true); setWlEmail(""); setWlText("");
              const letters = await getMyLetters(userId);
              setMyLetters(letters);
            } catch (err) { showToast("Couldn't send: " + err.message, "\u26A0\uFE0F", 5000); }
            setWlSending(false);
          }}
          style={{ width: "100%", padding: "10px", background: wlSending ? P.textFaint : `linear-gradient(135deg, ${P.rose}, ${P.sky})`, border: "none", borderRadius: 12, cursor: wlSending ? "wait" : "pointer", fontSize: 10, fontFamily: "inherit", color: "#fff", fontWeight: 600, opacity: (!wlEmail.trim() || !wlText.trim()) ? 0.4 : 1, letterSpacing: ".06em", boxShadow: !wlSending && wlEmail.trim() && wlText.trim() ? `0 2px 8px ${P.rose}30` : "none", transition: "all .25s" }}>
          {wlSending ? "Sending..." : "Send Welcome Letter"}
        </button>
        {myLetters.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Sent Letters</div>
            {myLetters.map(lt => (
              <div key={lt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${P.textFaint}15` }}>
                <div>
                  <div style={{ fontSize: 10, color: P.textMid }}>{lt.to_email}</div>
                  <div style={{ fontSize: 10, color: P.textFaint }}>{lt.read ? "Read" : "Unread"} {"\u00B7"} {new Date(lt.created_at).toLocaleDateString()}</div>
                </div>
                <button onClick={async () => { try { await deleteWelcomeLetter(lt.id); setMyLetters(prev => prev.filter(l => l.id !== lt.id)); } catch(err) { console.error('[deleteWelcomeLetter]', err); } }}
                  style={{ background: "none", border: "none", color: "#c9777a", cursor: "pointer", fontSize: 11 }}>x</button>
              </div>
            ))}
          </div>
        )}

        {isSharedWorld && (
          <>
            <div style={{ margin: "14px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />
            <div style={{ fontSize: 10, color: P.textMid, letterSpacing: ".13em", textTransform: "uppercase", marginBottom: 6, fontWeight: 500 }}>Members</div>
            {worldMembers.length > 0 ? (
              <div style={{ marginBottom: 8 }}>
                {worldMembers.map(m => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderBottom: `1px solid ${P.textFaint}12`, gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: P.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.display_name || "Member"}{m.user_id === userId ? " (you)" : ""}</div>
                      <div style={{ fontSize: 10, color: P.textFaint, textTransform: "uppercase", letterSpacing: ".08em" }}>{m.role}</div>
                    </div>
                    {worldRole === "owner" && m.user_id !== userId && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <select value={m.role} onChange={async (e) => {
                          const ok = await updateMemberRole(m.id, e.target.value);
                          if (ok) { const members = await getWorldMembers(worldId); setWorldMembers(members); }
                        }} style={{ padding: "2px 4px", background: `${P.parchment}`, border: `1px solid ${P.textFaint}30`, borderRadius: 4, fontSize: 10, color: P.textMid, fontFamily: "inherit" }}>
                          <option value="owner">Owner</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button onClick={() => {
                          setConfirmModal({ message: "Remove this member from the world?", onConfirm: async () => {
                            const ok = await removeWorldMember(worldId, m.id, userId);
                            if (ok) { const members = await getWorldMembers(worldId); setWorldMembers(members); }
                          }});
                        }} style={{ background: "none", border: "none", color: "#c9777a", cursor: "pointer", fontSize: 11, padding: "0 4px" }}>{"\u00D7"}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 10, color: P.textFaint, marginBottom: 8 }}>Loading members...</div>
            )}

            <div style={{ margin: "14px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />
            <div style={{ fontSize: 10, color: P.textMid, letterSpacing: ".13em", textTransform: "uppercase", marginBottom: 6, fontWeight: 500 }}>World Management</div>
            {worldRole === "owner" && (
              <button onClick={async () => {
                const newName = prompt("Rename this world:", worldName || "");
                if (!newName || !newName.trim() || newName.trim() === worldName) return;
                const ok = await updateWorld(worldId, { name: newName.trim() });
                if (ok) {
                  localStorage.setItem('activeWorldName', newName.trim());
                  window.location.reload();
                } else { showToast("Couldn't rename world", "\u26A0\uFE0F", 4000); }
              }} style={{ width: "100%", padding: "8px", background: `${P.parchment}`, border: `1px solid ${P.textFaint}30`, borderRadius: 8, cursor: "pointer", fontSize: 10, fontFamily: "inherit", color: P.textMid, marginBottom: 6, transition: "all .2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${P.rose}40`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${P.textFaint}30`; }}>
                Rename World
              </button>
            )}
            {worldRole === "owner" ? (
              <button onClick={() => {
                setConfirmModal({ message: `Are you sure you want to permanently delete "${worldName}"? This cannot be undone. All entries, photos, and settings will be lost.`, onConfirm: async () => {
                  const ok = await deleteWorld(worldId, userId);
                  if (ok) { flushConfigSave(); onClose(); onSwitchWorld(); }
                  else { showToast("Couldn't delete world.", "\u26A0\uFE0F", 4000); }
                }});
              }} style={{ width: "100%", padding: "8px", background: "transparent", border: "1px solid rgba(200,100,100,0.25)", borderRadius: 8, cursor: "pointer", fontSize: 10, fontFamily: "inherit", color: "#c97777", marginBottom: 6, transition: "all .2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(200,100,100,0.5)"; e.currentTarget.style.background = "rgba(200,100,100,0.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(200,100,100,0.25)"; e.currentTarget.style.background = "transparent"; }}>
                Delete World
              </button>
            ) : (
              <button onClick={() => {
                setConfirmModal({ message: `Leave "${worldName}"? You'll lose access to this world.`, onConfirm: async () => {
                  const ok = await leaveWorld(worldId, userId);
                  if (ok) { flushConfigSave(); onClose(); onSwitchWorld(); }
                  else { showToast("Couldn't leave world.", "\u26A0\uFE0F", 4000); }
                }});
              }} style={{ width: "100%", padding: "8px", background: "transparent", border: "1px solid rgba(200,160,100,0.25)", borderRadius: 8, cursor: "pointer", fontSize: 10, fontFamily: "inherit", color: "#c9a077", marginBottom: 6, transition: "all .2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(200,160,100,0.5)"; e.currentTarget.style.background = "rgba(200,160,100,0.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(200,160,100,0.25)"; e.currentTarget.style.background = "transparent"; }}>
                Leave World
              </button>
            )}
          </>
        )}

        <div style={{ margin: "14px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />
        <button onClick={() => { onClose(); setShowOnboarding(true); setOnboardStep(0); localStorage.removeItem(onboardKey); }}
          style={{ width: "100%", padding: "8px", background: "transparent", border: `1px dashed ${P.textFaint}30`, borderRadius: 8, cursor: "pointer", fontSize: 10, fontFamily: "inherit", color: P.textMid, transition: "all .2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = `${P.rose}40`; e.currentTarget.style.color = P.text; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = `${P.textFaint}30`; e.currentTarget.style.color = P.textMid; }}>
          Replay Tour
        </button>

        <div style={{ margin: "10px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />
        <div style={{ fontSize: 10, color: P.textFaint, letterSpacing: ".13em", textTransform: "uppercase", marginBottom: 6 }}>Data</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={exportData} style={{ flex: 1, padding: "9px", background: `linear-gradient(145deg, ${P.parchment}, ${P.cream})`, border: `1px solid ${P.rose}18`, borderRadius: 10, cursor: "pointer", fontSize: 10, fontFamily: "inherit", color: P.textMid, transition: "all .2s", boxShadow: `0 1px 3px ${P.text}04` }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 2px 8px ${P.text}08`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 1px 3px ${P.text}04`; }}>{"\uD83D\uDCE5"} Export Backup</button>
          <button onClick={importData} style={{ flex: 1, padding: "9px", background: `linear-gradient(145deg, ${P.parchment}, ${P.cream})`, border: `1px solid ${P.sky}18`, borderRadius: 10, cursor: "pointer", fontSize: 10, fontFamily: "inherit", color: P.textMid, transition: "all .2s", boxShadow: `0 1px 3px ${P.text}04` }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 2px 8px ${P.text}08`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 1px 3px ${P.text}04`; }}>{"\uD83D\uDCE4"} Import Data</button>
        </div>
        <div style={{ fontSize: 10, color: P.textFaint, fontStyle: "italic", marginBottom: 8 }}>Export saves all entries, photos, and settings as a JSON file</div>

        <button onClick={handleClose} style={{ width: "100%", padding: "11px", background: `linear-gradient(135deg, ${P.rose}, ${P.sky})`, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 11, fontFamily: "inherit", marginTop: 8, letterSpacing: ".06em", boxShadow: `0 2px 8px ${P.rose}30, 0 4px 16px ${P.rose}15`, transition: "all .25s" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${P.rose}40, 0 8px 24px ${P.rose}20`; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 2px 8px ${P.rose}30, 0 4px 16px ${P.rose}15`; }}>Done</button>
        <div style={{ marginTop: 12, textAlign: "center", fontSize: 10, color: P.textFaint, opacity: 0.5, letterSpacing: ".1em" }}>Little Cosmos v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '9.0'}</div>
      </div>
    </div>
  );
}
