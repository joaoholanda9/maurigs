import { jsPDF } from 'jspdf';
import type { BirdModality } from '../types/championship';
import {
  formatAverageScoreValue,
  formatDatePtBr,
  formatPercentPtBr,
  formatScoreValue,
  isTimeScoredModality,
} from './scoring';

export interface BirdStatsStageRow {
  stageNumber: number;
  stageName: string;
  date: string;
  participated: boolean;
  stakeNumber: string;
  position: number | null;
  points: number;
  part1Songs: number;
  part2Songs: number;
}

export interface BirdStatsExportData {
  championshipName: string;
  seasonYear: number;
  modality?: BirdModality;
  part1Minutes?: number;
  part2Minutes?: number;
  birdName: string;
  ownerName: string;
  isMember: boolean;
  currentPosition: number | null;
  totalRankedBirds: number;
  totalPoints: number;
  approvalPercent: number;
  concludedStagesCount: number;
  stagesDisputed: number;
  scoredStagesCount: number;
  totalPart1: number;
  totalPart2: number;
  totalSongs: number;
  avgPart1: number;
  avgPart2: number;
  avgPoints: number;
  bestPart1: { songs: number; stageNumber: number | null };
  bestPart2: { songs: number; stageNumber: number | null };
  bestPosition: { position: number | null; stageNumber: number | null };
  podiumsCount: number;
  firstPlacesCount: number;
  stageRows: BirdStatsStageRow[];
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

function buildFilename(data: BirdStatsExportData, ext: 'png' | 'pdf'): string {
  const slug = slugifyFilePart(data.birdName) || 'ave';
  return `estatisticas-${slug}-${data.seasonYear}.${ext}`;
}

function formatAvg(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
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
  targetLongSide = 480
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

export async function exportBirdStatsToPng(
  data: BirdStatsExportData
): Promise<void> {
  const isTimeModality = isTimeScoredModality(data.modality);
  const p1Min = data.part1Minutes ?? 10;
  const p2Min = data.part2Minutes ?? 15;
  const loadedLogo = data.eventLogoDataUrl
    ? await loadImageElement(data.eventLogoDataUrl)
    : null;

  await new Promise<void>((resolve, reject) => {
    const width = 1120;
    const paddingX = 44;
    const contentWidth = width - paddingX * 2;

    const headerHeight = 112;
    const summaryBlockHeight = 82;
    const recordsBlockHeight = 136;
    const sectionGap = 18;
    const tableHeaderHeight = 38;
    const rowHeight = 36;
    const rowsCount = Math.max(1, data.stageRows.length);
    const footerHeight = 52;

    const height =
      28 +
      headerHeight +
      sectionGap +
      summaryBlockHeight +
      sectionGap +
      recordsBlockHeight +
      sectionGap +
      28 +
      tableHeaderHeight +
      rowsCount * rowHeight +
      footerHeight;

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

    // Background & Top Accent Strip
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#047857';
    ctx.fillRect(0, 0, width, 7);

    let y = 30;

    // Header (Optional Logo + Bird Identity)
    let textStartX = paddingX;
    if (loadedLogo && loadedLogo.naturalWidth > 0 && loadedLogo.naturalHeight > 0) {
      const boxW = 92;
      const boxH = 74;
      const logoScale = Math.min(
        boxW / loadedLogo.naturalWidth,
        boxH / loadedLogo.naturalHeight
      );
      const drawW = loadedLogo.naturalWidth * logoScale;
      const drawH = loadedLogo.naturalHeight * logoScale;
      ctx.drawImage(
        loadedLogo,
        paddingX + (boxW - drawW) / 2,
        y + (boxH - drawH) / 2 + 6,
        drawW,
        drawH
      );
      textStartX = paddingX + boxW + 18;
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#065f46';
    ctx.font = '700 12px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText(
      fitText(
        ctx,
        `${data.championshipName.toUpperCase()} · TEMPORADA ${data.seasonYear}`,
        width - textStartX - paddingX - 180
      ),
      textStartX,
      y + 18
    );

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 28px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText(
      fitText(ctx, data.birdName, width - textStartX - paddingX - 190),
      textStartX,
      y + 52
    );

    ctx.fillStyle = '#334155';
    ctx.font = '400 14px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText(
      fitText(
        ctx,
        `Proprietário: ${data.ownerName} · ${data.isMember ? 'Sócio' : 'Não sócio'}`,
        width - textStartX - paddingX - 190
      ),
      textStartX,
      y + 78
    );

    // Right Header Metadata
    ctx.textAlign = 'right';
    ctx.fillStyle = '#065f46';
    ctx.font = '700 13px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText('FICHA ESTATÍSTICA DA AVE', width - paddingX, y + 18);

    ctx.fillStyle = '#64748b';
    ctx.font = '400 12px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText(`Emissão: ${data.issuedAtText}`, width - paddingX, y + 40);
    ctx.fillText(
      `Etapas concluídas: ${data.concludedStagesCount}`,
      width - paddingX,
      y + 60
    );

    // Header divider
    ctx.strokeStyle = '#d1fae5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(paddingX, y + headerHeight - 8);
    ctx.lineTo(width - paddingX, y + headerHeight - 8);
    ctx.stroke();

    y += headerHeight + sectionGap - 8;

    // Row 1: 5 Primary Summary KPI Cards (Light Green)
    const primaryKpis = [
      {
        label: 'COLOCAÇÃO ATUAL',
        value:
          data.currentPosition !== null
            ? `${data.currentPosition}º de ${data.totalRankedBirds}`
            : '—',
        accent: '#064e3b',
      },
      {
        label: 'PONTUAÇÃO TOTAL',
        value: `${data.totalPoints} pts`,
        accent: '#047857',
      },
      {
        label: 'APROVEITAMENTO',
        value: formatPercentPtBr(data.approvalPercent),
        accent: '#065f46',
      },
      {
        label: 'ETAPAS DISPUTADAS',
        value: `${data.stagesDisputed} (${data.scoredStagesCount} pont.)`,
        accent: '#064e3b',
      },
      {
        label: isTimeModality ? 'TEMPO TOTAL' : 'TOTAL DE CANTOS',
        value: formatScoreValue(data.totalSongs, data.modality),
        accent: '#064e3b',
      },
    ];

    const kpiGap = 12;
    const kpiW = (contentWidth - kpiGap * (primaryKpis.length - 1)) / primaryKpis.length;
    primaryKpis.forEach((kpi, idx) => {
      const kx = paddingX + idx * (kpiW + kpiGap);
      drawRoundedRect(ctx, kx, y, kpiW, summaryBlockHeight, 12);
      ctx.fillStyle = '#ecfdf5';
      ctx.fill();
      ctx.strokeStyle = '#a7f3d0';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#065f46';
      ctx.font = '700 10.5px Tahoma, Verdana, Geneva, sans-serif';
      ctx.fillText(kpi.label, kx + 14, y + 26);

      ctx.fillStyle = kpi.accent;
      ctx.font = '700 20px Tahoma, Verdana, Geneva, sans-serif';
      ctx.fillText(fitText(ctx, kpi.value, kpiW - 28), kx + 14, y + 58);
    });

    y += summaryBlockHeight + sectionGap;

    // Row 2: Averages & Season Records Card
    drawRoundedRect(ctx, paddingX, y, contentWidth, recordsBlockHeight, 14);
    ctx.fillStyle = '#f0fdf4';
    ctx.fill();
    ctx.strokeStyle = '#bbf7d0';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#065f46';
    ctx.font = '700 12px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText('MÉDIAS, TOTAIS E RECORDES NA TEMPORADA', paddingX + 18, y + 24);

    const detailStats = [
      {
        label: `Total ${p1Min} min`,
        value: `${formatScoreValue(data.totalPart1, data.modality)}${isTimeModality ? '' : ' cantos'}`,
      },
      {
        label: `Total ${p2Min} min`,
        value: `${formatScoreValue(data.totalPart2, data.modality)}${isTimeModality ? '' : ' cantos'}`,
      },
      {
        label: `Média ${p1Min} min`,
        value: `${formatAverageScoreValue(data.avgPart1, data.modality)} / etapa`,
      },
      {
        label: `Média ${p2Min} min`,
        value: `${formatAverageScoreValue(data.avgPart2, data.modality)} / etapa`,
      },
      {
        label: 'Média Pontos',
        value: `${formatAvg(data.avgPoints)} pts/etapa`,
      },
      {
        label: `Melhor ${p1Min} min`,
        value:
          data.bestPart1.stageNumber !== null
            ? `${formatScoreValue(data.bestPart1.songs, data.modality)} (E${String(data.bestPart1.stageNumber).padStart(2, '0')})`
            : '—',
      },
      {
        label: `Melhor ${p2Min} min`,
        value:
          data.bestPart2.stageNumber !== null
            ? `${formatScoreValue(data.bestPart2.songs, data.modality)} (E${String(data.bestPart2.stageNumber).padStart(2, '0')})`
            : '—',
      },
      {
        label: 'Melhor Posição / Pódios',
        value:
          data.bestPosition.position !== null
            ? `${data.bestPosition.position}º lugar · ${data.podiumsCount} pódio(s) (${data.firstPlacesCount}x 1º)`
            : 'Sem pódio ainda',
      },
    ];

    const colsPerRow = 4;
    const cellW = (contentWidth - 36) / colsPerRow;
    detailStats.forEach((item, idx) => {
      const row = Math.floor(idx / colsPerRow);
      const col = idx % colsPerRow;
      const sx = paddingX + 18 + col * cellW;
      const sy = y + 50 + row * 44;

      ctx.fillStyle = '#047857';
      ctx.font = '700 11px Tahoma, Verdana, Geneva, sans-serif';
      ctx.fillText(item.label, sx, sy);

      ctx.fillStyle = '#064e3b';
      ctx.font = '700 14px Tahoma, Verdana, Geneva, sans-serif';
      ctx.fillText(fitText(ctx, item.value, cellW - 14), sx, sy + 18);
    });

    y += recordsBlockHeight + sectionGap;

    // Section Title: Stage-by-Stage Breakdown
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 14px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText('HISTÓRICO COMPLETO ETAPA POR ETAPA', paddingX, y + 14);
    y += 26;

    // Table Header
    const columns = [
      { label: 'Etapa', width: 290, align: 'left' as const },
      { label: 'Data', width: 110, align: 'left' as const },
      { label: 'Estaca', width: 80, align: 'right' as const },
      { label: 'Colocação', width: 135, align: 'right' as const },
      { label: `${p1Min} min`, width: 95, align: 'right' as const },
      { label: `${p2Min} min`, width: 95, align: 'right' as const },
      { label: 'Total', width: 95, align: 'right' as const },
      { label: 'Pontos', width: 132, align: 'right' as const },
    ];

    drawRoundedRect(ctx, paddingX, y, contentWidth, tableHeaderHeight, 8);
    ctx.fillStyle = '#d1fae5';
    ctx.fill();

    let colX = paddingX;
    ctx.fillStyle = '#064e3b';
    ctx.font = '700 12px Tahoma, Verdana, Geneva, sans-serif';
    for (const col of columns) {
      if (col.align === 'right') {
        ctx.textAlign = 'right';
        ctx.fillText(col.label, colX + col.width - 12, y + 23);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(col.label, colX + 12, y + 23);
      }
      colX += col.width;
    }

    y += tableHeaderHeight;

    if (data.stageRows.length === 0) {
      ctx.fillStyle = '#f0fdf4';
      ctx.fillRect(paddingX, y, contentWidth, rowHeight);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#475569';
      ctx.font = '400 13px Tahoma, Verdana, Geneva, sans-serif';
      ctx.fillText(
        'Nenhuma etapa cadastrada na temporada.',
        paddingX + contentWidth / 2,
        y + 23
      );
      y += rowHeight;
    } else {
      data.stageRows.forEach((row, rIdx) => {
        ctx.fillStyle = row.participated
          ? rIdx % 2 === 0
            ? '#ecfdf5'
            : '#f0fdf4'
          : '#f8fafc';
        ctx.fillRect(paddingX, y, contentWidth, rowHeight);

        ctx.strokeStyle = '#d1fae5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(paddingX, y + rowHeight);
        ctx.lineTo(width - paddingX, y + rowHeight);
        ctx.stroke();

        const stageLabel = `E${String(row.stageNumber).padStart(2, '0')} — ${row.stageName}`;
        const posLabel = !row.participated
          ? 'Não participou'
          : row.position !== null
            ? `${row.position}º lugar`
            : `Aguardando ${p1Min}m`;

        const cells = [
          stageLabel,
          formatDatePtBr(row.date),
          row.participated && row.stakeNumber ? row.stakeNumber : '—',
          posLabel,
          row.participated ? formatScoreValue(row.part1Songs, data.modality) : '—',
          row.participated ? formatScoreValue(row.part2Songs, data.modality) : '—',
          row.participated
            ? formatScoreValue(row.part1Songs + row.part2Songs, data.modality)
            : '—',
          row.participated && row.points > 0 ? `+${row.points} pts` : '—',
        ];

        let cellX = paddingX;
        columns.forEach((col, cIdx) => {
          const val = cells[cIdx];
          if (cIdx === 0) {
            ctx.fillStyle = row.participated ? '#064e3b' : '#64748b';
            ctx.font = row.participated
              ? '700 12.5px Tahoma, Verdana, Geneva, sans-serif'
              : '400 12.5px Tahoma, Verdana, Geneva, sans-serif';
          } else if (cIdx === 7 && row.points > 0) {
            ctx.fillStyle = '#047857';
            ctx.font = '700 12.5px Tahoma, Verdana, Geneva, sans-serif';
          } else if (cIdx === 3 && row.position !== null) {
            ctx.fillStyle = '#064e3b';
            ctx.font = '700 12.5px Tahoma, Verdana, Geneva, sans-serif';
          } else {
            ctx.fillStyle = row.participated ? '#1e293b' : '#94a3b8';
            ctx.font = '400 12.5px Tahoma, Verdana, Geneva, sans-serif';
          }

          const safeText = fitText(ctx, val, col.width - 22);
          if (col.align === 'right') {
            ctx.textAlign = 'right';
            ctx.fillText(safeText, cellX + col.width - 12, y + 23);
          } else {
            ctx.textAlign = 'left';
            ctx.fillText(safeText, cellX + 12, y + 23);
          }

          cellX += col.width;
        });

        y += rowHeight;
      });
    }

    // Footer
    ctx.fillStyle = '#64748b';
    ctx.font = '400 11px Tahoma, Verdana, Geneva, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `Total de etapas registradas na temporada: ${data.stageRows.length}`,
      paddingX,
      y + 30
    );
    ctx.textAlign = 'right';
    ctx.fillText('Canto & Fibra · Ficha Estatística Oficial', width - paddingX, y + 30);

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível gerar a imagem PNG das estatísticas.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', buildFilename(data, 'png'));
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}

export async function exportBirdStatsToPdf(
  data: BirdStatsExportData
): Promise<void> {
  const isTimeModality = isTimeScoredModality(data.modality);
  const p1Min = data.part1Minutes ?? 10;
  const p2Min = data.part2Minutes ?? 15;
  const loadedLogo = data.eventLogoDataUrl
    ? await loadImageElement(data.eventLogoDataUrl)
    : null;
  const pdfLogoDataUrl =
    loadedLogo && loadedLogo.naturalWidth > 0 && loadedLogo.naturalHeight > 0
      ? imageToPngDataUrl(loadedLogo, 480)
      : null;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth(); // 210
  const pageH = doc.internal.pageSize.getHeight(); // 297
  const marginX = 12;
  const contentW = pageW - marginX * 2; // 186

  // Top emerald accent bar
  doc.setFillColor(4, 120, 87);
  doc.rect(0, 0, pageW, 3, 'F');

  let y = 10;

  // Header
  let textStartX = marginX;
  if (
    pdfLogoDataUrl &&
    loadedLogo &&
    loadedLogo.naturalWidth > 0 &&
    loadedLogo.naturalHeight > 0
  ) {
    const boxW = 22;
    const boxH = 18;
    const scale = Math.min(
      boxW / loadedLogo.naturalWidth,
      boxH / loadedLogo.naturalHeight
    );
    const drawW = loadedLogo.naturalWidth * scale;
    const drawH = loadedLogo.naturalHeight * scale;
    doc.addImage(
      pdfLogoDataUrl,
      'PNG',
      marginX + (boxW - drawW) / 2,
      y + (boxH - drawH) / 2,
      drawW,
      drawH
    );
    textStartX = marginX + boxW + 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(6, 95, 70);
  doc.text(
    `${data.championshipName.toUpperCase()} · TEMPORADA ${data.seasonYear}`,
    textStartX,
    y + 4
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(data.birdName, textStartX, y + 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Proprietário: ${data.ownerName} · ${data.isMember ? 'Sócio' : 'Não sócio'}`,
    textStartX,
    y + 17
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 95, 70);
  doc.text('FICHA ESTATÍSTICA', pageW - marginX, y + 4, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Emissão: ${data.issuedAtText}`, pageW - marginX, y + 9.5, {
    align: 'right',
  });
  doc.text(
    `Etapas concluídas: ${data.concludedStagesCount}`,
    pageW - marginX,
    y + 14.2,
    { align: 'right' }
  );

  y += 22;
  doc.setDrawColor(209, 250, 229);
  doc.setLineWidth(0.4);
  doc.line(marginX, y, pageW - marginX, y);
  y += 5;

  // 5 Summary KPI Cards (Light Green)
  const kpis = [
    {
      label: 'COLOCAÇÃO',
      value:
        data.currentPosition !== null
          ? `${data.currentPosition}º / ${data.totalRankedBirds}`
          : '—',
    },
    { label: 'PONTOS', value: `${data.totalPoints} pts` },
    { label: 'APROVEIT.', value: formatPercentPtBr(data.approvalPercent) },
    { label: 'ETAPAS', value: `${data.stagesDisputed} (${data.scoredStagesCount} pont.)` },
    {
      label: isTimeModality ? 'TEMPO' : 'CANTOS',
      value: formatScoreValue(data.totalSongs, data.modality),
    },
  ];
  const kpiGap = 2.5;
  const kpiW = (contentW - kpiGap * (kpis.length - 1)) / kpis.length;
  const kpiH = 16;

  kpis.forEach((kpi, idx) => {
    const kx = marginX + idx * (kpiW + kpiGap);
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.setLineWidth(0.3);
    doc.roundedRect(kx, y, kpiW, kpiH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(6, 95, 70);
    doc.text(kpi.label, kx + 2.5, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(6, 78, 59);
    doc.text(kpi.value, kx + 2.5, y + 12.2);
  });

  y += kpiH + 4.5;

  // Averages & Records Box
  const recH = 26;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, y, contentW, recH, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(6, 95, 70);
  doc.text('MÉDIAS, TOTAIS E RECORDES NA TEMPORADA', marginX + 3.5, y + 5.2);

  const detailItems = [
    {
      label: `Total ${p1Min} min`,
      value: `${formatScoreValue(data.totalPart1, data.modality)}${isTimeModality ? '' : ' cantos'}`,
    },
    {
      label: `Total ${p2Min} min`,
      value: `${formatScoreValue(data.totalPart2, data.modality)}${isTimeModality ? '' : ' cantos'}`,
    },
    {
      label: `Média ${p1Min} min`,
      value: `${formatAverageScoreValue(data.avgPart1, data.modality)} / etapa`,
    },
    {
      label: `Média ${p2Min} min`,
      value: `${formatAverageScoreValue(data.avgPart2, data.modality)} / etapa`,
    },
    { label: 'Média Pontos', value: `${formatAvg(data.avgPoints)} pts/etapa` },
    {
      label: `Melhor ${p1Min} min`,
      value:
        data.bestPart1.stageNumber !== null
          ? `${formatScoreValue(data.bestPart1.songs, data.modality)} (E${String(data.bestPart1.stageNumber).padStart(2, '0')})`
          : '—',
    },
    {
      label: `Melhor ${p2Min} min`,
      value:
        data.bestPart2.stageNumber !== null
          ? `${formatScoreValue(data.bestPart2.songs, data.modality)} (E${String(data.bestPart2.stageNumber).padStart(2, '0')})`
          : '—',
    },
    {
      label: 'Melhor Pos. / Pódios',
      value:
        data.bestPosition.position !== null
          ? `${data.bestPosition.position}º · ${data.podiumsCount} pódio(s) (${data.firstPlacesCount}x 1º)`
          : 'Sem pódio',
    },
  ];

  const colW = (contentW - 7) / 4;
  detailItems.forEach((item, idx) => {
    const r = Math.floor(idx / 4);
    const c = idx % 4;
    const dx = marginX + 3.5 + c * colW;
    const dy = y + 11 + r * 8.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(4, 120, 87);
    doc.text(item.label, dx, dy);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(6, 78, 59);
    doc.text(item.value, dx, dy + 3.8);
  });

  y += recH + 6;

  // Stage-by-Stage Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('HISTÓRICO COMPLETO ETAPA POR ETAPA', marginX, y);
  y += 3.5;

  const pdfCols = [
    { label: 'Etapa', width: 56, align: 'left' as const },
    { label: 'Data', width: 21, align: 'left' as const },
    { label: 'Est.', width: 12, align: 'right' as const },
    { label: 'Colocação', width: 26, align: 'right' as const },
    { label: `${p1Min}m`, width: 17, align: 'right' as const },
    { label: `${p2Min}m`, width: 17, align: 'right' as const },
    { label: 'Total', width: 17, align: 'right' as const },
    { label: 'Pontos', width: 20, align: 'right' as const },
  ];

  const drawTableHeader = (topY: number) => {
    doc.setFillColor(209, 250, 229);
    doc.rect(marginX, topY, contentW, 7.5, 'F');
    let cx = marginX;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(6, 78, 59);
    for (const col of pdfCols) {
      if (col.align === 'right') {
        doc.text(col.label, cx + col.width - 2, topY + 5, { align: 'right' });
      } else {
        doc.text(col.label, cx + 2, topY + 5);
      }
      cx += col.width;
    }
    return topY + 7.5;
  };

  y = drawTableHeader(y);

  const rowH = 7.2;
  if (data.stageRows.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhuma etapa cadastrada na temporada.', pageW / 2, y + 6, {
      align: 'center',
    });
    y += 10;
  } else {
    data.stageRows.forEach((row, rIdx) => {
      if (y + rowH > pageH - 16) {
        doc.addPage();
        doc.setFillColor(4, 120, 87);
        doc.rect(0, 0, pageW, 3, 'F');
        y = 12;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(6, 95, 70);
        doc.text(
          `${data.birdName} — Continuação do Histórico`,
          marginX,
          y
        );
        y += 4;
        y = drawTableHeader(y);
      }

      if (row.participated) {
        if (rIdx % 2 === 0) {
          doc.setFillColor(236, 253, 245);
        } else {
          doc.setFillColor(240, 253, 244);
        }
      } else {
        doc.setFillColor(248, 250, 252);
      }
      doc.rect(marginX, y, contentW, rowH, 'F');

      doc.setDrawColor(209, 250, 229);
      doc.setLineWidth(0.2);
      doc.line(marginX, y + rowH, marginX + contentW, y + rowH);

      const stageLabel = `E${String(row.stageNumber).padStart(2, '0')} — ${row.stageName}`;
      const posLabel = !row.participated
        ? 'Não participou'
        : row.position !== null
          ? `${row.position}º lugar`
          : `Aguard. ${p1Min}m`;

      const vals = [
        stageLabel,
        formatDatePtBr(row.date),
        row.participated && row.stakeNumber ? row.stakeNumber : '—',
        posLabel,
        row.participated ? formatScoreValue(row.part1Songs, data.modality) : '—',
        row.participated ? formatScoreValue(row.part2Songs, data.modality) : '—',
        row.participated
          ? formatScoreValue(row.part1Songs + row.part2Songs, data.modality)
          : '—',
        row.participated && row.points > 0 ? `+${row.points} pts` : '—',
      ];

      let cx = marginX;
      pdfCols.forEach((col, cIdx) => {
        const raw = vals[cIdx];
        const maxChars = Math.max(4, Math.floor(col.width * 0.56));
        const text = raw.length > maxChars ? `${raw.slice(0, maxChars - 1)}…` : raw;

        if (cIdx === 0) {
          doc.setFont('helvetica', row.participated ? 'bold' : 'normal');
          if (row.participated) doc.setTextColor(6, 78, 59);
          else doc.setTextColor(100, 116, 139);
        } else if (cIdx === 7 && row.points > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(4, 120, 87);
        } else if (cIdx === 3 && row.position !== null) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(6, 78, 59);
        } else {
          doc.setFont('helvetica', 'normal');
          if (row.participated) doc.setTextColor(30, 41, 59);
          else doc.setTextColor(148, 163, 184);
        }

        doc.setFontSize(7.5);
        if (col.align === 'right') {
          doc.text(text, cx + col.width - 2, y + 4.9, { align: 'right' });
        } else {
          doc.text(text, cx + 2, y + 4.9);
        }
        cx += col.width;
      });

      y += rowH;
    });
  }

  // Footer
  const footerY = Math.min(pageH - 8, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Total de etapas registradas: ${data.stageRows.length}`,
    marginX,
    footerY
  );
  doc.text(
    'Canto & Fibra · Ficha Estatística Oficial',
    pageW - marginX,
    footerY,
    { align: 'right' }
  );

  doc.save(buildFilename(data, 'pdf'));
}
