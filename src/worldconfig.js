/* worldConfigs.js — palette, types, and defaults for each world mode */

// ============================================================
//  OUR WORLD — rose / lavender / ethereal
// ============================================================

export const OUR_WORLD_PALETTE = {
  cream: "#faf8f4", warm: "#fef9f4", parchment: "#f5f1ea",
  blush: "#fdf2f4", lavMist: "#f3f0ff",
  text: "#3d3552", textMid: "#6b5e7e", textMuted: "#958ba8", textFaint: "#c4bbd4",
  rose: "#d4a0b9", roseLight: "#f0d4e4", roseSoft: "#e8c0d4",
  sky: "#9bb5d6", skyLight: "#c8daf0", skySoft: "#b0c8e0",
  sage: "#a8bf94", gold: "#d4b078", goldWarm: "#e8c88a", lavender: "#b8a5cc",
  together: "#c4a8e0", togetherSoft: "#d8c4f0", togetherLight: "#ece0f8",
  heart: "#e07a9a", heartSoft: "#f0a0b8",
  special: "#dfc090", specialSoft: "#eedbb0",
  card: "rgba(253,251,247,0.96)", glass: "rgba(250,248,244,0.92)",
  warmMist: "#f5ece6",
};

export const OUR_WORLD_TYPES = {
  "home-seth":  { label: "Seth's Home",      icon: "\u{1F3E1}", color: "sky",      who: "seth",  symbol: "home-seth" },
  "home-rosie": { label: "Rosie's Home",     icon: "\u{1F339}", color: "rose",     who: "rosie", symbol: "home-rosie" },
  "seth-solo":  { label: "Seth Traveling",    icon: "\u{1F9ED}", color: "skySoft",  who: "seth",  symbol: "seth-solo" },
  "rosie-solo": { label: "Rosie Traveling",   icon: "\u{1F339}", color: "roseSoft", who: "rosie", symbol: "rosie-solo" },
  together:     { label: "Together",          icon: "\u{1F495}", color: "together", who: "both",  symbol: "together" },
  special:      { label: "Special Moment",    icon: "\u2728",    color: "special",  who: "both",  symbol: "special" },
};

export const OUR_WORLD_DEFAULT_CONFIG = {
  startDate: "2021-06-01",
  title: "Our World",
  subtitle: "every moment, every adventure",
  loveLetter: "",
  loveLetters: [],
  youName: "Seth",
  partnerName: "Rosie Posie",
  chapters: [],
  dreamDestinations: [],
  darkMode: false,
};

// Our World sub-field labels for detail card
export const OUR_WORLD_FIELDS = {
  memories:    { label: "Memories",          icon: "\u{1F4AB}" },
  highlights:  { label: "Highlights",        icon: "\u2728" },
  museums:     { label: "Museums & Culture", icon: "\u{1F3DB}" },
  restaurants: { label: "Restaurants & Food",icon: "\u{1F37D}" },
};

// ============================================================
//  MY WORLD — sage / amber / earth tones / natural
// ============================================================

export const MY_WORLD_PALETTE = {
  cream: "#f5f2eb", warm: "#f8f4ec", parchment: "#ede8dd",
  blush: "#f0ebe0", lavMist: "#e8e5d4",
  text: "#2e2c22", textMid: "#5c5840", textMuted: "#8a8468", textFaint: "#b5af94",
  rose: "#c4a46c",       // amber as primary accent
  roseLight: "#dccca0", roseSoft: "#d0b888",
  sky: "#7a9a6e",        // moss-sage as secondary
  skyLight: "#a4c098", skySoft: "#8cb080",
  sage: "#7a9a6e", gold: "#c4a048", goldWarm: "#d8b460", lavender: "#a89878",
  together: "#8aaa6e", togetherSoft: "#a8c490", togetherLight: "#c8dab0",
  heart: "#c09050", heartSoft: "#d0a868",
  special: "#c8a848", specialSoft: "#d8c078",
  card: "rgba(248,244,236,0.96)", glass: "rgba(244,240,232,0.92)",
  warmMist: "#e8e0d0",
};

