/**
 * exifParser.js — Zero-dependency EXIF GPS extractor
 * Reads GPS coordinates and DateTimeOriginal from JPEG EXIF data.
 * No imports from any other app module.
 */

/**
 * Parse EXIF GPS data from a File object.
 * @param {File} file - A JPEG image file
 * @returns {Promise<{lat: number, lng: number, date: string|null}|null>}
 */
export async function parseExifGps(file) {
  try {
    const buffer = await readFileSlice(file, 0, 65536)
    const view = new DataView(buffer)

    // Verify JPEG SOI marker
    if (view.getUint16(0) !== 0xFFD8) return null

    // Find APP1 (EXIF) marker
    let offset = 2
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset)
      if (marker === 0xFFE1) { // APP1
        const length = view.getUint16(offset + 2)
        // Verify "Exif\0\0" header
        if (
          view.getUint8(offset + 4) === 0x45 && // E
          view.getUint8(offset + 5) === 0x78 && // x
          view.getUint8(offset + 6) === 0x69 && // i
          view.getUint8(offset + 7) === 0x66 && // f
          view.getUint8(offset + 8) === 0x00 &&
          view.getUint8(offset + 9) === 0x00
        ) {
          return parseExifBlock(view, offset + 10, length - 8)
        }
        offset += 2 + length
      } else if ((marker & 0xFF00) === 0xFF00) {
        // Other marker — skip
        const len = view.getUint16(offset + 2)
        offset += 2 + len
      } else {
        break
      }
    }
    return null
  } catch {
    return null
  }
}

function readFileSlice(file, start, end) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file.slice(start, end))
  })
}

function parseExifBlock(view, tiffStart, maxLen) {
  const endian = view.getUint16(tiffStart)
  const le = endian === 0x4949 // little-endian (Intel)
  if (!le && endian !== 0x4D4D) return null // not big-endian (Motorola) either

  const get16 = (o) => view.getUint16(tiffStart + o, le)
  const get32 = (o) => view.getUint32(tiffStart + o, le)

  // Verify TIFF magic 0x002A
  if (get16(2) !== 0x002A) return null

  const ifd0Offset = get32(4)
  let gpsIfdOffset = null
  let exifIfdOffset = null

  // Parse IFD0 to find GPS IFD and ExifIFD pointers
  const ifd0Count = get16(ifd0Offset)
  for (let i = 0; i < ifd0Count; i++) {
    const entryOffset = ifd0Offset + 2 + i * 12
    if (entryOffset + 12 > maxLen) break
    const tag = get16(entryOffset)
    if (tag === 0x8825) { // GPSInfoIFDPointer
      gpsIfdOffset = get32(entryOffset + 8)
    } else if (tag === 0x8769) { // ExifIFDPointer
      exifIfdOffset = get32(entryOffset + 8)
    }
  }

  if (!gpsIfdOffset) return null

  // Parse GPS IFD
  const gpsData = parseGpsIfd(view, tiffStart, gpsIfdOffset, le, maxLen)
  if (!gpsData) return null

  // Parse ExifIFD for DateTimeOriginal
  let date = null
  if (exifIfdOffset) {
    date = parseDateTimeOriginal(view, tiffStart, exifIfdOffset, le, maxLen)
  }

  return { lat: gpsData.lat, lng: gpsData.lng, date }
}

function parseGpsIfd(view, tiffStart, ifdOffset, le, maxLen) {
  const get16 = (o) => view.getUint16(tiffStart + o, le)
  const get32 = (o) => view.getUint32(tiffStart + o, le)

  const count = get16(ifdOffset)
  let latRef = null, lngRef = null
  let latRational = null, lngRational = null

  for (let i = 0; i < count; i++) {
    const entry = ifdOffset + 2 + i * 12
    if (entry + 12 > maxLen) break
    const tag = get16(entry)

    if (tag === 0x0001) { // GPSLatitudeRef
      latRef = String.fromCharCode(view.getUint8(tiffStart + entry + 8))
    } else if (tag === 0x0002) { // GPSLatitude
      const valOffset = get32(entry + 8)
      latRational = readRationals(view, tiffStart, valOffset, 3, le, maxLen)
    } else if (tag === 0x0003) { // GPSLongitudeRef
      lngRef = String.fromCharCode(view.getUint8(tiffStart + entry + 8))
    } else if (tag === 0x0004) { // GPSLongitude
      const valOffset = get32(entry + 8)
      lngRational = readRationals(view, tiffStart, valOffset, 3, le, maxLen)
    }
  }

  if (!latRational || !lngRational || !latRef || !lngRef) return null

  let lat = latRational[0] + latRational[1] / 60 + latRational[2] / 3600
  let lng = lngRational[0] + lngRational[1] / 60 + lngRational[2] / 3600
  if (latRef === 'S') lat = -lat
  if (lngRef === 'W') lng = -lng

  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null
  return { lat, lng }
}

function readRationals(view, tiffStart, offset, count, le, maxLen) {
  const results = []
  for (let i = 0; i < count; i++) {
    const pos = offset + i * 8
    if (pos + 8 > maxLen) return null
    const num = view.getUint32(tiffStart + pos, le)
    const den = view.getUint32(tiffStart + pos + 4, le)
    results.push(den === 0 ? 0 : num / den)
  }
  return results
}

function parseDateTimeOriginal(view, tiffStart, ifdOffset, le, maxLen) {
  const get16 = (o) => view.getUint16(tiffStart + o, le)
  const get32 = (o) => view.getUint32(tiffStart + o, le)

  const count = get16(ifdOffset)
  for (let i = 0; i < count; i++) {
    const entry = ifdOffset + 2 + i * 12
    if (entry + 12 > maxLen) break
    const tag = get16(entry)
    if (tag === 0x9003) { // DateTimeOriginal
      const strLen = get32(entry + 4)
      const strOffset = get32(entry + 8)
      if (strOffset + strLen > maxLen) return null
      let str = ''
      for (let j = 0; j < Math.min(strLen, 19); j++) {
        const ch = view.getUint8(tiffStart + strOffset + j)
        if (ch === 0) break
        str += String.fromCharCode(ch)
      }
      // Format: "2024:03:15 14:30:00" -> "2024-03-15"
      if (str.length >= 10) {
        return str.slice(0, 10).replace(/:/g, '-')
      }
      return null
    }
  }
  return null
}
