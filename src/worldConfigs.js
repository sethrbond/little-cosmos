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

export const OUR_WORLD_FIELDS = {
  memories:    { label: "Memories",          icon: "\u{1F4AB}" },
  highlights:  { label: "Highlights",        icon: "\u2728" },
  museums:     { label: "Museums & Culture", icon: "\u{1F3DB}" },
  restaurants: { label: "Restaurants & Food",icon: "\u{1F37D}" },
};

// ============================================================
//  MY WORLD — warm earth / leather / campfire / pine dusk
//  NOT swamp green. Think: worn leather journal, sandstone,
//  warm slate, amber firelight, deep forest at golden hour.
// ============================================================

export const MY_WORLD_PALETTE = {
  cream: "#f4f0e8", warm: "#f6f0e4", parchment: "#eae4d8",
  blush: "#ede6da", lavMist: "#e4ddd0",
  text: "#2c2822", textMid: "#5c5448", textMuted: "#8a7e6c", textFaint: "#b0a690",
  rose: "#c4a068",       // warm amber
  roseLight: "#d8c498", roseSoft: "#ccb480",
  sky: "#8a9a78",        // sage (muted, not vivid)
  skyLight: "#a8b498", skySoft: "#96a688",
  sage: "#8a9a78", gold: "#c4a048", goldWarm: "#d8b460", lavender: "#a89480",
  together: "#98a880", togetherSoft: "#b0be98", togetherLight: "#c8d4b0",
  heart: "#b88850", heartSoft: "#c8a068",
  special: "#c8a040", specialSoft: "#d8b868",
  card: "rgba(244,240,232,0.96)", glass: "rgba(240,236,228,0.92)",
  warmMist: "#e0d8c8",
};

export const MY_WORLD_TYPES = {
  adventure:  { label: "Adventure",       icon: "\u26F0\uFE0F",  color: "sage",     who: "solo", symbol: "compass" },
  "road-trip":{ label: "Road Trip",       icon: "\u{1F697}",     color: "gold",     who: "solo", symbol: "diamond" },
  city:       { label: "City Break",      icon: "\u{1F3D9}\uFE0F",color: "sky",     who: "solo", symbol: "burst" },
  beach:      { label: "Beach & Coast",   icon: "\u{1F3D6}\uFE0F",color: "skyLight",who: "solo", symbol: "compass" },
  cruise:     { label: "Cruise & Sailing",icon: "\u26F5",         color: "skySoft",  who: "solo", symbol: "diamond" },
  backpacking:{ label: "Backpacking",     icon: "\u{1F392}",     color: "together", who: "solo", symbol: "triangle-group" },
  friends:    { label: "With Friends",    icon: "\u{1F46B}",     color: "together", who: "solo", symbol: "triangle-group" },
  family:     { label: "With Family",     icon: "\u{1F46A}",     color: "heart",    who: "solo", symbol: "house" },
  event:      { label: "Event & Festival",icon: "\u{1F3AA}",     color: "special",  who: "solo", symbol: "burst" },
  nature:     { label: "Nature & Wildlife",icon: "\u{1F332}",    color: "sage",     who: "solo", symbol: "compass" },
  work:       { label: "Work & Business", icon: "\u{1F4BC}",     color: "gold",     who: "solo", symbol: "briefcase" },
  home:       { label: "Home Base",       icon: "\u{1F3E0}",     color: "rose",     who: "solo", symbol: "house" },
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

export const MY_WORLD_FIELDS = {
  memories:    { label: "Adventures",        icon: "\u26F0\uFE0F" },
  highlights:  { label: "Nature & Outdoors", icon: "\u{1F33F}" },
  museums:     { label: "Culture",           icon: "\u{1F3DB}" },
  restaurants: { label: "Food & Drink",      icon: "\u{1F37A}" },
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

// Warm earth — dark charcoal-brown space, sandstone globe, amber glow
export const MY_WORLD_SCENE = {
  bg: "#120e0a",
  fog: "#120e0a",
  sphereColor: "#c8b898",
  sphereEmissive: "#2a1e10",
  ambientColor: "#f0e8d8",
  sunColor: "#f8e8d0",
  fillColor: "#e0d4c0",
  rimColor: "#c8a060",
  bottomColor: "#a09070",
  glowColors: ["#c8a870", "#d0b480", "#d8c090", "#e0c8a0", "#e4d0a8", "#e8d4b0", "#ecd8b8", "#f0dcc0"],
  landColors: ["#a09878", "#988e70", "#a8a080", "#9c9478", "#948c68"],
  particleColor: "#c8a868",
  particleColor2: "#b09858",
  starTint: "#e8d8b0",
  coastColor: "#6a8850",
};

// ============================================================
//  SEASONAL TINTING per world
// ============================================================

export function getSeasonalHue(dateStr, isMyWorld) {
  if (!dateStr) return isMyWorld
    ? { glow: "#c8a868", particle: "#b09850" }
    : { glow: "#f0c8e0", particle: "#f0a0c0" };

  const m = new Date(dateStr + "T12:00:00").getMonth();

  if (isMyWorld) {
    if (m >= 4 && m <= 7)  return { glow: "#a8b070", particle: "#90a058" }; // summer: warm sage
    if (m >= 8 && m <= 10) return { glow: "#c8a050", particle: "#b89040" }; // autumn: amber gold
    if (m >= 11 || m <= 1) return { glow: "#988870", particle: "#887868" }; // winter: warm slate
    return { glow: "#a0a868", particle: "#909858" };                        // spring: fresh sage
  }

  if (m >= 4 && m <= 7)  return { glow: "#f0c8e0", particle: "#f0a0c0" };
  if (m >= 8 && m <= 0)  return { glow: "#d0c0f0", particle: "#c0a8e0" };
  return { glow: "#f0d0e8", particle: "#e8b0d0" };
}

// ============================================================
//  HELPERS
// ============================================================

export function resolveTypes(types, palette) {
  const resolved = {};
  for (const [k, v] of Object.entries(types)) {
    resolved[k] = { ...v, color: palette[v.color] || v.color };
  }
  return resolved;
}
