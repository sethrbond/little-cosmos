import { useState, useEffect, useCallback, useRef } from "react";

/* =================================================================
   ExportHub — Multi-format export & sharing modal for My Cosmos
   Formats: JSON, CSV, HTML Report, KML, Timeline Text, Share Link
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

export default function ExportHub({ entries = [], config = {}, stats = {}, palette, onClose, worldMode, travelerName }) {
  const P = palette || {};
  const [status, setStatus] = useState({}); // { [id]: "loading" | "done" | "error" }
  const overlayRef = useRef(null);

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

  // ---- Styles ----
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
              Export & Share
            </div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 26, fontWeight: 600, color: text,
              margin: 0, letterSpacing: "0.02em",
            }}>
              Take Your World With You
            </h2>
            <p style={{
              fontSize: 12, color: textMuted, marginTop: 6,
              maxWidth: 420, marginLeft: "auto", marginRight: "auto",
            }}>
              {entries.length === 0
                ? "No entries to export yet. Add some travels first!"
                : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} ready to export`}
            </p>
          </div>

          {/* Divider */}
          <div style={{
            height: 1, margin: "16px 0",
            background: `linear-gradient(90deg, transparent, ${accent}20, transparent)`,
          }} />

          {/* Export grid */}
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

          {/* Footer */}
          <div style={{
            textAlign: "center", marginTop: 20,
            fontSize: 10, color: textFaint, fontStyle: "italic",
          }}>
            All exports are generated locally in your browser. No data leaves your device.
          </div>
        </div>
      </div>
    </>
  );
}
