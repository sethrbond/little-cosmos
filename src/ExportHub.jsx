import { parseGoogleTimeline, getTimelineSummary, findOverlappingTrips } from "./importTimeline.js";
import { parseExifGps } from "./exifParser.js";
import { compressImage } from "./imageUtils.js";
import { supabase } from "./supabaseClient.js";
import { useState, useEffect, useCallback, useRef } from "react";

/* =================================================================
   ExportHub — Multi-format export & import for My Cosmos
   Export: JSON, CSV, HTML Report, KML, Timeline Text, Share Link
   Import: JSON backup, CSV spreadsheet
   ================================================================= */

// ---- helpers ----

function escapeCSV(val) {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateRange(start, end) {
  if (!start) return "";
  try {
    const s = new Date(start + "T12:00:00");
    const sMonth = s.toLocaleDateString("en-US", { month: "short" });
    const sDay = s.getDate();
    const sYear = s.getFullYear();
    if (!end || end === start) return `${sMonth} ${sDay}, ${sYear}`;
    const e = new Date(end + "T12:00:00");
    const eMonth = e.toLocaleDateString("en-US", { month: "short" });
    const eDay = e.getDate();
    const eYear = e.getFullYear();
    if (sYear === eYear && sMonth === eMonth) return `${sMonth} ${sDay}-${eDay}, ${sYear}`;
    if (sYear === eYear) return `${sMonth} ${sDay} - ${eMonth} ${eDay}, ${sYear}`;
    return `${sMonth} ${sDay}, ${sYear} - ${eMonth} ${eDay}, ${eYear}`;
  } catch { return start; }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sortedEntries(entries) {
  return [...entries].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
}

// KML type color mapping
const KML_COLORS = {
  // KML uses aaBBGGRR format (alpha, blue, green, red)
  adventure: "ff4c8c68", "road-trip": "ff4090b8", city: "ffa4886c",
  beach: "ffc0a888", cruise: "ffb0987c", backpacking: "ffa4b07c",
  friends: "ff88947c", family: "ff3870a0", event: "ff3890b8",
  nature: "ff4c8c68", work: "ff4090b8", home: "ff5890b8",
  together: "ffd098b8", special: "ff70a8d0", "home-seth": "ffc8a88c",
  "home-rosie": "ffa88ac4", "seth-solo": "ffd8bca0", "rosie-solo": "ffc0a8d8",
  "group-trip": "ffd098b8", weekend: "ff4c8c68", "night-out": "ff5890b8",
  hangout: "ffa4886c", concert: "ff70a8d0", sports: "ffb0987c",
  food: "ff4090b8", reunion: "ff3870a0", milestone: "ff70a8d0",
  "family-trip": "ffd098b8", holiday: "ff70a8d0", gathering: "ff5890b8",
  celebration: "ff3870a0", outdoors: "ff4c8c68", tradition: "ffc0a8d8",
};

// ---- Export generators ----

function generateJSON(entries, config, worldMode) {
  const payload = {
    _exportMeta: {
      format: "my-cosmos-backup",
      version: "9.1",
      exportDate: new Date().toISOString(),
      worldMode,
      entryCount: entries.length,
    },
    data: { entries },
    config,
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

function generateCSV(entries, worldMode) {
  const hasOurFields = worldMode === "our" || entries.some(e => e.who || e.loveNote);
  const columns = [
    "City", "Country", "Start Date", "End Date", "Type",
    "Notes", "Latitude", "Longitude", "Favorite",
    "Highlights", "Museums/Culture", "Restaurants/Food",
    "Stops Count", "Stop Cities", "Photo Count", "Photo URLs",
    ...(hasOurFields ? ["Who", "Love Note"] : []),
  ];
  const rows = [columns.map(escapeCSV).join(",")];
  for (const e of sortedEntries(entries)) {
    const stops = e.stops || [];
    const photos = e.photos || [];
    const stopCities = stops.map(s => [s.city, s.country].filter(Boolean).join("/")).join("; ");
    const row = [
      escapeCSV(e.city),
      escapeCSV(e.country),
      escapeCSV(e.dateStart),
      escapeCSV(e.dateEnd),
      escapeCSV(e.type),
      escapeCSV(e.notes),
      escapeCSV(e.lat),
      escapeCSV(e.lng),
      escapeCSV(e.favorite ? "Yes" : "No"),
      escapeCSV((e.highlights || []).join("; ")),
      escapeCSV((e.museums || []).join("; ")),
      escapeCSV((e.restaurants || []).join("; ")),
      escapeCSV(stops.length),
      escapeCSV(stopCities),
      escapeCSV(photos.length),
      escapeCSV(photos.join("; ")),
      ...(hasOurFields ? [escapeCSV(e.who), escapeCSV(e.loveNote)] : []),
    ];
    rows.push(row.join(","));
  }
  return new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
}

const safeColor = (c, fallback = '#c8a86e') => /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : fallback;

function generateHTMLReport(entries, config, stats, travelerName, palette, worldMode) {
  const sorted = sortedEntries(entries);
  const title = config?.title || (worldMode === "my" ? "My World" : "Our World");
  const name = travelerName || config?.travelerName || config?.youName || "Explorer";
  const accent = safeColor(palette?.rose, "#c48aa8");
  const accentLight = safeColor(palette?.roseLight, "#e4c0d4");
  const textColor = safeColor(palette?.text, "#2e2440");
  const bgColor = safeColor(palette?.cream, "#faf7f5");

  let dateRange = "";
  if (sorted.length > 0) {
    const first = sorted[0].dateStart || "";
    const last = sorted[sorted.length - 1].dateEnd || sorted[sorted.length - 1].dateStart || "";
    if (first) dateRange = formatDateRange(first, last);
  }

  const countriesSet = new Set(sorted.map(e => e.country).filter(Boolean));
  const citiesSet = new Set(sorted.map(e => e.city).filter(Boolean));
  const favCount = sorted.filter(e => e.favorite).length;

  const entryCards = sorted.map(e => {
    const loc = [e.city, e.country].filter(Boolean).join(", ");
    const dates = formatDateRange(e.dateStart, e.dateEnd);
    const sections = [];
    if (e.notes) sections.push(`<p class="notes">${escapeHTML(e.notes)}</p>`);
    const listFields = [
      { key: "highlights", label: "Highlights" },
      { key: "museums", label: "Culture" },
      { key: "restaurants", label: "Food & Drink" },
    ];
    for (const f of listFields) {
      const items = e[f.key];
      if (items && items.length > 0) {
        sections.push(`<div class="list-section"><strong>${escapeHTML(f.label)}:</strong> ${items.map(i => escapeHTML(i)).join(" &middot; ")}</div>`);
      }
    }
    // Stops section
    const stops = e.stops || [];
    let stopsHTML = "";
    if (stops.length > 0) {
      const stopItems = stops.map(s => {
        const sLoc = [s.city, s.country].filter(Boolean).join(", ");
        const sDates = formatDateRange(s.dateStart, s.dateEnd);
        return `<span class="stop-item">${escapeHTML(sLoc)}${sDates ? ` <span class="stop-dates">(${escapeHTML(sDates)})</span>` : ""}</span>`;
      }).join(" &rarr; ");
      stopsHTML = `<div class="stops-section"><strong>Stops:</strong> ${stopItems}</div>`;
    }

    // Photos section
    const photos = e.photos || [];
    let photosHTML = "";
    if (photos.length > 0) {
      const thumbs = photos.slice(0, 6).map(url =>
        `<img src="${escapeHTML(url)}" class="photo-thumb" alt="Photo" onerror="this.style.display='none'" />`
      ).join("");
      const moreLabel = photos.length > 6 ? `<span class="photo-more">+${photos.length - 6} more</span>` : "";
      photosHTML = `<div class="photos-section">${thumbs}${moreLabel}</div>`;
    }

    return `
      <div class="entry-card">
        <div class="entry-header">
          <span class="entry-location">${escapeHTML(loc)}</span>
          <span class="entry-dates">${escapeHTML(dates)}</span>
        </div>
        <div class="entry-type">${escapeHTML(e.type || "")}</div>
        ${sections.join("\n")}
        ${stopsHTML}
        ${photosHTML}
        ${e.favorite ? '<div class="favorite-badge">Favorite</div>' : ""}
      </div>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(title)} — Travel Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Inter:wght@300;400;500&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: ${bgColor};
    color: ${textColor};
    line-height: 1.6;
    padding: 0;
  }
  .hero {
    background: linear-gradient(135deg, ${accent}18, ${accentLight}20);
    border-bottom: 1px solid ${accent}25;
    padding: 60px 40px;
    text-align: center;
  }
  .hero h1 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 42px;
    font-weight: 600;
    color: ${textColor};
    letter-spacing: 0.04em;
    margin-bottom: 8px;
  }
  .hero .subtitle {
    font-size: 14px;
    color: ${accent};
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .hero .date-range {
    font-size: 13px;
    color: ${textColor}90;
    margin-top: 8px;
  }
  .stats-bar {
    display: flex;
    justify-content: center;
    gap: 40px;
    padding: 28px 20px;
    background: white;
    border-bottom: 1px solid ${accent}15;
    flex-wrap: wrap;
  }
  .stat {
    text-align: center;
  }
  .stat .num {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 32px;
    font-weight: 600;
    color: ${accent};
  }
  .stat .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: ${textColor}80;
  }
  .entries-container {
    max-width: 720px;
    margin: 40px auto;
    padding: 0 20px;
  }
  .entry-card {
    background: white;
    border: 1px solid ${accent}15;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
    page-break-inside: avoid;
  }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .entry-location {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 22px;
    font-weight: 600;
    color: ${textColor};
  }
  .entry-dates {
    font-size: 12px;
    color: ${textColor}80;
  }
  .entry-type {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: ${accent};
    margin-bottom: 10px;
  }
  .notes {
    font-size: 14px;
    color: ${textColor}cc;
    margin-bottom: 10px;
    line-height: 1.7;
  }
  .list-section {
    font-size: 13px;
    color: ${textColor}bb;
    margin-bottom: 6px;
  }
  .list-section strong {
    color: ${textColor}dd;
  }
  .stops-section {
    font-size: 13px;
    color: ${textColor}bb;
    margin-bottom: 8px;
    line-height: 1.7;
  }
  .stops-section strong {
    color: ${textColor}dd;
  }
  .stop-item {
    white-space: nowrap;
  }
  .stop-dates {
    font-size: 11px;
    color: ${textColor}80;
  }
  .photos-section {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
    margin-bottom: 8px;
    align-items: center;
  }
  .photo-thumb {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid ${accent}20;
  }
  .photo-more {
    font-size: 11px;
    color: ${textColor}80;
    padding-left: 4px;
  }
  .favorite-badge {
    display: inline-block;
    margin-top: 10px;
    padding: 2px 10px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${accent};
    background: ${accent}12;
    border: 1px solid ${accent}30;
    border-radius: 20px;
  }
  .footer {
    text-align: center;
    padding: 40px 20px;
    font-size: 11px;
    color: ${textColor}60;
    border-top: 1px solid ${accent}15;
  }
  @media print {
    .hero { padding: 30px 20px; }
    .entry-card { box-shadow: none; border: 1px solid #ddd; }
  }
  @media (max-width: 600px) {
    .hero { padding: 40px 20px; }
    .hero h1 { font-size: 28px; }
    .stats-bar { gap: 20px; }
    .stat .num { font-size: 24px; }
  }
</style>
</head>
<body>
  <div class="hero">
    <div class="subtitle">${escapeHTML(name)}'s Travel Report</div>
    <h1>${escapeHTML(title)}</h1>
    ${dateRange ? `<div class="date-range">${escapeHTML(dateRange)}</div>` : ""}
  </div>
  <div class="stats-bar">
    <div class="stat"><div class="num">${sorted.length}</div><div class="label">Entries</div></div>
    <div class="stat"><div class="num">${citiesSet.size}</div><div class="label">Cities</div></div>
    <div class="stat"><div class="num">${countriesSet.size}</div><div class="label">Countries</div></div>
    ${favCount > 0 ? `<div class="stat"><div class="num">${favCount}</div><div class="label">Favorites</div></div>` : ""}
  </div>
  <div class="entries-container">
    ${sorted.length === 0 ? '<p style="text-align:center;color:#999;padding:40px;">No entries yet. Start exploring!</p>' : entryCards}
  </div>
  <div class="footer">
    Generated by My Cosmos &middot; ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
  </div>
</body>
</html>`;
  return new Blob([html], { type: "text/html;charset=utf-8" });
}

function generateKML(entries, config, worldMode) {
  const title = config?.title || (worldMode === "my" ? "My World" : "Our World");
  const sorted = sortedEntries(entries);

  // Build style definitions for each type
  const typesUsed = new Set(sorted.map(e => e.type).filter(Boolean));
  const styles = [...typesUsed].map(type => {
    const color = KML_COLORS[type] || "ff0088ff";
    return `  <Style id="style-${escapeXML(type)}">
    <IconStyle>
      <color>${color}</color>
      <scale>1.1</scale>
      <Icon><href>http://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href></Icon>
    </IconStyle>
    <LabelStyle><scale>0.9</scale></LabelStyle>
  </Style>`;
  }).join("\n");

  const placemarks = sorted.map(e => {
    if (e.lat == null || e.lng == null) return "";
    const loc = [e.city, e.country].filter(Boolean).join(", ");
    const dates = formatDateRange(e.dateStart, e.dateEnd);
    const descParts = [];
    if (dates) descParts.push(dates);
    if (e.type) descParts.push(`Type: ${e.type}`);
    if (e.notes) descParts.push(e.notes);
    if (e.highlights?.length) descParts.push(`Highlights: ${e.highlights.join(", ")}`);
    const stops = e.stops || [];
    if (stops.length > 0) {
      const stopList = stops.map(s => [s.city, s.country].filter(Boolean).join(", ")).join(" → ");
      descParts.push(`Stops: ${stopList}`);
    }
    const photos = e.photos || [];
    if (photos.length > 0) {
      descParts.push(`Photos: ${photos.length}`);
    }
    const desc = descParts.map(escapeXML).join("<br/>");
    const styleRef = e.type ? `#style-${escapeXML(e.type)}` : "";

    return `  <Placemark>
    <name>${escapeXML(loc || "Untitled")}</name>
    <description><![CDATA[${desc.replace(/]]>/g, ']]]]><![CDATA[>')}]]></description>
    ${styleRef ? `<styleUrl>${styleRef}</styleUrl>` : ""}
    <Point><coordinates>${e.lng},${e.lat},0</coordinates></Point>
  </Placemark>`;
  }).filter(Boolean).join("\n");

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${escapeXML(title)}</name>
  <description>Exported from My Cosmos on ${new Date().toISOString().slice(0, 10)}</description>
${styles}
${placemarks}
</Document>
</kml>`;
  return new Blob([kml], { type: "application/vnd.google-earth.kml+xml;charset=utf-8" });
}

function generateTimeline(entries) {
  const sorted = sortedEntries(entries);
  if (sorted.length === 0) return "No entries yet.";
  const lines = sorted.map(e => {
    const loc = [e.city, e.country].filter(Boolean).join(", ") || "Unknown";
    const dates = formatDateRange(e.dateStart, e.dateEnd);
    const note = e.notes ? `: ${e.notes}` : "";
    const stops = e.stops || [];
    const stopsStr = stops.length > 0
      ? ` [Stops: ${stops.map(s => [s.city, s.country].filter(Boolean).join(", ")).join(" → ")}]`
      : "";
    const photoStr = (e.photos || []).length > 0 ? ` (${e.photos.length} photos)` : "";
    return `${dates || "No date"} -- ${loc}${note}${stopsStr}${photoStr}`;
  });
  return lines.join("\n");
}

// ---- CSV Parser (handles quoted fields, commas within quotes, newlines in quotes) ----

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(field);
        field = "";
        i++;
      } else if (ch === '\r') {
        // skip \r, handle \n next
        i++;
      } else if (ch === '\n') {
        row.push(field);
        field = "";
        if (row.some(f => f.trim() !== "")) rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }
  // last field/row
  row.push(field);
  if (row.some(f => f.trim() !== "")) rows.push(row);
  return rows;
}

// Column name mapping: CSV header -> entry field
const CSV_COLUMN_MAP = {
  "city": "city",
  "country": "country",
  "start date": "dateStart",
  "end date": "dateEnd",
  "type": "type",
  "notes": "notes",
  "latitude": "lat",
  "longitude": "lng",
  "favorite": "favorite",
  "highlights": "highlights",
  "museums/culture": "museums",
  "restaurants/food": "restaurants",
  "who": "who",
  "love note": "loveNote",
  "photo urls": "photos",
  "photo count": "_photoCount",
  "stops count": "_stopsCount",
  "stop cities": "_stopCities",
};

function normalizeCSVHeader(header) {
  return header.trim().toLowerCase();
}

function parseCSVEntries(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("CSV file must have a header row and at least one data row.");
  const headers = rows[0].map(normalizeCSVHeader);
  const fieldMap = headers.map(h => CSV_COLUMN_MAP[h] || null);

  const entries = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const entry = {};
    for (let c = 0; c < fieldMap.length; c++) {
      const key = fieldMap[c];
      if (!key || key.startsWith("_")) continue;
      const val = (row[c] || "").trim();
      if (!val) continue;
      if (key === "lat" || key === "lng") {
        const n = parseFloat(val);
        if (!isNaN(n)) entry[key] = n;
      } else if (key === "favorite") {
        entry[key] = val.toLowerCase() === "yes" || val.toLowerCase() === "true";
      } else if (key === "highlights" || key === "museums" || key === "restaurants") {
        entry[key] = val.split(";").map(s => s.trim()).filter(Boolean);
      } else if (key === "photos") {
        entry[key] = val.split(";").map(s => s.trim()).filter(Boolean);
      } else {
        entry[key] = val;
      }
    }
    // Generate an ID if missing
    if (!entry.id) entry.id = `e-${Date.now()}-${r}`;
    entries.push(entry);
  }
  return entries;
}

function parseJSONEntries(text) {
  const parsed = JSON.parse(text);
  // Handle the app's export format: { _exportMeta, data: { entries }, config }
  if (parsed._exportMeta && parsed.data?.entries) {
    return parsed.data.entries;
  }
  // Handle plain array of entries
  if (Array.isArray(parsed)) {
    return parsed;
  }
  // Handle { entries: [...] }
  if (parsed.entries && Array.isArray(parsed.entries)) {
    return parsed.entries;
  }
  throw new Error("Unrecognized JSON format. Expected an array of entries or a My Cosmos backup file.");
}

const REQUIRED_FIELDS = ["city", "country", "lat", "lng", "dateStart"];

function validateEntries(entries) {
  const errors = [];
  const valid = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const missing = REQUIRED_FIELDS.filter(f => {
      if (f === "lat" || f === "lng") return e[f] == null || isNaN(e[f]);
      return !e[f];
    });
    if (missing.length > 0) {
      errors.push(`Row ${i + 1} (${e.city || "unknown"}): missing ${missing.join(", ")}`);
    } else {
      // Ensure lat/lng are numbers
      e.lat = Number(e.lat);
      e.lng = Number(e.lng);
      // Ensure ID exists
      if (!e.id) e.id = `e-${Date.now()}-${i}`;
      valid.push(e);
    }
  }
  return { valid, errors };
}

// ---- Export option card data ----
const EXPORT_OPTIONS = [
  {
    id: "json",
    icon: "{ }",
    title: "JSON Backup",
    desc: "Full data export with entries, config, and metadata. Reimportable.",
    action: "Download .json",
  },
  {
    id: "csv",
    icon: "|||",
    title: "CSV Spreadsheet",
    desc: "Entries as a spreadsheet-ready CSV. Open in Excel or Google Sheets.",
    action: "Download .csv",
  },
  {
    id: "html",
    icon: "</>",
    title: "Travel Report",
    desc: "Beautiful standalone HTML page with all your travels. Print-friendly.",
    action: "Download .html",
    extra: "preview",
  },
  {
    id: "kml",
    icon: "\u{1F310}",
    title: "KML / Google Earth",
    desc: "Placemarks for every entry. View your travels in Google Earth.",
    action: "Download .kml",
  },
  {
    id: "timeline",
    icon: "\u{1F4C5}",
    title: "Timeline Text",
    desc: "Chronological text summary of all your travels. Easy to share.",
    action: "Copy to clipboard",
    extra: "download",
  },
  {
    id: "share",
    icon: "\u{1F517}",
    title: "Share Link",
    desc: "Generate a public link to your travel profile.",
    action: "Coming soon",
    disabled: true,
  },
];

// ---- Component ----

export default function ExportHub({ entries = [], config = {}, stats = {}, palette, onClose, onImport, worldMode, travelerName, partnerEntries, onMarkTogether }) {
  const P = palette || {};
  const [status, setStatus] = useState({}); // { [id]: "loading" | "done" | "error" }
  const [activeTab, setActiveTab] = useState("export"); // "export" | "import"
  const overlayRef = useRef(null);

  // ---- Import state ----
  const [importFile, setImportFile] = useState(null);
  const [importParsed, setImportParsed] = useState(null); // { valid: [], errors: [] }
  const [importError, setImportError] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const fileInputTimelineRef = useRef(null);
  const [importMode, setImportMode] = useState("file");
  const [timelineFile, setTimelineFile] = useState(null);
  const [timelineParsed, setTimelineParsed] = useState(null);
  const [timelineSummary, setTimelineSummary] = useState(null);
  const [timelineSelected, setTimelineSelected] = useState(new Set());
  const [timelineError, setTimelineError] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineImporting, setTimelineImporting] = useState(false);
  const [timelineProgress, setTimelineProgress] = useState(0);
  const [timelineDone, setTimelineDone] = useState(false);
  const [timelineImportedCount, setTimelineImportedCount] = useState(0);
  const [timelineOverlaps, setTimelineOverlaps] = useState(null);
  const [timelineOverlapsDone, setTimelineOverlapsDone] = useState(false);

  // ---- Photo import state ----
  const [photoFiles, setPhotoFiles] = useState(null);
  const [photoGroups, setPhotoGroups] = useState(null);
  const [photoParsing, setPhotoParsing] = useState(false);
  const [photoParseProgress, setPhotoParseProgress] = useState("");
  const [photoError, setPhotoError] = useState(null);
  const [photoImporting, setPhotoImporting] = useState(false);
  const [photoImportProgress, setPhotoImportProgress] = useState(0);
  const [photoDone, setPhotoDone] = useState(false);
  const [photoImportedCount, setPhotoImportedCount] = useState(0);
  const [photoSelected, setPhotoSelected] = useState(new Set());
  const fileInputPhotosRef = useRef(null);

  // Close on escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on overlay click
  const handleOverlayClick = useCallback((e) => {
    if (e.target === overlayRef.current) onClose?.();
  }, [onClose]);

  const setCardStatus = useCallback((id, s) => {
    setStatus(prev => ({ ...prev, [id]: s }));
    if (s === "done") {
      setTimeout(() => setStatus(prev => ({ ...prev, [id]: null })), 2500);
    }
  }, []);

  const handleExport = useCallback((id, opts = {}) => {
    if (id === "share") return;
    setCardStatus(id, "loading");
    try {
      const filename = (config?.title || worldMode || "cosmos").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      switch (id) {
        case "json": {
          const blob = generateJSON(entries, config, worldMode);
          downloadBlob(blob, `${filename}-backup.json`);
          break;
        }
        case "csv": {
          const blob = generateCSV(entries, worldMode);
          downloadBlob(blob, `${filename}-entries.csv`);
          break;
        }
        case "html": {
          const blob = generateHTMLReport(entries, config, stats, travelerName, P, worldMode);
          if (opts.preview) {
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60000);
          } else {
            downloadBlob(blob, `${filename}-report.html`);
          }
          break;
        }
        case "kml": {
          const blob = generateKML(entries, config, worldMode);
          downloadBlob(blob, `${filename}.kml`);
          break;
        }
        case "timeline": {
          const text = generateTimeline(entries);
          if (opts.download) {
            const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
            downloadBlob(blob, `${filename}-timeline.txt`);
          } else {
            navigator.clipboard.writeText(text).catch(() => {
              // Fallback: download instead
              const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
              downloadBlob(blob, `${filename}-timeline.txt`);
            });
          }
          break;
        }
        default: break;
      }
      setCardStatus(id, "done");
    } catch (err) {
      console.error("Export failed:", err);
      setCardStatus(id, "error");
      setTimeout(() => setCardStatus(id, null), 3000);
    }
  }, [entries, config, stats, travelerName, P, worldMode, setCardStatus]);

  // ---- Import handlers ----
  const resetImport = useCallback(() => {
    setImportFile(null);
    setImportParsed(null);
    setImportError(null);
    setImportDone(false);
  }, []);

  const processFile = useCallback((file) => {
    resetImport();
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext !== "json" && ext !== "csv") {
      setImportError("Unsupported file type. Please upload a .json or .csv file.");
      return;
    }
    setImportFile(file);
    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        let rawEntries;
        if (ext === "json") {
          rawEntries = parseJSONEntries(text);
        } else {
          rawEntries = parseCSVEntries(text);
        }
        if (!rawEntries || rawEntries.length === 0) {
          setImportError("No entries found in the file.");
          setImportLoading(false);
          return;
        }
        const result = validateEntries(rawEntries);
        setImportParsed(result);
        setImportLoading(false);
      } catch (err) {
        console.error("Import parse error:", err);
        setImportError(err.message || "Couldn't parse file. Please check the format.");
        setImportLoading(false);
      }
    };
    reader.onerror = () => {
      setImportError("Couldn't read file.");
      setImportLoading(false);
    };
    reader.readAsText(file);
  }, [resetImport]);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleImportAll = useCallback(async () => {
    if (!importParsed?.valid?.length || !onImport) return;
    setImportLoading(true);
    try {
      await onImport(importParsed.valid);
      setImportDone(true);
      setImportLoading(false);
    } catch (err) {
      console.error("Import failed:", err);
      setImportError(err.message || "Import failed. Please try again.");
      setImportLoading(false);
    }
  }, [importParsed, onImport]);

  // ---- Google Timeline handlers ----
  const resetTimeline = useCallback(() => {
    setTimelineFile(null); setTimelineParsed(null); setTimelineSummary(null);
    setTimelineSelected(new Set()); setTimelineError(null);
    setTimelineLoading(false); setTimelineImporting(false); setTimelineProgress(0);
    setTimelineDone(false); setTimelineImportedCount(0);
    setTimelineOverlaps(null); setTimelineOverlapsDone(false);
  }, []);

  const processTimelineFile = useCallback((file) => {
    resetTimeline();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setTimelineError("Please upload a .json file from Google Takeout.");
      return;
    }
    setTimelineFile(file);
    setTimelineLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        const trips = parseGoogleTimeline(json);
        if (trips.length === 0) {
          setTimelineError("No location visits found. Make sure this is a Google Takeout location history file.");
          setTimelineLoading(false);
          return;
        }
        setTimelineParsed(trips);
        setTimelineSummary(getTimelineSummary(trips));
        setTimelineSelected(new Set(trips.map((_, i) => i)));
        setTimelineLoading(false);
      } catch (err) {
        console.error("Timeline parse error:", err);
        setTimelineError(err.message || "Could not parse file.");
        setTimelineLoading(false);
      }
    };
    reader.onerror = () => { setTimelineError("Could not read file."); setTimelineLoading(false); };
    reader.readAsText(file);
  }, [resetTimeline]);

  const handleTimelineFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) processTimelineFile(file);
  }, [processTimelineFile]);

  const handleTimelineToggle = useCallback((idx) => {
    setTimelineSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const handleTimelineSelectAll = useCallback(() => {
    if (!timelineParsed) return;
    setTimelineSelected(prev => prev.size === timelineParsed.length ? new Set() : new Set(timelineParsed.map((_, i) => i)));
  }, [timelineParsed, timelineSelected]);

  const handleTimelineImport = useCallback(async () => {
    if (!timelineParsed || !onImport || timelineSelected.size === 0) return;
    setTimelineImporting(true); setTimelineProgress(0);
    try {
      const selected = timelineParsed.filter((_, i) => timelineSelected.has(i));
      const total = selected.length;
      const BATCH = 10;
      let imported = 0;
      for (let i = 0; i < total; i += BATCH) {
        const batch = selected.slice(i, i + BATCH);
        await onImport(batch);
        imported += batch.length;
        setTimelineProgress(Math.round((imported / total) * 100));
        await new Promise(r => setTimeout(r, 0));
      }
      setTimelineImportedCount(imported);
      setTimelineDone(true);
      setTimelineImporting(false);
      if (partnerEntries && partnerEntries.length > 0) {
        const overlaps = findOverlappingTrips(selected, partnerEntries);
        if (overlaps.length > 0) setTimelineOverlaps(overlaps);
      }
    } catch (err) {
      console.error("Timeline import failed:", err);
      setTimelineError(err.message || "Import failed.");
      setTimelineImporting(false);
    }
  }, [timelineParsed, timelineSelected, onImport, partnerEntries]);

  const handleMarkTogether = useCallback(async () => {
    if (!timelineOverlaps || !onMarkTogether) return;
    try { await onMarkTogether(timelineOverlaps); setTimelineOverlapsDone(true); }
    catch (err) { console.error("Mark together failed:", err); }
  }, [timelineOverlaps, onMarkTogether]);

  // ---- Styles ----

  // ---- Photo import handlers ----
  const resetPhotos = useCallback(() => {
    setPhotoFiles(null); setPhotoGroups(null); setPhotoParsing(false);
    setPhotoParseProgress(""); setPhotoError(null); setPhotoImporting(false);
    setPhotoImportProgress(0); setPhotoDone(false); setPhotoImportedCount(0);
    setPhotoSelected(new Set());
  }, []);

  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "json", addressdetails: "1", "accept-language": "en" });
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { headers: { "User-Agent": "LittleCosmos/1.0 (travel diary app)" } });
      if (!res.ok) return null;
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || addr.state || "";
      const country = addr.country || "";
      return { city, country };
    } catch { return null; }
  }, []);

  const processPhotoFiles = useCallback(async (files) => {
    resetPhotos();
    if (!files || files.length === 0) return;
    setPhotoFiles(files);
    setPhotoParsing(true);
    setPhotoParseProgress("Reading EXIF data...");

    try {
      // Parse EXIF from all files
      const parsed = [];
      for (let i = 0; i < files.length; i++) {
        setPhotoParseProgress(`Reading EXIF ${i + 1} / ${files.length}...`);
        const exif = await parseExifGps(files[i]);
        if (exif && exif.lat && exif.lng) {
          parsed.push({ file: files[i], ...exif, thumb: URL.createObjectURL(files[i]) });
        }
      }

      if (parsed.length === 0) {
        setPhotoError("No GPS data found in any of the selected photos. Only JPEG photos with embedded GPS coordinates can be imported.");
        setPhotoParsing(false);
        return;
      }

      setPhotoParseProgress(`Reverse geocoding ${parsed.length} locations...`);

      // Reverse geocode each unique location (batch nearby coords)
      const geocodeCache = new Map();
      for (let i = 0; i < parsed.length; i++) {
        const p = parsed[i];
        // Round to ~1km grid for caching
        const key = `${(p.lat * 100 | 0) / 100},${(p.lng * 100 | 0) / 100}`;
        if (geocodeCache.has(key)) {
          const cached = geocodeCache.get(key);
          p.city = cached.city;
          p.country = cached.country;
        } else {
          // Rate limit: 1 req/sec for Nominatim
          if (i > 0) await new Promise(r => setTimeout(r, 1100));
          setPhotoParseProgress(`Geocoding ${i + 1} / ${parsed.length}...`);
          const geo = await reverseGeocode(p.lat, p.lng);
          if (geo) {
            p.city = geo.city;
            p.country = geo.country;
            geocodeCache.set(key, geo);
          } else {
            p.city = "Unknown";
            p.country = "";
            geocodeCache.set(key, { city: "Unknown", country: "" });
          }
        }
      }

      // Group by location + date (same city within 3 days)
      const sorted = parsed.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      const groups = [];
      for (const photo of sorted) {
        const dateMs = photo.date ? new Date(photo.date + "T12:00:00").getTime() : 0;
        let matched = false;
        for (const g of groups) {
          if (g.city === photo.city && g.country === photo.country) {
            const gDateMs = g.dateEnd ? new Date(g.dateEnd + "T12:00:00").getTime() : (g.dateStart ? new Date(g.dateStart + "T12:00:00").getTime() : 0);
            if (dateMs && gDateMs && Math.abs(dateMs - gDateMs) <= 3 * 86400000) {
              g.photos.push(photo);
              if (photo.date && (!g.dateStart || photo.date < g.dateStart)) g.dateStart = photo.date;
              if (photo.date && (!g.dateEnd || photo.date > g.dateEnd)) g.dateEnd = photo.date;
              matched = true;
              break;
            }
          }
        }
        if (!matched) {
          groups.push({
            city: photo.city,
            country: photo.country,
            lat: photo.lat,
            lng: photo.lng,
            dateStart: photo.date || null,
            dateEnd: photo.date || null,
            photos: [photo],
          });
        }
      }

      setPhotoGroups(groups);
      setPhotoSelected(new Set(groups.map((_, i) => i)));
      setPhotoParsing(false);
      setPhotoParseProgress("");
    } catch (err) {
      console.error("Photo import parse error:", err);
      setPhotoError(err.message || "Failed to process photos.");
      setPhotoParsing(false);
    }
  }, [resetPhotos, reverseGeocode]);

  const handlePhotoFileSelect = useCallback((e) => {
    const files = e.target.files;
    if (files && files.length > 0) processPhotoFiles(Array.from(files));
  }, [processPhotoFiles]);

  const handlePhotoToggle = useCallback((idx) => {
    setPhotoSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const handlePhotoSelectAll = useCallback(() => {
    if (!photoGroups) return;
    setPhotoSelected(prev => prev.size === photoGroups.length ? new Set() : new Set(photoGroups.map((_, i) => i)));
  }, [photoGroups]);

  const handlePhotoImport = useCallback(async () => {
    if (!photoGroups || !onImport || photoSelected.size === 0) return;
    setPhotoImporting(true); setPhotoImportProgress(0);
    try {
      const selected = photoGroups.filter((_, i) => photoSelected.has(i));
      const total = selected.length;
      let imported = 0;

      for (const group of selected) {
        const entryId = `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const photoUrls = [];

        // Upload photos to Supabase
        for (const photo of group.photos) {
          try {
            const compressed = await compressImage(photo.file);
            const ext = compressed.name.split(".").pop() || "jpg";
            const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const path = `${entryId}/${safeName}`;
            const { error } = await supabase.storage.from("photos").upload(path, compressed, { cacheControl: "31536000", upsert: false, contentType: compressed.type || "image/jpeg" });
            if (!error) {
              const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
              if (urlData?.publicUrl) photoUrls.push(urlData.publicUrl);
            }
          } catch { /* skip failed upload */ }
        }

        const entry = {
          id: entryId,
          city: group.city,
          country: group.country,
          lat: group.lat,
          lng: group.lng,
          dateStart: group.dateStart,
          dateEnd: group.dateEnd || group.dateStart,
          type: "adventure",
          notes: `Imported from ${group.photos.length} photo${group.photos.length === 1 ? "" : "s"}`,
          photos: photoUrls,
        };

        await onImport([entry]);
        imported++;
        setPhotoImportProgress(Math.round((imported / total) * 100));
      }

      setPhotoImportedCount(imported);
      setPhotoDone(true);
      setPhotoImporting(false);
      // Clean up object URLs
      for (const g of photoGroups) {
        for (const p of g.photos) {
          if (p.thumb) URL.revokeObjectURL(p.thumb);
        }
      }
    } catch (err) {
      console.error("Photo import failed:", err);
      setPhotoError(err.message || "Import failed.");
      setPhotoImporting(false);
    }
  }, [photoGroups, photoSelected, onImport]);

  const accent = P.rose || "#c48aa8";
  const text = P.text || "#2e2440";
  const textMid = P.textMid || "#584c6e";
  const textMuted = P.textMuted || "#8878a0";
  const textFaint = P.textFaint || "#b8aec8";
  const cardBg = P.card || "rgba(252,249,246,0.96)";
  const cream = P.cream || "#faf7f5";
  const parchment = P.parchment || "#f3ede8";

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 99999,
    background: "rgba(10, 8, 20, 0.75)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    animation: "exportHubFadeIn 0.25s ease-out",
  };

  const modalStyle = {
    background: `linear-gradient(145deg, ${cream}, ${parchment})`,
    borderRadius: 20,
    border: `1px solid ${accent}20`,
    maxWidth: 680,
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: `0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px ${accent}10`,
    padding: "36px 32px 28px",
    position: "relative",
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
    gap: 14,
    marginTop: 20,
  };

  return (
    <>
      <style>{`
        @keyframes exportHubFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes exportCardPop {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
      <div ref={overlayRef} role="dialog" aria-modal="true" aria-label="Export hub" style={overlayStyle} onClick={handleOverlayClick}>
        <div style={modalStyle}>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 14, right: 16,
              background: "none", border: "none", cursor: "pointer",
              fontSize: 20, color: textMuted, lineHeight: 1,
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 8, transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${accent}12`; e.currentTarget.style.color = text; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = textMuted; }}
            title="Close (Esc)"
          >
            &#x2715;
          </button>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <div style={{
              fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
              color: accent, marginBottom: 6, fontWeight: 500,
            }}>
              Export & Import
            </div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 26, fontWeight: 600, color: text,
              margin: 0, letterSpacing: "0.02em",
            }}>
              Take Your World With You
            </h2>
          </div>

          {/* Tab switcher */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 4,
            margin: "16px 0 0",
            background: `${parchment}`,
            borderRadius: 10, padding: 3,
            border: `1px solid ${accent}12`,
          }}>
            {[
              { id: "export", label: "Export" },
              { id: "import", label: "Import" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); if (tab.id === "export") resetImport(); }}
                style={{
                  flex: 1,
                  padding: "8px 16px",
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  letterSpacing: "0.04em",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: activeTab === tab.id
                    ? `linear-gradient(135deg, ${accent}20, ${accent}10)`
                    : "transparent",
                  color: activeTab === tab.id ? accent : textMuted,
                  boxShadow: activeTab === tab.id ? `0 1px 4px ${accent}10` : "none",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{
            height: 1, margin: "14px 0",
            background: `linear-gradient(90deg, transparent, ${accent}20, transparent)`,
          }} />

          {/* ===== EXPORT TAB ===== */}
          {activeTab === "export" && (
            <>
              <p style={{
                fontSize: 12, color: textMuted, textAlign: "center", marginBottom: 4,
              }}>
                {entries.length === 0
                  ? "No entries to export yet. Add some travels first!"
                  : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} ready to export`}
              </p>
              <div style={gridStyle}>
                {EXPORT_OPTIONS.map((opt, i) => {
                  const st = status[opt.id];
                  const isDisabled = opt.disabled || entries.length === 0;
                  return (
                    <div
                      key={opt.id}
                      style={{
                        background: cardBg,
                        border: `1px solid ${accent}${isDisabled ? "08" : "15"}`,
                        borderRadius: 14,
                        padding: "20px 16px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        opacity: isDisabled ? 0.5 : 1,
                        animation: `exportCardPop 0.3s ease-out ${i * 0.05}s both`,
                        transition: "all 0.2s",
                        cursor: isDisabled ? "default" : "pointer",
                        position: "relative",
                        overflow: "hidden",
                      }}
                      onMouseEnter={e => {
                        if (!isDisabled) {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = `0 6px 20px ${accent}12`;
                          e.currentTarget.style.borderColor = `${accent}30`;
                        }
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.borderColor = `${accent}${isDisabled ? "08" : "15"}`;
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        fontSize: 22, width: 42, height: 42,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: `linear-gradient(135deg, ${accent}10, ${accent}05)`,
                        borderRadius: 10, color: accent,
                        fontWeight: 700, fontFamily: "monospace",
                        border: `1px solid ${accent}10`,
                      }}>
                        {opt.icon}
                      </div>

                      {/* Title & desc */}
                      <div>
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: text,
                          marginBottom: 3, letterSpacing: "0.01em",
                        }}>
                          {opt.title}
                        </div>
                        <div style={{
                          fontSize: 10.5, color: textMuted, lineHeight: 1.45,
                        }}>
                          {opt.desc}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ marginTop: "auto", paddingTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          disabled={isDisabled}
                          onClick={(e) => { e.stopPropagation(); handleExport(opt.id); }}
                          style={{
                            flex: 1,
                            padding: "7px 10px",
                            background: isDisabled
                              ? `${parchment}`
                              : st === "done"
                                ? `linear-gradient(135deg, #90b08030, #90b08015)`
                                : st === "error"
                                  ? `linear-gradient(135deg, #d0686830, #d0686815)`
                                  : `linear-gradient(135deg, ${accent}18, ${accent}08)`,
                            border: `1px solid ${isDisabled ? textFaint + "20" : st === "done" ? "#90b08040" : st === "error" ? "#d0686840" : accent + "25"}`,
                            borderRadius: 8,
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            fontSize: 10,
                            fontFamily: "inherit",
                            fontWeight: 500,
                            color: isDisabled ? textFaint : st === "done" ? "#688c5c" : st === "error" ? "#d06868" : accent,
                            transition: "all 0.2s",
                            letterSpacing: "0.02em",
                            whiteSpace: "nowrap",
                          }}
                          onMouseEnter={e => { if (!isDisabled) e.currentTarget.style.background = `linear-gradient(135deg, ${accent}28, ${accent}14)`; }}
                          onMouseLeave={e => { if (!isDisabled) e.currentTarget.style.background = `linear-gradient(135deg, ${accent}18, ${accent}08)`; }}
                        >
                          {st === "loading" ? "..." : st === "done" ? "Done!" : st === "error" ? "Failed" : opt.action}
                        </button>

                        {/* Extra button: preview or download */}
                        {opt.extra === "preview" && !isDisabled && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleExport(opt.id, { preview: true }); }}
                            style={{
                              padding: "7px 10px",
                              background: `linear-gradient(135deg, ${P.sky || "#8ca8c8"}18, ${P.sky || "#8ca8c8"}08)`,
                              border: `1px solid ${P.sky || "#8ca8c8"}25`,
                              borderRadius: 8, cursor: "pointer",
                              fontSize: 10, fontFamily: "inherit", fontWeight: 500,
                              color: P.sky || "#8ca8c8",
                              transition: "all 0.2s", letterSpacing: "0.02em",
                              whiteSpace: "nowrap",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(135deg, ${P.sky || "#8ca8c8"}28, ${P.sky || "#8ca8c8"}14)`}
                            onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg, ${P.sky || "#8ca8c8"}18, ${P.sky || "#8ca8c8"}08)`}
                          >
                            Preview
                          </button>
                        )}
                        {opt.extra === "download" && !isDisabled && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleExport(opt.id, { download: true }); }}
                            style={{
                              padding: "7px 10px",
                              background: `linear-gradient(135deg, ${P.sky || "#8ca8c8"}18, ${P.sky || "#8ca8c8"}08)`,
                              border: `1px solid ${P.sky || "#8ca8c8"}25`,
                              borderRadius: 8, cursor: "pointer",
                              fontSize: 10, fontFamily: "inherit", fontWeight: 500,
                              color: P.sky || "#8ca8c8",
                              transition: "all 0.2s", letterSpacing: "0.02em",
                              whiteSpace: "nowrap",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(135deg, ${P.sky || "#8ca8c8"}28, ${P.sky || "#8ca8c8"}14)`}
                            onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg, ${P.sky || "#8ca8c8"}18, ${P.sky || "#8ca8c8"}08)`}
                          >
                            Save .txt
                          </button>
                        )}
                      </div>

                      {/* Coming soon badge */}
                      {opt.disabled && (
                        <div style={{
                          position: "absolute", top: 10, right: 10,
                          fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em",
                          color: textFaint, background: `${parchment}`, padding: "2px 7px",
                          borderRadius: 6, border: `1px solid ${textFaint}25`,
                        }}>
                          Soon
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ===== IMPORT TAB ===== */}
          {activeTab === "import" && (
            <div style={{ animation: "exportCardPop 0.25s ease-out" }}>
              {/* Import mode sub-tabs */}
              <div style={{
                display: "flex", justifyContent: "center", gap: 4,
                margin: "0 0 16px",
                background: parchment,
                borderRadius: 10, padding: 3,
                border: `1px solid ${accent}10`,
              }}>
                {[
                  { id: "file", label: "File Import" },
                  { id: "timeline", label: "Google Maps Timeline" },
                  { id: "photos", label: "Import from Photos" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setImportMode(tab.id); if (tab.id !== "timeline") resetTimeline(); if (tab.id !== "file") resetImport(); if (tab.id !== "photos") resetPhotos(); }}
                    style={{
                      flex: 1, padding: "7px 14px", fontSize: 10, fontWeight: 600,
                      fontFamily: "inherit", letterSpacing: "0.04em",
                      border: "none", borderRadius: 7, cursor: "pointer",
                      transition: "all 0.2s",
                      background: importMode === tab.id ? `linear-gradient(135deg, ${accent}18, ${accent}08)` : "transparent",
                      color: importMode === tab.id ? accent : textMuted,
                      boxShadow: importMode === tab.id ? `0 1px 3px ${accent}08` : "none",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ---- FILE IMPORT MODE ---- */}
              {importMode === "file" && (
                <div>
              {importDone ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: 48, marginBottom: 16, filter: "grayscale(0.2)" }}>&#x2714;</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#688c5c", marginBottom: 8 }}>Import Complete</div>
                  <div style={{ fontSize: 12, color: textMuted, marginBottom: 20 }}>
                    {importParsed?.valid?.length || 0} {(importParsed?.valid?.length || 0) === 1 ? "entry" : "entries"} imported successfully.
                  </div>
                  <button onClick={resetImport} style={{ padding: "9px 24px", background: `linear-gradient(135deg, ${accent}18, ${accent}08)`, border: `1px solid ${accent}25`, borderRadius: 10, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 500, color: accent, transition: "all 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(135deg, ${accent}28, ${accent}14)`}
                    onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg, ${accent}18, ${accent}08)`}
                  >Import More</button>
                </div>
              ) : !importParsed ? (
                <>
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${dragOver ? accent : accent + "35"}`,
                      borderRadius: 16, padding: "48px 24px", textAlign: "center",
                      cursor: "pointer", transition: "all 0.25s",
                      background: dragOver ? `linear-gradient(135deg, ${accent}12, ${accent}06)` : `linear-gradient(135deg, ${accent}05, transparent)`,
                      position: "relative",
                    }}
                  >
                    <input ref={fileInputRef} type="file" accept=".json,.csv" onChange={handleFileSelect} style={{ display: "none" }} />
                    <div style={{ fontSize: 36, marginBottom: 12, color: accent, opacity: dragOver ? 1 : 0.6, transition: "opacity 0.2s" }}>&#x2912;</div>
                    <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, fontWeight: 600, color: text, marginBottom: 6 }}>{dragOver ? "Drop file here" : "Drag & drop a file here"}</div>
                    <div style={{ fontSize: 11, color: textMuted, marginBottom: 14 }}>or click to browse</div>
                    <div style={{ display: "inline-flex", gap: 8 }}>
                      <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, background: `${accent}10`, color: accent, border: `1px solid ${accent}15`, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>.json</span>
                      <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, background: `${accent}10`, color: accent, border: `1px solid ${accent}15`, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>.csv</span>
                    </div>
                    {importLoading && (
                      <div style={{ position: "absolute", inset: 0, borderRadius: 16, background: `${cream}dd`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: textMid, fontWeight: 500 }}>Parsing file...</div>
                    )}
                  </div>
                  {importError && (
                    <div style={{ marginTop: 14, padding: "12px 16px", background: "linear-gradient(135deg, #d0686810, #d0686806)", border: "1px solid #d0686825", borderRadius: 10, fontSize: 12, color: "#c05555", lineHeight: 1.5 }}>
                      <strong style={{ fontWeight: 600 }}>Error:</strong> {importError}
                    </div>
                  )}
                  <div style={{ marginTop: 16, padding: "14px 16px", background: cardBg, borderRadius: 12, border: `1px solid ${accent}10` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: text, marginBottom: 6 }}>Supported formats</div>
                    <div style={{ fontSize: 10.5, color: textMuted, lineHeight: 1.6 }}>
                      <strong style={{ color: textMid }}>JSON:</strong> My Cosmos backup files, or a plain array of entry objects.<br />
                      <strong style={{ color: textMid }}>CSV:</strong> Spreadsheet with columns for City, Country, Lat, Lng, Start Date.<br />
                      <span style={{ color: textFaint, fontSize: 10 }}>Required: city, country, lat, lng, dateStart</span>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: cardBg, border: `1px solid ${accent}12`, marginBottom: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${accent}15, ${accent}08)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: accent, fontWeight: 700, fontFamily: "monospace" }}>
                      {importFile?.name?.endsWith(".json") ? "{ }" : "|||"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{importFile?.name || "Uploaded file"}</div>
                      <div style={{ fontSize: 10, color: textMuted }}>{importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : ""}</div>
                    </div>
                    <button onClick={resetImport} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: textMuted, padding: "4px 8px", borderRadius: 6, transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${accent}10`; e.currentTarget.style.color = text; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = textMuted; }}
                      title="Remove file">&#x2715;</button>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1, padding: "14px 16px", borderRadius: 12, background: importParsed.valid.length > 0 ? "linear-gradient(135deg, #90b08012, #90b08006)" : `linear-gradient(135deg, ${accent}08, transparent)`, border: `1px solid ${importParsed.valid.length > 0 ? "#90b08020" : accent + "12"}`, textAlign: "center" }}>
                      <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 600, color: importParsed.valid.length > 0 ? "#688c5c" : textFaint }}>{importParsed.valid.length}</div>
                      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: textMuted }}>Valid entries</div>
                    </div>
                    {importParsed.errors.length > 0 && (
                      <div style={{ flex: 1, padding: "14px 16px", borderRadius: 12, background: "linear-gradient(135deg, #d0686808, transparent)", border: "1px solid #d0686815", textAlign: "center" }}>
                        <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 600, color: "#c05555" }}>{importParsed.errors.length}</div>
                        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: textMuted }}>Skipped</div>
                      </div>
                    )}
                  </div>
                  {importParsed.valid.length > 0 && (
                    <div style={{ padding: "12px 14px", borderRadius: 12, background: cardBg, border: `1px solid ${accent}10`, marginBottom: 14, maxHeight: 160, overflow: "auto" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: textMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Preview</div>
                      {importParsed.valid.slice(0, 50).map((e, i) => (
                        <div key={"import-" + i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: i < Math.min(importParsed.valid.length, 50) - 1 ? `1px solid ${accent}08` : "none" }}>
                          <span style={{ fontSize: 11, color: text }}>{e.city}{e.country ? `, ${e.country}` : ""}</span>
                          <span style={{ fontSize: 10, color: textFaint }}>{e.dateStart || "no date"}</span>
                        </div>
                      ))}
                      {importParsed.valid.length > 50 && <div style={{ fontSize: 10, color: textFaint, marginTop: 6, textAlign: "center" }}>...and {importParsed.valid.length - 50} more</div>}
                    </div>
                  )}
                  {importParsed.errors.length > 0 && (
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: "linear-gradient(135deg, #d0686808, transparent)", border: "1px solid #d0686812", marginBottom: 14, maxHeight: 100, overflow: "auto" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#c05555", marginBottom: 4 }}>Skipped entries</div>
                      {importParsed.errors.slice(0, 10).map((err, i) => (
                        <div key={"err-" + i} style={{ fontSize: 10, color: "#c05555", lineHeight: 1.5, opacity: 0.85 }}>{err}</div>
                      ))}
                      {importParsed.errors.length > 10 && <div style={{ fontSize: 10, color: "#c05555", opacity: 0.6, marginTop: 2 }}>...and {importParsed.errors.length - 10} more</div>}
                    </div>
                  )}
                  {importError && (
                    <div style={{ marginBottom: 14, padding: "10px 14px", background: "linear-gradient(135deg, #d0686810, #d0686806)", border: "1px solid #d0686825", borderRadius: 10, fontSize: 12, color: "#c05555" }}>
                      <strong>Error:</strong> {importError}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={resetImport} style={{ flex: 1, padding: "10px 16px", background: "transparent", border: `1px solid ${accent}20`, borderRadius: 10, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 500, color: textMuted, transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}40`; e.currentTarget.style.color = text; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = `${accent}20`; e.currentTarget.style.color = textMuted; }}
                    >Cancel</button>
                    <button disabled={!importParsed.valid.length || importLoading || !onImport} onClick={handleImportAll} style={{
                      flex: 2, padding: "10px 16px",
                      background: importParsed.valid.length && onImport ? `linear-gradient(135deg, ${accent}25, ${accent}12)` : parchment,
                      border: `1px solid ${importParsed.valid.length && onImport ? accent + "35" : textFaint + "20"}`,
                      borderRadius: 10, cursor: importParsed.valid.length && onImport ? "pointer" : "not-allowed",
                      fontSize: 12, fontFamily: "inherit", fontWeight: 600,
                      color: importParsed.valid.length && onImport ? accent : textFaint, transition: "all 0.2s",
                    }}
                      onMouseEnter={e => { if (importParsed.valid.length && onImport) e.currentTarget.style.background = `linear-gradient(135deg, ${accent}35, ${accent}18)`; }}
                      onMouseLeave={e => { if (importParsed.valid.length && onImport) e.currentTarget.style.background = `linear-gradient(135deg, ${accent}25, ${accent}12)`; }}
                    >
                      {importLoading ? "Importing..." : `Import ${importParsed.valid.length} ${importParsed.valid.length === 1 ? "Entry" : "Entries"}`}
                    </button>
                  </div>
                  {!onImport && <div style={{ textAlign: "center", marginTop: 10, fontSize: 10, color: textFaint, fontStyle: "italic" }}>Import is not available in this context.</div>}
                </div>
              )}
                </div>
              )}

              {/* ---- GOOGLE MAPS TIMELINE MODE ---- */}
              {importMode === "timeline" && (
                <div>
                {timelineDone ? (
                  <div style={{ textAlign: "center", padding: "32px 20px" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>{"🌍"}</div>
                    <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#688c5c", marginBottom: 8 }}>
                      {timelineImportedCount} memories added to your globe!
                    </div>
                    <div style={{ fontSize: 12, color: textMuted, marginBottom: 20 }}>Your Google Maps history has been transformed into travel memories.</div>
                    {timelineOverlaps && timelineOverlaps.length > 0 && !timelineOverlapsDone && (
                      <div style={{ margin: "0 auto 20px", maxWidth: 440, padding: "18px 20px", borderRadius: 14, background: `linear-gradient(135deg, ${accent}12, ${accent}06)`, border: `1px solid ${accent}20`, textAlign: "left" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: text, marginBottom: 8 }}>
                          {"❤️"} We found {timelineOverlaps.length} trip{timelineOverlaps.length === 1 ? "" : "s"} where you were both in the same city!
                        </div>
                        <div style={{ maxHeight: 120, overflow: "auto", marginBottom: 12 }}>
                          {timelineOverlaps.slice(0, 20).map((o, i) => (
                            <div key={"ov-" + i} style={{ fontSize: 11, color: textMid, padding: "3px 0", borderBottom: i < Math.min(timelineOverlaps.length, 20) - 1 ? `1px solid ${accent}08` : "none" }}>
                              {o.city}{o.country ? `, ${o.country}` : ""} — {o.dateStart}
                            </div>
                          ))}
                          {timelineOverlaps.length > 20 && <div style={{ fontSize: 10, color: textFaint, marginTop: 4, textAlign: "center" }}>...and {timelineOverlaps.length - 20} more</div>}
                        </div>
                        {onMarkTogether && (
                          <button onClick={handleMarkTogether} style={{ width: "100%", padding: "10px 16px", background: `linear-gradient(135deg, ${accent}25, ${accent}12)`, border: `1px solid ${accent}35`, borderRadius: 10, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600, color: accent, transition: "all 0.2s" }}
                            onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(135deg, ${accent}35, ${accent}18)`}
                            onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg, ${accent}25, ${accent}12)`}
                          >Yes, we were together!</button>
                        )}
                      </div>
                    )}
                    {timelineOverlapsDone && (
                      <div style={{ margin: "0 auto 16px", maxWidth: 440, padding: "12px 16px", borderRadius: 10, background: "linear-gradient(135deg, #90b08012, #90b08006)", border: "1px solid #90b08020", fontSize: 12, color: "#688c5c" }}>
                        {"✔"} {timelineOverlaps?.length || 0} shared trips marked as together!
                      </div>
                    )}
                    <button onClick={resetTimeline} style={{ padding: "9px 24px", background: `linear-gradient(135deg, ${accent}18, ${accent}08)`, border: `1px solid ${accent}25`, borderRadius: 10, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 500, color: accent, transition: "all 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(135deg, ${accent}28, ${accent}14)`}
                      onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg, ${accent}18, ${accent}08)`}
                    >Import More</button>
                  </div>
                ) : !timelineParsed ? (
                  <>
                    <div onClick={() => fileInputTimelineRef.current?.click()} style={{ border: `2px dashed ${accent}35`, borderRadius: 16, padding: "40px 24px", textAlign: "center", cursor: "pointer", transition: "all 0.25s", background: `linear-gradient(135deg, ${accent}05, transparent)`, position: "relative" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = `linear-gradient(135deg, ${accent}10, ${accent}04)`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = `${accent}35`; e.currentTarget.style.background = `linear-gradient(135deg, ${accent}05, transparent)`; }}
                    >
                      <input ref={fileInputTimelineRef} type="file" accept=".json" onChange={handleTimelineFileSelect} style={{ display: "none" }} />
                      <div style={{ fontSize: 36, marginBottom: 12, color: accent, opacity: 0.7 }}>{"🗺️"}</div>
                      <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, fontWeight: 600, color: text, marginBottom: 6 }}>Upload Google Takeout Data</div>
                      <div style={{ fontSize: 11, color: textMuted, marginBottom: 10 }}>Drop your Records.json or Location History.json</div>
                      <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, background: `${accent}10`, color: accent, border: `1px solid ${accent}15`, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>.json</span>
                      {timelineLoading && (
                        <div style={{ position: "absolute", inset: 0, borderRadius: 16, background: `${cream}dd`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: textMid, fontWeight: 500 }}>Parsing location history...</div>
                      )}
                    </div>
                    {timelineError && (
                      <div style={{ marginTop: 14, padding: "12px 16px", background: "linear-gradient(135deg, #d0686810, #d0686806)", border: "1px solid #d0686825", borderRadius: 10, fontSize: 12, color: "#c05555", lineHeight: 1.5 }}>
                        <strong style={{ fontWeight: 600 }}>Error:</strong> {timelineError}
                      </div>
                    )}
                    <div style={{ marginTop: 16, padding: "14px 16px", background: cardBg, borderRadius: 12, border: `1px solid ${accent}10` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: text, marginBottom: 6 }}>How to get your Google Maps Timeline data</div>
                      <div style={{ fontSize: 10.5, color: textMuted, lineHeight: 1.7 }}>
                        1. Go to <strong style={{ color: textMid }}>takeout.google.com</strong><br />
                        2. Deselect all, then select only <strong style={{ color: textMid }}>Location History</strong><br />
                        3. Choose JSON format and export<br />
                        4. Extract the zip and upload <strong style={{ color: textMid }}>Records.json</strong> or any Semantic Location History file
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <div style={{ padding: "16px 18px", borderRadius: 14, background: `linear-gradient(135deg, ${accent}10, ${accent}04)`, border: `1px solid ${accent}18`, marginBottom: 14, textAlign: "center" }}>
                      <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 600, color: text, marginBottom: 6 }}>
                        Found {timelineSummary?.tripCount || 0} trips across {timelineSummary?.countryCount || 0} countries
                      </div>
                      <div style={{ fontSize: 11, color: textMuted }}>
                        {timelineSummary?.yearCount || 0} year{(timelineSummary?.yearCount || 0) !== 1 ? "s" : ""} of history
                        {timelineSummary?.firstDate && timelineSummary?.lastDate ? ` (${timelineSummary.firstDate.slice(0,4)} – ${timelineSummary.lastDate.slice(0,4)})` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 2px" }}>
                      <div style={{ fontSize: 10, color: textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{timelineSelected.size} of {timelineParsed.length} selected</div>
                      <button onClick={handleTimelineSelectAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, fontFamily: "inherit", fontWeight: 600, color: accent, padding: "2px 6px", borderRadius: 4, transition: "all 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = `${accent}10`}
                        onMouseLeave={e => e.currentTarget.style.background = "none"}
                      >{timelineSelected.size === timelineParsed.length ? "Deselect All" : "Select All"}</button>
                    </div>
                    <div style={{ padding: "8px 10px", borderRadius: 12, background: cardBg, border: `1px solid ${accent}10`, marginBottom: 14, maxHeight: 260, overflow: "auto" }}>
                      {timelineParsed.map((trip, i) => (
                        <label key={"trip-" + i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 6px", borderBottom: i < timelineParsed.length - 1 ? `1px solid ${accent}06` : "none", cursor: "pointer", borderRadius: 6, transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = `${accent}05`}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <input type="checkbox" checked={timelineSelected.has(i)} onChange={() => handleTimelineToggle(i)} style={{ accentColor: accent, width: 14, height: 14, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {trip.city}{trip.country ? `, ${trip.country}` : ""}
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: textFaint, whiteSpace: "nowrap", flexShrink: 0 }}>
                            {trip.dateStart || ""}{trip.dateEnd && trip.dateEnd !== trip.dateStart ? ` – ${trip.dateEnd}` : ""}
                          </div>
                        </label>
                      ))}
                    </div>
                    {timelineError && (
                      <div style={{ marginBottom: 14, padding: "10px 14px", background: "linear-gradient(135deg, #d0686810, #d0686806)", border: "1px solid #d0686825", borderRadius: 10, fontSize: 12, color: "#c05555" }}><strong>Error:</strong> {timelineError}</div>
                    )}
                    {timelineImporting && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ height: 6, borderRadius: 3, background: `${accent}12`, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${accent}, ${accent}cc)`, width: `${timelineProgress}%`, transition: "width 0.3s ease-out" }} />
                        </div>
                        <div style={{ fontSize: 10, color: textMuted, textAlign: "center", marginTop: 4 }}>Importing... {timelineProgress}%</div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={resetTimeline} style={{ flex: 1, padding: "10px 16px", background: "transparent", border: `1px solid ${accent}20`, borderRadius: 10, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 500, color: textMuted, transition: "all 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}40`; e.currentTarget.style.color = text; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = `${accent}20`; e.currentTarget.style.color = textMuted; }}
                      >Cancel</button>
                      <button disabled={timelineSelected.size === 0 || timelineImporting || !onImport} onClick={handleTimelineImport} style={{
                        flex: 2, padding: "10px 16px",
                        background: timelineSelected.size > 0 && onImport && !timelineImporting ? `linear-gradient(135deg, ${accent}25, ${accent}12)` : parchment,
                        border: `1px solid ${timelineSelected.size > 0 && onImport ? accent + "35" : textFaint + "20"}`,
                        borderRadius: 10, cursor: timelineSelected.size > 0 && onImport && !timelineImporting ? "pointer" : "not-allowed",
                        fontSize: 12, fontFamily: "inherit", fontWeight: 600,
                        color: timelineSelected.size > 0 && onImport && !timelineImporting ? accent : textFaint, transition: "all 0.2s",
                      }}
                        onMouseEnter={e => { if (timelineSelected.size > 0 && onImport && !timelineImporting) e.currentTarget.style.background = `linear-gradient(135deg, ${accent}35, ${accent}18)`; }}
                        onMouseLeave={e => { if (timelineSelected.size > 0 && onImport && !timelineImporting) e.currentTarget.style.background = `linear-gradient(135deg, ${accent}25, ${accent}12)`; }}
                      >
                        {timelineImporting ? "Importing..." : `Import ${timelineSelected.size} Trip${timelineSelected.size === 1 ? "" : "s"}`}
                      </button>
                    </div>
                  </div>
                )}
                </div>
              )}

              {/* ---- IMPORT FROM PHOTOS MODE ---- */}
              {importMode === "photos" && (
                <div>
                {photoDone ? (
                  <div style={{ textAlign: "center", padding: "32px 20px" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>{"📸"}</div>
                    <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#688c5c", marginBottom: 8 }}>
                      {photoImportedCount} {photoImportedCount === 1 ? "entry" : "entries"} created from your photos!
                    </div>
                    <div style={{ fontSize: 12, color: textMuted, marginBottom: 20 }}>Your geotagged photos have been turned into travel memories.</div>
                    <button onClick={resetPhotos} style={{ padding: "9px 24px", background: `linear-gradient(135deg, ${accent}18, ${accent}08)`, border: `1px solid ${accent}25`, borderRadius: 10, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 500, color: accent, transition: "all 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(135deg, ${accent}28, ${accent}14)`}
                      onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg, ${accent}18, ${accent}08)`}
                    >Import More</button>
                  </div>
                ) : photoGroups ? (
                  <div>
                    <div style={{ padding: "16px 18px", borderRadius: 14, background: `linear-gradient(135deg, ${accent}10, ${accent}04)`, border: `1px solid ${accent}18`, marginBottom: 14, textAlign: "center" }}>
                      <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 600, color: text, marginBottom: 6 }}>
                        {photoGroups.length} {photoGroups.length === 1 ? "location" : "locations"} from {photoGroups.reduce((n, g) => n + g.photos.length, 0)} photos
                      </div>
                      <div style={{ fontSize: 11, color: textMuted }}>Photos grouped by city and date (within 3 days)</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 2px" }}>
                      <div style={{ fontSize: 10, color: textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{photoSelected.size} of {photoGroups.length} selected</div>
                      <button onClick={handlePhotoSelectAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, fontFamily: "inherit", fontWeight: 600, color: accent, padding: "2px 6px", borderRadius: 4, transition: "all 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = `${accent}10`}
                        onMouseLeave={e => e.currentTarget.style.background = "none"}
                      >{photoSelected.size === photoGroups.length ? "Deselect All" : "Select All"}</button>
                    </div>
                    <div style={{ padding: "8px 10px", borderRadius: 12, background: cardBg, border: `1px solid ${accent}10`, marginBottom: 14, maxHeight: 300, overflow: "auto" }}>
                      {photoGroups.map((group, i) => (
                        <label key={"photo-g-" + i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 6px", borderBottom: i < photoGroups.length - 1 ? `1px solid ${accent}06` : "none", cursor: "pointer", borderRadius: 6, transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = `${accent}05`}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <input type="checkbox" checked={photoSelected.has(i)} onChange={() => handlePhotoToggle(i)} style={{ accentColor: accent, width: 14, height: 14, flexShrink: 0, marginTop: 3 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {group.city}{group.country ? `, ${group.country}` : ""}
                            </div>
                            <div style={{ fontSize: 10, color: textFaint, marginTop: 1 }}>
                              {group.photos.length} photo{group.photos.length === 1 ? "" : "s"}
                              {group.dateStart ? ` \u00B7 ${group.dateStart}` : ""}
                              {group.dateEnd && group.dateEnd !== group.dateStart ? ` \u2013 ${group.dateEnd}` : ""}
                            </div>
                            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                              {group.photos.slice(0, 5).map((photo, pi) => (
                                <img key={"pthumb-" + pi} src={photo.thumb} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: `1px solid ${accent}15` }} />
                              ))}
                              {group.photos.length > 5 && (
                                <div style={{ width: 40, height: 40, borderRadius: 6, background: `${accent}10`, border: `1px solid ${accent}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: textMuted, fontWeight: 600 }}>+{group.photos.length - 5}</div>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    {photoError && (
                      <div style={{ marginBottom: 14, padding: "10px 14px", background: "linear-gradient(135deg, #d0686810, #d0686806)", border: "1px solid #d0686825", borderRadius: 10, fontSize: 12, color: "#c05555" }}><strong>Error:</strong> {photoError}</div>
                    )}
                    {photoImporting && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ height: 6, borderRadius: 3, background: `${accent}12`, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${accent}, ${accent}cc)`, width: `${photoImportProgress}%`, transition: "width 0.3s ease-out" }} />
                        </div>
                        <div style={{ fontSize: 10, color: textMuted, textAlign: "center", marginTop: 4 }}>Uploading photos & creating entries... {photoImportProgress}%</div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={resetPhotos} style={{ flex: 1, padding: "10px 16px", background: "transparent", border: `1px solid ${accent}20`, borderRadius: 10, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 500, color: textMuted, transition: "all 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}40`; e.currentTarget.style.color = text; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = `${accent}20`; e.currentTarget.style.color = textMuted; }}
                      >Cancel</button>
                      <button disabled={photoSelected.size === 0 || photoImporting || !onImport} onClick={handlePhotoImport} style={{
                        flex: 2, padding: "10px 16px",
                        background: photoSelected.size > 0 && onImport && !photoImporting ? `linear-gradient(135deg, ${accent}25, ${accent}12)` : parchment,
                        border: `1px solid ${photoSelected.size > 0 && onImport ? accent + "35" : textFaint + "20"}`,
                        borderRadius: 10, cursor: photoSelected.size > 0 && onImport && !photoImporting ? "pointer" : "not-allowed",
                        fontSize: 12, fontFamily: "inherit", fontWeight: 600,
                        color: photoSelected.size > 0 && onImport && !photoImporting ? accent : textFaint, transition: "all 0.2s",
                      }}
                        onMouseEnter={e => { if (photoSelected.size > 0 && onImport && !photoImporting) e.currentTarget.style.background = `linear-gradient(135deg, ${accent}35, ${accent}18)`; }}
                        onMouseLeave={e => { if (photoSelected.size > 0 && onImport && !photoImporting) e.currentTarget.style.background = `linear-gradient(135deg, ${accent}25, ${accent}12)`; }}
                      >
                        {photoImporting ? "Importing..." : `Import ${photoSelected.size} ${photoSelected.size === 1 ? "Entry" : "Entries"}`}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div onClick={() => fileInputPhotosRef.current?.click()} style={{ border: `2px dashed ${accent}35`, borderRadius: 16, padding: "40px 24px", textAlign: "center", cursor: "pointer", transition: "all 0.25s", background: `linear-gradient(135deg, ${accent}05, transparent)`, position: "relative" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = `linear-gradient(135deg, ${accent}10, ${accent}04)`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = `${accent}35`; e.currentTarget.style.background = `linear-gradient(135deg, ${accent}05, transparent)`; }}
                    >
                      <input ref={fileInputPhotosRef} type="file" accept=".jpg,.jpeg,.png" multiple onChange={handlePhotoFileSelect} style={{ display: "none" }} />
                      <div style={{ fontSize: 36, marginBottom: 12, color: accent, opacity: 0.7 }}>{"📷"}</div>
                      <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, fontWeight: 600, color: text, marginBottom: 6 }}>Select Photos</div>
                      <div style={{ fontSize: 11, color: textMuted, marginBottom: 10 }}>Choose geotagged photos to create travel entries</div>
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, background: `${accent}10`, color: accent, border: `1px solid ${accent}15`, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>.jpg</span>
                        <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, background: `${accent}10`, color: accent, border: `1px solid ${accent}15`, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>.jpeg</span>
                        <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, background: `${accent}10`, color: accent, border: `1px solid ${accent}15`, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>.png</span>
                      </div>
                      {photoParsing && (
                        <div style={{ position: "absolute", inset: 0, borderRadius: 16, background: `${cream}dd`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <div style={{ fontSize: 13, color: textMid, fontWeight: 500 }}>{photoParseProgress || "Processing..."}</div>
                          <div style={{ fontSize: 10, color: textMuted }}>This may take a moment</div>
                        </div>
                      )}
                    </div>
                    {photoError && (
                      <div style={{ marginTop: 14, padding: "12px 16px", background: "linear-gradient(135deg, #d0686810, #d0686806)", border: "1px solid #d0686825", borderRadius: 10, fontSize: 12, color: "#c05555", lineHeight: 1.5 }}>
                        <strong style={{ fontWeight: 600 }}>Error:</strong> {photoError}
                      </div>
                    )}
                    <div style={{ marginTop: 16, padding: "14px 16px", background: cardBg, borderRadius: 12, border: `1px solid ${accent}10` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: text, marginBottom: 6 }}>How it works</div>
                      <div style={{ fontSize: 10.5, color: textMuted, lineHeight: 1.7 }}>
                        1. Select photos with <strong style={{ color: textMid }}>GPS location data</strong> (geotagged JPEGs)<br />
                        2. We read the EXIF data to extract <strong style={{ color: textMid }}>coordinates and dates</strong><br />
                        3. Photos are <strong style={{ color: textMid }}>grouped by location and date</strong> (same city, within 3 days)<br />
                        4. Review the groups and import as travel entries with photos attached
                      </div>
                    </div>
                  </>
                )}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{
            textAlign: "center", marginTop: 20,
            fontSize: 10, color: textFaint, fontStyle: "italic",
          }}>
            {activeTab === "export"
              ? "All exports are generated locally in your browser. No data leaves your device."
              : "Files are parsed locally in your browser. Your data stays private."}
          </div>
        </div>
      </div>
    </>
  );
}
