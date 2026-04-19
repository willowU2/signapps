#!/usr/bin/env node
/**
 * Tiny PNG generator for the SO5 `Directory` PWA shortcut icons.
 *
 * Next.js 16 lets you ship SVG/PNG icons in public/. The existing `icon-192
 * .png` / `icon-512.png` are 1x1 pixel placeholders; when a user installs
 * the PWA Android's shortcut picker expects real pixels, so we generate a
 * simple coloured PNG with a centered "D" glyph using the Canvas API (via
 * node-canvas if available, otherwise a raw RGBA buffer + zlib).
 *
 * This script is build-time only — run once with `node scripts/generate-
 * directory-icons.js`; do not wire it into the dev loop.
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const OUT_DIR = path.resolve(__dirname, "..", "public", "icons");
fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * Write a PNG image with a solid background and a large centered "D".
 *
 * Uses a hand-rolled PNG encoder so we don't need to pull in a native
 * dependency. The "D" is painted by drawing a filled rounded rectangle and
 * then knocking out an inner rounded rectangle.
 */
function writePng(size, outFile) {
  const bg = [59, 130, 246, 255]; // #3b82f6 – matches manifest theme_color
  const fg = [255, 255, 255, 255];

  const width = size;
  const height = size;
  const rowBytes = width * 4;

  // Fill background.
  const buf = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * rowBytes + x * 4;
      buf[i] = bg[0];
      buf[i + 1] = bg[1];
      buf[i + 2] = bg[2];
      buf[i + 3] = bg[3];
    }
  }

  // Paint a simple "D" using geometric shapes:
  //   - outer rounded rect
  //   - inner rounded rect (bg color) with left flat edge
  const pad = Math.floor(size * 0.18);
  const x0 = pad;
  const y0 = pad;
  const x1 = size - pad;
  const y1 = size - pad;
  const glyphW = x1 - x0;
  const glyphH = y1 - y0;
  const stroke = Math.max(2, Math.floor(size * 0.12));

  // Draw white filled "D" shape: a rectangle on the left and a half-ellipse on the right.
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const localX = x - x0;
      const localY = y - y0;
      // Left-half straight edge (rectangle)
      const inLeft = localX <= glyphW / 2;
      // Right-half ellipse: center = (glyphW/2, glyphH/2), rx = glyphW/2, ry = glyphH/2
      const dx = localX - glyphW / 2;
      const dy = localY - glyphH / 2;
      const rx = glyphW / 2;
      const ry = glyphH / 2;
      const inEllipse = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
      const inside = inLeft || inEllipse;
      if (!inside) continue;

      // Knock out the interior — keep a stroke-thick ring only.
      const innerLeft = localX - stroke;
      const innerY = localY - stroke;
      const innerRight = glyphW - stroke;
      const innerBottom = glyphH - stroke;
      const inInterior =
        innerLeft >= 0 &&
        innerY >= 0 &&
        innerLeft <= innerRight - stroke &&
        innerY <= innerBottom - stroke;
      const innerDx = localX - glyphW / 2;
      const innerDy = localY - glyphH / 2;
      const innerRx = rx - stroke;
      const innerRy = ry - stroke;
      const inInnerEllipse =
        (innerDx * innerDx) / (innerRx * innerRx) +
          (innerDy * innerDy) / (innerRy * innerRy) <=
        1;
      const innerLeftStraight =
        localX >= stroke &&
        localX <= glyphW / 2 &&
        localY >= stroke &&
        localY <= glyphH - stroke;

      if (inInterior && (innerLeftStraight || inInnerEllipse)) continue;

      const i = y * rowBytes + x * 4;
      buf[i] = fg[0];
      buf[i + 1] = fg[1];
      buf[i + 2] = fg[2];
      buf[i + 3] = fg[3];
    }
  }

  // Add a one-byte filter prefix per scanline (0 = none) → deflate.
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowBytes + 1)] = 0;
    buf.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const compressed = zlib.deflateSync(raw);

  // Assemble the PNG chunks manually.
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const png = Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(outFile, png);
}

// CRC32 (standard polynomial, cached table).
let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

writePng(192, path.join(OUT_DIR, "directory-192.png"));
writePng(512, path.join(OUT_DIR, "directory-512.png"));
console.log("generated directory-{192,512}.png →", OUT_DIR);
