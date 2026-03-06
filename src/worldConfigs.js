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
  cream: "#f2f0ec", warm: "#f4f0e8", parchment: "#e8e4dc",
  blush: "#e8e4de", lavMist: "#e0dcd4",
  text: "#282830", textMid: "#504c58", textMuted: "#807888", textFaint: "#a8a0b0",
  rose: "#c0a068",       // warm amber accent
  roseLight: "#d8c498", roseSoft: "#ccb480",
  sky: "#7090a8",        // slate blue
  skyLight: "#90acc0", skySoft: "#80a0b8",
  sage: "#7a9a70", gold: "#c4a048", goldWarm: "#d8b460", lavender: "#908098",
  together: "#88a098", togetherSoft: "#a0b8b0", togetherLight: "#b8ccc4",
  heart: "#b08040", heartSoft: "#c8a060",
  special: "#c8a040", specialSoft: "#d8b868",
  card: "rgba(242,238,232,0.96)", glass: "rgba(238,234,228,0.92)",
  warmMist: "#dcd4c8",
};

export const MY_WORLD_TYPES = {
  adventure:  { label: "Adventure",        icon: "\u26F0\uFE0F",  color: "sage",     who: "solo", symbol: "compass" },
  "road-trip":{ label: "Road Trip",        icon: "\u{1F697}",     color: "gold",     who: "solo", symbol: "diamond" },
  city:       { label: "City Break",       icon: "\u{1F3D9}\uFE0F",color: "sky",     who: "solo", symbol: "burst" },
  beach:      { label: "Beach & Coast",    icon: "\u{1F3D6}\uFE0F",color: "skyLight",who: "solo", symbol: "compass" },
  cruise:     { label: "Cruise & Sailing", icon: "\u26F5",         color: "skySoft",  who: "solo", symbol: "diamond" },
  backpacking:{ label: "Backpacking",      icon: "\u{1F392}",     color: "together", who: "solo", symbol: "triangle-group" },
  friends:    { label: "With Friends",     icon: "\u{1F46B}",     color: "together", who: "solo", symbol: "triangle-group" },
  family:     { label: "With Family",      icon: "\u{1F46A}",     color: "heart",    who: "solo", symbol: "house" },
  event:      { label: "Event & Festival", icon: "\u{1F3AA}",     color: "special",  who: "solo", symbol: "burst" },
  nature:     { label: "Nature & Wildlife",icon: "\u{1F332}",     color: "sage",     who: "solo", symbol: "compass" },
  work:       { label: "Work & Business",  icon: "\u{1F4BC}",     color: "gold",     who: "solo", symbol: "briefcase" },
  home:       { label: "Home Base",        icon: "\u{1F3E0}",     color: "rose",     who: "solo", symbol: "house" },
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
  bg: "#18102c",
  fog: "#18102c",
  sphereColor: "#f8e8f4",
  sphereEmissive: "#803870",
  ambientColor: "#fff8f8",
  sunColor: "#fff4f8",
  fillColor: "#f8e8f8",
  rimColor: "#f8b0d8",
  bottomColor: "#e0c8f8",
  glowColors: ["#f0b8f8", "#f4c8fc", "#f8d8ff", "#fce4ff", "#fdecff", "#fef4ff", "#fff8ff", "#fffcff"],
  landColors: ["#f0c8d8", "#e8c0e0", "#f0d0e0", "#e0c8e0", "#f8d0e8"],
  particleColor: "#f8b8d0",
  particleColor2: "#e0c0f0",
  starTint: "#fce0f0",
  coastColor: "#78c058",
};

// Blue-tinged space, earthy/sandstone globe, green coasts
export const MY_WORLD_SCENE = {
  bg: "#0e1018",
  fog: "#0e1018",
  sphereColor: "#e0d0b0",
  sphereEmissive: "#383040",
  ambientColor: "#f8f0e8",
  sunColor: "#fcf4e8",
  fillColor: "#f0e8d8",
  rimColor: "#a8c0d8",
  bottomColor: "#90a8c0",
  glowColors: ["#80a0c0", "#88a8c8", "#98b8d0", "#a8c4d8", "#b0cce0", "#b8d4e8", "#c0dcf0", "#c8e0f4"],
  landColors: ["#d0c0a0", "#c0b090", "#d8c8a8", "#c8b898", "#c0b088"],
  particleColor: "#a8b8c8",
  particleColor2: "#b8c8b8",
  starTint: "#d8e0f0",
  coastColor: "#68a850",
};

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

  if (m >= 4 && m <= 7)  return { glow: "#f0c8e0", particle: "#f0a0c0" };
  if (m >= 8 || m <= 0)  return { glow: "#d0c0f0", particle: "#c0a8e0" };
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

// ============================================================
//  CUSTOMIZABLE THEME SYSTEM
// ============================================================

