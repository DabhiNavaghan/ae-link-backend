import QRCode from 'qrcode';

/**
 * Generate a real, scannable QR code as an SVG string.
 * Uses the `qrcode` library for proper QR encoding with error correction.
 *
 * @param data - The URL or text to encode
 * @param size - Width/height in pixels (default 200)
 * @param logoSvg - Optional SVG content for a center logo (rendered at ~20% of QR size)
 */
export function generateQRCodeSVG(
  data: string,
  size: number = 200,
  logoSvg?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use high error correction (H = 30%) so the QR is still scannable
    // even with a logo covering the center
    QRCode.toString(
      data,
      {
        type: 'svg',
        width: size,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      },
      (err: Error | null | undefined, svg: string) => {
        if (err) return reject(err);

        if (logoSvg) {
          // Extract the viewBox dimensions from the generated SVG
          // The library outputs viewBox="0 0 N N" where N is the module count
          const vbMatch = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
          const vbSize = vbMatch ? parseInt(vbMatch[1]) : size;

          // Logo takes ~20% of the viewBox — safe with H-level error correction (30%)
          const logoSize = Math.round(vbSize * 0.22);
          const logoOffset = Math.round((vbSize - logoSize) / 2);
          const pad = Math.round(vbSize * 0.02);

          const logoOverlay = `
            <rect x="${logoOffset - pad}" y="${logoOffset - pad}"
                  width="${logoSize + pad * 2}" height="${logoSize + pad * 2}"
                  fill="#ffffff" rx="1.5"/>
            <g transform="translate(${logoOffset}, ${logoOffset})">
              <svg width="${logoSize}" height="${logoSize}" viewBox="0 0 100 100">
                ${logoSvg}
              </svg>
            </g>
          `;

          svg = svg.replace('</svg>', `${logoOverlay}</svg>`);
        }

        resolve(svg);
      }
    );
  });
}

/**
 * Generate a QR code as a data URL (base64-encoded SVG).
 */
export async function generateQRCodeDataURL(
  data: string,
  size: number = 200,
  logoSvg?: string
): Promise<string> {
  const svg = await generateQRCodeSVG(data, size, logoSvg);
  const encoded = typeof btoa === 'function'
    ? btoa(svg)
    : Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${encoded}`;
}

/**
 * Default SmartLink logo SVG (the "SL" mark).
 * Used when no custom app icon is available.
 */
export const SMARTLINK_LOGO_SVG = `
  <rect width="100" height="100" rx="12" fill="#C9FF3D"/>
  <text x="50" y="58" text-anchor="middle" dominant-baseline="middle"
        font-family="system-ui, -apple-system, sans-serif" font-size="38" font-weight="700" fill="#0A0B0E">
    SL
  </text>
`;
