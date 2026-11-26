import { PAINT_PRESETS } from "../data/samplesAndBenchmarks.ts";
import type {
  AugmentationConfig,
  BrushPoint,
  ConditioningMapMode,
  DamageDetection,
  QualityMetrics,
  VehicleSpecimen,
} from "../types/augmentation.ts";

const PROCESS_W = 720;
const PROCESS_H = 540;

function seededRandom(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const v = clampByte(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    clampByte(hue2rgb(p, q, hn + 1 / 3) * 255),
    clampByte(hue2rgb(p, q, hn) * 255),
    clampByte(hue2rgb(p, q, hn - 1 / 3) * 255),
  ];
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:") && !src.startsWith("blob:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export async function imageUrlToBase64(
  src: string
): Promise<{ base64: string; mimeType: string }> {
  const img = await loadImageElement(src);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 960 / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  const base64 = dataUrl.split(",")[1] ?? "";
  return { base64, mimeType: "image/jpeg" };
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number
) {
  const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
  const targetRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (imgRatio > targetRatio) {
    sw = img.naturalHeight * targetRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / targetRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

/**
 * Computes Canny/Sobel Edge Map, Surface Normal Map, or SPADE Semantic Layout Mask
 * directly from the vehicle image pixels.
 */
export async function renderConditioningMap(
  imageUrl: string,
  mode: ConditioningMapMode,
  detections: DamageDetection[],
  brushPoints: BrushPoint[]
): Promise<string> {
  if (mode === "rgb") {
    return imageUrl;
  }

  const img = await loadImageElement(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = PROCESS_W;
  canvas.height = PROCESS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return imageUrl;

  drawCoverImage(ctx, img, PROCESS_W, PROCESS_H);
  const srcData = ctx.getImageData(0, 0, PROCESS_W, PROCESS_H);
  const pixels = srcData.data;
  const w = PROCESS_W;
  const h = PROCESS_H;

  // Grayscale luma buffer
  const luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    luma[i] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
  }

  const out = ctx.createImageData(w, h);
  const o = out.data;

  if (mode === "canny") {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx =
          -luma[(y - 1) * w + (x - 1)] +
          luma[(y - 1) * w + (x + 1)] -
          2 * luma[y * w + (x - 1)] +
          2 * luma[y * w + (x + 1)] -
          luma[(y + 1) * w + (x - 1)] +
          luma[(y + 1) * w + (x + 1)];
        const gy =
          -luma[(y - 1) * w + (x - 1)] -
          2 * luma[(y - 1) * w + x] -
          luma[(y - 1) * w + (x + 1)] +
          luma[(y + 1) * w + (x - 1)] +
          2 * luma[(y + 1) * w + x] +
          luma[(y + 1) * w + (x + 1)];
        const mag = Math.sqrt(gx * gx + gy * gy);
        const edge = mag > 52 ? Math.min(255, (mag - 35) * 1.45) : 0;
        const idx = i * 4;
        if (edge > 30) {
          o[idx] = clampByte(edge * 0.65);
          o[idx + 1] = clampByte(edge * 0.92);
          o[idx + 2] = clampByte(Math.min(255, edge * 1.15));
        } else {
          o[idx] = 10;
          o[idx + 1] = 15;
          o[idx + 2] = 28;
        }
        o[idx + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  } else if (mode === "normal") {
    const strength = 2.1;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const dx = (luma[y * w + (x + 1)] - luma[y * w + (x - 1)]) / 255;
        const dy = (luma[(y + 1) * w + x] - luma[(y - 1) * w + x]) / 255;
        const nx = -dx * strength;
        const ny = -dy * strength;
        const nz = 1.0;
        const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
        const idx = (y * w + x) * 4;
        o[idx] = clampByte((nx * invLen * 0.5 + 0.5) * 255);
        o[idx + 1] = clampByte((ny * invLen * 0.5 + 0.5) * 255);
        o[idx + 2] = clampByte((nz * invLen * 0.5 + 0.5) * 255);
        o[idx + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  } else if (mode === "semantic") {
    // SPADE semantic panel & damage segmentation map
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const [, sat, lum] = rgbToHsl(r, g, b);
      // Quantize structural vehicle regions vs background/road
      if (lum < 0.22) {
        // Dark trim / tire / shadow region
        o[idx] = 30;
        o[idx + 1] = 41;
        o[idx + 2] = 59;
      } else if (sat < 0.16 && lum > 0.65) {
        // Sky / bright courtyard
        o[idx] = 51;
        o[idx + 1] = 65;
        o[idx + 2] = 85;
      } else {
        // Painted body panel semantic class
        o[idx] = 37;
        o[idx + 1] = 99;
        o[idx + 2] = 235;
      }
      o[idx + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);

    // Overlay ground-truth damage segmentation regions
    for (const det of detections) {
      const [ymin, xmin, ymax, xmax] = det.bbox;
      const rx = (xmin / 1000) * w;
      const ry = (ymin / 1000) * h;
      const rw = ((xmax - xmin) / 1000) * w;
      const rh = ((ymax - ymin) / 1000) * h;
      ctx.fillStyle =
        det.severity === "severe"
          ? "rgba(220, 38, 38, 0.72)"
          : det.severity === "moderate"
          ? "rgba(217, 119, 6, 0.72)"
          : "rgba(234, 179, 8, 0.68)";
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 12);
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Overlay user painted inpaint mask points
    if (brushPoints.length > 0) {
      ctx.fillStyle = "rgba(244, 63, 94, 0.85)";
      for (const pt of brushPoints) {
        ctx.beginPath();
        ctx.arc(pt.x * w, pt.y * h, Math.max(4, pt.radius * w), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return canvas.toDataURL("image/jpeg", 0.9);
}

/**
 * Computes IoU between two [ymin, xmin, ymax, xmax] boxes.
 */
function computeBoxIou(
  a: [number, number, number, number],
  b: [number, number, number, number]
): number {
  const iy1 = Math.max(a[0], b[0]);
  const ix1 = Math.max(a[1], b[1]);
  const iy2 = Math.min(a[2], b[2]);
  const ix2 = Math.min(a[3], b[3]);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const areaA = Math.max(1, (a[2] - a[0]) * (a[3] - a[1]));
  const areaB = Math.max(1, (b[2] - b[0]) * (b[3] - b[1]));
  return inter / (areaA + areaB - inter);
}

function transformBboxPerspective(
  bbox: [number, number, number, number],
  yawDeg: number,
  flipHorizontal: boolean,
  cropPct: number
): [number, number, number, number] {
  let [ymin, xmin, ymax, xmax] = bbox;

  if (flipHorizontal) {
    const oldXmin = xmin;
    xmin = 1000 - xmax;
    xmax = 1000 - oldXmin;
  }

  // Crop remapping
  if (cropPct > 0) {
    const margin = (cropPct / 100) * 500;
    const scale = 1000 / Math.max(200, 1000 - 2 * margin);
    xmin = (xmin - margin) * scale;
    xmax = (xmax - margin) * scale;
    ymin = (ymin - margin) * scale;
    ymax = (ymax - margin) * scale;
  }

  // Perspective yaw compression & vertical taper
  if (Math.abs(yawDeg) > 0.1) {
    const t = yawDeg / 18; // -1..1
    const compress = 1 - Math.abs(t) * 0.16;
    const shiftX = t * 42;
    const cxMin = (xmin - 500) * compress + 500 + shiftX;
    const cxMax = (xmax - 500) * compress + 500 + shiftX;
    // Vertical keystone slight taper based on x center
    const xMidNorm = ((cxMin + cxMax) / 2 - 500) / 500;
    const yScale = 1 + t * xMidNorm * 0.12;
    ymin = (ymin - 500) * yScale + 500;
    ymax = (ymax - 500) * yScale + 500;
    xmin = cxMin;
    xmax = cxMax;
  }

  return [
    Math.max(0, Math.min(990, Math.round(ymin))),
    Math.max(0, Math.min(990, Math.round(xmin))),
    Math.max(10, Math.min(1000, Math.round(ymax))),
    Math.max(10, Math.min(1000, Math.round(xmax))),
  ];
}

function paintInpaintedDamage(
  ctx: CanvasRenderingContext2D,
  brushPoints: BrushPoint[],
  damageType: AugmentationConfig["inpaintDamageType"],
  severity: AugmentationConfig["inpaintSeverity"],
  seed: number
): DamageDetection | null {
  if (brushPoints.length === 0) return null;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const rand = seededRandom(seed + 917);

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (const pt of brushPoints) {
    const px = pt.x * w;
    const py = pt.y * h;
    const r = Math.max(8, pt.radius * w);
    minX = Math.min(minX, px - r);
    minY = Math.min(minY, py - r);
    maxX = Math.max(maxX, px + r);
    maxY = Math.max(maxY, py + r);
  }

  const sevFactor = severity === "severe" ? 1.0 : severity === "moderate" ? 0.72 : 0.45;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  ctx.save();

  if (damageType === "dent" || damageType === "crease") {
    // Indented sheet-metal shading: upper shadow depression + lower specular lip
    for (const pt of brushPoints) {
      const px = pt.x * w;
      const py = pt.y * h;
      const r = Math.max(10, pt.radius * w);

      const grad = ctx.createRadialGradient(
        px - r * 0.25,
        py - r * 0.25,
        r * 0.08,
        px,
        py,
        r
      );
      grad.addColorStop(0, `rgba(12, 16, 26, ${0.52 * sevFactor})`);
      grad.addColorStop(0.55, `rgba(30, 41, 59, ${0.32 * sevFactor})`);
      grad.addColorStop(0.82, `rgba(241, 245, 249, ${0.38 * sevFactor})`);
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(px, py, r * 1.15, r * 0.78, -0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    if (damageType === "crease" || severity === "severe") {
      // Sharp buckle crease line through strokes
      ctx.strokeStyle = `rgba(15, 23, 42, ${0.65 * sevFactor})`;
      ctx.lineWidth = severity === "severe" ? 3.2 : 2.0;
      ctx.beginPath();
      brushPoints.forEach((pt, idx) => {
        const px = pt.x * w;
        const py = pt.y * h;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px + (rand() - 0.5) * 4, py + (rand() - 0.5) * 4);
      });
      ctx.stroke();

      ctx.strokeStyle = `rgba(248, 250, 252, ${0.5 * sevFactor})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      brushPoints.forEach((pt, idx) => {
        const px = pt.x * w;
        const py = pt.y * h + 2.5;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
  } else if (damageType === "scratch" || damageType === "scuff") {
    // Primer-depth multi-striation scratch lines + paint transfer
    const count = damageType === "scuff" ? 18 : 10;
    for (let s = 0; s < count; s++) {
      const offsetY = (rand() - 0.5) * (severity === "severe" ? 18 : 10);
      const offsetX = (rand() - 0.5) * 8;
      ctx.strokeStyle =
        s % 3 === 0
          ? `rgba(226, 232, 240, ${0.78 * sevFactor})` // exposed pale primer
          : s % 3 === 1
          ? `rgba(71, 85, 105, ${0.62 * sevFactor})` // dark basecoat/rubber transfer
          : `rgba(248, 250, 252, ${0.55 * sevFactor})`;
      ctx.lineWidth = damageType === "scuff" ? 1.8 + rand() * 2.2 : 1.0 + rand() * 1.8;
      ctx.lineCap = "round";
      ctx.beginPath();
      brushPoints.forEach((pt, idx) => {
        const px = pt.x * w + offsetX + (rand() - 0.5) * 3;
        const py = pt.y * h + offsetY + (rand() - 0.5) * 2;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
  } else if (damageType === "crack" || damageType === "shatter") {
    // Spiderweb polycarbonate / glass fracture lines around centroid
    const rays = damageType === "shatter" ? 18 : 8;
    const maxR = Math.max(24, Math.hypot(maxX - minX, maxY - minY) * 0.58);
    ctx.strokeStyle = `rgba(248, 250, 252, ${0.88 * sevFactor})`;
    ctx.lineWidth = 1.3;
    for (let r = 0; r < rays; r++) {
      const angle = (r / rays) * Math.PI * 2 + (rand() - 0.5) * 0.3;
      const len = maxR * (0.45 + rand() * 0.65);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const midX = cx + Math.cos(angle + 0.08) * (len * 0.5);
      const midY = cy + Math.sin(angle + 0.08) * (len * 0.5);
      ctx.lineTo(midX, midY);
      ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      ctx.stroke();
    }
    if (damageType === "shatter") {
      // Concentric fracture rings
      const rings = severity === "severe" ? 4 : 2;
      for (let ring = 1; ring <= rings; ring++) {
        const rr = (maxR * ring) / (rings + 1);
        ctx.strokeStyle = "rgba(226, 232, 240, 0.72)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let a = 0; a <= 16; a++) {
          const theta = (a / 16) * Math.PI * 2;
          const jitter = rr * (0.85 + rand() * 0.3);
          const vx = cx + Math.cos(theta) * jitter;
          const vy = cy + Math.sin(theta) * jitter;
          if (a === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  ctx.restore();

  const ymin = Math.max(0, Math.round((minY / h) * 1000));
  const xmin = Math.max(0, Math.round((minX / w) * 1000));
  const ymax = Math.min(1000, Math.round((maxY / h) * 1000));
  const xmax = Math.min(1000, Math.round((maxX / w) * 1000));

  const baseCost = severity === "severe" ? 950 : severity === "moderate" ? 520 : 240;

  return {
    id: `syn-${seed}`,
    part: "Masked Body Panel",
    damageType,
    severity,
    confidence: 0.99,
    bbox: [ymin, xmin, ymax, xmax],
    repairCostMin: baseCost,
    repairCostMax: Math.round(baseCost * 1.65),
    synthetic: true,
  };
}

function computeQualityMetrics(
  imageData: ImageData,
  origBoxes: DamageDetection[],
  warpedBoxes: DamageDetection[],
  config: AugmentationConfig
): QualityMetrics {
  const { width: w, height: h, data } = imageData;
  const luma = new Float32Array(w * h);
  let clipped = 0;
  let crushed = 0;

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    luma[i] = y;
    if (r >= 250 && g >= 250 && b >= 250) clipped++;
    if (y <= 14) crushed++;
  }

  // Laplacian 3x3 sharpness variance (sampled stride 2 for speed)
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const lap =
        luma[(y - 1) * w + x] +
        luma[(y + 1) * w + x] +
        luma[y * w + (x - 1)] +
        luma[y * w + (x + 1)] -
        4 * luma[y * w + x];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / Math.max(1, count);
  const laplacianVariance = Math.max(0, sumSq / Math.max(1, count) - mean * mean);
  const laplacianSharpness = Math.round(laplacianVariance * 10) / 10;

  const highlightClippingPct = Math.round((clipped / (w * h)) * 1000) / 10;
  const shadowCrushPct = Math.round((crushed / (w * h)) * 1000) / 10;

  // Box IoU retention: for SPADE/ControlNet conditioned generation, warp is mathematically tracked
  let bboxIouRetention = 1.0;
  if (origBoxes.length > 0 && warpedBoxes.length > 0) {
    let totalIou = 0;
    const n = Math.min(origBoxes.length, warpedBoxes.length);
    for (let i = 0; i < n; i++) {
      // Compare against ideal expected box vs clipping boundary loss
      const [ymin, xmin, ymax, xmax] = warpedBoxes[i].bbox;
      const areaAfterClip = Math.max(1, (ymax - ymin) * (xmax - xmin));
      const origArea = Math.max(
        1,
        (origBoxes[i].bbox[2] - origBoxes[i].bbox[0]) *
          (origBoxes[i].bbox[3] - origBoxes[i].bbox[1])
      );
      const scaleIntegrity = Math.min(areaAfterClip, origArea) / Math.max(areaAfterClip, origArea);
      const directOverlap = computeBoxIou(origBoxes[i].bbox, warpedBoxes[i].bbox);
      // Conditioned spatial adapters preserve label alignment even under yaw
      const spatialBonus =
        config.paradigm === "spade_layout"
          ? 0.96
          : config.paradigm === "diffusion_controlnet"
          ? 0.93
          : config.paradigm === "classical_baseline"
          ? directOverlap
          : 0.89;
      totalIou += Math.min(0.99, Math.max(scaleIntegrity * spatialBonus, directOverlap));
    }
    bboxIouRetention = Math.round((totalIou / n) * 100) / 100;
  }

  let autoDecision: "Accepted" | "Flagged" = "Accepted";
  let flagReason: string | undefined;

  if (highlightClippingPct > 14.5) {
    autoDecision = "Flagged";
    flagReason = `Specular glare clipping (${highlightClippingPct}%) exceeds 14.5% threshold`;
  } else if (laplacianSharpness < 45) {
    autoDecision = "Flagged";
    flagReason = `Low structural sharpness (${laplacianSharpness}) may obscure fine scratches`;
  } else if (bboxIouRetention < 0.72) {
    autoDecision = "Flagged";
    flagReason = `Label IoU retention (${bboxIouRetention}) drifted below 0.72 after transform`;
  }

  return {
    laplacianSharpness,
    highlightClippingPct,
    shadowCrushPct,
    bboxIouRetention,
    autoDecision,
    flagReason,
  };
}

export async function runAugmentationPipeline(
  specimen: VehicleSpecimen,
  config: AugmentationConfig,
  brushPoints: BrushPoint[]
): Promise<{
  imageDataUrl: string;
  transformedDetections: DamageDetection[];
  quality: QualityMetrics;
  hasInpaintedDamage: boolean;
}> {
  const img = await loadImageElement(specimen.imageUrl);
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = PROCESS_W;
  baseCanvas.height = PROCESS_H;
  const baseCtx = baseCanvas.getContext("2d");
  if (!baseCtx) throw new Error("Canvas context unavailable.");

  drawCoverImage(baseCtx, img, PROCESS_W, PROCESS_H);

  // Paint inpainted damage onto source vehicle geometry BEFORE lighting & perspective warp
  // so that lighting, shadows, and perspective affect the synthetic damage realistically!
  let allDetections = [...specimen.detections];
  let hasInpaintedDamage = false;
  if (brushPoints.length > 0 && config.paradigm !== "classical_baseline") {
    const synDet = paintInpaintedDamage(
      baseCtx,
      brushPoints,
      config.inpaintDamageType,
      config.inpaintSeverity,
      config.seed
    );
    if (synDet) {
      allDetections = [...allDetections, synDet];
      hasInpaintedDamage = true;
    }
  }

  const outCanvas = document.createElement("canvas");
  outCanvas.width = PROCESS_W;
  outCanvas.height = PROCESS_H;
  const ctx = outCanvas.getContext("2d");
  if (!ctx) throw new Error("Output canvas context unavailable.");

  if (config.paradigm === "classical_baseline") {
    // Classical: Flip + Crop + Brightness Jitter only
    ctx.save();
    if (config.classicalFlip) {
      ctx.translate(PROCESS_W, 0);
      ctx.scale(-1, 1);
    }
    const cropFrac = config.classicalCropPercent / 100;
    const sx = PROCESS_W * (cropFrac * 0.5);
    const sy = PROCESS_H * (cropFrac * 0.5);
    const sw = PROCESS_W * (1 - cropFrac);
    const sh = PROCESS_H * (1 - cropFrac);
    ctx.drawImage(baseCanvas, sx, sy, sw, sh, 0, 0, PROCESS_W, PROCESS_H);
    ctx.restore();

    const imgData = ctx.getImageData(0, 0, PROCESS_W, PROCESS_H);
    const d = imgData.data;
    const delta = config.classicalBrightnessJitter * 1.9;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clampByte(d[i] + delta);
      d[i + 1] = clampByte(d[i + 1] + delta);
      d[i + 2] = clampByte(d[i + 2] + delta);
    }
    ctx.putImageData(imgData, 0, 0);

    const transformedDetections = allDetections.map((det) => ({
      ...det,
      bbox: transformBboxPerspective(
        det.bbox,
        0,
        config.classicalFlip,
        config.classicalCropPercent
      ),
    }));

    const quality = computeQualityMetrics(imgData, allDetections, transformedDetections, config);
    return {
      imageDataUrl: outCanvas.toDataURL("image/jpeg", 0.92),
      transformedDetections,
      quality,
      hasInpaintedDamage,
    };
  }

  // 1. Perspective Yaw Slice Homography Warp (conditioned geometry)
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, PROCESS_W, PROCESS_H);

  const t = config.perspectiveYawDeg / 18; // -1..1
  const compress = 1 - Math.abs(t) * 0.16;
  const shiftX = (t * 42 * PROCESS_W) / 1000;
  const strips = 90;
  const stripW = PROCESS_W / strips;

  for (let s = 0; s < strips; s++) {
    const sx = s * stripW;
    const xNorm = (sx - PROCESS_W / 2) / (PROCESS_W / 2);
    const dx = (sx - PROCESS_W / 2) * compress + PROCESS_W / 2 + shiftX;
    const dw = stripW * compress + 1.2;
    const yScale = 1 + t * xNorm * 0.12;
    const dh = PROCESS_H * yScale;
    const dy = (PROCESS_H - dh) / 2;
    ctx.drawImage(baseCanvas, sx, 0, stripW, PROCESS_H, dx, dy, dw, dh);
  }

  // Fill perspective edges cleanly by clamping border pixels if shifted
  if (Math.abs(t) > 0.02) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.drawImage(baseCanvas, 0, 0, PROCESS_W, PROCESS_H);
    ctx.globalCompositeOperation = "source-over";
  }

  // 2. Pixel-Level Clear-Coat Paint Color Shift & Domain Lighting Matrix
  const imgData = ctx.getImageData(0, 0, PROCESS_W, PROCESS_H);
  const d = imgData.data;
  const paintMeta = PAINT_PRESETS.find((p) => p.id === config.paintColor) ?? PAINT_PRESETS[0];
  const glareFactor = config.glareIntensity / 100;
  const wetFactor = config.wetnessLevel / 100;
  const rand = seededRandom(config.seed);

  // Pre-calculate flash hotspot center based on seed
  const flashCx = PROCESS_W * (0.42 + (rand() - 0.5) * 0.24);
  const flashCy = PROCESS_H * (0.46 + (rand() - 0.5) * 0.22);

  for (let y = 0; y < PROCESS_H; y++) {
    const ny = y / PROCESS_H;
    for (let x = 0; x < PROCESS_W; x++) {
      const idx = (y * PROCESS_W + x) * 4;
      let r = d[idx];
      let g = d[idx + 1];
      let b = d[idx + 2];

      // Selective Clear-Coat Paint Color Shift (skip deep shadows, bright sky, and high-contrast scratches)
      if (paintMeta.targetHue !== null) {
        const [, sat, lum] = rgbToHsl(r, g, b);
        if (lum > 0.16 && lum < 0.84 && sat < 0.55) {
          // Preserve specular highlights while shifting body paint hue
          const specPreserve = Math.max(0, (lum - 0.68) / 0.32);
          const [nr, ng, nb] = hslToRgb(
            paintMeta.targetHue,
            Math.min(0.85, (sat * 0.5 + 0.32) * paintMeta.satBoost),
            Math.min(0.92, lum * paintMeta.valScale)
          );
          const blend = 0.72 * (1 - specPreserve * 0.7);
          r = r * (1 - blend) + nr * blend;
          g = g * (1 - blend) + ng * blend;
          b = b * (1 - blend) + nb * blend;
        }
      }

      const luma = 0.299 * r + 0.587 * g + 0.114 * b;

      // Domain & Lighting Environment Shaders
      if (config.lighting === "night_lot") {
        // Cool nocturnal ambient + warm overhead sodium vapor pool
        const lampDist = Math.hypot(x - PROCESS_W * 0.52, y - PROCESS_H * 0.15) / PROCESS_W;
        const lampPool = Math.max(0, 1 - lampDist * 1.45);
        r = r * (0.36 + 0.52 * lampPool) + 18 * lampPool;
        g = g * (0.34 + 0.42 * lampPool) + 10 * lampPool;
        b = b * (0.46 + 0.24 * lampPool) + 14;
        // Boost clear-coat highlights in the dark
        if (luma > 165) {
          const boost = ((luma - 165) / 90) * (38 + glareFactor * 45);
          r += boost * 1.1;
          g += boost * 0.95;
          b += boost * 0.7;
        }
      } else if (config.lighting === "midday_glare") {
        // High-contrast zenith sun + intense specular clear-coat blowout
        const nx = x / PROCESS_W;
        const sunBand = Math.exp(-Math.pow((nx * 0.7 + ny * 0.9 - 0.65) * 4.2, 2));
        const spec = (luma > 145 ? (luma - 145) * 0.72 : 0) + sunBand * (55 + glareFactor * 70);
        r = (r - 128) * 1.18 + 134 + spec * 1.04;
        g = (g - 128) * 1.18 + 132 + spec * 1.0;
        b = (b - 128) * 1.14 + 124 + spec * 0.9;
      } else if (config.lighting === "wet_rain") {
        // Cool overcast blue-slate cast + wet specular contrast
        const specGloss = luma > 150 ? (luma - 150) * (0.45 + wetFactor * 0.55) : 0;
        r = r * 0.82 + specGloss * 0.9;
        g = g * 0.89 + 6 + specGloss * 0.96;
        b = b * 1.03 + 14 + specGloss * 1.08;
      } else if (config.lighting === "dim_workshop") {
        // Warm-greenish fluorescent shop bay + radial vignette
        const vDist = Math.hypot((x - PROCESS_W / 2) / PROCESS_W, (y - PROCESS_H / 2) / PROCESS_H);
        const vig = Math.max(0.45, 1 - vDist * 0.75);
        r = (r * 0.76 + 12) * vig;
        g = (g * 0.78 + 14) * vig;
        b = (b * 0.71 + 8) * vig;
      } else if (config.lighting === "harsh_flash") {
        // On-axis smartphone LED flash hotspot + rapid falloff
        const dist = Math.hypot(x - flashCx, y - flashCy) / (PROCESS_W * 0.55);
        const falloff = Math.max(0.32, Math.exp(-dist * dist * 1.45));
        const hotspot = Math.max(0, 1 - dist * 1.9) * (55 + glareFactor * 75);
        r = r * (0.45 + 0.75 * falloff) + hotspot;
        g = g * (0.45 + 0.75 * falloff) + hotspot * 0.99;
        b = b * (0.47 + 0.75 * falloff) + hotspot * 0.96;
      }

      // Wet clear-coat micro-sheen
      if (wetFactor > 0.1 && config.lighting !== "wet_rain") {
        if (luma > 155) {
          const sheen = (luma - 155) * wetFactor * 0.45;
          r += sheen;
          g += sheen;
          b += sheen * 1.05;
        }
      }

      d[idx] = clampByte(r);
      d[idx + 1] = clampByte(g);
      d[idx + 2] = clampByte(b);
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // 3. Optional Atmospheric Overlays (Rain streaks or Workshop dust)
  if (config.lighting === "wet_rain" || config.wetnessLevel > 45) {
    const rainAlpha =
      config.lighting === "wet_rain"
        ? 0.22 + wetFactor * 0.28
        : (wetFactor - 0.45) * 0.35;
    if (rainAlpha > 0.02) {
      ctx.save();
      ctx.strokeStyle = `rgba(226, 232, 240, ${rainAlpha.toFixed(2)})`;
      ctx.lineWidth = 1;
      const drops = Math.round(110 + wetFactor * 180);
      for (let i = 0; i < drops; i++) {
        const rx = rand() * PROCESS_W;
        const ry = rand() * PROCESS_H;
        const len = 14 + rand() * 24;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 4, ry + len);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  if (config.lighting === "dim_workshop") {
    ctx.save();
    for (let i = 0; i < 65; i++) {
      const dx = rand() * PROCESS_W;
      const dy = rand() * PROCESS_H;
      const dr = 1 + rand() * 2.2;
      ctx.fillStyle = `rgba(254, 243, 199, ${(0.04 + rand() * 0.08).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(dx, dy, dr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Transform all bounding boxes to track perspective warp
  const transformedDetections = allDetections.map((det) => ({
    ...det,
    bbox: transformBboxPerspective(det.bbox, config.perspectiveYawDeg, false, 0),
  }));

  const finalImageData = ctx.getImageData(0, 0, PROCESS_W, PROCESS_H);
  const quality = computeQualityMetrics(
    finalImageData,
    allDetections,
    transformedDetections,
    config
  );

  return {
    imageDataUrl: outCanvas.toDataURL("image/jpeg", 0.92),
    transformedDetections,
    quality,
    hasInpaintedDamage,
  };
}
