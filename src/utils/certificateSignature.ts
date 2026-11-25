export const PRESIDENT_SIGNATURE_PATH =
  '/assets/aistudio/R_brica.Toninho_99899eb6.png';

export interface TrimmedSignatureAsset {
  dataUrl: string;
  width: number;
  height: number;
}

let cachedSignaturePromise: Promise<TrimmedSignatureAsset | null> | null = null;

/**
 * Loads the attached signature PNG and trims surrounding empty transparent padding
 * so the signature renders at crisp, balanced proportions directly above "Presidente AOPE".
 */
export function loadTrimmedPresidentSignature(): Promise<TrimmedSignatureAsset | null> {
  if (cachedSignaturePromise) {
    return cachedSignaturePromise;
  }

  cachedSignaturePromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(null);
          return;
        }

        const scanCanvas = document.createElement('canvas');
        scanCanvas.width = w;
        scanCanvas.height = h;
        const scanCtx = scanCanvas.getContext('2d');
        if (!scanCtx) {
          resolve({ dataUrl: PRESIDENT_SIGNATURE_PATH, width: w, height: h });
          return;
        }

        scanCtx.clearRect(0, 0, w, h);
        scanCtx.drawImage(img, 0, 0, w, h);
        const { data } = scanCtx.getImageData(0, 0, w, h);

        let minX = w;
        let minY = h;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < h; y++) {
          const rowOffset = y * w * 4;
          for (let x = 0; x < w; x++) {
            const alpha = data[rowOffset + x * 4 + 3];
            if (alpha > 12) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX < minX || maxY < minY) {
          resolve({ dataUrl: PRESIDENT_SIGNATURE_PATH, width: w, height: h });
          return;
        }

        const pad = 8;
        const sx = Math.max(0, minX - pad);
        const sy = Math.max(0, minY - pad);
        const sw = Math.min(w - sx, maxX - minX + 1 + pad * 2);
        const sh = Math.min(h - sy, maxY - minY + 1 + pad * 2);

        const outCanvas = document.createElement('canvas');
        outCanvas.width = sw;
        outCanvas.height = sh;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) {
          resolve({ dataUrl: PRESIDENT_SIGNATURE_PATH, width: w, height: h });
          return;
        }

        outCtx.clearRect(0, 0, sw, sh);
        outCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

        resolve({
          dataUrl: outCanvas.toDataURL('image/png'),
          width: sw,
          height: sh,
        });
      } catch {
        resolve({
          dataUrl: PRESIDENT_SIGNATURE_PATH,
          width: img.naturalWidth || 1146,
          height: img.naturalHeight || 494,
        });
      }
    };
    img.onerror = () => resolve(null);
    img.src = PRESIDENT_SIGNATURE_PATH;
  });

  return cachedSignaturePromise;
}
