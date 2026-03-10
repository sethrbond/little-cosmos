/* worldConfigs.js — palette, types, and defaults for each world mode */

// ============================================================
//  OUR WORLD — rose / lavender / ethereal
// ============================================================

export const OUR_WORLD_PALETTE = {
  cream: "#faf7f5", warm: "#fdf8f5", parchment: "#f3ede8",
  blush: "#faf0f2", lavMist: "#f1edf8",
  text: "#2e2440", textMid: "#584c6e", textMuted: "#7a6a94", textFaint: "#b8aec8",
  rose: "#c48aa8", roseLight: "#e4c0d4", roseSoft: "#d8a8c0",
  sky: "#8ca8c8", skyLight: "#b8d0e8", skySoft: "#a0bcd8",
  sage: "#90b080", gold: "#c8a060", goldWarm: "#dab470", lavender: "#a898c0",
  together: "#b898d0", togetherSoft: "#d0b8e4", togetherLight: "#e6d8f2",
  heart: "#d06888", heartSoft: "#e890a8",
  special: "#d0a870", specialSoft: "#e0c090",
  card: "rgba(252,249,246,0.96)", glass: "rgba(248,244,240,0.92)",
  warmMist: "#f0e6de",
};

export const OUR_WORLD_TYPES = {
  "home-seth":  { label: "Your Home",         icon: "\u{1F3E1}", color: "sky",      who: "seth",  symbol: "home-seth" },
  "home-rosie": { label: "Partner's Home",   icon: "\u{1F339}", color: "rose",     who: "rosie", symbol: "home-rosie" },
  "seth-solo":  { label: "You Traveling",    icon: "\u{1F9ED}", color: "skySoft",  who: "seth",  symbol: "seth-solo" },
  "rosie-solo": { label: "Partner Traveling",icon: "\u{1F339}", color: "roseSoft", who: "rosie", symbol: "rosie-solo" },
  together:     { label: "Together",          icon: "\u{1F495}", color: "together", who: "both",  symbol: "together" },
  special:      { label: "Special Moment",    icon: "\u2728",    color: "special",  who: "both",  symbol: "special" },
};

export const OUR_WORLD_DEFAULT_CONFIG = {
  startDate: "",
  title: "Our World",
  subtitle: "every moment, every adventure",
  loveLetter: "",
  loveLetters: [],
  youName: "",
  partnerName: "",
  chapters: [],
  dreamDestinations: [],
  darkMode: false,
  customPalette: {},
  customScene: {},
};

export const OUR_WORLD_FIELDS = {
  memories:    { label: "Memories",          icon: "\u{1F4AB}" },
  highlights:  { label: "Highlights",        icon: "\u2728" },
  museums:     { label: "Museums & Culture", icon: "\u{1F3DB}" },
  restaurants: { label: "Restaurants & Food",icon: "\u{1F37D}" },
};

// ============================================================
//  MY WORLD — blue-slate sky / earthy ground / pine coast
//  Orb is blue-ish. Globe scene is warm earth tones with
//  tan/sandstone land, green coastlines, blue-tinged space.
// ============================================================

export const MY_WORLD_PALETTE = {
  cream: "#f5f2ee", warm: "#f8f4ee", parchment: "#ece6de",
  blush: "#ede8e0", lavMist: "#e4e0d8",
  text: "#24222c", textMid: "#484450", textMuted: "#6c6876", textFaint: "#a09ca8",
  rose: "#b89058",       // warm amber accent (richer, deeper)
  roseLight: "#d0b080", roseSoft: "#c4a070",
  sky: "#6888a4",        // deeper slate blue
  skyLight: "#88a8c0", skySoft: "#7898b0",
  sage: "#688c5c", gold: "#b89040", goldWarm: "#cca450", lavender: "#887890",
  together: "#7c9488", togetherSoft: "#98b0a4", togetherLight: "#b4c8bc",
  heart: "#a07038", heartSoft: "#b88850",
  special: "#b89038", specialSoft: "#ccaa50",
  card: "rgba(244,240,234,0.96)", glass: "rgba(240,236,228,0.92)",
  warmMist: "#d8cec0",
};

