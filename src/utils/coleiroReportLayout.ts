import coleiroTableBackdropUrl from '../assets/images/coleiro_table_backdrop_1795725671241.jpg';
import type { PngColumn } from './reportExport';
import {
  drawAutoFittedCellText,
  drawHighlightedAutoSizedLine,
  drawTwoLineHeaderText,
  type HighlightSegment,
  loadImageElement,
  splitHighlightedTokens,
  trimTransparentImageCanvas,
} from './reportCanvasHelpers';

const COLEIRO_HEADER_REF_URL = '/assets/aistudio/23.Etapa.08.11.26..._93aa1413.png';

function extractCornerColeiroCanvas(
  refImg: HTMLImageElement | null
): HTMLCanvasElement | null {
  if (!refImg || refImg.naturalWidth < 1414 || refImg.naturalHeight < 240) {
    return null;
  }

  try {
    const sx = 1294;
    const sy = 88;
    const sw = 120;
    const sh = 145;
    const offscreen = document.createElement('canvas');
    offscreen.width = sw;
    offscreen.height = sh;
    const octx = offscreen.getContext('2d');
    if (!octx) return null;

    octx.drawImage(refImg, sx, sy, sw, sh, 0, 0, sw, sh);
    const imgData = octx.getImageData(0, 0, sw, sh);
    const data = imgData.data;

    // Fade pure black header background pixels into transparency so it blends seamlessly
    for (let i = 0; i < data.length; i += 4) {
      const maxC = Math.max(data[i], data[i + 1], data[i + 2]);
      if (maxC <= 10) {
        data[i + 3] = 0;
      } else if (maxC < 26) {
        data[i + 3] = Math.round(((maxC - 10) / 16) * 255);
      }
    }

    octx.putImageData(imgData, 0, 0);
    return offscreen;
  } catch {
    return null;
  }
}

function extractReferenceAopeLogoCanvas(
  refImg: HTMLImageElement | null
): HTMLCanvasElement | null {
  if (!refImg || refImg.naturalWidth < 1414 || refImg.naturalHeight < 240) {
    return null;
  }

  try {
    const sx = 1;
    const sy = 30;
    const sw = 463;
    const sh = 167;
    const offscreen = document.createElement('canvas');
    offscreen.width = sw;
    offscreen.height = sh;
    const octx = offscreen.getContext('2d');
    if (!octx) return null;

    octx.drawImage(refImg, sx, sy, sw, sh, 0, 0, sw, sh);
    const imgData = octx.getImageData(0, 0, sw, sh);
    const data = imgData.data;

    // Flood-fill pure black exterior pixels to transparent while preserving dark letter fills
    const visited = new Uint8Array(sw * sh);
    const queue = new Int32Array(sw * sh);
    let head = 0;
    let tail = 0;

    const isBlackBg = (idx: number) =>
      data[idx] <= 12 && data[idx + 1] <= 12 && data[idx + 2] <= 12;

    const tryEnqueue = (x: number, y: number) => {
      const p = y * sw + x;
      if (visited[p]) return;
      if (isBlackBg(p * 4)) {
        visited[p] = 1;
        queue[tail++] = p;
      }
    };

    for (let x = 0; x < sw; x++) {
      tryEnqueue(x, 0);
      tryEnqueue(x, sh - 1);
    }
    for (let y = 0; y < sh; y++) {
      tryEnqueue(0, y);
      tryEnqueue(sw - 1, y);
    }

    while (head < tail) {
      const p = queue[head++];
      data[p * 4 + 3] = 0;
      const x = p % sw;
      const y = (p - x) / sw;
      if (x > 0) tryEnqueue(x - 1, y);
      if (x + 1 < sw) tryEnqueue(x + 1, y);
      if (y > 0) tryEnqueue(x, y - 1);
      if (y + 1 < sh) tryEnqueue(x, y + 1);
    }

    octx.putImageData(imgData, 0, 0);
    return offscreen;
  } catch {
    return null;
  }
}

