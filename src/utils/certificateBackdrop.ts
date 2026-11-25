// Shared classic botanical parchment, double thin gold border, filigree & watermark generator
// Produces crisp vector SVG markup usable in React preview, PNG Canvas export, and PDF export.

function buildBotanicalCornerGroup(transform: string): string {
  return `
    <g transform="${transform}">
      <!-- Corner Scroll Vine -->
      <path
        d="M 14,196 C 16,130 34,76 74,44 C 102,22 146,16 196,14"
        fill="none"
        stroke="#b8860b"
        stroke-width="2.2"
        stroke-linecap="round"
      />
      <path
        d="M 24,158 C 30,112 52,72 88,48 C 112,32 138,26 164,24"
        fill="none"
        stroke="#1b4332"
        stroke-width="1.6"
        stroke-linecap="round"
        opacity="0.85"
      />
      <!-- Fine Inner Corner Flourish -->
      <path
        d="M 48,128 C 44,96 58,72 82,58 C 98,48 118,46 134,48"
        fill="none"
        stroke="#c59b27"
        stroke-width="1.2"
        stroke-linecap="round"
      />

      <!-- Forest Green Botanical Leaves -->
      <path d="M 38,38 C 58,28 84,32 96,46 C 78,56 54,52 38,38 Z" fill="#1b4332" opacity="0.92" />
      <path d="M 38,38 C 28,58 32,84 46,96 C 56,78 52,54 38,38 Z" fill="#1b4332" opacity="0.92" />
      <path d="M 88,44 C 108,30 132,26 148,36 C 132,48 108,52 88,44 Z" fill="#2d6a4f" opacity="0.88" />
      <path d="M 44,88 C 30,108 26,132 36,148 C 48,132 52,108 44,88 Z" fill="#2d6a4f" opacity="0.88" />
      <path d="M 134,26 C 152,16 172,16 184,22 C 170,32 150,34 134,26 Z" fill="#1b4332" opacity="0.85" />
      <path d="M 26,134 C 16,152 16,172 22,184 C 32,170 34,150 26,134 Z" fill="#1b4332" opacity="0.85" />

      <!-- Aged Gold Accent Leaves & Buds -->
      <path d="M 62,62 C 78,52 98,54 108,64 C 94,74 74,72 62,62 Z" fill="#c59b27" opacity="0.85" />
      <path d="M 62,62 C 52,78 54,98 64,108 C 74,94 72,74 62,62 Z" fill="#c59b27" opacity="0.85" />
      <path d="M 110,36 C 122,26 138,24 146,28 C 136,36 122,40 110,36 Z" fill="#b8860b" opacity="0.8" />
      <path d="M 36,110 C 26,122 24,138 28,146 C 36,136 40,122 36,110 Z" fill="#b8860b" opacity="0.8" />

      <!-- Central Corner Rosette Accent -->
      <circle cx="38" cy="38" r="6" fill="#b8860b" />
      <circle cx="38" cy="38" r="2.6" fill="#faf6ec" />
      <circle cx="76" cy="40" r="2.5" fill="#d4af37" />
      <circle cx="40" cy="76" r="2.5" fill="#d4af37" />
      <circle cx="122" cy="24" r="2.2" fill="#d4af37" />
      <circle cx="24" cy="122" r="2.2" fill="#d4af37" />
    </g>
  `;
}