export const THEME_FIELDS = [
  { key: "space",     label: "Space Background", defaultOur: "#161028", defaultMy: "#0c0e16" },
  { key: "globe",     label: "Globe Color",      defaultOur: "#e8d8f0", defaultMy: "#c8b898" },
  { key: "glow",      label: "Glow Halo",        defaultOur: "#d8a0f0", defaultMy: "#6880a8" },
  { key: "accent",    label: "Primary Accent",    defaultOur: "#d4a0b9", defaultMy: "#c0a068" },
  { key: "secondary", label: "Secondary Accent",  defaultOur: "#9bb5d6", defaultMy: "#7090a8" },
  { key: "coast",     label: "Coastlines",        defaultOur: "#70b850", defaultMy: "#5a9848" },
  { key: "particles", label: "Particles",         defaultOur: "#f0a0c8", defaultMy: "#90a0b8" },
  { key: "card",      label: "Card Background",   defaultOur: "#fdfbf7", defaultMy: "#f2eee6" },
  { key: "textColor", label: "Text Color",        defaultOur: "#3d3552", defaultMy: "#282830" },
  { key: "gold",      label: "Gold / Highlight",  defaultOur: "#d4b078", defaultMy: "#c4a048" },
];

function adjustHex(hex, amt) {
  const c = hex.replace("#", "");
  const r = Math.min(255, Math.max(0, parseInt(c.slice(0,2),16) + amt));
  const g = Math.min(255, Math.max(0, parseInt(c.slice(2,4),16) + amt));
  const b = Math.min(255, Math.max(0, parseInt(c.slice(4,6),16) + amt));
  return "#" + [r,g,b].map(v => v.toString(16).padStart(2,"0")).join("");
}

function hexToRgb(hex) {
  const c = hex.replace("#","");
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
}

function mixHex(a, b, t) {
  const [r1,g1,b1] = hexToRgb(a), [r2,g2,b2] = hexToRgb(b);
  return "#" + [Math.round(r1+(r2-r1)*t), Math.round(g1+(g2-g1)*t), Math.round(b1+(b2-b1)*t)]
    .map(v => Math.min(255,Math.max(0,v)).toString(16).padStart(2,"0")).join("");
}

export function deriveTheme(seeds, isMyWorld) {
  const base = isMyWorld ? MY_WORLD_PALETTE : OUR_WORLD_PALETTE;
  const baseScene = isMyWorld ? MY_WORLD_SCENE : OUR_WORLD_SCENE;
  const s = seeds || {};
  if (!Object.values(s).some(v => v && v.length > 0)) return { palette: base, scene: baseScene };

  const accent = s.accent || base.rose;
  const secondary = s.secondary || base.sky;
  const tc = s.textColor || base.text;
  const gold = s.gold || base.gold;
  const cardBg = s.card || (isMyWorld ? "#f2eee6" : "#fdfbf7");
  const space = s.space || baseScene.bg;
  const globe = s.globe || baseScene.sphereColor;
  const glow = s.glow || baseScene.glowColors[0];
  const coast = s.coast || baseScene.coastColor;
  const particles = s.particles || baseScene.particleColor;

  const palette = {
    ...base,
    cream: adjustHex(cardBg, 4), warm: adjustHex(cardBg, 6), parchment: adjustHex(cardBg, -8),
    blush: mixHex(cardBg, accent, 0.06), lavMist: mixHex(cardBg, secondary, 0.08),
    text: tc, textMid: adjustHex(tc, 40), textMuted: adjustHex(tc, 80), textFaint: adjustHex(tc, 120),
    rose: accent, roseLight: adjustHex(accent, 50), roseSoft: adjustHex(accent, 30),
    sky: secondary, skyLight: adjustHex(secondary, 40), skySoft: adjustHex(secondary, 20),
    sage: mixHex(secondary, "#88aa88", 0.5),
    gold: gold, goldWarm: adjustHex(gold, 20), lavender: mixHex(accent, secondary, 0.5),
    together: mixHex(accent, secondary, 0.4), togetherSoft: mixHex(accent, secondary, 0.25),
    togetherLight: mixHex(cardBg, mixHex(accent, secondary, 0.4), 0.15),
    heart: adjustHex(accent, -15), heartSoft: adjustHex(accent, 15),
    special: gold, specialSoft: adjustHex(gold, 30),
    card: `rgba(${hexToRgb(cardBg).join(",")},0.96)`,
    glass: `rgba(${hexToRgb(adjustHex(cardBg, -4)).join(",")},0.92)`,
    warmMist: adjustHex(cardBg, -16),
  };

  const scene = {
    ...baseScene,
    bg: space, fog: space,
    sphereColor: globe, sphereEmissive: adjustHex(space, 10),
    ambientColor: adjustHex(cardBg, 30), sunColor: adjustHex(cardBg, 20),
    fillColor: mixHex(globe, cardBg, 0.5), rimColor: accent, bottomColor: mixHex(secondary, glow, 0.5),
    glowColors: Array.from({length: 8}, (_, i) => adjustHex(glow, i * 12)),
    landColors: Array.from({length: 5}, (_, i) => adjustHex(mixHex(globe, accent, 0.2), -10 + i * 5)),
    particleColor: particles, particleColor2: mixHex(particles, gold, 0.4),
    starTint: mixHex(glow, cardBg, 0.5), coastColor: coast,
  };

  return { palette, scene };
}
