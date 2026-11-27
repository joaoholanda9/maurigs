import trincaTableBackdropUrl from '../assets/images/trinca_table_backdrop_1795726767422.jpg';
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

const TRINCA_REF_URL = '/assets/aistudio/Trinca.AOPE_ec3d4f6a.jpeg';

export interface TrincaPosterParams {
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

function extractTrincaCrestCanvas(
  refImg: HTMLImageElement | null
): HTMLCanvasElement | null {
  if (!refImg || refImg.naturalWidth < 1000 || refImg.naturalHeight < 1000) {
    return null;
  }

  try {
    const sx = 32;
    const sy = 0;
    const sw = 202;
    const sh = 165;

    const offscreen = document.createElement('canvas');
    offscreen.width = sw;
    offscreen.height = sh;
    const octx = offscreen.getContext('2d');
    if (!octx) return null;

    octx.drawImage(refImg, sx, sy, sw, sh, 0, 0, sw, sh);
    const imgData = octx.getImageData(0, 0, sw, sh);
    const data = imgData.data;

    // Border flood-fill to strip only the exterior light silver-grey header pixels
    const visited = new Uint8Array(sw * sh);
    const queue = new Int32Array(sw * sh);
    let head = 0;
    let tail = 0;

    const isNeutralHeaderBg = (idx: number) => {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      return minC >= 145 && maxC - minC <= 22;
    };

    const tryEnqueue = (x: number, y: number) => {
      const p = y * sw + x;
      if (visited[p]) return;
      if (isNeutralHeaderBg(p * 4)) {
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

    // Soften 1px anti-aliased fringe around the gold/laurel outer rim
    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const p = y * sw + x;
        if (visited[p]) continue;
        const hasTransparentNeighbor =
          visited[p - 1] || visited[p + 1] || visited[p - sw] || visited[p + sw];
        if (hasTransparentNeighbor) {
          const idx = p * 4;
          const maxC = Math.max(data[idx], data[idx + 1], data[idx + 2]);
          const minC = Math.min(data[idx], data[idx + 1], data[idx + 2]);
          if (minC > 140 && maxC - minC < 40) {
            data[idx + 3] = 110;
          }
        }
      }
    }

    octx.putImageData(imgData, 0, 0);

    // Trim transparent outer margins so the shield scales cleanly to full header height
    let minX = sw;
    let minY = sh;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (data[(y * sw + x) * 4 + 3] > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX > minX && maxY > minY) {
      const tw = maxX - minX + 1;
      const th = maxY - minY + 1;
      const trimmed = document.createElement('canvas');
      trimmed.width = tw;
      trimmed.height = th;
      const tctx = trimmed.getContext('2d');
      if (tctx) {
        tctx.drawImage(offscreen, minX, minY, tw, th, 0, 0, tw, th);
        return trimmed;
      }
    }

    return offscreen;
  } catch {
    return null;
  }
}

function drawFallbackTrincaShield(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  const cx = x + w / 2;
  const cy = y + h * 0.46;
  const r = Math.min(w, h) * 0.36;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0f3d26';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ca8a04';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 18px Tahoma, Verdana, Geneva, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AOPE', cx, cy);
  ctx.restore();
}

export async function renderTrincaPosterPng({
  filename,
  championshipName,
  seasonYear,
  reportTitle,
  stageHighlight,
  resolvedLocation,
  issuedAtText,
  isDefaultAope,
  loadedCustomLogo,
  whiteSignatureCanvas,
  columns,
  rows,
}: TrincaPosterParams): Promise<void> {
  const [backdropImg, refImg] = await Promise.all([
    loadImageElement(trincaTableBackdropUrl),
    loadImageElement(TRINCA_REF_URL),
  ]);
  const crestCanvas = extractTrincaCrestCanvas(refImg);

  await new Promise<void>((resolve, reject) => {
    const contentWidth = columns.reduce((acc, c) => acc + c.width, 0);
    // Instagram Portrait Feed 4:5 base dimensions (1080 x 1350 at 2x resolution = 2160 x 2700)
    const width = 1080;
    const targetHeight = 1350;

    const headerHeight = resolvedLocation ? 206 : 190;
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

    // 1. Top 90-degree Linear Gradient Header Band (#A6A6A6 -> #FFFFFF)
    const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
    headerGrad.addColorStop(0, '#A6A6A6');
    headerGrad.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, width, headerHeight);

    const logoX = 6;
    const logoY = 0;
    const logoBoxH = headerHeight;
    let logoRightEdge = logoX + 220;

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
      const maxCustomW = 420;
      const scaleImg = Math.min(maxCustomW / srcW, logoBoxH / srcH);
      const drawW = srcW * scaleImg;
      const drawH = srcH * scaleImg;
      ctx.drawImage(
        logoSource,
        logoX,
        logoY + (logoBoxH - drawH) / 2,
        drawW,
        drawH
      );
      logoRightEdge = logoX + drawW;
    } else if (crestCanvas) {
      const maxCrestW = 280;
      const scaleCrest = Math.min(
        maxCrestW / crestCanvas.width,
        logoBoxH / crestCanvas.height
      );
      const drawW = crestCanvas.width * scaleCrest;
      const drawH = crestCanvas.height * scaleCrest;
      ctx.drawImage(
        crestCanvas,
        logoX,
        logoY + (logoBoxH - drawH) / 2,
        drawW,
        drawH
      );
      logoRightEdge = logoX + drawW;
    } else {
      const fallbackW = 220;
      drawFallbackTrincaShield(ctx, logoX, logoY, fallbackW, logoBoxH);
      logoRightEdge = logoX + fallbackW;
    }

    const titleX = Math.round(logoRightEdge + 16);
    const titleMaxW = width - titleX - 18;

    const yearSuffix = championshipName.includes(String(seasonYear))
      ? ''
      : ` - ${seasonYear}`;
    const rawLine1 = `${championshipName.toUpperCase()}${yearSuffix}`;
    const line1Text = /\bAOPE\b/i.test(rawLine1) ? rawLine1 : `${rawLine1} AOPE`;
    const line1Segments = splitHighlightedTokens(
      line1Text,
      /\bAOPE\b/gi,
      '#160b96',
      '#000000'
    );

    const line2Text = 'MODALIDADE FIBRA DE TRINCA FERRO';
    const line2Segments: HighlightSegment[] = [
      { text: line2Text, color: '#000000' },
    ];

    const line3Text = (stageHighlight || reportTitle).toUpperCase();
    const hasStageToken = /\d+ª\s+ETAPA/i.test(line3Text);
    const line3Segments = hasStageToken
      ? splitHighlightedTokens(line3Text, /\d+ª\s+ETAPA/gi, '#160b96', '#000000')
      : [{ text: line3Text, color: '#160b96' }];

    const line1StartPx = Math.round(width * 0.036);
    const line2StartPx = Math.round(width * 0.033);
    const line3StartPx = Math.round(width * 0.033);
    // Vertically center the entire text block inside headerHeight
    const startY = resolvedLocation
      ? Math.round(headerHeight / 2 - 42)
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
      20,
      700,
      0.79
    );
    drawHighlightedAutoSizedLine(
      ctx,
      line2Segments,
      titleX,
      startY + 35,
      titleMaxW,
      line2StartPx,
      19,
      700,
      0.81
    );
    drawHighlightedAutoSizedLine(
      ctx,
      line3Segments,
      titleX,
      startY + 69,
      titleMaxW,
      line3StartPx,
      18,
      700,
      0.82
    );