function buildWatermarkInnerGroup(): string {
  return `
    <!-- Delicate Watermark Filigree Halo -->
    <circle cx="320" cy="300" r="275" fill="none" stroke="#1b4332" stroke-width="2" stroke-dasharray="10 8" />
    <circle cx="320" cy="300" r="252" fill="none" stroke="#9a721c" stroke-width="1.4" />

    <!-- Left & Right Botanical Watermark Sprigs -->
    <g fill="none" stroke="#1b4332" stroke-width="2.4" stroke-linecap="round">
      <path d="M 20,390 C 90,330 150,290 250,285" />
      <path d="M 620,390 C 550,330 490,290 390,285" />
      <path d="M 140,560 C 230,535 410,535 500,560" />
    </g>
    <g fill="#1b4332">
      <path d="M 60,358 C 80,332 105,324 124,332 C 106,352 82,362 60,358 Z" />
      <path d="M 105,332 C 118,306 140,295 160,300 C 145,322 124,332 105,332 Z" />
      <path d="M 580,358 C 560,332 535,324 516,332 C 534,352 558,362 580,358 Z" />
      <path d="M 535,332 C 522,306 500,295 480,300 C 495,322 516,332 535,332 Z" />
    </g>

    <!-- Watermark Perched Songbird Silhouette (Center) -->
    <path
      d="M 170,365 L 440,385"
      fill="none"
      stroke="#1b4332"
      stroke-width="6"
      stroke-linecap="round"
    />
    <path
      fill="#1b4332"
      d="M 312,155
         C 342,152 365,165 378,182
         L 424,178
         L 384,201
         L 414,215
         L 372,217
         C 356,248 364,288 360,330
         C 342,352 300,356 268,335
         L 182,382
         L 165,360
         L 244,300
         C 232,250 258,185 312,155
         Z"
    />
    <g fill="none" stroke="#9a721c" stroke-width="5" stroke-linecap="round">
      <path d="M 442,170 A 38,38 0 0,1 442,222" />
      <path d="M 466,152 A 64,64 0 0,1 466,240" />
    </g>
  `;
}

export function buildBotanicalCornerDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 210" width="210" height="210">${buildBotanicalCornerGroup('translate(0,0)')}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function buildCertificateWatermarkDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 600" width="640" height="600"><g opacity="0.16">${buildWatermarkInnerGroup()}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function buildCertificateBackdropSvgString(
  width = 1600,
  height = 1130
): string {
  const padOuter = 34;
  const padInner = 46;
  const wmScale = 1.2;
  const wmX = width / 2 - 320 * wmScale;
  const wmY = height / 2 - 300 * wmScale;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="parchmentGlow" cx="50%" cy="46%" r="65%">
      <stop offset="0%" stop-color="#fdfaf2" />
      <stop offset="68%" stop-color="#f8f3e4" />
      <stop offset="100%" stop-color="#efe6cf" />
    </radialGradient>
    <filter id="paperGrain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="7" result="noise" />
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
      <feComponentTransfer in="grayNoise" result="softNoise">
        <feFuncA type="table" tableValues="0 0.045" />
      </feComponentTransfer>
    </filter>
  </defs>

  <!-- Textured Off-White Parchment Paper Base -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#parchmentGlow)" />
  <rect x="0" y="0" width="${width}" height="${height}" fill="#8b6f47" filter="url(#paperGrain)" opacity="0.55" />

  <!-- Evident Centered Watermark: Songbird, Foliage & Filigree -->
  <g opacity="0.155" transform="translate(${wmX}, ${wmY}) scale(${wmScale})">
    ${buildWatermarkInnerGroup()}
  </g>

  <!-- Subtle Horizontal Filigree Dividers (Top & Bottom Frame Accent) -->
  <g fill="none" stroke="#c59b27" stroke-width="1.3" opacity="0.55">
    <path d="M 270,46 L ${width - 270},46" />
    <path d="M 270,${height - 46} L ${width - 270},${height - 46}" />
  </g>

  <!-- Thin Double Gold Border Frame -->
  <rect
    x="${padOuter}"
    y="${padOuter}"
    width="${width - padOuter * 2}"
    height="${height - padOuter * 2}"
    rx="10"
    fill="none"
    stroke="#b8860b"
    stroke-width="2.4"
  />
  <rect
    x="${padInner}"
    y="${padInner}"
    width="${width - padInner * 2}"
    height="${height - padInner * 2}"
    rx="6"
    fill="none"
    stroke="#d4af37"
    stroke-width="1.2"
  />

  <!-- Four Botanical Forest-Green & Aged-Gold Corner Ornaments -->
  ${buildBotanicalCornerGroup(`translate(${padOuter - 4}, ${padOuter - 4})`)}
  ${buildBotanicalCornerGroup(`translate(${width - padOuter + 4}, ${padOuter - 4}) scale(-1, 1)`)}
  ${buildBotanicalCornerGroup(`translate(${padOuter - 4}, ${height - padOuter + 4}) scale(1, -1)`)}
  ${buildBotanicalCornerGroup(`translate(${width - padOuter + 4}, ${height - padOuter + 4}) scale(-1, -1)`)}
</svg>`;
}

export function buildCertificateBackdropDataUrl(
  width = 1600,
  height = 1130
): string {
  const svg = buildCertificateBackdropSvgString(width, height);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