export const MY_WORLD_TYPES = {
  adventure:  { label: "Adventure",        icon: "\u26F0\uFE0F",  color: "sage",     who: "solo", symbol: "compass" },
  "road-trip":{ label: "Road Trip",        icon: "\u{1F697}",     color: "gold",     who: "solo", symbol: "car" },
  city:       { label: "City Break",       icon: "\u{1F3D9}\uFE0F",color: "sky",     who: "solo", symbol: "burst" },
  beach:      { label: "Beach & Coast",    icon: "\u{1F3D6}\uFE0F",color: "skyLight",who: "solo", symbol: "wave" },
  cruise:     { label: "Cruise & Sailing", icon: "\u26F5",         color: "skySoft",  who: "solo", symbol: "anchor" },
  backpacking:{ label: "Backpacking",      icon: "\u{1F392}",     color: "together", who: "solo", symbol: "backpack" },
  friends:    { label: "With Friends",     icon: "\u{1F46B}",     color: "together", who: "solo", symbol: "people" },
  family:     { label: "With Family",      icon: "\u{1F46A}",     color: "heart",    who: "solo", symbol: "people" },
  event:      { label: "Event & Festival", icon: "\u{1F3AA}",     color: "special",  who: "solo", symbol: "tent" },
  nature:     { label: "Nature & Wildlife",icon: "\u{1F332}",     color: "sage",     who: "solo", symbol: "mountain" },
  work:       { label: "Work & Business",  icon: "\u{1F4BC}",     color: "gold",     who: "solo", symbol: "briefcase" },
  home:       { label: "Home Base",        icon: "\u{1F3E0}",     color: "rose",     who: "solo", symbol: "house" },
};

export const MY_WORLD_DEFAULT_CONFIG = {
  startDate: "",
  title: "My World",
  subtitle: "",
  travelerName: "Explorer",
  chapters: [],
  dreamDestinations: [],
  darkMode: false,
  customPalette: {},
  customScene: {},
};

export const MY_WORLD_FIELDS = {
  memories:    { label: "Adventures",        icon: "\u26F0\uFE0F" },
  highlights:  { label: "Nature & Outdoors", icon: "\u{1F33F}" },
  museums:     { label: "Culture",           icon: "\u{1F3DB}" },
  restaurants: { label: "Food & Drink",      icon: "\u{1F37A}" },
};

// ============================================================
//  SHARED WORLD TYPE PALETTES
// ============================================================

// Partner shared worlds — rose/lavender (same as Our World)
export const PARTNER_PALETTE = OUR_WORLD_PALETTE;

// Friends shared worlds — deep sapphire / burnished gold (premium social)
export const FRIENDS_PALETTE = {
  cream: "#f5f4fa", warm: "#f7f5fc", parchment: "#eceaf6",
  blush: "#f2eef8", lavMist: "#eceef8",
  text: "#1c1c34", textMid: "#3c3c5c", textMuted: "#6c6c8c", textFaint: "#9c9cb8",
  rose: "#5b6abf",       // deep sapphire accent
  roseLight: "#8890d8", roseSoft: "#7078cc",
  sky: "#c89640",        // burnished gold secondary
  skyLight: "#ddb460", skySoft: "#d4a850",
  sage: "#6c9478", gold: "#bfa040", goldWarm: "#d4b450", lavender: "#8888b0",
  together: "#7480b8", togetherSoft: "#9098cc", togetherLight: "#b4b8e0",
  heart: "#4854a8", heartSoft: "#6870c0",
  special: "#c89840", specialSoft: "#d8b058",
  card: "rgba(245,244,250,0.97)", glass: "rgba(238,236,248,0.93)",
  warmMist: "#d8d4ec",
};

// Family shared worlds — vivid terracotta / deep forest (warm & grounded)
export const FAMILY_PALETTE = {
  cream: "#fcf5ee", warm: "#fef7f0", parchment: "#f4e8da",
  blush: "#fce8dc", lavMist: "#e4eee6",
  text: "#2c1c14", textMid: "#583828", textMuted: "#885c48", textFaint: "#b0907c",
  rose: "#d05030",       // vivid terracotta-red accent (distinct from My World amber)
  roseLight: "#e87058", roseSoft: "#d86040",
  sky: "#2c7048",        // deep forest green secondary
  skyLight: "#48905c", skySoft: "#388050",
  sage: "#5c8c4c", gold: "#c89030", goldWarm: "#d8a440", lavender: "#907060",
  together: "#986850", togetherSoft: "#b08068", togetherLight: "#c89880",
  heart: "#c03818", heartSoft: "#d85838",
  special: "#c89030", specialSoft: "#dca848",
  card: "rgba(252,245,238,0.97)", glass: "rgba(248,240,230,0.93)",
  warmMist: "#e0cbb8",
};

// ============================================================
//  SCENE THEMING — Three.js colors per world
// ============================================================

