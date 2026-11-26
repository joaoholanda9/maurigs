import * as XLSX from 'xlsx';
import defaultAopeLogo from '../assets/aope-logo.svg';
import type { BirdModality } from '../types/championship';
import { renderColeiroPosterPng } from './coleiroReportLayout';
import { renderTrincaPosterPng } from './trincaReportLayout';
import {
  drawAutoFittedCellText,
  drawHighlightedAutoSizedLine,
  drawTwoLineHeaderText,
  type HighlightSegment,
  loadImageElement,
  loadWhitePresidentSignatureCanvas,
  splitHighlightedTokens,
  trimTransparentImageCanvas,
} from './reportCanvasHelpers';

export interface ExcelExportOptions {
  filename: string;
  sheetName: string;
  metadataRows: (string | number)[][];
  headers: string[];
  rows: (string | number)[][];
  colWidths?: number[];
}

export function exportReportToExcel({
  filename,
  sheetName,
  metadataRows,
  headers,
  rows,
  colWidths,
}: ExcelExportOptions): void {
  const aoa: (string | number)[][] = [
    ...metadataRows,
    [],
    headers,
    ...rows,
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  if (colWidths && colWidths.length > 0) {
    worksheet['!cols'] = colWidths.map((wch) => ({ wch }));
  } else {
    const maxCols = Math.max(
      headers.length,
      ...metadataRows.map((r) => r.length),
      ...rows.map((r) => r.length)
    );
    const widths: { wch: number }[] = [];
    for (let c = 0; c < maxCols; c++) {
      let maxLen = 10;
      for (const row of aoa) {
        const val = row[c];
        if (val !== undefined && val !== null) {
          maxLen = Math.max(maxLen, String(val).length + 3);
        }
      }
      widths.push({ wch: Math.min(48, maxLen) });
    }
    worksheet['!cols'] = widths;
  }

  const workbook = XLSX.utils.book_new();
  const safeSheet = sheetName.slice(0, 31) || 'Relatorio';
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheet);
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export interface PngColumn {
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
  emphasis?: 'normal' | 'bold' | 'emerald';
}

export interface PngExportOptions {
  filename: string;
  championshipName: string;
  seasonYear: number;
  modality?: BirdModality;
  reportTitle: string;
  stageHighlight?: string;
  stageLocation?: string;
  issuedAtText: string;
  filterLabel: string;
  eventLogoDataUrl?: string;
  infoBlocks: { label: string; value: string }[];
  columns: PngColumn[];
  rows: (string | number)[][];
}

const WATERMARK_IMAGE_URL = '/assets/aistudio/Logo.Papa_f214021c.png';

async function loadTransparentWatermarkCanvas(
  src: string
): Promise<HTMLCanvasElement | null> {
  const img = await loadImageElement(src);
  if (!img || img.naturalWidth === 0 || img.naturalHeight === 0) return null;

  const offscreen = document.createElement('canvas');
  offscreen.width = img.naturalWidth;
  offscreen.height = img.naturalHeight;
  const octx = offscreen.getContext('2d');
  if (!octx) return null;

  octx.drawImage(img, 0, 0);
  const imageData = octx.getImageData(0, 0, offscreen.width, offscreen.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxC = Math.max(r, g, b);
    if (maxC <= 12) {
      data[i + 3] = 0;
    } else if (maxC < 52) {
      data[i + 3] = Math.round(((maxC - 12) / 40) * data[i + 3]);
    }
  }

  octx.putImageData(imageData, 0, 0);
  return offscreen;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

function drawCondensedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  scaleX = 0.86
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scaleX, 1);
  const safe = fitText(ctx, text, maxWidth / scaleX);
  ctx.fillText(safe, 0, 0);
  ctx.restore();
}



