import * as XLSX from 'xlsx';

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
  align?: 'left' | 'right';
  emphasis?: 'normal' | 'bold' | 'emerald';
}

export interface PngExportOptions {
  filename: string;
  championshipName: string;
  seasonYear: number;
  reportTitle: string;
  issuedAtText: string;
  filterLabel: string;
  infoBlocks: { label: string; value: string }[];
  columns: PngColumn[];
  rows: (string | number)[][];
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

export function exportReportToPng({
  filename,
  championshipName,
  seasonYear,
  reportTitle,
  issuedAtText,
  filterLabel,
  infoBlocks,
  columns,
  rows,
}: PngExportOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const paddingX = 40;
    const contentWidth = columns.reduce((acc, c) => acc + c.width, 0);
    const width = Math.max(960, contentWidth + paddingX * 2);

    const headerSectionHeight = 96;
    const infoCardHeight = infoBlocks.length > 0 ? 28 + infoBlocks.length * 24 + 14 : 0;
    const tableHeaderHeight = 38;
    const rowHeight = 36;
    const footerHeight = 44;
    const height =
      32 +
      headerSectionHeight +
      (infoCardHeight > 0 ? infoCardHeight + 16 : 0) +
      tableHeaderHeight +
      rows.length * rowHeight +
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

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Top accent strip
    ctx.fillStyle = '#047857';
    ctx.fillRect(0, 0, width, 6);

    let y = 32;

    // Championship & Title
    ctx.fillStyle = '#065f46';
    ctx.font = '700 12px Tahoma, Verdana, Geneva, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `${championshipName.toUpperCase()} · TEMPORADA ${seasonYear}`,
      paddingX,
      y + 12
    );

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 22px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText(reportTitle, paddingX, y + 40);

    // Right metadata
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = '400 12px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText(`Emissão: ${issuedAtText}`, width - paddingX, y + 14);
    ctx.fillStyle = '#334155';
    ctx.font = '700 12px Tahoma, Verdana, Geneva, sans-serif';
    ctx.fillText(filterLabel, width - paddingX, y + 34);

    // Divider line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingX, y + 60);
    ctx.lineTo(width - paddingX, y + 60);
    ctx.stroke();

    y += 76;

    // Single Event Info Card
    if (infoBlocks.length > 0) {
      drawRoundedRect(ctx, paddingX, y, width - paddingX * 2, infoCardHeight, 12);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();

      let infoY = y + 26;
      ctx.textAlign = 'left';
      for (const block of infoBlocks) {
        ctx.fillStyle = '#475569';
        ctx.font = '700 12px Tahoma, Verdana, Geneva, sans-serif';
        const labelStr = `${block.label}: `;
        ctx.fillText(labelStr, paddingX + 16, infoY);
        const labelW = ctx.measureText(labelStr).width;

        ctx.fillStyle = '#0f172a';
        ctx.font = '400 12px Tahoma, Verdana, Geneva, sans-serif';
        const availableW = width - paddingX * 2 - 32 - labelW;
        ctx.fillText(fitText(ctx, block.value, availableW), paddingX + 16 + labelW, infoY);
        infoY += 24;
      }

      y += infoCardHeight + 18;
    }

    // Table Header
    const tableWidth = width - paddingX * 2;
    drawRoundedRect(ctx, paddingX, y, tableWidth, tableHeaderHeight, 8);
    ctx.fillStyle = '#f1f5f9';
    ctx.fill();

    let colX = paddingX;
    const scaleFactor = tableWidth / contentWidth;

    ctx.fillStyle = '#475569';
    ctx.font = '700 12px Tahoma, Verdana, Geneva, sans-serif';
    for (const col of columns) {
      const colW = col.width * scaleFactor;
      if (col.align === 'right') {
        ctx.textAlign = 'right';
        ctx.fillText(col.label, colX + colW - 12, y + 23);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(col.label, colX + 12, y + 23);
      }
      colX += colW;
    }

    y += tableHeaderHeight;

    // Table Rows
    rows.forEach((row, rIdx) => {
      if (rIdx % 2 === 1) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(paddingX, y, tableWidth, rowHeight);
      }

      ctx.strokeStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(paddingX, y + rowHeight);
      ctx.lineTo(width - paddingX, y + rowHeight);
      ctx.stroke();

      let cellX = paddingX;
      columns.forEach((col, cIdx) => {
        const colW = col.width * scaleFactor;
        const valStr = String(row[cIdx] ?? '');

        if (col.emphasis === 'emerald') {
          ctx.fillStyle = '#065f46';
          ctx.font = '700 13px Tahoma, Verdana, Geneva, sans-serif';
        } else if (col.emphasis === 'bold') {
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 13px Tahoma, Verdana, Geneva, sans-serif';
        } else {
          ctx.fillStyle = '#334155';
          ctx.font = '400 13px Tahoma, Verdana, Geneva, sans-serif';
        }

        const safeText = fitText(ctx, valStr, Math.max(20, colW - 24));
        if (col.align === 'right') {
          ctx.textAlign = 'right';
          ctx.fillText(safeText, cellX + colW - 12, y + 23);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(safeText, cellX + 12, y + 23);
        }

        cellX += colW;
      });

      y += rowHeight;
    });

    // Footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 11px Tahoma, Verdana, Geneva, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `Total listado: ${rows.length} ${rows.length === 1 ? 'ave' : 'aves'}`,
      paddingX,
      y + 26
    );
    ctx.textAlign = 'right';
    ctx.fillText('Canto & Fibra · Relatório Oficial', width - paddingX, y + 26);

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