export const MY_WORLD_TYPES = {
  travel:   { label: "Travel",       icon: "\u2708\uFE0F", color: "sky",      who: "solo", symbol: "compass" },
  solo:     { label: "Solo",         icon: "\u{1F9ED}",    color: "sage",     who: "solo", symbol: "diamond" },
  friends:  { label: "With Friends", icon: "\u{1F46B}",    color: "together", who: "solo", symbol: "triangle-group" },
  event:    { label: "Event",        icon: "\u{1F3AA}",    color: "special",  who: "solo", symbol: "burst" },
  work:     { label: "Work",         icon: "\u{1F4BC}",    color: "gold",     who: "solo", symbol: "briefcase" },
  home:     { label: "Home Base",    icon: "\u{1F3E0}",    color: "rose",     who: "solo", symbol: "house" },
};

export const MY_WORLD_DEFAULT_CONFIG = {
  startDate: "",
  title: "My World",
  subtitle: "every step, every discovery",
  travelerName: "Explorer",
  chapters: [],
  bucketList: [],
  darkMode: false,
};

// My World sub-field labels for detail card
export const MY_WORLD_FIELDS = {
  memories:    { label: "Adventures",        icon: "\u26F0\uFE0F" },
  highlights:  { label: "Nature",            icon: "\u{1F33F}" },
  museums:     { label: "Culture",           icon: "\u{1F3DB}" },
  restaurants: { label: "Food & Drink",      icon: "\u{1F37C}" },
};

// ============================================================
//  SCENE THEMING — Three.js colors per world
// ============================================================

export const OUR_WORLD_SCENE = {
  bg: "#161028",
  fog: "#161028",
  sphereColor: "#e8d8f0",
  sphereEmissive: "#5a2878",
  ambientColor: "#fff0f8",
  sunColor: "#ffe8f0",
  fillColor: "#f0d8f5",
  rimColor: "#f0a0c8",
  bottomColor: "#d8b8f0",
  glowColors: ["#d8a0f0", "#e0b8f8", "#f0d0ff", "#f8e0ff", "#fce8ff", "#fef0ff", "#fff4ff", "#fff8ff"],
  landColors: ["#e0b0d0", "#d8b0e0", "#e0c0d8", "#d0b8d8", "#e8c0e0"],
  particleColor: "#f0a0c8",
  particleColor2: "#d0b0e8",
  starTint: "#f8d0e0",
  coastColor: "#70b850",
};

export const MY_WORLD_SCENE = {
  bg: "#0c1a08",
  fog: "#0c1a08",
  sphereColor: "#c8d8b0",
  sphereEmissive: "#1a3010",
  ambientColor: "#f8f0e0",
  sunColor: "#f8e8d0",
  fillColor: "#d8e0c0",
  rimColor: "#c0a868",
  bottomColor: "#a8c090",
  glowColors: ["#90b868", "#a0c478", "#b0d088", "#c0d898", "#c8e0a8", "#d0e4b0", "#d8e8b8", "#e0ecc0"],
  landColors: ["#a0b878", "#90a868", "#b0c090", "#a8b480", "#98a870"],
  particleColor: "#b0c070",
  particleColor2: "#c8b060",
  starTint: "#e0d8a0",
  coastColor: "#6aaa48",
};

// ============================================================
//  SEASONAL TINTING per world
// ============================================================

export function getSeasonalHue(dateStr, isMyWorld) {
  if (!dateStr) return isMyWorld
    ? { glow: "#a0b868", particle: "#90a050" }
    : { glow: "#f0c8e0", particle: "#f0a0c0" };

  const m = new Date(dateStr + "T12:00:00").getMonth();

  if (isMyWorld) {
    // Earth-tone seasons
    if (m >= 4 && m <= 7)  return { glow: "#90c060", particle: "#80a848" }; // summer: lush green
    if (m >= 8 && m <= 10) return { glow: "#c8a050", particle: "#b89040" }; // autumn: amber
    if (m >= 11 || m <= 1) return { glow: "#88a878", particle: "#789868" }; // winter: muted sage
    return { glow: "#a0c468", particle: "#90b458" };                        // spring: fresh green
  }

  // Our World: rose/lavender seasons (original)
  if (m >= 4 && m <= 7)  return { glow: "#f0c8e0", particle: "#f0a0c0" }; // summer: warm rose
  if (m >= 8 && m <= 0)  return { glow: "#d0c0f0", particle: "#c0a8e0" }; // winter: lavender frost
  return { glow: "#f0d0e8", particle: "#e8b0d0" };                        // spring/fall: blush
}

// ============================================================
//  HELPERS
// ============================================================

// Resolve type color keys to actual hex from palette
export function resolveTypes(types, palette) {
  const resolved = {};
  for (const [k, v] of Object.entries(types)) {
    resolved[k] = { ...v, color: palette[v.color] || v.color };
  }
  return resolved;
}