function drawDarkCyberAopeCrest(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.translate(x, y);

  const fontSize = Math.round(h * 0.88);
  const baseY = h * 0.83;
  ctx.font = `900 ${fontSize}px Tahoma, Verdana, Geneva, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const drawLetter = (char: string, lx: number, strokeCol: string) => {
    ctx.save();
    ctx.translate(lx, baseY);
    ctx.scale(0.90, 1);

    // Glow outline
    ctx.shadowColor = strokeCol;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 5;
    ctx.strokeStyle = strokeCol;
    ctx.strokeText(char, 0, 0);

    // Metallic dark translucent fill so background stays open
    ctx.shadowBlur = 0;
    const grad = ctx.createLinearGradient(0, -fontSize * 0.8, 0, 6);
    grad.addColorStop(0, 'rgba(54, 88, 99, 0.88)');
    grad.addColorStop(0.45, 'rgba(13, 34, 41, 0.78)');
    grad.addColorStop(1, 'rgba(31, 68, 80, 0.88)');
    ctx.fillStyle = grad;
    ctx.fillText(char, 0, 0);

    // Inner bright rim
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.72)';
    ctx.strokeText(char, 0, 0);
    ctx.restore();
  };

  // Left A
  drawLetter('A', w * 0.14, '#22d3ee');
  // Right P and E
  drawLetter('P', w * 0.67, '#22d3ee');
  drawLetter('E', w * 0.88, '#4ade80');

  // Center circular "O" emblem with transparent interior and perched songbird
  const cx = w * 0.405;
  const cy = h * 0.50;
  const rOuter = h * 0.43;
  const rInner = rOuter * 0.74;

  ctx.save();
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.lineWidth = 5.5;
  const ringGrad = ctx.createLinearGradient(cx - rOuter, cy - rOuter, cx + rOuter, cy + rOuter);
  ringGrad.addColorStop(0, '#38bdf8');
  ringGrad.addColorStop(0.55, '#a3e635');
  ringGrad.addColorStop(1, '#22d3ee');
  ctx.strokeStyle = ringGrad;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(103, 232, 249, 0.78)';
  ctx.stroke();

  // Perched songbird inside the emblem
  ctx.translate(cx, cy);
  const bs = rInner / 32;
  ctx.scale(bs, bs);

  // Perch twig
  ctx.beginPath();
  ctx.moveTo(-22, 16);
  ctx.quadraticCurveTo(0, 11, 22, 15);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#94a3b8';
  ctx.stroke();

  // Bird silhouette
  const birdGrad = ctx.createLinearGradient(-16, -20, 18, 14);
  birdGrad.addColorStop(0, '#10b981');
  birdGrad.addColorStop(0.55, '#84cc16');
  birdGrad.addColorStop(1, '#facc15');
  ctx.fillStyle = birdGrad;
  ctx.beginPath();
  ctx.moveTo(-2, -19);
  ctx.bezierCurveTo(6, -20, 12, -16, 15, -10);
  ctx.lineTo(24, -12);
  ctx.lineTo(15, -6);
  ctx.lineTo(22, -2);
  ctx.lineTo(12, -1);
  ctx.bezierCurveTo(9, 6, 10, 13, 6, 15);
  ctx.bezierCurveTo(0, 17, -8, 15, -13, 10);
  ctx.lineTo(-26, 21);
  ctx.lineTo(-28, 16);
  ctx.lineTo(-14, 2);
  ctx.bezierCurveTo(-16, -8, -11, -17, -2, -19);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = '#05151b';
  ctx.beginPath();
  ctx.arc(9, -11, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawWireframeSongbirdWatermark(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scaleSize: number
) {
  ctx.save();
  ctx.translate(centerX, centerY);
  const s = scaleSize / 520;
  ctx.scale(s, s);

  // Ambient cyan holographic glow behind bird
  const glow = ctx.createRadialGradient(15, -20, 20, 0, 0, 320);
  glow.addColorStop(0, 'rgba(34, 211, 238, 0.24)');
  glow.addColorStop(0.55, 'rgba(6, 182, 212, 0.09)');
  glow.addColorStop(1, 'rgba(6, 182, 212, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 320, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Diagonal Perch Branch (bottom-left to mid-right)
  ctx.save();
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = 'rgba(103, 232, 249, 0.44)';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(-275, 175);
  ctx.quadraticCurveTo(38, 86, 285, -10);
  ctx.stroke();

  ctx.lineWidth = 1.8;
  ctx.strokeStyle = 'rgba(165, 243, 252, 0.34)';
  ctx.beginPath();
  ctx.moveTo(-270, 184);
  ctx.quadraticCurveTo(44, 96, 288, 0);
  ctx.stroke();

  // Branch twigs & bark texture lines
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(114, 52);
  ctx.lineTo(188, -24);
  ctx.moveTo(154, 16);
  ctx.lineTo(226, -6);
  ctx.moveTo(74, 72);
  ctx.lineTo(136, 122);
  ctx.moveTo(-110, 126);
  ctx.lineTo(-42, 108);
  ctx.stroke();
  ctx.restore();

  // Legs & gripping toes on branch
  ctx.strokeStyle = 'rgba(165, 243, 252, 0.42)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-2, 62);
  ctx.lineTo(-18, 108);
  ctx.lineTo(-28, 114);
  ctx.moveTo(-18, 108);
  ctx.lineTo(-8, 116);
  ctx.moveTo(34, 52);
  ctx.lineTo(22, 95);
  ctx.lineTo(12, 102);
  ctx.moveTo(22, 95);
  ctx.lineTo(32, 103);
  ctx.stroke();

  // Main Coleiro Songbird Contour Path (facing right with stout conical finch beak)
  const traceBirdPath = () => {
    ctx.beginPath();
    ctx.moveTo(34, -186);
    ctx.bezierCurveTo(76, -196, 118, -174, 132, -142);
    // Stout conical Coleiro beak
    ctx.quadraticCurveTo(164, -142, 184, -128);
    ctx.quadraticCurveTo(162, -112, 132, -108);
    // Throat & rounded chest
    ctx.bezierCurveTo(138, -56, 136, 10, 92, 54);
    ctx.bezierCurveTo(46, 90, -24, 82, -66, 54);
    // Long swept tail extending bottom-left
    ctx.lineTo(-228, 214);
    ctx.lineTo(-244, 196);
    ctx.lineTo(-210, 148);
    ctx.lineTo(-254, 180);
    ctx.lineTo(-106, 16);
    // Back & wing shoulder up to crown
    ctx.bezierCurveTo(-116, -54, -76, -144, 34, -186);
    ctx.closePath();
  };

  // Soft outer wireframe stroke
  ctx.save();
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 18;
  traceBirdPath();
  ctx.fillStyle = 'rgba(20, 126, 148, 0.13)';
  ctx.fill();
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = 'rgba(125, 240, 255, 0.48)';
  ctx.stroke();
  ctx.restore();

  // Beak ridge line
  ctx.save();
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.46)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(132, -124);
  ctx.quadraticCurveTo(158, -125, 182, -128);
  ctx.stroke();
  ctx.restore();

  // Clip interior wireframe mesh cleanly inside bird silhouette
  ctx.save();
  traceBirdPath();
  ctx.clip();

  ctx.strokeStyle = 'rgba(103, 232, 249, 0.28)';
  ctx.lineWidth = 1.15;

  // Longitudinal anatomical wireframe curves
  for (let i = -6; i <= 7; i++) {
    const offset = i * 24;
    ctx.beginPath();
    ctx.moveTo(-244, 174 + offset * 0.44);
    ctx.bezierCurveTo(-50, 20 + offset * 0.7, 52, -92 + offset * 0.64, 164, -134 + offset * 0.32);
    ctx.stroke();
  }

  // Cross-section ribs across chest, head, and tail
  for (let t = -224; t <= 156; t += 22) {
    ctx.beginPath();
    ctx.moveTo(t - 44, -210);
    ctx.quadraticCurveTo(t + 30, -25, t - 20, 224);
    ctx.stroke();
  }

  // Wing coverts & primary feather wireframe arcs
  ctx.strokeStyle = 'rgba(165, 243, 252, 0.36)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-58, -68);
  ctx.bezierCurveTo(18, -74, 58, -16, 44, 42);
  ctx.lineTo(-98, 50);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-42, -46);
  ctx.quadraticCurveTo(12, -46, 18, 18);
  ctx.moveTo(-64, -22);
  ctx.quadraticCurveTo(-8, -18, -6, 36);
  ctx.moveTo(-82, 4);
  ctx.quadraticCurveTo(-24, 10, -26, 46);
  ctx.stroke();
  ctx.restore();

  // Highlighted eye wireframe ring
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.54)';
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.arc(92, -138, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(224, 242, 254, 0.48)';
  ctx.beginPath();
  ctx.arc(92, -138, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Wireframe mesh nodes (subtle holographic points)
  const nodes: [number, number][] = [
    [34, -186], [84, -174], [132, -142], [92, -138], [184, -128],
    [126, -72], [118, 12], [68, 64], [-18, 66], [-64, 54], [-98, -28],
    [-46, -108], [16, -98], [44, 42], [-152, 118], [-228, 214],
    [-2, 62], [34, 52], [114, 52], [188, -24],
  ];
  ctx.fillStyle = 'rgba(165, 243, 252, 0.52)';
  for (const [nx, ny] of nodes) {
    ctx.beginPath();
    ctx.arc(nx, ny, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export async function exportReportToPng({
  filename,
  championshipName,
  seasonYear,
  modality,
  reportTitle,
  stageHighlight,
  stageLocation,
  issuedAtText,
  eventLogoDataUrl,
  infoBlocks,
  columns,
  rows,
}: PngExportOptions): Promise<void> {
  const isDefaultAope = !eventLogoDataUrl || eventLogoDataUrl === defaultAopeLogo;
  const isColeiroModality =
    !modality || modality === 'Coleiro' || modality === 'Papa-Capim';
  const isTrincaModality = modality === 'Trinca-Ferro';
  const resolvedLocation =
    stageLocation?.trim() ||
    infoBlocks.find((b) => b.label === 'Local')?.value?.trim() ||
    '';

  const [loadedCustomLogo, watermarkCanvas, whiteSignatureCanvas] =
    await Promise.all([
      !isDefaultAope && eventLogoDataUrl
        ? loadImageElement(eventLogoDataUrl)
        : Promise.resolve(null),
      isColeiroModality || isTrincaModality
        ? Promise.resolve(null)
        : loadTransparentWatermarkCanvas(WATERMARK_IMAGE_URL),
      loadWhitePresidentSignatureCanvas(),
    ]);

  if (isColeiroModality) {
    return renderColeiroPosterPng({
      filename,
      championshipName,
      seasonYear,
      modality,
      reportTitle,
      stageHighlight,
      resolvedLocation,
      issuedAtText,
      isDefaultAope,
      loadedCustomLogo,
      whiteSignatureCanvas,
      columns,
      rows,
    });
  }

  if (isTrincaModality) {
    return renderTrincaPosterPng({
      filename,
      championshipName,
      seasonYear,
      modality,
      reportTitle,
      stageHighlight,
      resolvedLocation,
      issuedAtText,
      isDefaultAope,
      loadedCustomLogo,
      whiteSignatureCanvas,
      columns,
      rows,
    });
  }

  await new Promise<void>((resolve, reject) => {
    const outerMargin = 18;
    const paddingX = 40;
    const contentWidth = columns.reduce((acc, c) => acc + c.width, 0);
    const colGap = 4;
    const totalGaps = Math.max(0, columns.length - 1) * colGap;
    const width = Math.max(1240, contentWidth + totalGaps + paddingX * 2);
    const tableWidth = width - paddingX * 2;

    const headerHeight = 204;
    const hudBarHeight = 26;
    const tableHeaderHeight = 42;
    const rowHeight = 37;
    const rowGap = 5;
    const rowStep = rowHeight + rowGap;
    const rowsBlockHeight = rows.length * rowStep;
    const footerHeight = 136;

    const minBodyHeight = Math.max(rowsBlockHeight, 360);
    const height =
      outerMargin +
      headerHeight +
      hudBarHeight +
      tableHeaderHeight +
      6 +
      minBodyHeight +
      footerHeight +
      outerMargin;

    const scale = 3;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas não suportado neste navegador.'));
      return;
    }

    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Background: Deep Cyber-Teal Gradient + Perspective Grid
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#041419');
    bgGrad.addColorStop(0.5, '#072229');
    bgGrad.addColorStop(1, '#030f14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const centerGlow = ctx.createRadialGradient(
      width * 0.52,
      height * 0.52,
      40,
      width * 0.52,
      height * 0.52,
      width * 0.65
    );
    centerGlow.addColorStop(0, 'rgba(20, 148, 168, 0.24)');
    centerGlow.addColorStop(0.6, 'rgba(8, 65, 78, 0.10)');
    centerGlow.addColorStop(1, 'rgba(3, 15, 20, 0)');
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.11)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= width; gx += 72) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(width * 0.5 + (gx - width * 0.5) * 0.72, 136);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(gx, height);
      ctx.lineTo(width * 0.5 + (gx - width * 0.5) * 0.72, height - 108);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Outer HUD Frame Border + Corner Brackets + Right Equalizer Ticks
    const frameX = outerMargin;
    const frameY = outerMargin;
    const frameW = width - outerMargin * 2;
    const frameH = height - outerMargin * 2;

    ctx.save();
    drawRoundedRect(ctx, frameX, frameY, frameW, frameH, 10);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.42)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Bright corner L-brackets
    const bracketLen = 28;
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2.6;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 8;

    const corners: [number, number, number, number][] = [
      [frameX, frameY, 1, 1],
      [frameX + frameW, frameY, -1, 1],
      [frameX, frameY + frameH, 1, -1],
      [frameX + frameW, frameY + frameH, -1, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * bracketLen, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * bracketLen);
      ctx.stroke();
    }

    // Vertical right-edge HUD tick marks
    ctx.shadowBlur = 0;
    const tickStartY = frameY + headerHeight + 8;
    const tickEndY = frameY + frameH - 70;
    for (let ty = tickStartY; ty < tickEndY; ty += 9) {
      const isMajor = (ty - tickStartY) % 45 === 0;
      ctx.fillStyle = isMajor ? 'rgba(103, 232, 249, 0.58)' : 'rgba(34, 211, 238, 0.28)';
      ctx.fillRect(frameX + frameW - (isMajor ? 10 : 6), ty, isMajor ? 7 : 4, 3);
    }
    ctx.restore();

    // 3. Header: Preserved AOPE Logo + Tall Condensed HUD Titles + Two-Line Complete Event Location
    const headerTop = outerMargin + 2;
    const logoX = outerMargin + 4;
    const logoBoxW = 476;
    const logoBoxH = 200;

    if (
      !isDefaultAope &&
      loadedCustomLogo &&
      loadedCustomLogo.naturalWidth > 0 &&
      loadedCustomLogo.naturalHeight > 0
    ) {
      const logoSource = trimTransparentImageCanvas(loadedCustomLogo);
      const srcW =
        logoSource instanceof HTMLCanvasElement
          ? logoSource.width
          : logoSource.naturalWidth;
      const srcH =
        logoSource instanceof HTMLCanvasElement
          ? logoSource.height
          : logoSource.naturalHeight;
      const scaleImg = Math.min(logoBoxW / srcW, logoBoxH / srcH);
      const drawW = srcW * scaleImg;
      const drawH = srcH * scaleImg;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 12;
      ctx.drawImage(
        logoSource,
        logoX + (logoBoxW - drawW) / 2,
        headerTop + (logoBoxH - drawH) / 2,
        drawW,
        drawH
      );
      ctx.restore();
    } else {
      drawDarkCyberAopeCrest(ctx, logoX, headerTop, logoBoxW, logoBoxH);
    }

    const titleX = logoX + logoBoxW + 14;
    const titleMaxW = width - paddingX - titleX - 4;

    const yearSuffix = championshipName.includes(String(seasonYear))
      ? ''
      : ` ${seasonYear}`;
    const rawLine1 = `${championshipName.toUpperCase()}${yearSuffix}`;
    const line1Text = /\bAOPE\b/i.test(rawLine1) ? rawLine1 : `${rawLine1} AOPE`;
    const line1Segments = splitHighlightedTokens(
      line1Text,
      /\bAOPE\b/gi,
      '#95FF00',
      '#e6fbff'
    );

    const line2Text = modality
      ? `MODALIDADE ${modality.toUpperCase()}`
      : reportTitle.toUpperCase();
    const line2Segments: HighlightSegment[] = [
      { text: line2Text, color: '#ffffff' },
    ];

    const line3Text = (stageHighlight || reportTitle).toUpperCase();
    const hasStageToken = /\d+ª\s+ETAPA/i.test(line3Text);
    const line3Segments = hasStageToken
      ? splitHighlightedTokens(line3Text, /\d+ª\s+ETAPA/gi, '#95FF00', '#ffffff')
      : [{ text: line3Text, color: '#95FF00' }];

    const line1StartPx = Math.round(width * 0.031);
    const line2StartPx = Math.round(width * 0.028);
    const line3StartPx = Math.round(width * 0.027);
    const startY = resolvedLocation
      ? Math.round(outerMargin + headerHeight / 2 - 47)
      : Math.round(outerMargin + headerHeight / 2 - 23);

    // Header Line 1: Championship + Year + AOPE Highlight (#95FF00)
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
    ctx.shadowBlur = 7;
    drawHighlightedAutoSizedLine(
      ctx,
      line1Segments,
      titleX,
      startY,
      titleMaxW,
      line1StartPx,
      22,
      700,
      0.78
    );
    ctx.restore();

    // Header Line 2: Modality (Tall Condensed White Tahoma)
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.68)';
    ctx.shadowBlur = 7;
    drawHighlightedAutoSizedLine(
      ctx,
      line2Segments,
      titleX,
      startY + 38,
      titleMaxW,
      line2StartPx,
      20,
      700,
      0.80
    );
    ctx.restore();

    // Header Line 3: Current Stage Highlight (#95FF00)
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 6;
    drawHighlightedAutoSizedLine(
      ctx,
      line3Segments,
      titleX,
      startY + 75,
      titleMaxW,
      line3StartPx,
      19,
      700,
      0.82
    );
    ctx.restore();

    // Header Lines 4 & 5: Complete Event Venue Location Split Across Two Lines
    if (resolvedLocation) {
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 5;
      drawTwoLineHeaderText(
        ctx,
        `LOCAL: ${resolvedLocation.toUpperCase()}`,
        titleX,
        startY + 102,
        18,
        titleMaxW,
        14,
        10.5,
        0.88,
        600
      );
      ctx.restore();
    }

    // 4. HUD Equalizer Pill + Telemetry Signal Icons + Divider Line above Table
    const hudY = outerMargin + headerHeight;
    const lineY = hudY + 18;
    ctx.save();
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.72)';
    ctx.lineWidth = 1.6;
    ctx.shadowColor = 'rgba(34, 211, 238, 0.45)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(paddingX, lineY);
    ctx.lineTo(width - paddingX, lineY);
    ctx.stroke();

    // Left accent bracket tick under logo/title transition
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(165, 243, 252, 0.78)';
    ctx.fillRect(titleX, lineY - 3, 24, 2.5);

    // Framed segmented equalizer pill on upper-right above divider
    const pillW = 148;
    const pillH = 13;
    const pillX = width - paddingX - 242;
    const pillY = hudY + 1;
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 3);
    ctx.fillStyle = 'rgba(4, 24, 31, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.72)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    const barCount = 28;
    for (let m = 0; m < barCount; m++) {
      const mx = pillX + 6 + m * 4.9;
      const barH = m % 4 === 0 ? 8 : 6;
      ctx.fillStyle = m < 21 ? 'rgba(149, 255, 0, 0.85)' : 'rgba(103, 232, 249, 0.45)';
      ctx.fillRect(mx, pillY + (pillH - barH) / 2, 2.6, barH);
    }

    // Telemetry signal wave + 4 ascending signal strength bars on far right
    const sigWaveX = width - paddingX - 72;
    const sigWaveY = hudY + 12;
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(sigWaveX, sigWaveY, 3.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sigWaveX, sigWaveY, 7.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sigWaveX, sigWaveY, 11.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    const barsBaseX = width - paddingX - 38;
    const barsBaseY = hudY + 13;
    const barHeights = [5, 8, 11, 14];
    barHeights.forEach((bh, idx) => {
      ctx.fillStyle = idx < 3 ? '#67e8f9' : 'rgba(149, 255, 0, 0.88)';
      ctx.fillRect(barsBaseX + idx * 6.5, barsBaseY - bh, 4, bh);
    });
    ctx.restore();

    const tableTop = hudY + hudBarHeight;

    // 5. Centered Transparent Emblem Watermark behind Table (with Wireframe Fallback)
    const watermarkAreaH = tableHeaderHeight + 6 + minBodyHeight;
    const wmTargetSize = Math.min(640, Math.max(400, watermarkAreaH * 0.72));
    if (!watermarkCanvas) {
      const wmColeiroSize = Math.min(820, Math.max(480, watermarkAreaH * 0.86));
      drawWireframeSongbirdWatermark(
        ctx,
        width * 0.51,
        tableTop + watermarkAreaH * 0.49,
        wmColeiroSize
      );
    } else {
      const wmScale = Math.min(
        wmTargetSize / watermarkCanvas.width,
        wmTargetSize / watermarkCanvas.height
      );
      const wmW = watermarkCanvas.width * wmScale;
      const wmH = watermarkCanvas.height * wmScale;
      const wmX = width / 2 - wmW / 2;
      const wmY = tableTop + watermarkAreaH * 0.5 - wmH / 2;

      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.drawImage(watermarkCanvas, wmX, wmY, wmW, wmH);
      ctx.restore();
    }

    // Compute scaled column widths inside tableWidth
    const availForCols = tableWidth - totalGaps;
    const scaleCols = availForCols / contentWidth;
    const colWidths = columns.map((c) => c.width * scaleCols);

    // 6. Table Header Cells (Segmented Cyan Glass Boxes)
    let curX = paddingX;
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const cw = colWidths[c];

      ctx.save();
      drawRoundedRect(ctx, curX, tableTop, cw, tableHeaderHeight, 4);
      const hdrFill = ctx.createLinearGradient(0, tableTop, 0, tableTop + tableHeaderHeight);
      hdrFill.addColorStop(0, 'rgba(14, 78, 96, 0.84)');
      hdrFill.addColorStop(1, 'rgba(8, 46, 58, 0.80)');
      ctx.fillStyle = hdrFill;
      ctx.fill();

      ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#e0f2fe';
      ctx.font = '800 14px Tahoma, Verdana, Geneva, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelX =
        col.align === 'left'
          ? curX + 12
          : col.align === 'right'
            ? curX + cw - 12
            : curX + cw / 2;
      if (col.align === 'left') ctx.textAlign = 'left';
      else if (col.align === 'right') ctx.textAlign = 'right';
      drawCondensedText(
        ctx,
        col.label.toUpperCase(),
        labelX,
        tableTop + tableHeaderHeight / 2 + 1,
        cw - 14,
        0.92
      );
      ctx.restore();

      curX += cw + colGap;
    }

    // 7. Table Data Rows (Top 3 Podium Cards: Gold, Silver, Bronze + Translucent Cyan Glass Cells)
    let rowY = tableTop + tableHeaderHeight + 6;
    rows.forEach((row, rIdx) => {
      const isScoredRow = String(row[0] ?? '').trim() !== '—';
      const podiumTier: 'gold' | 'silver' | 'bronze' | null =
        isScoredRow && rIdx === 0
          ? 'gold'
          : isScoredRow && rIdx === 1
            ? 'silver'
            : isScoredRow && rIdx === 2
              ? 'bronze'
              : null;
      let cellX = paddingX;

      columns.forEach((col, cIdx) => {
        const cw = colWidths[cIdx];
        const valStr = String(row[cIdx] ?? '');

        ctx.save();
        drawRoundedRect(ctx, cellX, rowY, cw, rowHeight, 4);
        if (podiumTier === 'gold') {
          const goldGrad = ctx.createLinearGradient(0, rowY, 0, rowY + rowHeight);
          goldGrad.addColorStop(0, 'rgba(161, 114, 14, 0.80)');
          goldGrad.addColorStop(1, 'rgba(92, 62, 8, 0.76)');
          ctx.fillStyle = goldGrad;
        } else if (podiumTier === 'silver') {
          const silverGrad = ctx.createLinearGradient(0, rowY, 0, rowY + rowHeight);
          silverGrad.addColorStop(0, 'rgba(136, 150, 168, 0.66)');
          silverGrad.addColorStop(1, 'rgba(66, 78, 96, 0.72)');
          ctx.fillStyle = silverGrad;
        } else if (podiumTier === 'bronze') {
          const bronzeGrad = ctx.createLinearGradient(0, rowY, 0, rowY + rowHeight);
          bronzeGrad.addColorStop(0, 'rgba(148, 76, 32, 0.78)');
          bronzeGrad.addColorStop(1, 'rgba(84, 40, 14, 0.76)');
          ctx.fillStyle = bronzeGrad;
        } else if (rIdx % 2 === 0) {
          ctx.fillStyle = 'rgba(4, 24, 31, 0.62)';
        } else {
          ctx.fillStyle = 'rgba(8, 38, 48, 0.56)';
        }
        ctx.fill();

        if (podiumTier === 'gold') {
          ctx.shadowColor = 'rgba(250, 204, 21, 0.55)';
          ctx.shadowBlur = 8;
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.96)';
          ctx.lineWidth = 1.75;
        } else if (podiumTier === 'silver') {
          ctx.shadowColor = 'rgba(226, 232, 240, 0.48)';
          ctx.shadowBlur = 7;
          ctx.strokeStyle = 'rgba(226, 232, 240, 0.94)';
          ctx.lineWidth = 1.65;
        } else if (podiumTier === 'bronze') {
          ctx.shadowColor = 'rgba(217, 119, 6, 0.48)';
          ctx.shadowBlur = 7;
          ctx.strokeStyle = 'rgba(234, 148, 86, 0.94)';
          ctx.lineWidth = 1.65;
        } else {
          ctx.shadowColor = 'rgba(34, 211, 238, 0.25)';
          ctx.shadowBlur = 3;
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.52)';
          ctx.lineWidth = 1.05;
        }
        ctx.stroke();
        ctx.restore();

        // Cell Typography
        ctx.save();
        ctx.textBaseline = 'middle';
        const align = col.align ?? 'center';
        if (align === 'left') ctx.textAlign = 'left';
        else if (align === 'right') ctx.textAlign = 'right';
        else ctx.textAlign = 'center';

        const textX =
          align === 'left'
            ? cellX + 12
            : align === 'right'
              ? cellX + cw - 12
              : cellX + cw / 2;
        const textY = rowY + rowHeight / 2 + 1;

        if (cIdx === 0) {
          // POS column
          ctx.fillStyle =
            podiumTier === 'gold'
              ? '#fde047'
              : podiumTier === 'silver'
                ? '#f8fafc'
                : podiumTier === 'bronze'
                  ? '#fdba74'
                  : '#4ade80';
          drawAutoFittedCellText(ctx, valStr, textX, textY, cw - 10, 15, 10, 0.96, 700);
        } else if (col.emphasis === 'emerald') {
          ctx.fillStyle =
            podiumTier === 'gold'
              ? '#fef08a'
              : podiumTier === 'silver'
                ? '#ffffff'
                : podiumTier === 'bronze'
                  ? '#fed7aa'
                  : '#ffffff';
          drawAutoFittedCellText(ctx, valStr, textX, textY, cw - 12, 15.5, 10, 0.96, 700);
        } else if (col.emphasis === 'bold') {
          ctx.fillStyle =
            podiumTier === 'gold'
              ? '#fffbeb'
              : podiumTier === 'silver'
                ? '#f8fafc'
                : podiumTier === 'bronze'
                  ? '#fff7ed'
                  : '#ffffff';
          drawAutoFittedCellText(ctx, valStr, textX, textY, cw - 12, 14.5, 9.5, 0.94, 700);
        } else {
          ctx.fillStyle =
            podiumTier === 'gold'
              ? '#fef9c3'
              : podiumTier === 'silver'
                ? '#f1f5f9'
                : podiumTier === 'bronze'
                  ? '#ffedd5'
                  : '#f1f5f9';
          drawAutoFittedCellText(ctx, valStr, textX, textY, cw - 12, 14, 9.5, 0.94, 700);
        }
        ctx.restore();

        cellX += cw + colGap;
      });

      rowY += rowStep;
    });

    // 8. White President Signature + "Presidente AOPE" + Official Footer Centered at Bottom
    const footerY = height - outerMargin - 16;
    const sigTextY = footerY - 22;

    if (whiteSignatureCanvas) {
      const sigMaxW = 195;
      const sigMaxH = 72;
      const sigScale = Math.min(
        sigMaxW / whiteSignatureCanvas.width,
        sigMaxH / whiteSignatureCanvas.height
      );
      const drawW = whiteSignatureCanvas.width * sigScale;
      const drawH = whiteSignatureCanvas.height * sigScale;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 6;
      ctx.drawImage(
        whiteSignatureCanvas,
        width / 2 - drawW / 2,
        sigTextY - 12 - drawH,
        drawW,
        drawH
      );
      ctx.restore();
    }

    ctx.save();
    ctx.font = '700 15px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText('Presidente AOPE', width / 2, sigTextY);
    ctx.restore();

    ctx.save();
    ctx.font = '400 11.5px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillStyle = 'rgba(241, 245, 249, 0.88)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `Emitido em ${issuedAtText} · Canto & Fibra · Documento Oficial`,
      width / 2,
      footerY
    );
    ctx.restore();

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível gerar a imagem PNG.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        filename.endsWith('.png') ? filename : `${filename}.png`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}
