import { describe, it, expect, beforeAll } from 'vitest'
import { parseExifGps } from '../exifParser.js'

// Node doesn't have FileReader — polyfill it for tests.
beforeAll(() => {
  if (typeof globalThis.FileReader === 'undefined') {
    globalThis.FileReader = class FileReader {
      onload = null
      onerror = null
      result = null
      readAsArrayBuffer(blob) {
        blob.arrayBuffer().then(buf => {
          this.result = buf
          this.onload?.()
        }).catch(err => {
          this.error = err
          this.onerror?.()
        })
      }
    }
  }
})

/* ------------------------------------------------------------------ */
/*  Helpers — build EXIF binary data from scratch                     */
/* ------------------------------------------------------------------ */

/**
 * Write a uint16 into a DataView at `offset`, respecting endianness.
 */
function w16(dv, offset, val, le) {
  dv.setUint16(offset, val, le)
}

/**
 * Write a uint32 into a DataView at `offset`, respecting endianness.
 */
function w32(dv, offset, val, le) {
  dv.setUint32(offset, val, le)
}

/**
 * Write a RATIONAL (two uint32: numerator, denominator) at `offset`.
 */
function wRational(dv, offset, num, den, le) {
  w32(dv, offset, num, le)
  w32(dv, offset + 4, den, le)
}

/**
 * Write a string (ASCII) starting at `offset`.
 */
function wStr(dv, offset, str) {
  for (let i = 0; i < str.length; i++) {
    dv.setUint8(offset + i, str.charCodeAt(i))
  }
}

/**
 * Write one IFD entry (12 bytes) at `offset`.
 *   tag:   uint16
 *   type:  uint16
 *   count: uint32
 *   value: uint32 (value or pointer)
 */
function wIfdEntry(dv, offset, tag, type, count, value, le) {
  w16(dv, offset, tag, le)
  w16(dv, offset + 2, type, le)
  w32(dv, offset + 4, count, le)
  w32(dv, offset + 8, value, le)
}

/**
 * For SHORT IFD entries where value fits in the value slot,
 * but the value is stored as the first 2 bytes of the 4-byte value field.
 * For little-endian, the value goes at offset+8.
 * For big-endian, the value goes at offset+8 too (as uint32).
 */

/**
 * Write an IFD entry whose value is a single ASCII character stored inline.
 * EXIF stores single-char refs (N/S/E/W) as type=2 (ASCII), count=2 (char + null),
 * with the character in the value field.
 * The parser reads it as: view.getUint8(tiffStart + entry + 8)
 * So we put the char at entry + 8 relative to tiffStart.
 */
function wIfdEntryAsciiInline(dv, tiffStart, entryOffset, tag, char, le) {
  w16(dv, tiffStart + entryOffset, tag, le)
  w16(dv, tiffStart + entryOffset + 2, 2, le)  // type=ASCII
  w32(dv, tiffStart + entryOffset + 4, 2, le)   // count=2
  // Store char byte at tiffStart + entryOffset + 8
  // In the source: view.getUint8(tiffStart + entry + 8)
  // entry is relative to tiffStart, so this is correct
  dv.setUint8(tiffStart + entryOffset + 8, char.charCodeAt(0))
  dv.setUint8(tiffStart + entryOffset + 9, 0)
}

/**
 * Build a complete JPEG+EXIF buffer with GPS data.
 *
 * @param {object} opts
 * @param {boolean}  opts.le          - true for little-endian ("II"), false for big-endian ("MM")
 * @param {number}   opts.latDeg      - latitude degrees
 * @param {number}   opts.latMin      - latitude minutes
 * @param {number}   opts.latSec      - latitude seconds (as numerator, denominator=100)
 * @param {string}   opts.latRef      - 'N' or 'S'
 * @param {number}   opts.lngDeg      - longitude degrees
 * @param {number}   opts.lngMin      - longitude minutes
 * @param {number}   opts.lngSec      - longitude seconds (as numerator, denominator=100)
 * @param {string}   opts.lngRef      - 'E' or 'W'
 * @param {string|null} opts.dateTime - DateTimeOriginal string, e.g. "2024:03:15 14:30:00"
 * @returns {File}
 */
