import { useEffect } from "react";

/* =================================================================
   KeyboardShortcuts — full-screen overlay listing all keyboard
   shortcuts for the My Cosmos travel app.

   Props:
     onClose    — function to call when the overlay should close
     palette    — P color object (world-mode aware)
     worldMode  — "my" | "our" | "friends" | "family" | etc.

   The "?" key toggle is handled inside OurWorld.jsx (line ~1833).
   This component listens for Escape to close itself.
   ================================================================= */

const FADE_IN_KEYFRAMES = `
@keyframes ks_fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes ks_slideUp {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
`;

function KeyboardShortcuts({ onClose, palette: P, worldMode }) {
  const isPartnerWorld = worldMode === "our" || worldMode === "partner";

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

  const categories = [
    {
      title: "Navigation",
      shortcuts: [
        { keys: ["\u2190"], desc: "Step back one day" },
        { keys: ["\u2192"], desc: "Step forward one day" },
        { keys: ["Scroll"], desc: "Zoom in / out" },
      ],
    },
    {
      title: "Playback",
      shortcuts: [
        { keys: ["Space"], desc: isPartnerWorld ? "Play Our Story" : "Play Story" },
        { keys: ["R"], desc: "Surprise Me (random entry)" },
      ],
    },
    {
      title: "Panels",
      shortcuts: [
        { keys: ["F"], desc: "Toggle filter panel" },
        { keys: ["S"], desc: "Open search" },
        { keys: ["G"], desc: "Toggle scrapbook" },
        { keys: ["I"], desc: "Toggle stats" },
        { keys: ["T"], desc: "Jump to today" },
        { keys: ["P"], desc: "Save globe screenshot" },
        { keys: ["⌘Z"], desc: "Undo last action" },
        { keys: ["⌘⇧Z"], desc: "Redo" },
      ],
    },
    {
      title: "Search",
      shortcuts: [
        { keys: ["\u2191", "\u2193"], desc: "Navigate results" },
        { keys: ["Enter"], desc: "Go to selected result" },
      ],
    },
    {
      title: "General",
      shortcuts: [
        { keys: ["?"], desc: "Show / hide this help" },
        { keys: ["Esc"], desc: "Close any open panel" },
      ],
    },
  ];

  // ---- styles ----

  const backdrop = {
    position: "fixed",
    inset: 0,
    zIndex: 190,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "ks_fadeIn .25s ease",
  };

  const card = {
    position: "relative",
    background: P.card || "rgba(252,249,246,0.97)",
    borderRadius: 18,
    padding: "28px 30px 22px",
    maxWidth: 380,
    width: "92%",
    maxHeight: "80vh",
    overflowY: "auto",
    boxShadow: `0 16px 64px rgba(0,0,0,0.25), 0 0 0 1px ${P.rose || "#c48aa8"}12`,
    border: `1px solid ${P.rose || "#c48aa8"}18`,
    animation: "ks_slideUp .3s ease",
  };

  const closeBtn = {
    position: "absolute",
    top: 14,
    right: 16,
    background: "none",
    border: "none",
    fontSize: 20,
    color: P.textFaint || "#b8aec8",
    cursor: "pointer",
    lineHeight: 1,
    padding: "4px 6px",
    borderRadius: 6,
    transition: "color .15s",
  };

  const titleStyle = {
    fontSize: 15,
    fontWeight: 700,
    color: P.text || "#2e2440",
    letterSpacing: ".06em",
    marginBottom: 20,
  };

  const catLabel = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".12em",
    color: P.rose || "#c48aa8",
    marginBottom: 6,
    marginTop: 16,
  };

  const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "7px 0",
    borderBottom: `1px solid ${P.textFaint || "#b8aec8"}0c`,
  };

  const descStyle = {
    fontSize: 12,
    color: P.textMuted || "#8878a0",
    flex: 1,
  };

  const kbdBase = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: 11,
    fontWeight: 600,
    minWidth: 28,
    padding: "3px 8px",
    borderRadius: 5,
    color: P.textMid || "#584c6e",
    background: `linear-gradient(180deg, ${P.parchment || "#f3ede8"} 0%, ${P.warmMist || "#f0e6de"} 100%)`,
    border: `1px solid ${P.textFaint || "#b8aec8"}30`,
    boxShadow: `0 2px 0 ${P.textFaint || "#b8aec8"}28, inset 0 1px 0 rgba(255,255,255,0.5)`,
    letterSpacing: ".04em",
    lineHeight: 1.3,
    marginLeft: 4,
  };

  const keysWrap = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  };

  const plusSign = {
    fontSize: 10,
    color: P.textFaint || "#b8aec8",
  };

  return (
    <>
      <style>{FADE_IN_KEYFRAMES}</style>
      <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" style={backdrop} onClick={onClose}>
        <div style={card} onClick={(e) => e.stopPropagation()}>
          <button
            style={closeBtn}
            onClick={onClose}
            onMouseEnter={(e) => (e.target.style.color = P.text || "#2e2440")}
            onMouseLeave={(e) => (e.target.style.color = P.textFaint || "#b8aec8")}
            aria-label="Close shortcuts"
          >
            &times;
          </button>

          <div style={titleStyle}>Keyboard Shortcuts</div>

          {categories.map((cat, ci) => (
            <div key={cat.title}>
              <div style={{ ...catLabel, marginTop: ci === 0 ? 0 : 16 }}>
                {cat.title}
              </div>
              {cat.shortcuts.map(({ keys, desc }) => (
                <div key={desc} style={rowStyle}>
                  <span style={descStyle}>{desc}</span>
                  <div style={keysWrap}>
                    {keys.map((k, ki) => (
                      <span key={ki}>
                        {ki > 0 && <span style={plusSign}>/</span>}
                        <kbd style={kbdBase}>{k}</kbd>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div
            style={{
              marginTop: 20,
              paddingTop: 12,
              borderTop: `1px solid ${P.textFaint || "#b8aec8"}14`,
              fontSize: 10,
              color: P.textFaint || "#b8aec8",
              textAlign: "center",
              letterSpacing: ".04em",
            }}
          >
            Shortcuts are disabled while typing in a form field
          </div>
        </div>
      </div>
    </>
  );
}

export default KeyboardShortcuts;
