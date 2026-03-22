/**
 * ShareCard — generates a shareable image card from the globe screenshot + stats.
 * Pure utility, no React, no Supabase imports.
 *
 * @param {Object} opts
 * @param {HTMLCanvasElement} opts.rendererCanvas — the Three.js renderer.domElement
 * @param {THREE.Scene} opts.scene — the Three.js scene (for re-render)
 * @param {THREE.Camera} opts.camera — the Three.js camera (for re-render)
 * @param {THREE.WebGLRenderer} opts.renderer — the Three.js renderer (for re-render)
 * @param {string} opts.worldName — e.g. "Seth & Rosie's Cosmos"
 * @param {number} opts.entryCount
 * @param {number} opts.countryCount
 * @param {number} opts.totalMiles
 * @param {string} [opts.startDate] — ISO date string for "Since ..." line
 * @param {boolean} [opts.isPartnerWorld]
 * @param {"story"|"landscape"} [opts.format="story"] — story = 1080x1350, landscape = 1200x630
 * @returns {Promise<Blob>}
 */
export async function generateShareCard({
  rendererCanvas, renderer, scene, camera,
  worldName, entryCount, countryCount, totalMiles,
  startDate, isPartnerWorld,
  format = "story",
}) {
  // Force a fresh render so the canvas has current pixels
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }

  // Capture globe pixels
  const globeDataUrl = rendererCanvas.toDataURL("image/png");
  const globeImg = await loadImage(globeDataUrl);

  // Card dimensions
  const W = format === "landscape" ? 1200 : 1080;
  const H = format === "landscape" ? 630 : 1350;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // ---- Background ----
  ctx.fillStyle = "#0c0a12";
  ctx.fillRect(0, 0, W, H);

  // ---- Draw globe screenshot (centered, filling top portion) ----
  const globeSection = format === "landscape" ? H * 0.65 : H * 0.6;
  const scale = Math.max(W / globeImg.width, globeSection / globeImg.height);
  const gw = globeImg.width * scale;
  const gh = globeImg.height * scale;
  const gx = (W - gw) / 2;
  const gy = (globeSection - gh) / 2;

  // Clip to card bounds
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, globeSection);
  ctx.clip();
  ctx.drawImage(globeImg, gx, gy, gw, gh);
  ctx.restore();

  // ---- Gradient fade from globe into dark bottom ----
  const fadeH = 120;
  const fade = ctx.createLinearGradient(0, globeSection - fadeH, 0, globeSection);
  fade.addColorStop(0, "rgba(12,10,18,0)");
  fade.addColorStop(1, "rgba(12,10,18,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, globeSection - fadeH, W, fadeH);

  // ---- Divider line ----
  const divY = globeSection + 10;
  const lineW = W * 0.5;
  const lineX = (W - lineW) / 2;
  ctx.strokeStyle = "rgba(200,160,96,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lineX, divY);
  ctx.lineTo(lineX + lineW, divY);
  ctx.stroke();

  // ---- Text section ----
  const textStartY = divY + 40;
  const gold = "#c8a060";
  const cream = "#f0e8d8";
  const faint = "rgba(240,232,216,0.5)";

  ctx.textAlign = "center";

  // World name
  ctx.fillStyle = cream;
  ctx.font = `300 ${format === "landscape" ? 28 : 36}px 'Palatino Linotype', 'Palatino', Georgia, serif`;
  ctx.fillText(worldName || "My Cosmos", W / 2, textStartY);

  // Stats line
  const statsLine = buildStatsLine(entryCount, countryCount, totalMiles, isPartnerWorld);
  ctx.fillStyle = gold;
  ctx.font = `${format === "landscape" ? 16 : 20}px 'Palatino Linotype', 'Palatino', Georgia, serif`;
  ctx.fillText(statsLine, W / 2, textStartY + (format === "landscape" ? 32 : 44));

  // Miles line
  if (totalMiles > 0) {
    const milesText = `${Math.round(totalMiles).toLocaleString()} miles ${isPartnerWorld ? "together" : "traveled"}`;
    ctx.fillStyle = faint;
    ctx.font = `${format === "landscape" ? 14 : 17}px 'Palatino Linotype', 'Palatino', Georgia, serif`;
    ctx.fillText(milesText, W / 2, textStartY + (format === "landscape" ? 54 : 74));
  }

  // "Since" date for partner worlds
  if (startDate && isPartnerWorld) {
    const since = formatSinceDate(startDate);
    ctx.fillStyle = faint;
    ctx.font = `italic ${format === "landscape" ? 13 : 15}px 'Palatino Linotype', 'Palatino', Georgia, serif`;
    ctx.fillText(since, W / 2, textStartY + (format === "landscape" ? 74 : 100));
  }

  // ---- Watermark ----
  ctx.fillStyle = "rgba(200,160,96,0.3)";
  ctx.font = `${format === "landscape" ? 12 : 14}px 'Palatino Linotype', 'Palatino', Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText("littlecosmos.app", W / 2, H - 20);

  // ---- Convert to blob ----
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/**
 * Generate card, then trigger download + native share if available.
 */
export async function shareGlobeCard(opts) {
  const blob = await generateShareCard(opts);
  const url = URL.createObjectURL(blob);
  const fileName = (opts.worldName || "my-cosmos")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase() + "_share.png";

  // Try native share (mobile)
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], fileName, { type: "image/png" });
    const shareData = { files: [file] };
    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        URL.revokeObjectURL(url);
        return { shared: true };
      } catch (e) {
        // User cancelled or share failed — fall through to download
        if (e.name === "AbortError") {
          URL.revokeObjectURL(url);
          return { shared: false, cancelled: true };
        }
      }
    }
  }

  // Fallback: trigger download
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { shared: false, downloaded: true };
}

// ---- Helpers ----

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function buildStatsLine(entries, countries, miles, isPartner) {
  const parts = [];
  if (entries > 0) parts.push(`${entries} ${isPartner ? "adventures" : "trips"}`);
  if (countries > 0) parts.push(`${countries} ${countries === 1 ? "country" : "countries"}`);
  return parts.join(" \u00B7 ");
}

function formatSinceDate(isoDate) {
  try {
    const d = new Date(isoDate + "T00:00:00");
    const month = d.toLocaleString("en-US", { month: "long" });
    return `Since ${month} ${d.getFullYear()}`;
  } catch {
    return "";
  }
}
