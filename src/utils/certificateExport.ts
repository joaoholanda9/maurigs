import { jsPDF } from 'jspdf';
import type { BirdModality } from '../types/championship';
import { buildCertificateBackdropDataUrl } from './certificateBackdrop';
import { loadTrimmedPresidentSignature } from './certificateSignature';
import { trimTransparentImageCanvas } from './reportCanvasHelpers';
import { formatScoreValue, isTimeScoredModality } from './scoring';

export const TRINCA_CERT_WATERMARK_URL = '/assets/aistudio/Trinca.Fundo_64444362.png';
export const COLEIRO_CERT_WATERMARK_URL =
  '/assets/aistudio/Coleiro.Fundo__1__549372e9.png';
export const CANARIO_CERT_WATERMARK_URL =
  '/assets/aistudio/CT.Fundo_69dfbb88.png';

export function getCertificateCustomWatermarkUrl(
  modality?: BirdModality
): string | null {
  if (modality === 'Trinca-Ferro') return TRINCA_CERT_WATERMARK_URL;
  if (modality === 'Coleiro') return COLEIRO_CERT_WATERMARK_URL;
  if (modality === 'Canário-da-Terra') return CANARIO_CERT_WATERMARK_URL;
  return null;
}

export function getCertificateCustomBackgroundColor(
  modality?: BirdModality
): string | undefined {
  if (modality === 'Canário-da-Terra') return '#ffffe2';
  if (modality === 'Trinca-Ferro') return '#f3ffe4';
  return undefined;
}

export interface CertificateData {
  championshipName: string;
  seasonYear: number;
  modality?: BirdModality;
  birdName: string;
  ownerName: string;
  isMember: boolean;
  stageNumber: number;
  stageName: string;
  stageDateText: string;
  stageAddress: string;
  stakeNumber: string;
  position: number;
  points: number;
  part1Songs: number;
  part2Songs: number;
  issuedAtText: string;
  eventLogoDataUrl?: string;
}

function slugifyFilePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function buildCertificateFilename(
  data: CertificateData,
  ext: 'png' | 'pdf'
): string {
  const stageCode = String(data.stageNumber).padStart(2, '0');
  const birdSlug = slugifyFilePart(data.birdName) || 'ave';
  return `certificado-${birdSlug}-etapa-${stageCode}-${data.seasonYear}.${ext}`;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function imageToPngDataUrl(
  img: HTMLImageElement,
  targetLongSide = 960
): string | null {
  try {
    const scale = Math.max(
      1,
      targetLongSide / Math.max(img.naturalWidth, img.naturalHeight)
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function drawCustomWatermarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  wmSource: HTMLCanvasElement | HTMLImageElement,
  width: number,
  height: number
) {
  const srcW =
    wmSource instanceof HTMLCanvasElement ? wmSource.width : wmSource.naturalWidth;
  const srcH =
    wmSource instanceof HTMLCanvasElement ? wmSource.height : wmSource.naturalHeight;
  if (!srcW || !srcH) return;

  const maxW = width * 0.64;
  const maxH = height * 0.8;
  const scale = Math.min(maxW / srcW, maxH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const drawX = (width - drawW) / 2;
  const drawY = (height - drawH) / 2;

  ctx.save();
  ctx.globalAlpha = 0.78;
  ctx.drawImage(wmSource, drawX, drawY, drawW, drawH);
  ctx.restore();
}

function buildCompositeBackdropDataUrl(
  loadedBackdrop: HTMLImageElement,
  trimmedWatermark: HTMLCanvasElement | HTMLImageElement | null,
  targetWidth = 1920,
  targetHeight = 1356
): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(loadedBackdrop, 0, 0, targetWidth, targetHeight);
    if (trimmedWatermark) {
      drawCustomWatermarkOnCanvas(ctx, trimmedWatermark, targetWidth, targetHeight);
    }
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function exportCertificateToPng(data: CertificateData): Promise<void> {
  const customWatermarkUrl = getCertificateCustomWatermarkUrl(data.modality);
  const customBackgroundColor = getCertificateCustomBackgroundColor(data.modality);
  const backdropUrl = buildCertificateBackdropDataUrl(
    1600,
    1130,
    !customWatermarkUrl,
    customBackgroundColor
  );
  const sigAsset = await loadTrimmedPresidentSignature();
  const [loadedLogo, loadedBackdrop, loadedSig, loadedCustomWatermark] =
    await Promise.all([
      data.eventLogoDataUrl
        ? loadImageElement(data.eventLogoDataUrl)
        : Promise.resolve(null),
      loadImageElement(backdropUrl),
      sigAsset?.dataUrl ? loadImageElement(sigAsset.dataUrl) : Promise.resolve(null),
      customWatermarkUrl
        ? loadImageElement(customWatermarkUrl)
        : Promise.resolve(null),
    ]);

  const trimmedCustomWatermark =
    customWatermarkUrl && loadedCustomWatermark && loadedCustomWatermark.naturalWidth > 0
      ? trimTransparentImageCanvas(loadedCustomWatermark)
      : null;

  await new Promise<void>((resolve, reject) => {
    const width = 1600;
    const height = 1130;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas não suportado neste navegador.'));
      return;
    }

    // Classic textured parchment, double thin gold border, botanical corners & watermark
    if (loadedBackdrop) {
      ctx.drawImage(loadedBackdrop, 0, 0, width, height);
    } else {
      ctx.fillStyle = customBackgroundColor ?? '#faf6ec';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(34, 34, width - 68, height - 68);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(46, 46, width - 92, height - 92);
    }

    if (trimmedCustomWatermark) {
      drawCustomWatermarkOnCanvas(ctx, trimmedCustomWatermark, width, height);
    }

    const centerX = width / 2;

    // Top-center Logo (Large & Transparent)
    const logoBoxW = 360;
    const logoBoxH = 168;
    const logoBoxX = centerX - logoBoxW / 2;
    const logoBoxY = 66;

    if (loadedLogo && loadedLogo.naturalWidth > 0 && loadedLogo.naturalHeight > 0) {
      const scale = Math.min(
        logoBoxW / loadedLogo.naturalWidth,
        logoBoxH / loadedLogo.naturalHeight
      );
      const drawW = loadedLogo.naturalWidth * scale;
      const drawH = loadedLogo.naturalHeight * scale;
      ctx.drawImage(
        loadedLogo,
        centerX - drawW / 2,
        logoBoxY + (logoBoxH - drawH) / 2,
        drawW,
        drawH
      );
    } else {
      ctx.save();
      drawRoundedRect(ctx, logoBoxX, logoBoxY, logoBoxW, logoBoxH, 14);
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = '#c59b27';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 15px Tahoma, Verdana, Geneva, sans-serif';
      ctx.fillText('LOGOMARCA DO EVENTO', centerX, logoBoxY + logoBoxH / 2 + 5);
    }

    // Championship Eyebrow
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1b4332';
    ctx.font = '700 19px Tahoma, Verdana, Geneva, sans-serif';
    const eyebrow = `${data.championshipName.toUpperCase()} · TEMPORADA ${data.seasonYear}`;
    const eyebrowLines = wrapCanvasText(ctx, eyebrow, width - 240);
    let y = 272;
    for (const line of eyebrowLines.slice(0, 2)) {
      ctx.fillText(line, centerX, y);
      y += 26;
    }

    // Main Certificate Title (Tahoma Bold in Dark Forest Green with Subtle Dimensional Finish)
    y += 24;
    ctx.save();
    ctx.shadowColor = 'rgba(184, 134, 11, 0.28)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 3;
    ctx.fillStyle = '#14452f';
    ctx.font = '700 46px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText('CERTIFICADO DE PARTICIPAÇÃO', centerX, y);
    ctx.restore();

    // Ornamental Gold Filigree Divider with Center Diamond
    y += 22;
    const divHalf = 190;
    const gradLeft = ctx.createLinearGradient(centerX - divHalf, y, centerX - 16, y);
    gradLeft.addColorStop(0, 'rgba(197, 155, 39, 0)');
    gradLeft.addColorStop(1, 'rgba(197, 155, 39, 0.95)');
    ctx.strokeStyle = gradLeft;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(centerX - divHalf, y);
    ctx.lineTo(centerX - 16, y);
    ctx.stroke();

    const gradRight = ctx.createLinearGradient(centerX + 16, y, centerX + divHalf, y);
    gradRight.addColorStop(0, 'rgba(197, 155, 39, 0.95)');
    gradRight.addColorStop(1, 'rgba(197, 155, 39, 0)');
    ctx.strokeStyle = gradRight;
    ctx.beginPath();
    ctx.moveTo(centerX + 16, y);
    ctx.lineTo(centerX + divHalf, y);
    ctx.stroke();

    ctx.fillStyle = '#c59b27';
    ctx.beginPath();
    ctx.moveTo(centerX, y - 6);
    ctx.lineTo(centerX + 6, y);
    ctx.lineTo(centerX, y + 6);
    ctx.lineTo(centerX - 6, y);
    ctx.closePath();
    ctx.fill();

    // Intro line
    y += 44;
    ctx.fillStyle = '#475569';
    ctx.font = 'italic 500 23px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText('Certificamos oficialmente que a ave competidora', centerX, y);

    // Bird Name
    y += 60;
    ctx.fillStyle = '#14452f';
    ctx.font = '700 54px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText(data.birdName, centerX, y);

    // Owner line
    y += 40;
    ctx.fillStyle = '#1e293b';
    ctx.font = '700 23px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText(`Proprietário: ${data.ownerName}`, centerX, y);

    // Participation Statement (without hyphen or trailing date)
    y += 42;
    ctx.fillStyle = '#475569';
    ctx.font = '400 21px Tahoma, Verdana, Geneva, sans-serif';
    const stageCode = String(data.stageNumber).padStart(2, '0');
    const statementLines = wrapCanvasText(
      ctx,
      `participou da Etapa ${stageCode} ${data.stageName}.`,
      width - 260
    );
    for (const line of statementLines.slice(0, 2)) {
      ctx.fillText(line, centerX, y);
      y += 28;
    }

    // Center Cream/Ivory Semitransparent Rounded Card with Soft Shadow
    y += 14;
    const boxX = 148;
    const boxW = width - 296;
    const boxH = 204;

    ctx.save();
    ctx.shadowColor = 'rgba(20, 69, 47, 0.12)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;
    drawRoundedRect(ctx, boxX, y, boxW, boxH, 20);
    ctx.fillStyle = 'rgba(253, 250, 241, 0.78)';
    ctx.fill();
    ctx.restore();

    drawRoundedRect(ctx, boxX, y, boxW, boxH, 20);
    ctx.strokeStyle = 'rgba(197, 155, 39, 0.55)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Stage metadata inside card
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 21px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText(
      `Etapa ${stageCode} (${data.stageDateText})${data.stakeNumber ? ` · Estaca ${data.stakeNumber}` : ''}`,
      centerX,
      y + 42
    );

    ctx.fillStyle = '#475569';
    ctx.font = '400 18px Tahoma, Verdana, Geneva, sans-serif';
    const addrLines = wrapCanvasText(ctx, data.stageAddress, boxW - 80);
    ctx.fillText(addrLines[0] ?? '', centerX, y + 74);

    // Subtle Gold Divider inside card
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(boxX + 44, y + 96);
    ctx.lineTo(boxX + boxW - 44, y + 96);
    ctx.stroke();

    // 4 Metrics Columns
    const isTimeModality = isTimeScoredModality(data.modality);
    const cols = [
      { label: 'COLOCAÇÃO', value: `${data.position}º Lugar`, color: '#0f172a' },
      { label: 'PONTUAÇÃO', value: `${data.points} pts`, color: '#15803d' },
      {
        label: isTimeModality ? 'TEMPO 10 MIN' : 'CANTOS 10 MIN',
        value: formatScoreValue(data.part1Songs, data.modality),
        color: '#0f172a',
      },
      {
        label: isTimeModality ? 'TEMPO 15 MIN' : 'CANTOS 15 MIN',
        value: formatScoreValue(data.part2Songs, data.modality),
        color: '#0369a1',
      },
    ];
    const colW = boxW / cols.length;
    cols.forEach((col, idx) => {
      const colCenter = boxX + colW * idx + colW / 2;
      ctx.fillStyle = '#64748b';
      ctx.font = '700 15px Tahoma, Verdana, Geneva, sans-serif';
      ctx.fillText(col.label, colCenter, y + 134);

      ctx.fillStyle = col.color;
      ctx.font = '700 31px Tahoma, Verdana, Geneva, sans-serif';
      ctx.fillText(col.value, colCenter, y + 178);
    });

    // Bottom Signature: Handwritten Rubrica + Presidente AOPE + Footer
    const sigTextY = height - 86;
    if (loadedSig && loadedSig.naturalWidth > 0 && loadedSig.naturalHeight > 0) {
      const sigMaxW = 240;
      const sigMaxH = 104;
      const scale = Math.min(
        sigMaxW / loadedSig.naturalWidth,
        sigMaxH / loadedSig.naturalHeight
      );
      const drawW = loadedSig.naturalWidth * scale;
      const drawH = loadedSig.naturalHeight * scale;
      ctx.drawImage(
        loadedSig,
        centerX - drawW / 2,
        sigTextY - 24 - drawH,
        drawW,
        drawH
      );
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 20px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText('Presidente AOPE', centerX, sigTextY);

    ctx.fillStyle = '#64748b';
    ctx.font = '400 14.5px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText(
      `Emitido em ${data.issuedAtText} · Canto & Fibra · Documento Oficial`,
      centerX,
      sigTextY + 24
    );

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível gerar a imagem do certificado.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', buildCertificateFilename(data, 'png'));
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}

export async function exportCertificateToPdf(data: CertificateData): Promise<void> {
  const customWatermarkUrl = getCertificateCustomWatermarkUrl(data.modality);
  const customBackgroundColor = getCertificateCustomBackgroundColor(data.modality);
  const backdropUrl = buildCertificateBackdropDataUrl(
    1600,
    1130,
    !customWatermarkUrl,
    customBackgroundColor
  );
  const [loadedLogo, loadedBackdrop, sigAsset, loadedCustomWatermark] =
    await Promise.all([
      data.eventLogoDataUrl
        ? loadImageElement(data.eventLogoDataUrl)
        : Promise.resolve(null),
      loadImageElement(backdropUrl),
      loadTrimmedPresidentSignature(),
      customWatermarkUrl
        ? loadImageElement(customWatermarkUrl)
        : Promise.resolve(null),
    ]);

  const trimmedCustomWatermark =
    customWatermarkUrl && loadedCustomWatermark && loadedCustomWatermark.naturalWidth > 0
      ? trimTransparentImageCanvas(loadedCustomWatermark)
      : null;

  const pdfLogoDataUrl =
    loadedLogo && loadedLogo.naturalWidth > 0 && loadedLogo.naturalHeight > 0
      ? imageToPngDataUrl(loadedLogo, 960)
      : null;

  const pdfBackdropDataUrl =
    loadedBackdrop && loadedBackdrop.naturalWidth > 0 && loadedBackdrop.naturalHeight > 0
      ? trimmedCustomWatermark
        ? buildCompositeBackdropDataUrl(loadedBackdrop, trimmedCustomWatermark, 1920, 1356)
        : imageToPngDataUrl(loadedBackdrop, 1920)
      : null;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const width = doc.internal.pageSize.getWidth(); // 297
  const height = doc.internal.pageSize.getHeight(); // 210
  const centerX = width / 2;

  // Classic textured parchment, double thin gold border, botanical corners & watermark
  if (pdfBackdropDataUrl) {
    doc.addImage(pdfBackdropDataUrl, 'PNG', 0, 0, width, height);
  } else {
    if (customBackgroundColor === '#ffffe2') {
      doc.setFillColor(255, 255, 226);
    } else if (customBackgroundColor === '#f3ffe4') {
      doc.setFillColor(243, 255, 228);
    } else {
      doc.setFillColor(250, 246, 236);
    }
    doc.rect(0, 0, width, height, 'F');
    doc.setDrawColor(184, 134, 11);
    doc.setLineWidth(0.55);
    doc.rect(8, 8, width - 16, height - 16);
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.3);
    doc.rect(10.5, 10.5, width - 21, height - 21);
  }

  // Top-Center Logo (Large & Transparent)
  const logoBoxW = 68;
  const logoBoxH = 31;
  const logoBoxX = centerX - logoBoxW / 2;
  const logoBoxY = 14;

  if (
    pdfLogoDataUrl &&
    loadedLogo &&
    loadedLogo.naturalWidth > 0 &&
    loadedLogo.naturalHeight > 0
  ) {
    const scale = Math.min(
      logoBoxW / loadedLogo.naturalWidth,
      logoBoxH / loadedLogo.naturalHeight
    );
    const drawW = loadedLogo.naturalWidth * scale;
    const drawH = loadedLogo.naturalHeight * scale;
    doc.addImage(
      pdfLogoDataUrl,
      'PNG',
      centerX - drawW / 2,
      logoBoxY + (logoBoxH - drawH) / 2,
      drawW,
      drawH
    );
  } else {
    doc.setDrawColor(197, 155, 39);
    doc.setLineWidth(0.35);
    doc.roundedRect(logoBoxX, logoBoxY, logoBoxW, logoBoxH, 2, 2, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('LOGOMARCA DO EVENTO', centerX, logoBoxY + logoBoxH / 2 + 1, {
      align: 'center',
    });
  }

  // Championship eyebrow
  let y = 52;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(27, 67, 50);
  const eyebrow = `${data.championshipName.toUpperCase()} · TEMPORADA ${data.seasonYear}`;
  const eyebrowLines = doc.splitTextToSize(eyebrow, width - 48) as string[];
  doc.text(eyebrowLines, centerX, y, { align: 'center' });

  // Title (Sans-serif Dark Forest Green with subtle gold dimensional offset)
  y += Math.max(1, eyebrowLines.length) * 4 + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(212, 175, 55);
  doc.text('CERTIFICADO DE PARTICIPAÇÃO', centerX, y + 0.35, { align: 'center' });
  doc.setTextColor(20, 69, 47);
  doc.text('CERTIFICADO DE PARTICIPAÇÃO', centerX, y, { align: 'center' });

  // Gold filigree line with center diamond
  y += 3.8;
  doc.setDrawColor(197, 155, 39);
  doc.setLineWidth(0.5);
  doc.line(centerX - 36, y, centerX - 3, y);
  doc.line(centerX + 3, y, centerX + 36, y);
  doc.setFillColor(197, 155, 39);
  doc.circle(centerX, y, 0.9, 'F');

  // Intro
  y += 8.5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Certificamos oficialmente que a ave competidora', centerX, y, {
    align: 'center',
  });

  // Bird Name
  y += 10.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22.5);
  doc.setTextColor(20, 69, 47);
  doc.text(data.birdName, centerX, y, { align: 'center' });

  // Owner
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Proprietário: ${data.ownerName}`, centerX, y, {
    align: 'center',
  });

  // Participation Statement (without hyphen or trailing date)
  y += 7.5;
  const stageCode = String(data.stageNumber).padStart(2, '0');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(71, 85, 105);
  const stmtLines = doc.splitTextToSize(
    `participou da Etapa ${stageCode} ${data.stageName}.`,
    width - 56
  ) as string[];
  doc.text(stmtLines, centerX, y, { align: 'center' });

  // Cream/Ivory Rounded Card with Soft Shadow Layer
  y += Math.max(1, stmtLines.length) * 4 + 3.5;
  const boxX = 28;
  const boxW = width - 56;
  const boxH = 38;

  // Soft shadow underneath card
  doc.setFillColor(225, 220, 204);
  doc.roundedRect(boxX + 0.6, y + 0.9, boxW, boxH, 3.2, 3.2, 'F');

  doc.setFillColor(253, 250, 241);
  doc.setDrawColor(197, 155, 39);
  doc.setLineWidth(0.35);
  doc.roundedRect(boxX, y, boxW, boxH, 3.2, 3.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Etapa ${stageCode} (${data.stageDateText})${data.stakeNumber ? ` · Estaca ${data.stakeNumber}` : ''}`,
    centerX,
    y + 7.5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(71, 85, 105);
  const addrLines = doc.splitTextToSize(data.stageAddress, boxW - 16) as string[];
  doc.text(addrLines[0] ?? '', centerX, y + 12.8, { align: 'center' });

  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.25);
  doc.line(boxX + 10, y + 16.5, boxX + boxW - 10, y + 16.5);

  const isTimeModality = isTimeScoredModality(data.modality);
  const metrics = [
    { label: 'COLOCAÇÃO', value: `${data.position}º Lugar`, color: [15, 23, 42] as const },
    { label: 'PONTUAÇÃO', value: `${data.points} pts`, color: [21, 128, 61] as const },
    {
      label: isTimeModality ? 'TEMPO 10 MIN' : 'CANTOS 10 MIN',
      value: formatScoreValue(data.part1Songs, data.modality),
      color: [15, 23, 42] as const,
    },
    {
      label: isTimeModality ? 'TEMPO 15 MIN' : 'CANTOS 15 MIN',
      value: formatScoreValue(data.part2Songs, data.modality),
      color: [3, 105, 161] as const,
    },
  ];
  const colW = boxW / metrics.length;
  metrics.forEach((m, idx) => {
    const cx = boxX + colW * idx + colW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, cx, y + 23.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.value, cx, y + 32, { align: 'center' });
  });

  // Single Signature Footer: Handwritten Rubrica + Presidente AOPE (Lowered, Without Top Line)
  const sigTextY = height - 16.5;
  if (sigAsset && sigAsset.width > 0 && sigAsset.height > 0) {
    const sigMaxW = 45;
    const sigMaxH = 19.5;
    const scale = Math.min(sigMaxW / sigAsset.width, sigMaxH / sigAsset.height);
    const drawW = sigAsset.width * scale;
    const drawH = sigAsset.height * scale;
    doc.addImage(
      sigAsset.dataUrl,
      'PNG',
      centerX - drawW / 2,
      sigTextY - 4.5 - drawH,
      drawW,
      drawH
    );
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Presidente AOPE', centerX, sigTextY, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Emitido em ${data.issuedAtText} · Canto & Fibra · Documento Oficial`,
    centerX,
    sigTextY + 4.8,
    { align: 'center' }
  );

  doc.save(buildCertificateFilename(data, 'pdf'));
}