    if (resolvedLocation) {
      drawTwoLineHeaderText(
        ctx,
        `LOCAL: ${resolvedLocation.toUpperCase()}`,
        titleX,
        startY + 93,
        16,
        titleMaxW,
        12.5,
        9.5,
        0.88,
        600,
        '#0f172a'
      );
    }
    ctx.restore();

    // 2. Solid Royal Indigo/Blue Table Header Strip (#160b96)
    const headerBarY = headerHeight;
    const scaleCols = width / contentWidth;
    const colWidths = columns.map((c) => c.width * scaleCols);

    ctx.fillStyle = '#160b96';
    ctx.fillRect(0, headerBarY, width, tableHeaderHeight);

    let curX = 0;
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const cw = colWidths[c];

      if (c > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(curX, headerBarY);
        ctx.lineTo(curX, headerBarY + tableHeaderHeight);
        ctx.stroke();
      }

      ctx.save();
      ctx.fillStyle = '#ffffff';
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

    // 3. Table Body Area: 58% Opacity Photorealistic Trinca-Ferro Backdrop + White Grid Lines
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
      const bgX = (width - bgW) * 0.48;
      const bgY = tableBodyY + (minBodyHeight - bgH) * 0.25;
      ctx.globalAlpha = 0.58;
      ctx.drawImage(backdropImg, bgX, bgY, bgW, bgH);
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

    ctx.beginPath();
    ctx.moveTo(0, tableBodyY);
    ctx.lineTo(width, tableBodyY);
    ctx.stroke();

    for (let r = 1; r <= rows.length; r++) {
      const ly = tableBodyY + r * rowHeight;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(width, ly);
      ctx.stroke();
    }

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
