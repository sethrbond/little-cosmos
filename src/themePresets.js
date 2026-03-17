import { WORLD_THEMES } from "./worldConfigs.js";

// Extended theme presets — side-effect import adds these to WORLD_THEMES
Object.assign(WORLD_THEMES, {
  sunset: {
    name: "Sunset Garden",
    description: "Warm oranges and pinks",
    preview: ["#1a1008", "#e8884a", "#d06878"],
    palette: { rose: "#e8884a", sky: "#d06878", gold: "#f0b060", heart: "#e05858", text: "#f0e0d0", cream: "#1a1210" },
    scene: { bg: "#120c06", globe: "#2c2018", glow: "#e8884a30", coast: "#e8884a", particles: "#d0687840", starTint: "#e8884a20" },
  },
  desert: {
    name: "Desert Sand",
    description: "Warm tans and terracotta",
    preview: ["#1c1610", "#d4a070", "#c07850"],
    palette: { rose: "#c07850", sky: "#a89878", gold: "#d4a070", heart: "#c86848", text: "#e8dcd0", cream: "#1c1814" },
    scene: { bg: "#100c08", globe: "#2c2418", glow: "#d4a07030", coast: "#c07850", particles: "#d4a07040", starTint: "#d4a07020" },
  },
  arctic: {
    name: "Arctic Ice",
    description: "Cool whites and light blues",
    preview: ["#0c1018", "#a0d0e8", "#d8e8f0"],
    palette: { rose: "#78b8d8", sky: "#a0d0e8", gold: "#d8e8f0", heart: "#6098c0", text: "#d0e0e8", cream: "#0e1418" },
    scene: { bg: "#060a10", globe: "#182028", glow: "#a0d0e830", coast: "#78b8d8", particles: "#a0d0e840", starTint: "#d8e8f020" },
  },
  lavender: {
    name: "Lavender Fields",
    description: "Soft purples and lilacs",
    preview: ["#14101c", "#b090d0", "#d0b8e8"],
    palette: { rose: "#b090d0", sky: "#9880c0", gold: "#d0b8e8", heart: "#c878b0", text: "#e0d8e8", cream: "#161020" },
    scene: { bg: "#0a0810", globe: "#201830", glow: "#b090d030", coast: "#b090d0", particles: "#9880c040", starTint: "#d0b8e820" },
  },
  forest: {
    name: "Forest Canopy",
    description: "Deep woodland greens",
    preview: ["#0a1208", "#58a068", "#88c898"],
    palette: { rose: "#58a068", sky: "#78b888", gold: "#a0c878", heart: "#48884c", text: "#d0e0d0", cream: "#0c1410" },
    scene: { bg: "#060a06", globe: "#142818", glow: "#58a06830", coast: "#58a068", particles: "#78b88840", starTint: "#88c89820" },
  },
  golden: {
    name: "Golden Hour",
    description: "Warm golds and ambers",
    preview: ["#181008", "#d8a840", "#e8c868"],
    palette: { rose: "#d8a840", sky: "#c89848", gold: "#e8c868", heart: "#c08830", text: "#f0e0c8", cream: "#181410" },
    scene: { bg: "#100c04", globe: "#282010", glow: "#d8a84030", coast: "#d8a840", particles: "#e8c86840", starTint: "#e8c86820" },
  },
  nebula: {
    name: "Cosmic Nebula",
    description: "Deep purples and magentas",
    preview: ["#10081c", "#c058a0", "#8848c0"],
    palette: { rose: "#c058a0", sky: "#8848c0", gold: "#d080c0", heart: "#d04888", text: "#e0d0e8", cream: "#140c1c" },
    scene: { bg: "#080410", globe: "#201030", glow: "#c058a030", coast: "#c058a0", particles: "#8848c040", starTint: "#d080c020" },
  },
  rosegold: {
    name: "Rose Gold",
    description: "Elegant blush and copper",
    preview: ["#181014", "#c89888", "#e8b8a8"],
    palette: { rose: "#c89888", sky: "#b8a098", gold: "#e8b8a8", heart: "#d08878", text: "#e8d8d0", cream: "#181214" },
    scene: { bg: "#0c0808", globe: "#281c1c", glow: "#c8988830", coast: "#c89888", particles: "#e8b8a840", starTint: "#e8b8a820" },
  },
  monochrome: {
    name: "Monochrome",
    description: "Elegant grayscale",
    preview: ["#111111", "#888888", "#cccccc"],
    palette: { rose: "#888888", sky: "#a0a0a0", gold: "#cccccc", heart: "#707070", text: "#e0e0e0", cream: "#141414" },
    scene: { bg: "#080808", globe: "#1c1c1c", glow: "#88888830", coast: "#888888", particles: "#a0a0a040", starTint: "#cccccc20" },
  },
  tropical: {
    name: "Tropical Paradise",
    description: "Vibrant turquoise and coral",
    preview: ["#081418", "#40c8b8", "#e87870"],
    palette: { rose: "#40c8b8", sky: "#58d8c8", gold: "#e8c868", heart: "#e87870", text: "#d0e8e8", cream: "#0c1618" },
    scene: { bg: "#040c10", globe: "#142028", glow: "#40c8b830", coast: "#40c8b8", particles: "#58d8c840", starTint: "#e8c86820" },
  },
});