export interface ColeiroPosterParams {
  filename: string;
  championshipName: string;
  seasonYear: number;
  modality?: string;
  reportTitle: string;
  stageHighlight?: string;
  resolvedLocation: string;
  issuedAtText: string;
  isDefaultAope: boolean;
  loadedCustomLogo: HTMLImageElement | null;
  whiteSignatureCanvas: HTMLCanvasElement | null;
  columns: PngColumn[];
  rows: (string | number)[][];
}

function drawPosterAopeCrest(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.translate(x, y);

  const fontSize = Math.round(h * 1.03);
  const baseY = h * 0.88;
  ctx.font = `900 ${fontSize}px Tahoma, Verdana, Geneva, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const drawLetter = (char: string, lx: number) => {
    ctx.save();
    ctx.translate(lx, baseY);
    ctx.scale(1.02, 1);

    ctx.lineWidth = 5.5;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(char, 0, 0);

    const grad = ctx.createLinearGradient(0, -fontSize * 0.78, 0, 6);
    grad.addColorStop(0, '#2a3038');
    grad.addColorStop(0.5, '#12161b');
    grad.addColorStop(1, '#20262e');
    ctx.fillStyle = grad;
    ctx.fillText(char, 0, 0);
    ctx.restore();
  };

  drawLetter('A', w * 0.13);
  drawLetter('P', w * 0.67);
  drawLetter('E', w * 0.89);

  const cx = w * 0.40;
  const cy = h * 0.50;
  const rOuter = h * 0.475;
  const rInner = rOuter * 0.72;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.lineWidth = 4.8;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#15191f';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fillStyle = '#090c10';
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.stroke();

  ctx.translate(cx, cy);
  const bs = rInner / 32;
  ctx.scale(bs, bs);

  ctx.beginPath();
  ctx.moveTo(-22, 16);
  ctx.quadraticCurveTo(0, 11, 22, 15);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#94a3b8';
  ctx.stroke();

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

  ctx.fillStyle = '#05151b';
  ctx.beginPath();
  ctx.arc(9, -11, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawCornerColeiroHead(
  ctx: CanvasRenderingContext2D,
  rightEdgeX: number,
  bottomY: number
) {
  ctx.save();
  ctx.translate(rightEdgeX, bottomY);

  // Subtle neck & back silhouette emerging from bottom-right corner of header
  const neckGrad = ctx.createLinearGradient(-72, -105, 0, 0);
  neckGrad.addColorStop(0, '#2a2c2b');
  neckGrad.addColorStop(0.6, '#4b4e48');
  neckGrad.addColorStop(1, '#6c6f65');
  ctx.fillStyle = neckGrad;
  ctx.beginPath();
  ctx.moveTo(-78, 0);
  ctx.bezierCurveTo(-72, -32, -62, -66, -42, -88);
  ctx.bezierCurveTo(-22, -106, -4, -104, 0, -90);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();

  // White Coleiro throat/cheek crescent
  const throatGrad = ctx.createLinearGradient(-64, -52, -24, 0);
  throatGrad.addColorStop(0, '#e2e8f0');
  throatGrad.addColorStop(0.55, '#cbd5e1');
  throatGrad.addColorStop(1, '#64748b');
  ctx.fillStyle = throatGrad;
  ctx.beginPath();
  ctx.moveTo(-66, -42);
  ctx.bezierCurveTo(-48, -42, -34, -26, -30, 0);
  ctx.lineTo(-70, 0);
  ctx.bezierCurveTo(-72, -18, -70, -32, -66, -42);
  ctx.closePath();
  ctx.fill();

  // Black crown, mask, and collar band
  const capGrad = ctx.createLinearGradient(-70, -102, -18, -40);
  capGrad.addColorStop(0, '#1f2428');
  capGrad.addColorStop(0.5, '#090b0d');
  capGrad.addColorStop(1, '#1c2023');
  ctx.fillStyle = capGrad;
  ctx.beginPath();
  ctx.moveTo(-68, -58);
  ctx.bezierCurveTo(-66, -84, -46, -102, -22, -98);
  ctx.bezierCurveTo(-8, -94, -4, -76, -10, -54);
  ctx.bezierCurveTo(-20, -40, -48, -40, -68, -58);
  ctx.closePath();
  ctx.fill();

  // Stout silvery-grey conical beak pointing left
  const beakGrad = ctx.createLinearGradient(-98, -68, -62, -52);
  beakGrad.addColorStop(0, '#cbd5e1');
  beakGrad.addColorStop(0.5, '#94a3b8');
  beakGrad.addColorStop(1, '#475569');
  ctx.fillStyle = beakGrad;
  ctx.beginPath();
  ctx.moveTo(-66, -69);
  ctx.quadraticCurveTo(-84, -67, -98, -57);
  ctx.quadraticCurveTo(-80, -48, -64, -50);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-65, -59);
  ctx.quadraticCurveTo(-82, -58, -96, -57);
  ctx.stroke();

  // Glossy dark eye + bright catchlight
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.arc(-48, -69, 6.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-50, -71, 2.0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawNaturalColeiroBackdrop(
  ctx: CanvasRenderingContext2D,
  areaX: number,
  areaY: number,
  areaW: number,
  areaH: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(areaX, areaY, areaW, areaH);
  ctx.clip();

  // 1. Warm dark forest-olive background gradient + sunlit bokeh orbs
  const bgGrad = ctx.createLinearGradient(areaX, areaY, areaX + areaW, areaY + areaH);
  bgGrad.addColorStop(0, '#0a0f07');
  bgGrad.addColorStop(0.42, '#1a2310');
  bgGrad.addColorStop(0.75, '#131a0b');
  bgGrad.addColorStop(1, '#060804');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(areaX, areaY, areaW, areaH);

  const bokehOrbs: [number, number, number, string][] = [
    [0.24, 0.30, 210, 'rgba(132, 169, 68, 0.14)'],
    [0.72, 0.24, 240, 'rgba(190, 212, 92, 0.12)'],
    [0.54, 0.55, 290, 'rgba(149, 255, 0, 0.08)'],
    [0.82, 0.72, 220, 'rgba(217, 179, 86, 0.12)'],
    [0.22, 0.78, 190, 'rgba(94, 128, 52, 0.12)'],
  ];
  for (const [rx, ry, rad, color] of bokehOrbs) {
    const cx = areaX + areaW * rx;
    const cy = areaY + areaH * ry;
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, rad);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Natural Perched Coleiro / Papa-Capim on Diagonal Mossy Branch
  const scale = Math.min(areaW / 860, areaH / 640) * 1.05;
  const cx = areaX + areaW * 0.55;
  const cy = areaY + areaH * 0.50;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Diagonal textured branch (bottom-left to mid-right)
  ctx.save();
  const branchGrad = ctx.createLinearGradient(-320, 240, 320, 12);
  branchGrad.addColorStop(0, '#3a2c1c');
  branchGrad.addColorStop(0.5, '#6b5335');
  branchGrad.addColorStop(1, '#443420');
  ctx.strokeStyle = branchGrad;
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-360, 255);
  ctx.quadraticCurveTo(10, 130, 350, 14);
  ctx.stroke();

  // Mossy olive highlight on top edge of branch
  ctx.strokeStyle = 'rgba(132, 169, 68, 0.42)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-320, 232);
  ctx.quadraticCurveTo(10, 118, 330, 4);
  ctx.stroke();

  // Small right-side twig
  ctx.strokeStyle = '#57432a';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(140, 74);
  ctx.lineTo(235, 115);
  ctx.stroke();
  ctx.restore();

  // Gripping legs & claws
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, 82);
  ctx.lineTo(-26, 136);
  ctx.lineTo(-38, 145);
  ctx.moveTo(-26, 136);
  ctx.lineTo(-14, 148);
  ctx.moveTo(34, 72);
  ctx.lineTo(24, 120);
  ctx.lineTo(12, 130);
  ctx.moveTo(24, 120);
  ctx.lineTo(36, 132);
  ctx.stroke();

  // Long dark slate-brown tail extending bottom-left
  const tailGrad = ctx.createLinearGradient(-60, 40, -255, 248);
  tailGrad.addColorStop(0, '#3f3e38');
  tailGrad.addColorStop(1, '#1d1e1b');
  ctx.fillStyle = tailGrad;
  ctx.beginPath();
  ctx.moveTo(-58, 42);
  ctx.lineTo(-244, 238);
  ctx.lineTo(-262, 222);
  ctx.lineTo(-212, 164);
  ctx.lineTo(-266, 206);
  ctx.lineTo(-104, 18);
  ctx.closePath();
  ctx.fill();

  // White belly & chest body silhouette (facing right)
  const bellyGrad = ctx.createRadialGradient(48, 8, 18, 22, 24, 155);
  bellyGrad.addColorStop(0, '#f8fafc');
  bellyGrad.addColorStop(0.55, '#d5d8d0');
  bellyGrad.addColorStop(1, '#585b52');
  ctx.fillStyle = bellyGrad;
  ctx.beginPath();
  ctx.moveTo(42, -196);
  ctx.bezierCurveTo(88, -206, 132, -184, 146, -150);
  ctx.bezierCurveTo(156, -78, 152, 8, 102, 66);
  ctx.bezierCurveTo(52, 106, -24, 96, -74, 62);
  ctx.bezierCurveTo(-118, 20, -118, -76, -64, -148);
  ctx.bezierCurveTo(-30, -184, 6, -192, 42, -196);
  ctx.closePath();
  ctx.fill();

  // Jet-black Coleiro hood (crown, mask, throat bib band)
  const hoodGrad = ctx.createLinearGradient(10, -200, 140, -70);
  hoodGrad.addColorStop(0, '#27292c');
  hoodGrad.addColorStop(0.45, '#090b0d');
  hoodGrad.addColorStop(1, '#1c1f22');
  ctx.fillStyle = hoodGrad;
  ctx.beginPath();
  ctx.moveTo(42, -196);
  ctx.bezierCurveTo(88, -206, 132, -184, 146, -150);
  ctx.bezierCurveTo(150, -130, 148, -110, 138, -94);
  ctx.bezierCurveTo(106, -86, 60, -96, 18, -116);
  ctx.bezierCurveTo(-16, -134, -36, -156, -40, -172);
  ctx.bezierCurveTo(-16, -188, 14, -194, 42, -196);
  ctx.closePath();
  ctx.fill();

  // Crisp white Coleiro throat collar crescent
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(44, -124);
  ctx.bezierCurveTo(84, -104, 118, -96, 140, -100);
  ctx.bezierCurveTo(142, -82, 136, -66, 124, -56);
  ctx.bezierCurveTo(88, -58, 52, -74, 24, -98);
  ctx.closePath();
  ctx.fill();

  // Characteristic black breast collar band below white throat
  ctx.fillStyle = '#0f1215';
  ctx.beginPath();
  ctx.moveTo(22, -98);
  ctx.bezierCurveTo(54, -74, 90, -58, 126, -56);
  ctx.bezierCurveTo(122, -40, 114, -30, 102, -24);
  ctx.bezierCurveTo(64, -32, 30, -52, 8, -76);
  ctx.closePath();
  ctx.fill();

  // Olive-grey folded back & wing coverts with feather strokes
  const wingGrad = ctx.createLinearGradient(-105, -135, 65, 58);
  wingGrad.addColorStop(0, '#5a5b4f');
  wingGrad.addColorStop(0.5, '#3b3d35');
  wingGrad.addColorStop(1, '#20221d');
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.moveTo(-40, -172);
  ctx.bezierCurveTo(8, -144, 44, -94, 52, -32);
  ctx.bezierCurveTo(56, 14, 34, 48, 2, 58);
  ctx.lineTo(-98, 60);
  ctx.bezierCurveTo(-124, -6, -108, -108, -40, -172);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(203, 213, 225, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-64, -84);
  ctx.quadraticCurveTo(6, -64, 22, 26);
  ctx.moveTo(-78, -44);
  ctx.quadraticCurveTo(-12, -26, -6, 44);
  ctx.moveTo(-88, -8);
  ctx.quadraticCurveTo(-30, 10, -40, 52);
  ctx.stroke();

  // Stout silvery-grey conical Coleiro beak
  const beakGrad = ctx.createLinearGradient(136, -158, 198, -134);
  beakGrad.addColorStop(0, '#cbd5e1');
  beakGrad.addColorStop(0.55, '#94a3b8');
  beakGrad.addColorStop(1, '#475569');
  ctx.fillStyle = beakGrad;
  ctx.beginPath();
  ctx.moveTo(138, -158);
  ctx.quadraticCurveTo(174, -156, 198, -140);
  ctx.quadraticCurveTo(172, -122, 138, -120);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(138, -138);
  ctx.quadraticCurveTo(168, -139, 196, -140);
  ctx.stroke();

  // Glossy eye with crisp catchlight
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.arc(98, -148, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.52)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(95, -151, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export async function renderColeiroPosterPng({
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
}: ColeiroPosterParams): Promise<void> {
  const [backdropImg, headerRefImg] = await Promise.all([
    loadImageElement(coleiroTableBackdropUrl),
    loadImageElement(COLEIRO_HEADER_REF_URL),
  ]);
  const cornerBirdCanvas = extractCornerColeiroCanvas(headerRefImg);
  const refAopeLogoCanvas = extractReferenceAopeLogoCanvas(headerRefImg);

  await new Promise<void>((resolve, reject) => {
    const contentWidth = columns.reduce((acc, c) => acc + c.width, 0);
    // Instagram Portrait Feed 4:5 base dimensions (1080 x 1350 at 2x resolution = 2160 x 2700)
    const width = 1080;
    const targetHeight = 1350;

    const headerHeight = resolvedLocation ? 178 : 164;
    const tableHeaderHeight = 36;
    const footerHeight = 96;
    const availBodyH = targetHeight - headerHeight - tableHeaderHeight - footerHeight;
    const rowHeight = Math.min(
      38,
      Math.max(24, availBodyH / Math.max(rows.length, 1))
    );
    const minBodyHeight = Math.max(availBodyH, Math.ceil(rows.length * rowHeight));
    const height = headerHeight + tableHeaderHeight + minBodyHeight + footerHeight;

    const scale = 2;
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

    // 1. Top Black Header Band (#000000)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, headerHeight);

    const logoX = 6;
    const logoY = 4;
    const logoBoxW = 432;
    const logoBoxH = headerHeight - 8;

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
      ctx.drawImage(
        logoSource,
        logoX + (logoBoxW - drawW) / 2,
        logoY + (logoBoxH - drawH) / 2,
        drawW,
        drawH
      );
    } else if (refAopeLogoCanvas) {
      const scaleLogo = Math.min(
        logoBoxW / refAopeLogoCanvas.width,
        logoBoxH / refAopeLogoCanvas.height
      );
      const drawW = refAopeLogoCanvas.width * scaleLogo;
      const drawH = refAopeLogoCanvas.height * scaleLogo;
      ctx.drawImage(
        refAopeLogoCanvas,
        logoX + (logoBoxW - drawW) / 2,
        logoY + (logoBoxH - drawH) / 2,
        drawW,
        drawH
      );
    } else {
      drawPosterAopeCrest(ctx, logoX, logoY, logoBoxW, logoBoxH);
    }

    // Reserve right corner for the peeking Coleiro head
    const cornerDrawH = cornerBirdCanvas
      ? Math.round(headerHeight * 0.72)
      : 96;
    const cornerDrawW = cornerBirdCanvas
      ? Math.round(cornerDrawH * (cornerBirdCanvas.width / cornerBirdCanvas.height))
      : 90;
    const titleX = logoX + logoBoxW + 14;
    const titleMaxW = width - titleX - Math.max(106, cornerDrawW + 10);

    const yearSuffix = championshipName.includes(String(seasonYear))
      ? ''
      : ` ${seasonYear}`;
    const rawLine1 = `${championshipName.toUpperCase()}${yearSuffix}`;
    const line1Text = /\bAOPE\b/i.test(rawLine1) ? rawLine1 : `${rawLine1} AOPE`;
    const line1Segments = splitHighlightedTokens(
      line1Text,
      /\bAOPE\b/gi,
      '#95FF00',
      '#ffffff'
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

    const line1StartPx = Math.round(width * 0.032);
    const line2StartPx = Math.round(width * 0.029);
    const line3StartPx = Math.round(width * 0.028);
    // Vertically center the entire text block inside headerHeight
    const startY = resolvedLocation
      ? Math.round(headerHeight / 2 - 38.5)
      : Math.round(headerHeight / 2 - 21);

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    drawHighlightedAutoSizedLine(
      ctx,
      line1Segments,
      titleX,
      startY,
      titleMaxW,
      line1StartPx,
      19,
      700,
      0.78
    );
    drawHighlightedAutoSizedLine(
      ctx,
      line2Segments,
      titleX,
      startY + 32,
      titleMaxW,
      line2StartPx,
      17,
      700,
      0.80
    );
    drawHighlightedAutoSizedLine(
      ctx,
      line3Segments,
      titleX,
      startY + 63,
      titleMaxW,
      line3StartPx,
      16,
      700,
      0.82
    );

    if (resolvedLocation) {
      drawTwoLineHeaderText(
        ctx,
        `LOCAL: ${resolvedLocation.toUpperCase()}`,
        titleX,
        startY + 83,
        14,
        titleMaxW,
        10.5,
        8,
        0.88,
        600
      );
    }
    ctx.restore();

    // Exact Coleiro head peeking up at bottom-right of black header
    if (cornerBirdCanvas) {
      ctx.drawImage(
        cornerBirdCanvas,
        width - cornerDrawW,
        headerHeight - cornerDrawH,
        cornerDrawW,
        cornerDrawH
      );
    } else {
      drawCornerColeiroHead(ctx, width, headerHeight);
    }

    // 2. Solid Bright Neon Lime Table Header Strip (#95FF00)
    const headerBarY = headerHeight;
    const scaleCols = width / contentWidth;
    const colWidths = columns.map((c) => c.width * scaleCols);

    ctx.fillStyle = '#95FF00';
    ctx.fillRect(0, headerBarY, width, tableHeaderHeight);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, headerBarY + 0.8);
    ctx.lineTo(width, headerBarY + 0.8);
    ctx.stroke();

    let curX = 0;
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const cw = colWidths[c];

      if (c > 0) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(curX, headerBarY);
        ctx.lineTo(curX, headerBarY + tableHeaderHeight);
        ctx.stroke();
      }

      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawAutoFittedCellText(
        ctx,
        col.label.toUpperCase(),
        curX + cw / 2,
        headerBarY + tableHeaderHeight / 2 + 1,
        cw - 10,
        14.5,
        10,
        0.92,
        800
      );
      ctx.restore();

      curX += cw;
    }

    // 3. Table Body Area: 58% Opacity Photorealistic Coleiro Backdrop + White Grid Lines
    const tableBodyY = headerBarY + tableHeaderHeight;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, tableBodyY, width, minBodyHeight);

    if (
      backdropImg &&
      backdropImg.naturalWidth > 0 &&
      backdropImg.naturalHeight > 0
    ) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, tableBodyY, width, minBodyHeight);
      ctx.clip();

      const coverScale = Math.max(
        width / backdropImg.naturalWidth,
        minBodyHeight / backdropImg.naturalHeight
      );
      const bgW = backdropImg.naturalWidth * coverScale;
      const bgH = backdropImg.naturalHeight * coverScale;
      const bgX = (width - bgW) * 0.45;
      const bgY = tableBodyY + (minBodyHeight - bgH) * 0.34;
      ctx.globalAlpha = 0.58;
      ctx.drawImage(backdropImg, bgX, bgY, bgW, bgH);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.58;
      drawNaturalColeiroBackdrop(ctx, 0, tableBodyY, width, minBodyHeight);
      ctx.restore();
    }

    const rowFontBase = Math.min(14.5, Math.max(10.5, rowHeight * 0.42));
    let rowY = tableBodyY;
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

      if (podiumTier === 'gold') {
        ctx.fillStyle = 'rgba(180, 128, 12, 0.28)';
      } else if (podiumTier === 'silver') {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
      } else if (podiumTier === 'bronze') {
        ctx.fillStyle = 'rgba(154, 72, 24, 0.28)';
      } else if (rIdx % 2 === 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      }
      ctx.fillRect(0, rowY, width, rowHeight);

      let cellX = 0;
      columns.forEach((col, cIdx) => {
        const cw = colWidths[cIdx];
        const valStr = String(row[cIdx] ?? '');

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
        ctx.shadowBlur = 4;

        const textX = cellX + cw / 2;
        const textY = rowY + rowHeight / 2 + 0.5;

        if (cIdx === 0) {
          ctx.fillStyle =
            podiumTier === 'gold'
              ? '#fde047'
              : podiumTier === 'silver'
                ? '#f8fafc'
                : podiumTier === 'bronze'
                  ? '#fdba74'
                  : '#ffffff';
          drawAutoFittedCellText(
            ctx,
            valStr,
            textX,
            textY,
            cw - 8,
            rowFontBase,
            9.5,
            0.94,
            700
          );
        } else if (col.emphasis === 'emerald') {
          ctx.fillStyle =
            podiumTier === 'gold'
              ? '#fef08a'
              : podiumTier === 'silver'
                ? '#ffffff'
                : podiumTier === 'bronze'
                  ? '#fed7aa'
                  : '#ffffff';
          drawAutoFittedCellText(
            ctx,
            valStr,
            textX,
            textY,
            cw - 10,
            rowFontBase + 0.5,
            9.5,
            0.94,
            700
          );
        } else {
          ctx.fillStyle =
            podiumTier === 'gold'
              ? '#fffbeb'
              : podiumTier === 'silver'
                ? '#f8fafc'
                : podiumTier === 'bronze'
                  ? '#fff7ed'
                  : '#ffffff';
          drawAutoFittedCellText(
            ctx,
            valStr,
            textX,
            textY,
            cw - 10,
            rowFontBase - 0.5,
            9,
            0.90,
            700
          );
        }
        ctx.restore();

        cellX += cw;
      });

      rowY += rowHeight;
    });

    // Crisp White Horizontal & Vertical Grid Lines + Outer Borders
    const gridBottomY = tableBodyY + minBodyHeight;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 1.25;

    // Top white hairline separating #95FF00 header bar from rows
    ctx.beginPath();
    ctx.moveTo(0, tableBodyY);
    ctx.lineTo(width, tableBodyY);
    ctx.stroke();

    // Horizontal row lines
    for (let r = 1; r <= rows.length; r++) {
      const ly = tableBodyY + r * rowHeight;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(width, ly);
      ctx.stroke();
    }

    // Left & right outer white lines + vertical column dividers
    ctx.beginPath();
    ctx.moveTo(0.75, tableBodyY);
    ctx.lineTo(0.75, gridBottomY);
    ctx.moveTo(width - 0.75, tableBodyY);
    ctx.lineTo(width - 0.75, gridBottomY);
    ctx.stroke();

    let vx = 0;
    for (let c = 0; c < colWidths.length - 1; c++) {
      vx += colWidths[c];
      ctx.beginPath();
      ctx.moveTo(vx, tableBodyY);
      ctx.lineTo(vx, gridBottomY);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Bottom Black Footer Band + White President Signature + Official Footer
    const footerStartY = gridBottomY;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, footerStartY, width, footerHeight);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, footerStartY);
    ctx.lineTo(width, footerStartY);
    ctx.stroke();

    const footerY = height - 13;
    const sigTextY = footerY - 18;

    if (whiteSignatureCanvas) {
      const sigMaxW = 165;
      const sigMaxH = 48;
      const sigScale = Math.min(
        sigMaxW / whiteSignatureCanvas.width,
        sigMaxH / whiteSignatureCanvas.height
      );
      const drawW = whiteSignatureCanvas.width * sigScale;
      const drawH = whiteSignatureCanvas.height * sigScale;
      ctx.drawImage(
        whiteSignatureCanvas,
        width / 2 - drawW / 2,
        sigTextY - 10 - drawH,
        drawW,
        drawH
      );
    }

    ctx.save();
    ctx.font = '700 13.5px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Presidente AOPE', width / 2, sigTextY);

    ctx.font = '400 10.5px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillStyle = 'rgba(241, 245, 249, 0.88)';
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