export const OUR_WORLD_SCENE = {
  bg: "#1a1230",
  fog: "#1a1230",
  sphereColor: "#fcf0f6",
  sphereEmissive: "#884880",
  ambientColor: "#fefafc",
  sunColor: "#fff6fa",
  fillColor: "#faf0f6",
  rimColor: "#e8a8d0",
  bottomColor: "#d8c0f0",
  glowColors: ["#e8b0e8", "#f0bbf0", "#f4c8f4", "#f8d4f8", "#fae0fa", "#fce8fc", "#fef0fe", "#fef6fe"],
  landColors: ["#f0cce0", "#e8c4e4", "#f0d4e8", "#e8cce4", "#f4d8ec"],
  particleColor: "#e8b0cc",
  particleColor2: "#d8b8e8",
  starTint: "#f0d4e8",
  coastColor: "#60b858",
};

// Deeper blue-slate space, warm sandstone globe, vivid green coasts
export const MY_WORLD_SCENE = {
  bg: "#121820",
  fog: "#121820",
  sphereColor: "#f0e0c8",
  sphereEmissive: "#484050",
  ambientColor: "#faf0e4",
  sunColor: "#fff4e8",
  fillColor: "#f4ead8",
  rimColor: "#a0c8e0",
  bottomColor: "#90acc4",
  glowColors: ["#88a8c8", "#90b0d0", "#98b8d8", "#a8c4e0", "#b0cce4", "#b8d4ec", "#c0dcf0", "#c8e4f4"],
  landColors: ["#e0ccac", "#d4bc98", "#e6d4b4", "#d8c8a4", "#d0bc94"],
  particleColor: "#a4b8cc",
  particleColor2: "#b8ccb8",
  starTint: "#ccd8e8",
  coastColor: "#58b050",
};

// Partner scene — same as Our World
export const PARTNER_SCENE = OUR_WORLD_SCENE;

// Friends scene — deep sapphire-navy, luminous globe
export const FRIENDS_SCENE = {
  bg: "#0e1028",
  fog: "#0e1028",
  sphereColor: "#e8e4f4",
  sphereEmissive: "#2c3060",
  ambientColor: "#f4f2fc",
  sunColor: "#f4f0ff",
  fillColor: "#ece8f8",
  rimColor: "#6c78c8",
  bottomColor: "#9098c0",
  glowColors: ["#5c68b0", "#6874b8", "#7480c0", "#808cc8", "#8c98d0", "#98a4d8", "#a4b0e0", "#b0bce8"],
  landColors: ["#dcd8ec", "#d0cce4", "#e4e0f0", "#d8d4e8", "#ccc8e0"],
  particleColor: "#7880c0",
  particleColor2: "#c4a458",
  starTint: "#c4c4dc",
  coastColor: "#58a860",
};

// Family scene — vivid terracotta/forest, distinctly warm (not blue-slate like My World)
export const FAMILY_SCENE = {
  bg: "#1c0e08",
  fog: "#1c0e08",
  sphereColor: "#f8e8d0",
  sphereEmissive: "#6c3020",
  ambientColor: "#fcf0e0",
  sunColor: "#fff0dc",
  fillColor: "#f4e0c8",
  rimColor: "#d05838",
  bottomColor: "#388c50",
  glowColors: ["#d06040", "#d46848", "#d87050", "#dc7858", "#e08060", "#e48868", "#e89070", "#ec9878"],
  landColors: ["#f0d8b8", "#e4cca8", "#f4e0c0", "#e8d4b0", "#dcc8a0"],
  particleColor: "#cc5030",
  particleColor2: "#48905c",
  starTint: "#e8ccb0",
  coastColor: "#48a050",
};

// ============================================================
//  FRIENDS WORLD — entry types, fields, defaults
// ============================================================

export const FRIENDS_TYPES = {
  "group-trip":  { label: "Group Trip",       icon: "\u{1F30D}", color: "together", who: "group", symbol: "together" },
  "weekend":     { label: "Weekend Away",     icon: "\u{1F3D5}\uFE0F", color: "sage",     who: "group", symbol: "tent" },
  "night-out":   { label: "Night Out",        icon: "\u{1F378}", color: "rose",     who: "group", symbol: "burst" },
  "hangout":     { label: "Hangout",          icon: "\u{1F3E0}", color: "sky",      who: "group", symbol: "home-seth" },
  "concert":     { label: "Concert & Event",  icon: "\u{1F3B6}", color: "special",  who: "group", symbol: "burst" },
  "sports":      { label: "Sports & Activity",icon: "\u{1F3C4}", color: "skySoft",  who: "group", symbol: "wave" },
  "food":        { label: "Food & Drinks",    icon: "\u{1F37B}", color: "gold",     who: "group", symbol: "diamond" },
  "reunion":     { label: "Reunion",          icon: "\u{1F91D}", color: "heart",    who: "group", symbol: "people" },
  "adventure":   { label: "Adventure",        icon: "\u26F0\uFE0F", color: "sage",  who: "group", symbol: "compass" },
  "milestone":   { label: "Milestone",        icon: "\u{1F389}", color: "special",  who: "group", symbol: "star" },
};

