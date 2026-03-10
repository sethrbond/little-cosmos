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

/**
 * Compress an image file client-side before upload.
 * Uses Canvas API to resize and re-encode as JPEG.
 *
 * @param {File} file - Original image file
 * @param {object} opts
 * @param {number} opts.maxWidth  - Max width in px (default 2048)
 * @param {number} opts.maxHeight - Max height in px (default 2048)
 * @param {number} opts.quality   - JPEG quality 0-1 (default 0.82)
 * @returns {Promise<File>} Compressed file (or original if smaller / non-image)
 */
export function compressImage(file, { maxWidth = 2048, maxHeight = 2048, quality = 0.82 } = {}) {
  return new Promise((resolve) => {
    // Skip non-image or already-small files
    if (!file.type.startsWith('image/') || file.size < 200_000) {
      return resolve(file)
    }
    // Skip GIFs (animation would be lost)
    if (file.type === 'image/gif') return resolve(file)

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img

      // Only downscale, never upscale
      if (width <= maxWidth && height <= maxHeight && file.size < 500_000) {
        return resolve(file)
      }

      // Calculate scaled dimensions maintaining aspect ratio
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Compressed version is larger — keep original
            return resolve(file)
          }
          const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          })
          resolve(compressed)
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // fallback to original
    }

    img.src = url
  })
}
