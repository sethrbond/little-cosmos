/* imageUtils.js — Photo optimization utilities for Supabase Storage
 *
 * Supabase Storage supports server-side image transforms on Pro plans via
 * /render/image/... endpoints. This utility constructs transform URLs and
 * falls back to originals gracefully on free plans.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''

/**
 * Generate a thumbnail URL for a Supabase Storage photo.
 * Uses Supabase image transforms if available (Pro plan), otherwise returns original.
 *
 * @param {string} url - Original public photo URL
 * @param {number} width - Desired width in px (default 320)
 * @param {number} quality - JPEG quality 1-100 (default 75)
 * @returns {string} Transformed URL or original
 */
export function thumbnail(url, width = 320, quality = 75) {
  if (!url || typeof url !== 'string') return url
  // Only transform Supabase Storage URLs
  if (!url.includes('/storage/v1/object/public/')) return url
  // Construct render URL: /storage/v1/render/image/public/...
  return url.replace(
    '/storage/v1/object/public/',
    `/storage/v1/render/image/public/`
  ) + `?width=${width}&quality=${quality}`
}

/**
 * Preload a full-size image in background (for hover-to-view patterns).
 * Returns a promise that resolves when loaded.
 */
export function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(url)
    img.onerror = reject
    img.src = url
  })
}