export const FRIENDS_FIELDS = {
  memories:    { label: "Best Moments",      icon: "\u{1F4AB}" },
  highlights:  { label: "Highlights",        icon: "\u2728" },
  museums:     { label: "Places & Culture",  icon: "\u{1F3DB}" },
  restaurants: { label: "Food & Drinks",     icon: "\u{1F37B}" },
};

export const FRIENDS_DEFAULT_CONFIG = {
  startDate: "",
  title: "Friends World",
  subtitle: "",
  youName: "",
  members: [],
  chapters: [],
  dreamDestinations: [],
  darkMode: false,
  customPalette: {},
  customScene: {},
};

// ============================================================
//  FAMILY WORLD — entry types, fields, defaults
// ============================================================

export const FAMILY_TYPES = {
  "family-trip":  { label: "Family Trip",      icon: "\u{1F46A}", color: "together", who: "family", symbol: "people" },
  "holiday":      { label: "Holiday",          icon: "\u{1F384}", color: "special",  who: "family", symbol: "star" },
  "gathering":    { label: "Family Gathering", icon: "\u{1F3E1}", color: "rose",     who: "family", symbol: "home-seth" },
  "celebration":  { label: "Celebration",      icon: "\u{1F382}", color: "heart",    who: "family", symbol: "burst" },
  "road-trip":    { label: "Road Trip",        icon: "\u{1F697}", color: "gold",     who: "family", symbol: "car" },
  "outdoors":     { label: "Outdoors",         icon: "\u{1F332}", color: "sage",     who: "family", symbol: "mountain" },
  "beach":        { label: "Beach & Coast",    icon: "\u{1F3D6}\uFE0F", color: "skyLight", who: "family", symbol: "wave" },
  "tradition":    { label: "Tradition",        icon: "\u2764\uFE0F", color: "roseSoft", who: "family", symbol: "heart" },
  "milestone":    { label: "Milestone",        icon: "\u{1F393}", color: "special",  who: "family", symbol: "diamond" },
  "home":         { label: "Home & Everyday",  icon: "\u{1F3E0}", color: "sky",      who: "family", symbol: "house" },
};

export const FAMILY_FIELDS = {
  memories:    { label: "Family Moments",    icon: "\u{1F4AB}" },
  highlights:  { label: "Highlights",        icon: "\u2728" },
  museums:     { label: "Places & Culture",  icon: "\u{1F3DB}" },
  restaurants: { label: "Food & Meals",      icon: "\u{1F37D}" },
};

export const FAMILY_DEFAULT_CONFIG = {
  startDate: "",
  title: "Family World",
  subtitle: "",
  youName: "",
  members: [],
  chapters: [],
  dreamDestinations: [],
  darkMode: false,
  customPalette: {},
  customScene: {},
};

// Helper to get palette/scene for a shared world type
export function getSharedWorldConfig(worldType) {
  switch (worldType) {
    case "friends": return { palette: FRIENDS_PALETTE, scene: FRIENDS_SCENE };
    case "family":  return { palette: FAMILY_PALETTE,  scene: FAMILY_SCENE };
    case "partner":
    default:        return { palette: PARTNER_PALETTE, scene: PARTNER_SCENE };
  }
}

// ============================================================
//  SEASONAL TINTING per world
// ============================================================

export function getSeasonalHue(dateStr, isMyWorld) {
  if (!dateStr) return isMyWorld
    ? { glow: "#8098b8", particle: "#7088a8" }
    : { glow: "#f0c8e0", particle: "#f0a0c0" };

  const m = new Date(dateStr + "T12:00:00").getMonth();

  if (isMyWorld) {
    if (m >= 4 && m <= 7)  return { glow: "#88a890", particle: "#789880" }; // summer: sage-green warmth
    if (m >= 8 && m <= 10) return { glow: "#c0a058", particle: "#b09048" }; // autumn: amber gold
    if (m >= 11 || m <= 1) return { glow: "#7888a0", particle: "#687890" }; // winter: cool slate
    return { glow: "#88a078", particle: "#789068" };                        // spring: fresh sage
  }

  if (m >= 4 && m <= 7)  return { glow: "#f0c8e0", particle: "#f0a0c0" };  // summer: rosy warmth
  if (m >= 8 && m <= 10) return { glow: "#e0c8a8", particle: "#d0b898" };  // autumn: warm amber
  if (m >= 11 || m <= 1) return { glow: "#d0c0f0", particle: "#c0a8e0" };  // winter: cool lavender
  return { glow: "#f0d0e8", particle: "#e8b0d0" };                         // spring: soft pink
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

