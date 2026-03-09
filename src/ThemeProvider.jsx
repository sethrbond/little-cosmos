import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

/* =================================================================
   ThemeProvider — dark mode / theme toggle system for My Cosmos

   Provides: { theme, isDark, toggleTheme, setTheme }
     - theme: 'auto' | 'light' | 'dark'
     - isDark: resolved boolean (auto resolves via matchMedia)
     - toggleTheme: cycles light -> dark -> auto -> light
     - setTheme: set directly to 'auto' | 'light' | 'dark'
   ================================================================= */

const STORAGE_KEY = "cosmos_theme";

const ThemeContext = createContext({
  theme: "light",
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

function useTheme() {
  return useContext(ThemeContext);
}

// -------------------------------------------------------------------
//  Dark palette overrides — keyed by the same palette property names
//  used throughout the app. These get merged over the base palette
//  when dark mode is active: { ...basePalette, ...DARK_OVERRIDES }
// -------------------------------------------------------------------
const DARK_OVERRIDES = {
  // Backgrounds
  cream:     "#1a1824",
  warm:      "#1e1c28",
  parchment: "#24222e",
  blush:     "#201e2a",
  lavMist:   "#1c1a26",
  warmMist:  "#28262e",

  // Text
  text:      "#e8e4f0",
  textMid:   "#c4bcd4",
  textMuted: "#988eac",
  textFaint: "#6c6480",

  // Cards & glass
  card:      "rgba(30,28,40,0.96)",
  glass:     "rgba(26,24,36,0.92)",
};

// Per-world dark overrides — subtle tinting to keep world identity
const DARK_OVERRIDES_MY_WORLD = {
  ...DARK_OVERRIDES,
  cream:     "#181c20",
  warm:      "#1c2024",
  parchment: "#22262c",
  blush:     "#1e2228",
  lavMist:   "#1a1e24",
  warmMist:  "#262a2e",
  card:      "rgba(28,32,38,0.96)",
  glass:     "rgba(24,28,34,0.92)",
};

function getDarkOverrides(worldMode, worldType) {
  if (worldMode === "my" || worldMode === "friend") return DARK_OVERRIDES_MY_WORLD;
  // All shared worlds and Our World use the default dark overrides
  return DARK_OVERRIDES;
}

// -------------------------------------------------------------------
//  Provider component
// -------------------------------------------------------------------
function ThemeProvider({ children, onConfigDarkMode }) {
  const [theme, setThemeRaw] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light" || stored === "auto") return stored;
    } catch {}
    return "light";
  });

  const [systemDark, setSystemDark] = useState(() => {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  // Listen for system preference changes
  useEffect(() => {
    let mql;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const handler = (e) => setSystemDark(e.matches);
    if (mql.addEventListener) {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    // Fallback for older browsers
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

  const isDark = theme === "dark" || (theme === "auto" && systemDark);

  const setTheme = useCallback((val) => {
    if (val !== "auto" && val !== "light" && val !== "dark") return;
    setThemeRaw(val);
    try { localStorage.setItem(STORAGE_KEY, val); } catch {}
    // If caller provided a config persistence callback, fire it
    if (onConfigDarkMode) {
      onConfigDarkMode(val === "dark" ? true : val === "auto" ? "auto" : false);
    }
  }, [onConfigDarkMode]);

  const toggleTheme = useCallback(() => {
    setThemeRaw((prev) => {
      const next = prev === "light" ? "dark" : prev === "dark" ? "auto" : "light";
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      if (onConfigDarkMode) {
        onConfigDarkMode(next === "dark" ? true : next === "auto" ? "auto" : false);
      }
      return next;
    });
  }, [onConfigDarkMode]);

  const value = useMemo(() => ({
    theme,
    isDark,
    toggleTheme,
    setTheme,
  }), [theme, isDark, toggleTheme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export {
  ThemeContext,
  ThemeProvider,
  useTheme,
  getDarkOverrides,
  DARK_OVERRIDES,
  DARK_OVERRIDES_MY_WORLD,
};
