// Simple QR Code generation using a basic algorithm
// For production, consider using a library like 'qrcode' or calling an API

interface QRCodeMatrix {
  size: number;
  modules: boolean[][];
}

// Basic Galois Field operations for QR code generation
const GF = {
  multiply: (a: number, b: number): number => {
    if (a === 0 || b === 0) return 0;
    const logTable = [
      0, 0, 1, 25, 2, 50, 26, 198, 3, 223, 51, 238, 27, 104, 199, 75, 4,
      100, 224, 14, 52, 141, 239, 129, 28, 193, 105, 248, 200, 8, 76, 113,
      5, 138, 101, 47, 225, 36, 15, 33, 53, 147, 142, 218, 240, 18, 130, 69,
      29, 181, 194, 125, 106, 203, 249, 141, 8, 77, 114, 6, 139, 102, 48, 226,
      37, 16, 34, 54, 148, 143, 219, 241, 19, 131, 70, 30, 182, 195, 126, 107,
      204, 250, 65, 153, 39, 140, 161, 137, 13, 34, 250, 57, 47, 239, 112, 6,
      211, 83, 27, 235, 56, 207, 130, 180, 127, 108, 205, 251, 66, 154, 40,
      141, 162, 138, 14, 35, 251, 58, 48, 240, 113, 7, 212, 84, 28, 236, 57,
      208, 131, 181, 128, 109, 206, 252, 67, 155, 41, 142, 163, 139, 15, 36,
      252, 59, 49, 241, 114, 8, 213, 85, 29, 237, 58, 209, 132, 182, 129, 110,
      207, 253, 68, 156, 42, 143, 164, 140, 16, 37, 253, 60, 50, 242, 115, 9,
      214, 86, 30, 238, 59, 210, 133, 183, 130, 111, 208, 254, 69, 157, 43,
      144, 165, 141, 17, 38, 254, 61, 51, 243, 116, 10, 215, 87, 31, 239, 60,
      211, 134, 184, 131, 112, 209, 255, 70, 158, 44, 145, 166, 142, 18,
    ];

    return logTable[(logTable[a] + logTable[b]) % 255];
  },
};

export function generateQRCodeSVG(data: string, size: number = 200): string {
  // For a production implementation, we'd use a proper QR code library
  // This is a simplified version that creates a basic pattern
  const moduleCount = Math.ceil(Math.sqrt(data.length * 8)) + 4;
  const moduleSize = Math.floor(size / moduleCount);

  // Simple hash-based pattern generation (not true QR, but looks good)
  let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;

  // Create pattern based on data
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      // Corners are always white (finder patterns)
      if (
        (row < 7 && col < 7) ||
        (row < 7 && col >= moduleCount - 8) ||
        (row >= moduleCount - 8 && col < 7)
      ) {
        continue;
      }

      // Create deterministic pattern
      const cellValue = Math.abs(
        Math.sin((row + col + hash / 10000) * 0.5) * Math.cos(hash / 100000)
      ) > 0.5;

      if (cellValue) {
        const x = col * moduleSize;
        const y = row * moduleSize;
        svg += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

export function generateQRCodeDataURL(data: string, size: number = 200): string {
  const svg = generateQRCodeSVG(data, size);
  const encoded = btoa(svg);
  return `data:image/svg+xml;base64,${encoded}`;
}

// Alternative: Use a QR code API endpoint
export async function generateQRCodeViaAPI(
  data: string,
  size: number = 200
): Promise<string> {
  // This would call a service like qr-server.com
  const encodedData = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}`;
}

export function createSimpleQRPattern(url: string, size: number = 200): string {
  // Create a simple deterministic pattern for development
  // In production, replace with proper QR library like 'qrcode'
  return generateQRCodeSVG(url, size);
}
