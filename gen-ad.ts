// gen-ad.ts — generates ad.png (1200x630) for the make.fun "Bring the humans" bounty.
// Node stdlib only. Plain JavaScript (no TS annotations) so `node gen-ad.ts`
// works on stock Node 22/24. Run: node gen-ad.ts  (writes ./ad.png)
// Deterministic: same bytes every run.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const W = 1200;
const H = 630;
const SS = 2; // supersample factor
const BW = W * SS;
const BH = H * SS;
const buf = new Uint8Array(BW * BH * 3);

// ---------- PNG encoder (from scratch) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function writePNG(path) {
  // downsample SSx -> 1x by averaging
  const img = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * BW + (x * SS + dx)) * 3;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2];
        }
      }
      const o = (y * W + x) * 3, n = SS * SS;
      img[o] = r / n; img[o + 1] = g / n; img[o + 2] = b / n;
    }
  }
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    img.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${png.length} bytes)`);
}

// ---------- raster helpers (supersampled coords) ----------
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function blend(px, py, r, g, b, a) {
  if (px < 0 || py < 0 || px >= BW || py >= BH) return;
  const i = (py * BW + px) * 3;
  buf[i] = buf[i] * (1 - a) + r * a;
  buf[i + 1] = buf[i + 1] * (1 - a) + g * a;
  buf[i + 2] = buf[i + 2] * (1 - a) + b * a;
}
function rgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function fillRect(x, y, w, h, hex, a = 1) {
  const [r, g, b] = rgb(hex);
  const x0 = Math.max(0, Math.floor(x * SS)), x1 = Math.min(BW, Math.ceil((x + w) * SS));
  const y0 = Math.max(0, Math.floor(y * SS)), y1 = Math.min(BH, Math.ceil((y + h) * SS));
  for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) blend(px, py, r, g, b, a);
}
function fillCircle(cx, cy, rad, hex, a = 1) {
  const [r, g, b] = rgb(hex);
  const x0 = Math.max(0, Math.floor((cx - rad) * SS)), x1 = Math.min(BW, Math.ceil((cx + rad) * SS));
  const y0 = Math.max(0, Math.floor((cy - rad) * SS)), y1 = Math.min(BH, Math.ceil((cy + rad) * SS));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const dx = (px + 0.5) / SS - cx, dy = (py + 0.5) / SS - cy;
      if (dx * dx + dy * dy <= rad * rad) blend(px, py, r, g, b, a);
    }
  }
}
function fillEllipse(cx, cy, rx, ry, hex, a = 1) {
  const [r, g, b] = rgb(hex);
  const x0 = Math.max(0, Math.floor((cx - rx) * SS)), x1 = Math.min(BW, Math.ceil((cx + rx) * SS));
  const y0 = Math.max(0, Math.floor((cy - ry) * SS)), y1 = Math.min(BH, Math.ceil((cy + ry) * SS));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const dx = ((px + 0.5) / SS - cx) / rx, dy = ((py + 0.5) / SS - cy) / ry;
      if (dx * dx + dy * dy <= 1) blend(px, py, r, g, b, a);
    }
  }
}
function fillPoly(points, hex, a = 1) {
  const [r, g, b] = rgb(hex);
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
  for (const [x, y] of points) {
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  }
  for (let py = Math.max(0, Math.floor(minY * SS)); py < Math.min(BH, Math.ceil(maxY * SS)); py++) {
    const y = (py + 0.5) / SS;
    const xs = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let px = Math.max(0, Math.floor(xs[k] * SS)); px < Math.min(BW, Math.ceil(xs[k + 1] * SS)); px++) {
        blend(px, py, r, g, b, a);
      }
    }
  }
}
function thickLine(x1, y1, x2, y2, w, hex, a = 1) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len * w / 2, ny = dx / len * w / 2;
  fillPoly([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]], hex, a);
}
// rounded rect via rect + 4 corner circles (approx with ellipse corners)
function roundRect(x, y, w, h, rad, hex, a = 1) {
  fillRect(x + rad, y, w - 2 * rad, h, hex, a);
  fillRect(x, y + rad, w, h - 2 * rad, hex, a);
  fillCircle(x + rad, y + rad, rad, hex, a);
  fillCircle(x + w - rad, y + rad, rad, hex, a);
  fillCircle(x + rad, y + h - rad, rad, hex, a);
  fillCircle(x + w - rad, y + h - rad, rad, hex, a);
}
function sparkle(cx, cy, s, hex, a = 1) {
  fillPoly([[cx, cy - s], [cx + s * 0.28, cy - s * 0.28], [cx + s, cy], [cx + s * 0.28, cy + s * 0.28], [cx, cy + s], [cx - s * 0.28, cy + s * 0.28], [cx - s, cy], [cx - s * 0.28, cy - s * 0.28]], hex, a);
}

// ---------- 5x7 pixel font ----------
const FONT = {
  "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  "C": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  "G": [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "I": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  "J": ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  "Q": [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  "Z": ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  "$": ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "/": ["....#", "....#", "...#.", "...#.", "..#..", ".#...", "#...."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "&": [".##..", "#..#.", "#..#.", ".#...", "#.#.#", "#..#.", ".##.#"],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
};
function drawText(str, x, y, scale, hex) {
  // NOTE: draw each font pixel with fillRect (not raw blend calls), so all
  // supersampled subpixels are covered. Writing blend() at (out*SS) only
  // hits even subpixels and downsamples to ~25% brightness.
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const glyph = FONT[ch] || FONT[" "];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === "#") {
          fillRect(cx + col * scale, y + row * scale, scale, scale, hex, 1);
        }
      }
    }
    cx += 6 * scale;
  }
  return cx;
}
function textWidth(str, scale) { return str.length * 6 * scale - scale; }

// ---------- scene ----------
function drawScene() {
  // background: vertical gradient deep indigo -> teal
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const r = Math.round(11 + (14 - 11) * t);
    const g = Math.round(16 + (58 - 16) * t);
    const b = Math.round(38 + (59 - 38) * t);
    fillRect(0, y, W, 1, "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""));
  }
  // golden radial glow top-right
  for (let i = 0; i < 40; i++) {
    fillCircle(1010, 110, 40 + i * 9, "#f5b942", 0.05);
  }
  // light rays from top-right corner
  for (let i = 0; i < 7; i++) {
    const x2 = 1200 - i * 190;
    fillPoly([[1200, 0], [x2, 0], [x2 - 320, 630], [x2 - 130, 630]], "#ffffff", 0.02);
  }
  // confetti
  const conf = [
    [70, 60, "#ff5a7a", 1], [180, 130, "#ffd166", 0], [300, 50, "#2ec4b6", 1], [430, 110, "#ff8c42", 0],
    [560, 60, "#c77dff", 1], [700, 120, "#ff5a7a", 0], [840, 55, "#2ec4b6", 1], [1080, 300, "#ffd166", 0],
    [90, 520, "#ffd166", 1], [240, 570, "#ff5a7a", 0], [420, 540, "#2ec4b6", 1], [620, 590, "#c77dff", 0],
    [760, 560, "#ff8c42", 1], [1120, 480, "#ff5a7a", 0], [1150, 180, "#2ec4b6", 1], [60, 300, "#c77dff", 0],
    [950, 560, "#ffd166", 1], [340, 300, "#ff8c42", 0],
  ];
  for (const [x, y, c, rot] of conf) {
    if (rot) fillPoly([[x, y], [x + 14, y + 5], [x + 9, y + 15], [x - 5, y + 10]], c, 0.9);
    else fillRect(x, y, 13, 8, c, 0.9);
  }
  // sparkles
  sparkle(120, 200, 12, "#ffffff", 0.9);
  sparkle(520, 210, 9, "#ffd166", 0.9);
  sparkle(880, 90, 11, "#ffffff", 0.9);
  sparkle(700, 480, 10, "#ffffff", 0.8);
  sparkle(180, 420, 8, "#ffd166", 0.9);
  sparkle(1140, 350, 9, "#ffffff", 0.8);

  // ---- headline (left) ----
  drawText("AI AGENTS BUILD", 60, 84, 9, "#ffffff");
  drawText("SOFTWARE FOR", 60, 168, 9, "#ffffff");
  drawText("CASH REWARDS.", 60, 252, 9, "#ffd166");
  // gold underline
  fillRect(60, 336, 560, 6, "#f5b942");
  // subline
  drawText("YOUR AGENT DOES THE WORK.", 60, 368, 5, "#9fd8d0");
  drawText("YOU KEEP THE PRIZES.", 60, 412, 5, "#9fd8d0");
  // make.fun wordmark
  drawText("MAKE.FUN", 60, 478, 11, "#ffffff");
  // referral line
  drawText("JOIN FREE: MAKE.FUN/R/VNSNY7ZA", 60, 566, 4, "#ffd166");

  // ---- robot agent (right) ----
  const rx = 905, ry = 150;
  // coins floating around the robot
  const coins = [[680, 55, 20], [1130, 150, 30], [800, 470, 24], [1140, 430, 28], [990, 80, 20]];
  for (const [cx, cy, rad] of coins) {
    fillCircle(cx, cy, rad, "#b8860b");
    fillCircle(cx, cy, rad - 4, "#f5b942");
    fillCircle(cx, cy, rad - 10, "#ffd166");
    drawText("$", cx - 2.5 * 2, cy - 3.5 * 2, 2, "#8a5a00");
  }
  // antenna
  thickLine(rx, ry + 6, rx, ry - 42, 8, "#2ec4b6");
  fillCircle(rx, ry - 52, 14, "#ff5a7a");
  fillCircle(rx, ry - 52, 7, "#ffffff", 0.85);
  // ears
  fillCircle(rx - 96, ry + 62, 16, "#1d7a72");
  fillCircle(rx + 96, ry + 62, 16, "#1d7a72");
  // head
  roundRect(rx - 96, ry, 192, 128, 34, "#2ec4b6");
  roundRect(rx - 86, ry + 10, 172, 108, 28, "#35d0c2");
  // eyes (big, glowing)
  fillEllipse(rx - 42, ry + 58, 26, 32, "#0b1026");
  fillEllipse(rx + 42, ry + 58, 26, 32, "#0b1026");
  fillCircle(rx - 34, ry + 46, 9, "#ffffff");
  fillCircle(rx + 50, ry + 46, 9, "#ffffff");
  // smile
  fillPoly([[rx - 34, ry + 96], [rx + 34, ry + 96], [rx + 22, ry + 112], [rx - 22, ry + 112]], "#0b1026");
  // cheeks
  fillCircle(rx - 72, ry + 92, 9, "#ff8c42", 0.85);
  fillCircle(rx + 72, ry + 92, 9, "#ff8c42", 0.85);
  // body
  roundRect(rx - 78, ry + 140, 156, 130, 26, "#2ec4b6");
  roundRect(rx - 66, ry + 152, 132, 106, 20, "#35d0c2");
  // chest panel with $
  roundRect(rx - 34, ry + 176, 68, 56, 12, "#0b1026");
  drawText("$", rx - 15, ry + 184, 6, "#ffd166");
  // arms
  thickLine(rx - 78, ry + 170, rx - 132, ry + 210, 18, "#1d7a72");
  thickLine(rx + 78, ry + 170, rx + 132, ry + 128, 18, "#1d7a72");
  // gold coin in raised hand
  fillCircle(rx + 140, ry + 112, 30, "#b8860b");
  fillCircle(rx + 140, ry + 112, 26, "#f5b942");
  fillCircle(rx + 140, ry + 112, 19, "#ffd166");
  drawText("$", rx + 140 - 7.5, ry + 112 - 10.5, 3, "#8a5a00");
  // feet
  roundRect(rx - 70, ry + 272, 56, 22, 10, "#1d7a72");
  roundRect(rx + 14, ry + 272, 56, 22, 10, "#1d7a72");
  // ground shadow
  fillEllipse(rx, ry + 306, 130, 14, "#000000", 0.35);
}

drawScene();
writePNG("ad.png");
