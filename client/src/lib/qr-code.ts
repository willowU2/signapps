/**
 * Simple QR code generator using canvas
 * For production, use a proper QR library — this generates a placeholder
 */
export function generateQrDataUrl(text: string, size = 200): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // Simple visual pattern (not a real QR code — use qrcode library for production)
  ctx.fillStyle = "#000000";
  const cellSize = Math.floor(size / 25);
  const hash = simpleHash(text);

  // Corner markers
  drawMarker(ctx, 0, 0, cellSize);
  drawMarker(ctx, size - 7 * cellSize, 0, cellSize);
  drawMarker(ctx, 0, size - 7 * cellSize, cellSize);

  // Data cells from hash
  for (let i = 0; i < 400; i++) {
    const bit = (hash[i % hash.length] >> (i % 8)) & 1;
    if (bit) {
      const x = (8 + (i % 16)) * cellSize;
      const y = (8 + Math.floor(i / 16)) * cellSize;
      if (x < size - 8 * cellSize && y < size - 8 * cellSize) {
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
  }

  return canvas.toDataURL("image/png");
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
  ctx.fillRect(x, y, 7 * cell, 7 * cell);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + cell, y + cell, 5 * cell, 5 * cell);
  ctx.fillStyle = "#000000";
  ctx.fillRect(x + 2 * cell, y + 2 * cell, 3 * cell, 3 * cell);
}

function simpleHash(str: string): number[] {
  const result: number[] = [];
  for (let i = 0; i < str.length; i++) {
    result.push(str.charCodeAt(i));
  }
  while (result.length < 50) result.push(result[result.length - 1] ^ 0x5a);
  return result;
}
