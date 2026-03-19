// Palette accessor — reads from mutable global set by OurWorld
// This is a standalone leaf module with zero imports to prevent TDZ
export const getP = () => (typeof window !== "undefined" && window.__cosmosP) || {};
