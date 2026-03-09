import { useState } from "react";
import { useTheme } from "./ThemeProvider.jsx";

/* =================================================================
   ThemeToggle — compact sun/moon toggle for the toolbar

   Props:
     palette — P colors object (for styling consistency)
   ================================================================= */

function ThemeToggle({ palette }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const [hov, setHov] = useState(false);

  const P = palette || {};
  const accent = P.rose || "#c48aa8";
  const textColor = isDark ? "#e8e4f0" : (P.textMid || "#584c6e");
  const borderColor = isDark ? "rgba(232,228,240,0.12)" : (P.textFaint || "#b8aec8") + "25";
  const bgColor = isDark ? "rgba(30,28,40,0.92)" : (P.glass || "rgba(248,244,240,0.92)");

  // Label for accessibility & tooltip
  const label = theme === "auto" ? "Auto" : isDark ? "Dark" : "Light";

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <button
        onClick={toggleTheme}
        aria-label={`Theme: ${label}. Click to toggle.`}
        title={`Theme: ${label}`}
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          border: `1px solid ${borderColor}`,
          background: bgColor,
          backdropFilter: "blur(12px)",
          cursor: "pointer",
          fontSize: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.3s ease",
          fontFamily: "inherit",
          color: textColor,
          boxShadow: hov
            ? `0 4px 16px ${isDark ? "rgba(0,0,0,0.3)" : "rgba(61,53,82,0.12)"}, 0 1px 3px rgba(0,0,0,0.08)`
            : `0 1px 4px ${isDark ? "rgba(0,0,0,0.2)" : "rgba(61,53,82,0.06)"}`,
          transform: hov ? "translateY(-1px)" : "none",
          position: "relative",
          overflow: "hidden",
          padding: 0,
          lineHeight: 1,
        }}
      >
        {/* Icon container with rotation transition */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
            transform: isDark ? "rotate(0deg)" : "rotate(360deg)",
            width: "100%",
            height: "100%",
          }}
        >
          {theme === "auto" ? (
            // Half sun / half moon for auto mode
            <span style={{ position: "relative", fontSize: 14, lineHeight: 1 }}>
              <span style={{ opacity: 0.8 }}>{"\u25D0"}</span>
            </span>
          ) : isDark ? (
            // Moon for dark mode
            <span style={{ fontSize: 15, lineHeight: 1 }}>{"\u263E"}</span>
          ) : (
            // Sun for light mode
            <span style={{ fontSize: 15, lineHeight: 1 }}>{"\u2600"}</span>
          )}
        </span>
      </button>
    </div>
  );
}

export { ThemeToggle };
