/* exifParser.js — Minimal EXIF GPS + date extraction from JPEG files
 * No external dependencies. Reads first 64KB of file to find GPS coords and DateTimeOriginal.
 */

function readUint16(dv, off, le) { return le ? dv.getUint16(off, true) : dv.getUint16(off, false); }
function readUint32(dv, off, le) { return le ? dv.getUint32(off, true) : dv.getUint32(off, false); }

function readRational(dv, off, le) {
  const num = readUint32(dv, off, le);
  const den = readUint32(dv, off + 4, le);
  return den === 0 ? 0 : num / den;
}

function dmsToDecimal(d, m, s) { return d + m / 60 + s / 3600; }

function parseIFDTags(dv, ifdOff, tiffOff, le, tagsWanted) {
  const count = readUint16(dv, ifdOff, le);
  const result = {};
  for (let i = 0; i < count; i++) {
    const entryOff = ifdOff + 2 + i * 12;
    if (entryOff + 12 > dv.byteLength) break;
    const tag = readUint16(dv, entryOff, le);
    if (!tagsWanted.has(tag)) continue;
    const type = readUint16(dv, entryOff + 2, le);
    const numValues = readUint32(dv, entryOff + 4, le);
    let valOff = entryOff + 8;
    // If data > 4 bytes, the value field is an offset
    const typeSize = [0,1,1,2,4,8,1,1,2,4,8,4,8][type] || 1;
    if (numValues * typeSize > 4) {
      valOff = tiffOff + readUint32(dv, entryOff + 8, le);
    }
    if (valOff + numValues * typeSize > dv.byteLength) continue;
    if (type === 5 || type === 10) { // RATIONAL or SRATIONAL
      const rats = [];
      for (let r = 0; r < numValues; r++) rats.push(readRational(dv, valOff + r * 8, le));
      result[tag] = rats;
    } else if (type === 2) { // ASCII
      let str = "";
      for (let c = 0; c < numValues - 1; c++) str += String.fromCharCode(dv.getUint8(valOff + c));
      result[tag] = str;
    } else if (type === 3) { // SHORT
      result[tag] = readUint16(dv, valOff, le);
    } else if (type === 4) { // LONG
      result[tag] = readUint32(dv, valOff, le);
    }
  }
  return result;
}

/**
 * Parse EXIF GPS coordinates and DateTimeOriginal from a File.
 * @param {File} file - Image file (JPEG)
 * @returns {Promise<{lat: number|null, lng: number|null, date: string|null} | null>}
 *   date is "YYYY-MM-DD" or null
 */
export async function parseExifGps(file) {
  try {
    const slice = file.slice(0, 65536);
    const buf = await slice.arrayBuffer();
    const dv = new DataView(buf);
    // Find JPEG SOI
    if (dv.getUint16(0) !== 0xFFD8) return null;
    // Scan for APP1 (EXIF) marker
    let pos = 2;
    while (pos < dv.byteLength - 4) {
      const marker = dv.getUint16(pos);
      if (marker === 0xFFE1) break; // APP1
      if ((marker & 0xFF00) !== 0xFF00) return null;
      const segLen = dv.getUint16(pos + 2);
      pos += 2 + segLen;
    }
    if (pos >= dv.byteLength - 4) return null;
    const app1Off = pos + 4; // skip marker + length
    // Check "Exif\0\0"
    if (dv.getUint32(app1Off) !== 0x45786966 || dv.getUint16(app1Off + 4) !== 0x0000) return null;
    const tiffOff = app1Off + 6;
    const bo = dv.getUint16(tiffOff);
    const le = bo === 0x4949; // little-endian
    if (!le && bo !== 0x4D4D) return null;
    const ifd0Off = tiffOff + readUint32(dv, tiffOff + 4, le);
    // Tags we need from IFD0: 0x8825 = GPSInfo pointer, 0x8769 = ExifIFD pointer
    const ifd0 = parseIFDTags(dv, ifd0Off, tiffOff, le, new Set([0x8825, 0x8769]));
    let dateStr = null;
    // Read DateTimeOriginal (0x9003) from ExifIFD
    if (ifd0[0x8769]) {
      const exifIfdOff = tiffOff + ifd0[0x8769];
      if (exifIfdOff < dv.byteLength) {
        const exifTags = parseIFDTags(dv, exifIfdOff, tiffOff, le, new Set([0x9003]));
        if (exifTags[0x9003]) {
          // Format: "2024:03:15 10:30:00" -> "2024-03-15"
          dateStr = exifTags[0x9003].slice(0, 10).replace(/:/g, "-");
        }
      }
    }
    if (!ifd0[0x8825]) return dateStr ? { lat: null, lng: null, date: dateStr } : null;
    const gpsOff = tiffOff + ifd0[0x8825];
    if (gpsOff >= dv.byteLength) return null;
    // GPS tags: 1=LatRef, 2=Lat, 3=LngRef, 4=Lng
    const gps = parseIFDTags(dv, gpsOff, tiffOff, le, new Set([1, 2, 3, 4]));
    if (!gps[2] || !gps[4] || gps[2].length < 3 || gps[4].length < 3) {
      return dateStr ? { lat: null, lng: null, date: dateStr } : null;
    }
    let lat = dmsToDecimal(gps[2][0], gps[2][1], gps[2][2]);
    let lng = dmsToDecimal(gps[4][0], gps[4][1], gps[4][2]);
    if (gps[1] === "S") lat = -lat;
    if (gps[3] === "W") lng = -lng;
    return { lat, lng, date: dateStr };
  } catch (e) {
    console.warn("[exifParser] failed:", e);
    return null;
  }
}
