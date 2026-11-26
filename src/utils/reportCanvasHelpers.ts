import { loadTrimmedPresidentSignature } from './certificateSignature';

export interface HighlightSegment {
  text: string;
  color: string;
}

export function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function loadWhitePresidentSignatureCanvas(): Promise<HTMLCanvasElement | null> {
  const sigAsset = await loadTrimmedPresidentSignature();
  if (!sigAsset?.dataUrl) return null;

  const img = await loadImageElement(sigAsset.dataUrl);
  if (!img || img.naturalWidth === 0 || img.naturalHeight === 0) return null;

  const offscreen = document.createElement('canvas');
  offscreen.width = img.naturalWidth;
  offscreen.height = img.naturalHeight;
  const sctx = offscreen.getContext('2d');
  if (!sctx) return null;

  sctx.clearRect(0, 0, offscreen.width, offscreen.height);
  sctx.drawImage(img, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, offscreen.width, offscreen.height);
  sctx.globalCompositeOperation = 'source-over';

  return offscreen;
}

export function trimTransparentImageCanvas(
  img: HTMLImageElement
): HTMLCanvasElement | HTMLImageElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return img;

  try {
    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = w;
    scanCanvas.height = h;
    const sctx = scanCanvas.getContext('2d');
    if (!sctx) return img;

    sctx.clearRect(0, 0, w, h);
    sctx.drawImage(img, 0, 0, w, h);
    const { data } = sctx.getImageData(0, 0, w, h);

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w * 4;
      for (let x = 0; x < w; x++) {
        if (data[rowOffset + x * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return img;

    const pad = 2;
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const sw = Math.min(w - sx, maxX - minX + 1 + pad * 2);
    const sh = Math.min(h - sy, maxY - minY + 1 + pad * 2);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = sw;
    outCanvas.height = sh;
    const octx = outCanvas.getContext('2d');
    if (!octx) return img;

    octx.clearRect(0, 0, sw, sh);
    octx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return outCanvas;
  } catch {
    return img;
  }
}

export function drawAutoFittedCellText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  startPx: number,
  minPx = 9.5,
  baseScaleX = 0.94,
  weight = 700
) {
  let fontSize = startPx;
  ctx.font = `${weight} ${fontSize}px Tahoma, Verdana, Geneva, sans-serif`;
  while (
    fontSize > minPx &&
    ctx.measureText(text).width * baseScaleX > maxWidth
  ) {
    fontSize -= 0.5;
    ctx.font = `${weight} ${fontSize}px Tahoma, Verdana, Geneva, sans-serif`;
  }

  const measured = ctx.measureText(text).width;
  const finalScaleX =
    measured * baseScaleX > maxWidth && measured > 0
      ? maxWidth / measured
      : baseScaleX;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(finalScaleX, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function splitHighlightedTokens(
  text: string,
  pattern: RegExp,
  highlightColor: string,
  defaultColor = '#ffffff'
): HighlightSegment[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  const segments: HighlightSegment[] = [];
  let lastIdx = 0;

  for (const match of text.matchAll(regex)) {
    const idx = match.index ?? 0;
    if (idx > lastIdx) {
      segments.push({ text: text.slice(lastIdx, idx), color: defaultColor });
    }
    segments.push({ text: match[0], color: highlightColor });
    lastIdx = idx + match[0].length;
  }

  if (lastIdx < text.length) {
    segments.push({ text: text.slice(lastIdx), color: defaultColor });
  }

  return segments.length > 0 ? segments : [{ text, color: defaultColor }];
}

export function drawHighlightedAutoSizedLine(
  ctx: CanvasRenderingContext2D,
  segments: HighlightSegment[],
  x: number,
  y: number,
  maxWidth: number,
  startPx: number,
  minPx: number,
  weight = 700,
  baseScaleX = 0.80
) {
  const fullText = segments.map((s) => s.text).join('');
  let fontSize = startPx;
  ctx.font = `${weight} ${fontSize}px Tahoma, Verdana, Geneva, sans-serif`;
  while (
    fontSize > minPx &&
    ctx.measureText(fullText).width * baseScaleX > maxWidth
  ) {
    fontSize -= 1;
    ctx.font = `${weight} ${fontSize}px Tahoma, Verdana, Geneva, sans-serif`;
  }

  const scaledWidth = ctx.measureText(fullText).width * baseScaleX;
  const scaleX =
    scaledWidth > maxWidth && scaledWidth > 0
      ? baseScaleX * (maxWidth / scaledWidth)
      : baseScaleX;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scaleX, 1);
  let curX = 0;
  for (const seg of segments) {
    if (!seg.text) continue;
    ctx.fillStyle = seg.color;
    ctx.fillText(seg.text, curX, 0);
    curX += ctx.measureText(seg.text).width;
  }
  ctx.restore();
}

function splitVenueAndAddress(rawText: string): [string, string] | null {
  const cleaned = rawText
    .replace(/\r/g, '')
    .replace(/\n+\s*Estacas\s*\(\d+\)\s*$/i, '')
    .trim();
  if (!cleaned) return null;

  const prefixMatch = cleaned.match(/^LOCAL:\s*/i);
  const prefix = prefixMatch ? 'LOCAL: ' : '';
  const body = prefixMatch ? cleaned.slice(prefixMatch[0].length).trim() : cleaned;

  // 1. Pipe- or slash-delimited seed format: "Venue | Street | Neighborhood | City - UF"
  const delimiter = body.includes('|') ? '|' : body.includes(' / ') ? ' / ' : null;
  if (delimiter) {
    const parts = body
      .split(delimiter)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return [`${prefix}${parts[0]}`, parts.slice(1).join(', ')];
    }
  }

  // 2. Multi-line address
  const nlLines = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (nlLines.length >= 2) {
    return [`${prefix}${nlLines[0]}`, nlLines.slice(1).join(', ')];
  }

  // 3. Inline separator before street keyword (", Rua ...", " - Av. ...", etc.)
  const streetMatch = body.match(
    /\s*[,;\-–·]\s*((?:RUA|R\.|AV\.?|AVENIDA|TRAVESSA|TV\.?|ESTRADA|RODOVIA|ALAMEDA|PRAÇA|PC\.?)\b.*)$/i
  );
  if (streetMatch && streetMatch.index && streetMatch.index > 2) {
    const venue = body.slice(0, streetMatch.index).trim();
    const address = streetMatch[1].trim();
    if (venue && address) {
      return [`${prefix}${venue}`, address];
    }
  }

  return null;
}

export function drawTwoLineHeaderText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y1: number,
  lineGap: number,
  maxWidth: number,
  startPx = 14,
  minPx = 9.5,
  baseScaleX = 0.88,
  weight = 600,
  color = '#f8fafc'
) {
  const structuredSplit = splitVenueAndAddress(text);

  if (structuredSplit) {
    const [lineA, lineB] = structuredSplit;
    let fontSize = startPx;
    while (fontSize > minPx) {
      ctx.font = `${weight} ${fontSize}px Tahoma, Verdana, Geneva, sans-serif`;
      const fitsA = ctx.measureText(lineA).width * baseScaleX <= maxWidth;
      const fitsB = ctx.measureText(lineB).width * baseScaleX <= maxWidth;
      if (fitsA && fitsB) break;
      fontSize -= 0.5;
    }

    ctx.font = `${weight} ${fontSize}px Tahoma, Verdana, Geneva, sans-serif`;
    const drawSingleLine = (lineStr: string, lineY: number) => {
      const measured = ctx.measureText(lineStr).width;
      const scaleX =
        measured * baseScaleX > maxWidth && measured > 0
          ? maxWidth / measured
          : baseScaleX;
      ctx.save();
      ctx.translate(x, lineY);
      ctx.scale(scaleX, 1);
      ctx.fillStyle = color;
      ctx.fillText(lineStr, 0, 0);
      ctx.restore();
    };

    drawSingleLine(lineA, y1);
    drawSingleLine(lineB, y1 + lineGap);
    return;
  }

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return;

  if (words.length === 1) {
    let fontSize = startPx;
    ctx.font = `${weight} ${fontSize}px Tahoma, Verdana, Geneva, sans-serif`;
    while (
      fontSize > minPx &&
      ctx.measureText(words[0]).width * baseScaleX > maxWidth
    ) {
      fontSize -= 0.5;
      ctx.font = `${weight} ${fontSize}px Tahoma, Verdana, Geneva, sans-serif`;
    }
    const w0 = ctx.measureText(words[0]).width;
    const scaleX =
      w0 * baseScaleX > maxWidth && w0 > 0 ? maxWidth / w0 : baseScaleX;
    ctx.save();
    ctx.translate(x, y1);
    ctx.scale(scaleX, 1);
    ctx.fillStyle = color;
    ctx.fillText(words[0], 0, 0);
    ctx.restore();
    return;
  }

  const pickBestSplit = (): [string, string] => {
    let bestScore = Number.POSITIVE_INFINITY;
    let bestPair: [string, string] = [words[0], words.slice(1).join(' ')];

    for (let k = 1; k < words.length; k++) {
      const partA = words.slice(0, k).join(' ');
      const partB = words.slice(k).join(' ');
      const wA = ctx.measureText(partA).width;
      const wB = ctx.measureText(partB).width;
      const lastWordA = words[k - 1];
      const endsWithBreak =
        /[,;\-–·/]$/.test(lastWordA) || lastWordA === '-' || lastWordA === '–';
      const score = Math.max(wA, wB) - (endsWithBreak ? 36 : 0);
      if (score < bestScore) {
        bestScore = score;
        bestPair = [partA, partB];
      }
    }
    return bestPair;
  };

  let fontSize = startPx;
  ctx.font = `${weight} ${fontSize}px Tahoma, Verdana, Geneva, sans-serif`;
  let [lineA, lineB] = pickBestSplit();

  while (fontSize > minPx) {
    ctx.font = `${weight} ${fontSize}px Tahoma, Verdana, Geneva, sans-serif`;
    [lineA, lineB] = pickBestSplit();
    const fitsA = ctx.measureText(lineA).width * baseScaleX <= maxWidth;
    const fitsB = ctx.measureText(lineB).width * baseScaleX <= maxWidth;
    if (fitsA && fitsB) break;
    fontSize -= 0.5;
  }

  ctx.font = `${weight} ${fontSize}px Tahoma, Verdana, Geneva, sans-serif`;
  [lineA, lineB] = pickBestSplit();

  const drawSingleLine = (lineStr: string, lineY: number) => {
    const measured = ctx.measureText(lineStr).width;
    const scaleX =
      measured * baseScaleX > maxWidth && measured > 0
        ? maxWidth / measured
        : baseScaleX;
    ctx.save();
    ctx.translate(x, lineY);
    ctx.scale(scaleX, 1);
    ctx.fillStyle = color;
    ctx.fillText(lineStr, 0, 0);
    ctx.restore();
  };

  drawSingleLine(lineA, y1);
  drawSingleLine(lineB, y1 + lineGap);
}