function buildExifJpeg(opts) {
  const le = opts.le ?? false
  const hasDate = opts.dateTime != null
  const hasExifIfd = hasDate

  // We need enough space for:
  //   2  JPEG SOI
  //   4  APP1 marker + length
  //   6  "Exif\0\0"
  //   -- TIFF data starts here (tiffStart) --
  //   2  byte order
  //   2  TIFF magic 0x002A
  //   4  IFD0 offset pointer
  //   -- IFD0 --
  //   2  entry count
  //  12* entries (GPS ptr + optional ExifIFD ptr)
  //   4  next IFD offset (0)
  //   -- GPS IFD --
  //   2  entry count
  //  12*4 GPS entries (latRef, lat, lngRef, lng)
  //   -- GPS rational data (lat: 3 rationals = 24 bytes, lng: 3 rationals = 24 bytes) --
  //   -- ExifIFD (optional) --
  //   -- DateTimeOriginal string data (optional) --
  // Total: let's use 512 bytes, plenty of room.

  const size = 512
  const buf = new ArrayBuffer(size)
  const dv = new DataView(buf)
  let pos = 0

  // JPEG SOI
  dv.setUint8(pos++, 0xFF)
  dv.setUint8(pos++, 0xD8)

  // APP1 marker
  dv.setUint8(pos++, 0xFF)
  dv.setUint8(pos++, 0xE1)

  // APP1 length placeholder (we'll fill after)
  const app1LenPos = pos
  pos += 2

  // "Exif\0\0"
  wStr(dv, pos, 'Exif')
  dv.setUint8(pos + 4, 0)
  dv.setUint8(pos + 5, 0)
  pos += 6

  // TIFF data starts here
  const tiffStart = pos

  // Byte order
  if (le) {
    dv.setUint8(pos, 0x49) // 'I'
    dv.setUint8(pos + 1, 0x49)
  } else {
    dv.setUint8(pos, 0x4D) // 'M'
    dv.setUint8(pos + 1, 0x4D)
  }
  // TIFF magic
  w16(dv, tiffStart + 2, 0x002A, le)
  // IFD0 offset (immediately after header: 8 bytes from tiffStart)
  w32(dv, tiffStart + 4, 8, le)

  // -- IFD0 at tiffStart + 8 --
  const ifd0Start = 8 // relative to tiffStart
  const ifd0Entries = hasExifIfd ? 2 : 1 // GPSInfoIFDPointer + optional ExifIFDPointer
  w16(dv, tiffStart + ifd0Start, ifd0Entries, le)

  // We'll compute GPS IFD offset after we lay out IFD0
  // IFD0 size: 2 + entries*12 + 4 (next IFD = 0)
  const ifd0Size = 2 + ifd0Entries * 12 + 4
  const gpsIfdStart = ifd0Start + ifd0Size // relative to tiffStart

  // IFD0 entry 0: GPSInfoIFDPointer (tag=0x8825, type=LONG=4, count=1, value=offset)
  wIfdEntry(dv, tiffStart + ifd0Start + 2, 0x8825, 4, 1, gpsIfdStart, le)

  // GPS IFD: 4 entries (latRef, lat, lngRef, lng)
  const gpsEntryCount = 4
  const gpsIfdSize = 2 + gpsEntryCount * 12

  // Rational data goes right after GPS IFD
  const latRationalStart = gpsIfdStart + gpsIfdSize      // relative to tiffStart
  const lngRationalStart = latRationalStart + 24          // 3 rationals * 8 bytes

  // ExifIFD starts after lng rationals
  let exifIfdStart = lngRationalStart + 24
  let dateStrStart = 0

  if (hasExifIfd) {
    // IFD0 entry 1: ExifIFDPointer (tag=0x8769, type=LONG=4, count=1, value=offset)
    wIfdEntry(dv, tiffStart + ifd0Start + 2 + 12, 0x8769, 4, 1, exifIfdStart, le)
    // ExifIFD: 1 entry (DateTimeOriginal)
    const exifEntryCount = 1
    dateStrStart = exifIfdStart + 2 + exifEntryCount * 12
  }

  // Next IFD pointer = 0 (no more IFDs)
  w32(dv, tiffStart + ifd0Start + 2 + ifd0Entries * 12, 0, le)

  // -- GPS IFD --
  w16(dv, tiffStart + gpsIfdStart, gpsEntryCount, le)

  const gpsE = (i) => gpsIfdStart + 2 + i * 12 // entry offset relative to tiffStart

  // GPS entry 0: LatitudeRef (tag=0x0001, type=ASCII=2, count=2, value inline)
  wIfdEntryAsciiInline(dv, tiffStart, gpsE(0), 0x0001, opts.latRef, le)

  // GPS entry 1: Latitude (tag=0x0002, type=RATIONAL=5, count=3, value=offset to rationals)
  wIfdEntry(dv, tiffStart + gpsE(1), 0x0002, 5, 3, latRationalStart, le)

  // GPS entry 2: LongitudeRef (tag=0x0003, type=ASCII=2, count=2, value inline)
  wIfdEntryAsciiInline(dv, tiffStart, gpsE(2), 0x0003, opts.lngRef, le)

  // GPS entry 3: Longitude (tag=0x0004, type=RATIONAL=5, count=3, value=offset to rationals)
  wIfdEntry(dv, tiffStart + gpsE(3), 0x0004, 5, 3, lngRationalStart, le)

  // -- Latitude rational data (3 rationals: deg, min, sec) --
  wRational(dv, tiffStart + latRationalStart,      opts.latDeg, 1, le)
  wRational(dv, tiffStart + latRationalStart + 8,   opts.latMin, 1, le)
  wRational(dv, tiffStart + latRationalStart + 16,  opts.latSec, 100, le) // sec * 100 / 100

  // -- Longitude rational data --
  wRational(dv, tiffStart + lngRationalStart,      opts.lngDeg, 1, le)
  wRational(dv, tiffStart + lngRationalStart + 8,   opts.lngMin, 1, le)
  wRational(dv, tiffStart + lngRationalStart + 16,  opts.lngSec, 100, le)

  // -- ExifIFD + DateTimeOriginal --
  if (hasExifIfd) {
    w16(dv, tiffStart + exifIfdStart, 1, le) // 1 entry

    const dateStr = opts.dateTime
    // DateTimeOriginal: tag=0x9003, type=ASCII=2, count=strlen+1, value=offset to string
    wIfdEntry(
      dv,
      tiffStart + exifIfdStart + 2,
      0x9003,
      2,
      dateStr.length + 1,
      dateStrStart,
      le
    )
    // Write the date string
    wStr(dv, tiffStart + dateStrStart, dateStr)
    dv.setUint8(tiffStart + dateStrStart + dateStr.length, 0) // null terminator
  }

  // Fill in APP1 length: everything from after the length field to end of TIFF data
  // APP1 length = 2 (length field itself doesn't count, but the spec says length includes itself?
  // Actually: APP1 length field value = number of bytes following the length field (per JPEG spec)
  // But the parser does: length = view.getUint16(offset + 2), then checks "Exif\0\0"
  // and calls parseExifBlock(view, offset + 10, length - 8)
  // So length - 8 = maxLen for the TIFF block.
  // We need maxLen to cover all our TIFF data.
  // The furthest byte we write relative to tiffStart determines what maxLen needs to be.
  const tiffDataEnd = hasExifIfd
    ? dateStrStart + opts.dateTime.length + 1
    : lngRationalStart + 24
  const app1Len = 8 + tiffDataEnd // 6 for "Exif\0\0" + 2 for length counting
  w16(dv, app1LenPos, app1Len, false) // APP1 length is always big-endian (JPEG standard)

  return new File([buf], 'test.jpg', { type: 'image/jpeg' })
}

/**
 * Build a JPEG without EXIF (has SOI + some non-APP1 marker).
 */
function buildNonExifJpeg() {
  const buf = new ArrayBuffer(32)
  const dv = new DataView(buf)
  // SOI
  dv.setUint16(0, 0xFFD8)
  // APP0 marker (JFIF), not APP1
  dv.setUint16(2, 0xFFE0)
  dv.setUint16(4, 16) // length
  return new File([buf], 'test.jpg', { type: 'image/jpeg' })
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('parseExifGps', () => {
  // --- Edge cases ---

  it('returns null for empty buffer', async () => {
    const file = new File([new ArrayBuffer(0)], 'empty.jpg')
    expect(await parseExifGps(file)).toBe(null)
  })

  it('returns null for tiny buffer (1 byte)', async () => {
    const file = new File([new Uint8Array([0xFF])], 'tiny.jpg')
    expect(await parseExifGps(file)).toBe(null)
  })

  it('returns null for non-JPEG file (random bytes)', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) // PNG header
    const file = new File([bytes], 'test.png')
    expect(await parseExifGps(file)).toBe(null)
  })

  it('returns null for JPEG without EXIF data', async () => {
    const file = buildNonExifJpeg()
    expect(await parseExifGps(file)).toBe(null)
  })

  // --- Big-endian (Motorola byte order "MM") ---

  it('extracts GPS from big-endian EXIF (N/E)', async () => {
    // Paris: 48°51'24.00"N, 2°17'36.00"E
    const file = buildExifJpeg({
      le: false,
      latDeg: 48, latMin: 51, latSec: 2400, latRef: 'N',
      lngDeg: 2,  lngMin: 17, lngSec: 3600, lngRef: 'E',
      dateTime: null,
    })
    const result = await parseExifGps(file)
    expect(result).not.toBe(null)
    expect(result.lat).toBeCloseTo(48.8567, 3)
    expect(result.lng).toBeCloseTo(2.2933, 3)
    expect(result.date).toBe(null)
  })

  it('extracts GPS from big-endian EXIF (S/W)', async () => {
    // Rio de Janeiro: 22°54'36.00"S, 43°10'12.00"W
    const file = buildExifJpeg({
      le: false,
      latDeg: 22, latMin: 54, latSec: 3600, latRef: 'S',
      lngDeg: 43, lngMin: 10, lngSec: 1200, lngRef: 'W',
      dateTime: null,
    })
    const result = await parseExifGps(file)
    expect(result).not.toBe(null)
    expect(result.lat).toBeCloseTo(-22.91, 2)
    expect(result.lng).toBeCloseTo(-43.17, 2)
  })

  // --- Little-endian (Intel byte order "II") ---

  it('extracts GPS from little-endian EXIF (N/E)', async () => {
    // Tokyo: 35°41'24.00"N, 139°41'24.00"E
    const file = buildExifJpeg({
      le: true,
      latDeg: 35, latMin: 41, latSec: 2400, latRef: 'N',
      lngDeg: 139, lngMin: 41, lngSec: 2400, lngRef: 'E',
      dateTime: null,
    })
    const result = await parseExifGps(file)
    expect(result).not.toBe(null)
    expect(result.lat).toBeCloseTo(35.69, 2)
    expect(result.lng).toBeCloseTo(139.69, 2)
  })

  it('extracts GPS from little-endian EXIF (S/E)', async () => {
    // Sydney: 33°52'12.00"S, 151°12'36.00"E
    const file = buildExifJpeg({
      le: true,
      latDeg: 33, latMin: 52, latSec: 1200, latRef: 'S',
      lngDeg: 151, lngMin: 12, lngSec: 3600, lngRef: 'E',
      dateTime: null,
    })
    const result = await parseExifGps(file)
    expect(result).not.toBe(null)
    expect(result.lat).toBeCloseTo(-33.87, 2)
    expect(result.lng).toBeCloseTo(151.21, 2)
  })

  // --- GPS reference sign ---

  it('applies negative sign for S latitude', async () => {
    const file = buildExifJpeg({
      le: false,
      latDeg: 10, latMin: 0, latSec: 0, latRef: 'S',
      lngDeg: 20, lngMin: 0, lngSec: 0, lngRef: 'E',
      dateTime: null,
    })
    const result = await parseExifGps(file)
    expect(result.lat).toBe(-10)
    expect(result.lng).toBe(20)
  })

  it('applies negative sign for W longitude', async () => {
    const file = buildExifJpeg({
      le: false,
      latDeg: 10, latMin: 0, latSec: 0, latRef: 'N',
      lngDeg: 20, lngMin: 0, lngSec: 0, lngRef: 'W',
      dateTime: null,
    })
    const result = await parseExifGps(file)
    expect(result.lat).toBe(10)
    expect(result.lng).toBe(-20)
  })

  it('applies negative signs for both S and W', async () => {
    const file = buildExifJpeg({
      le: true,
      latDeg: 34, latMin: 36, latSec: 0, latRef: 'S',
      lngDeg: 58, lngMin: 22, lngSec: 4800, lngRef: 'W',
      dateTime: null,
    })
    const result = await parseExifGps(file)
    expect(result.lat).toBeCloseTo(-34.6, 1)
    expect(result.lng).toBeCloseTo(-58.38, 1)
  })

  // --- DateTimeOriginal extraction ---

  it('extracts DateTimeOriginal and formats as ISO date', async () => {
    const file = buildExifJpeg({
      le: false,
      latDeg: 48, latMin: 51, latSec: 2400, latRef: 'N',
      lngDeg: 2,  lngMin: 17, lngSec: 3600, lngRef: 'E',
      dateTime: '2024:03:15 14:30:00',
    })
    const result = await parseExifGps(file)
    expect(result).not.toBe(null)
    expect(result.date).toBe('2024-03-15')
  })

  it('extracts DateTimeOriginal with little-endian byte order', async () => {
    const file = buildExifJpeg({
      le: true,
      latDeg: 35, latMin: 41, latSec: 2400, latRef: 'N',
      lngDeg: 139, lngMin: 41, lngSec: 2400, lngRef: 'E',
      dateTime: '2023:12:25 08:00:00',
    })
    const result = await parseExifGps(file)
    expect(result).not.toBe(null)
    expect(result.date).toBe('2023-12-25')
  })

  it('returns date as null when no ExifIFD is present', async () => {
    const file = buildExifJpeg({
      le: false,
      latDeg: 48, latMin: 51, latSec: 2400, latRef: 'N',
      lngDeg: 2,  lngMin: 17, lngSec: 3600, lngRef: 'E',
      dateTime: null,
    })
    const result = await parseExifGps(file)
    expect(result).not.toBe(null)
    expect(result.date).toBe(null)
  })

  // --- Combined GPS + date ---

  it('returns lat, lng, and date together', async () => {
    const file = buildExifJpeg({
      le: true,
      latDeg: 40, latMin: 42, latSec: 4600, latRef: 'N',
      lngDeg: 74, lngMin: 0,  lngSec: 2200, lngRef: 'W',
      dateTime: '2025:07:04 12:00:00',
    })
    const result = await parseExifGps(file)
    expect(result).not.toBe(null)
    // New York: ~40.7128, ~-74.0061
    expect(result.lat).toBeCloseTo(40.7128, 3)
    expect(result.lng).toBeCloseTo(-74.0061, 3)
    expect(result.date).toBe('2025-07-04')
  })

  // --- Invalid EXIF structure ---

  it('returns null for JPEG with APP1 marker but bad Exif header', async () => {
    const buf = new ArrayBuffer(64)
    const dv = new DataView(buf)
    dv.setUint16(0, 0xFFD8) // SOI
    dv.setUint16(2, 0xFFE1) // APP1
    dv.setUint16(4, 20)     // length
    // Write "NotE" instead of "Exif"
    dv.setUint8(6, 0x4E)  // N
    dv.setUint8(7, 0x6F)  // o
    dv.setUint8(8, 0x74)  // t
    dv.setUint8(9, 0x45)  // E
    dv.setUint8(10, 0x00)
    dv.setUint8(11, 0x00)
    const file = new File([buf], 'bad.jpg', { type: 'image/jpeg' })
    expect(await parseExifGps(file)).toBe(null)
  })

  it('returns null for EXIF with invalid TIFF byte order', async () => {
    const buf = new ArrayBuffer(64)
    const dv = new DataView(buf)
    dv.setUint16(0, 0xFFD8) // SOI
    dv.setUint16(2, 0xFFE1) // APP1
    dv.setUint16(4, 30)     // length
    wStr(dv, 6, 'Exif')
    dv.setUint8(10, 0x00)
    dv.setUint8(11, 0x00)
    // Bad byte order: "XX" instead of "II" or "MM"
    dv.setUint8(12, 0x58) // X
    dv.setUint8(13, 0x58) // X
    const file = new File([buf], 'bad.jpg', { type: 'image/jpeg' })
    expect(await parseExifGps(file)).toBe(null)
  })
})
