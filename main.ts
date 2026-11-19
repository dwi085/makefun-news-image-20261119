// THE WORLD LEDGER — front page for Thursday, 19 November 2026.
// A newspaper front page drawn entirely in code: rasterizer + hand-made
// 5x7 bitmap font + hand-rolled PNG encoder. Node 22, stdlib only.
// Writes one 1024x1024 image to $MAKEFUN_OUTPUT_DIR/entry.png
// (or /output/entry.png when the variable is unset). Deterministic:
// no clock, no randomness, no environment-dependent pixels.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 231];
const INK: RGB = [20, 20, 20];
const RED: RGB = [166, 28, 28];
const BLUE: RGB = [29, 78, 137];
const GOLD: RGB = [178, 126, 24];
const GREY: RGB = [96, 92, 82];
const CREAM: RGB = [232, 226, 208];
const NAVY: RGB = [18, 38, 66];
const ORANGE: RGB = [214, 110, 30];
const GREEN: RGB = [46, 110, 62];

// ---------------------------------------------------------------- canvas
const px = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}

function hline(x: number, y: number, w: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, t, h, c);
}

// Bresenham line, 1px.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function thickLine(x0: number, y0: number, x1: number, y1: number, c: RGB, t: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const half = Math.floor(t / 2);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / steps);
    const y = Math.round(y0 + ((y1 - y0) * s) / steps);
    fillRect(x - half, y - half, t, t, c);
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPixel(cx + x, cy + y, c);
  }
}

function circleOutline(cx: number, cy: number, r: number, c: RGB): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    setPixel(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
  }
}

// Filled triangle via barycentric edge test.
function fillTriangle(
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB,
): void {
  const minX = Math.max(0, Math.min(x0, x1, x2));
  const maxX = Math.min(W - 1, Math.max(x0, x1, x2));
  const minY = Math.max(0, Math.min(y0, y1, y2));
  const maxY = Math.min(H - 1, Math.max(y0, y1, y2));
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
      const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
      const cc = 1 - a - b;
      if (a >= 0 && b >= 0 && cc >= 0) setPixel(x, y, c);
    }
  }
}

// ------------------------------------------------------------------- font
// Hand-made 5x7 bitmap font. Each glyph: 7 rows of 5 cells, "#" = ink.
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
  b: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "####."],
  c: [".....", ".....", ".###.", "#....", "#....", "#....", ".###."],
  d: ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
  f: ["..##.", ".#..#", ".#...", "####.", ".#...", ".#...", ".#..."],
  g: [".....", ".....", ".####", "#...#", "#...#", ".####", "....#", ".###."],
  h: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#"],
  i: ["..#..", ".....", ".##..", "..#..", "..#..", "..#..", ".###."],
  j: ["...#.", ".....", "..##.", "...#.", "...#.", "...#.", "...#.", ".##.."],
  k: ["#....", "#....", "#..#.", "#.#..", "##...", "#.#..", "#..#."],
  l: [".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  n: [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
  o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  p: [".....", ".....", "####.", "#...#", "#...#", "####.", "#....", "#...."],
  q: [".....", ".....", ".####", "#...#", "#...#", ".####", "....#", "....#"],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  s: [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  t: [".#...", ".#...", "####.", ".#...", ".#...", ".#...", "..##."],
  u: [".....", ".....", "#...#", "#...#", "#...#", "#..##", ".##.#"],
  v: [".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  w: [".....", ".....", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  x: [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  y: [".....", ".....", "#...#", "#...#", "#...#", ".####", "....#", ".###."],
  z: [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
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
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", "#.##.", "#..##"],
  "&": [".###.", "#...#", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "/": ["....#", "....#", "...#.", "...#.", "..#..", "..#..", ".#..."],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".#.#.", ".....", ".....", ".....", "....."],
};

// Glyphs with descenders (g, j, p, q, y) have 8 rows; render them shifted
// up by one so their bodies sit on the same baseline as the rest.
function glyphRows(ch: string): string[] {
  const g = FONT[ch];
  if (!g) return FONT[" "];
  return g;
}

function textWidth(s: string, scale: number, tracking = 0): number {
  let w = 0;
  for (const ch of s) w += 6 * scale + tracking;
  return w > 0 ? w - tracking : 0;
}

function drawText(
  x: number, y: number, s: string, scale: number, color: RGB, tracking = 0,
): void {
  let cx = x;
  for (const ch of s) {
    const g = glyphRows(ch);
    const tall = g.length === 8;
    for (let r = 0; r < g.length; r++) {
      const row = g[r];
      const yy = y + (tall ? r - 1 : r) * scale;
      for (let c = 0; c < 5; c++) {
        if (row[c] === "#") fillRect(cx + c * scale, yy, scale, scale, color);
      }
    }
    cx += 6 * scale + tracking;
  }
}

function drawTextCentered(
  cx: number, y: number, s: string, scale: number, color: RGB, tracking = 0,
): void {
  drawText(cx - Math.floor(textWidth(s, scale, tracking) / 2), y, s, scale, color, tracking);
}

function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (textWidth(test, scale) <= maxW || cur === "") {
      cur = test;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawPara(
  x: number, y: number, s: string, maxW: number, scale: number, color: RGB,
): number {
  const lines = wrapText(s, maxW, scale);
  const leading = scale === 2 ? 17 : 26;
  for (let i = 0; i < lines.length; i++) {
    drawText(x, y + i * leading, lines[i], scale, color);
  }
  return y + lines.length * leading;
}

// -------------------------------------------------------------------- png
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePng(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const rowStart = y * (1 + W * 3);
    raw[rowStart] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), rowStart + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- pictograms
// 1. Lead art: Vice City skyline at sunset with a palm tree.
function drawSkyline(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, CREAM);
  // Sun.
  fillCircle(x + w - 52, y + 42, 30, GOLD);
  fillCircle(x + w - 52, y + 42, 22, [224, 164, 60]);
  // Skyline silhouettes, back row then front row.
  const back: Array<[number, number, number]> = [
    [0, 90, 46], [52, 70, 40], [98, 110, 52], [156, 80, 44], [206, 120, 40],
  ];
  for (const [bx, bh, bw] of back) {
    fillRect(x + bx, y + h - 40 - bh, bw, bh + 40, GREY);
  }
  const front: Array<[number, number, number]> = [
    [8, 130, 54], [70, 100, 46], [124, 150, 58], [190, 112, 52],
  ];
  for (const [bx, bh, bw] of front) {
    fillRect(x + bx, y + h - 40 - bh, bw, bh + 40, INK);
    // Lit windows.
    for (let wy = y + h - 40 - bh + 10; wy < y + h - 52; wy += 16) {
      for (let wx = x + bx + 8; wx < x + bx + bw - 8; wx += 14) {
        if ((wx + wy) % 28 < 14) fillRect(wx, wy, 5, 7, GOLD);
      }
    }
  }
  // Ground line.
  fillRect(x, y + h - 40, w, 4, INK);
  // Palm tree at the left.
  const px0 = x + 26;
  const py0 = y + h - 40;
  thickLine(px0, py0, px0 + 8, py0 - 62, [110, 74, 40], 5);
  for (const [dx, dy] of [[-26, -18], [-14, -30], [2, -34], [20, -28], [30, -14]] as Array<[number, number]>) {
    thickLine(px0 + 8, py0 - 62, px0 + 8 + dx, py0 - 62 + dy, GREEN, 3);
  }
}

// 2. Middle East art: explosion burst over a ridge.
function drawBurst(cx: number, cy: number, r: number): void {
  const spikes = 12;
  for (let i = 0; i < spikes; i++) {
    const a1 = (i * 2 * Math.PI) / spikes;
    const a2 = ((i + 0.5) * 2 * Math.PI) / spikes;
    const a3 = ((i + 1) * 2 * Math.PI) / spikes;
    const x1 = Math.round(cx + r * Math.cos(a1));
    const y1 = Math.round(cy + r * Math.sin(a1));
    const x2 = Math.round(cx + r * 0.45 * Math.cos(a2));
    const y2 = Math.round(cy + r * 0.45 * Math.sin(a2));
    const x3 = Math.round(cx + r * Math.cos(a3));
    const y3 = Math.round(cy + r * Math.sin(a3));
    fillTriangle(x1, y1, x2, y2, x3, y3, i % 2 === 0 ? RED : ORANGE);
  }
  fillCircle(cx, cy, Math.round(r * 0.42), GOLD);
  fillCircle(cx, cy, Math.round(r * 0.24), [255, 220, 120]);
  // Smoke puffs.
  fillCircle(cx - r - 6, cy + r * 0.55, 12, GREY);
  fillCircle(cx + r + 4, cy + r * 0.6, 10, GREY);
  fillCircle(cx - r + 14, cy + r * 0.75, 8, GREY);
}

// 3. Business art: rising bar chart with an arrow.
function drawBars(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, CREAM);
  const bars = [22, 32, 28, 44, 54, 64];
  const bw = 22;
  const gap = 8;
  for (let i = 0; i < bars.length; i++) {
    const bh = bars[i];
    fillRect(x + 14 + i * (bw + gap), y + h - 14 - bh, bw, bh, i === bars.length - 1 ? RED : BLUE);
  }
  hline(x + 8, y + h - 14, w - 16, INK, 2);
  // Rising arrow.
  thickLine(x + 16, y + h - 30, x + w - 20, y + 18, RED, 3);
  fillTriangle(x + w - 20, y + 18, x + w - 38, y + 20, x + w - 24, y + 34, RED);
}

// 4. Capitol dome.
function drawCapitol(cx: number, baseY: number, s: number): void {
  // Dome: top half of a circle.
  const r = 34 * s;
  for (let yy = -r; yy <= 0; yy++) {
    const half = Math.floor(Math.sqrt(r * r - yy * yy));
    for (let xx = -half; xx <= half; xx++) setPixel(cx + xx, baseY - 46 * s + yy, INK);
  }
  // Lantern + flag.
  fillRect(cx - 3 * s, baseY - 46 * s - r - 8 * s, 6 * s, 8 * s, INK);
  vline(cx, baseY - 46 * s - r - 20 * s, 12 * s, INK, 2);
  fillTriangle(cx, baseY - 46 * s - r - 20 * s, cx, baseY - 46 * s - r - 10 * s, cx + 14 * s, baseY - 46 * s - r - 15 * s, RED);
  // Drum + columns.
  fillRect(cx - 30 * s, baseY - 46 * s, 60 * s, 10 * s, INK);
  for (let i = -2; i <= 2; i++) {
    fillRect(cx + i * 12 * s - 2 * s, baseY - 36 * s, 4 * s, 26 * s, INK);
  }
  fillRect(cx - 34 * s, baseY - 10 * s, 68 * s, 10 * s, INK);
}

// 5. Europe art: blue disc ringed by twelve gold stars, coins below.
function drawEuroStars(cx: number, cy: number, r: number): void {
  fillCircle(cx, cy, r, BLUE);
  for (let i = 0; i < 12; i++) {
    const a = (i * 2 * Math.PI) / 12 - Math.PI / 2;
    const sx = Math.round(cx + (r - 12) * Math.cos(a));
    const sy = Math.round(cy + (r - 12) * Math.sin(a));
    fillCircle(sx, sy, 4, GOLD);
  }
}

// 6. Space art: navy panel, stars, Voyager probe with a signal ring
// clipped to the panel. Positions are proportional so any panel size works.
function drawVoyager(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, NAVY);
  const stars: Array<[number, number]> = [
    [0.06, 0.18], [0.2, 0.42], [0.35, 0.12], [0.55, 0.32], [0.75, 0.14],
    [0.9, 0.42], [0.12, 0.72], [0.45, 0.78], [0.65, 0.66], [0.86, 0.76],
    [0.28, 0.62], [0.95, 0.16],
  ];
  for (const [fx, fy] of stars) {
    fillRect(x + Math.round(fx * w), y + Math.round(fy * h), 3, 3, [255, 255, 255]);
  }
  // Signal ring, clipped to the panel.
  const arcCx = x + Math.round(w * 0.52);
  const arcCy = y + Math.round(h * 0.45);
  const arcR = Math.round(w * 0.42);
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    const ax = Math.round(arcCx + arcR * Math.cos(rad));
    const ay = Math.round(arcCy + arcR * Math.sin(rad));
    if (ax >= x && ax < x + w && ay >= y && ay < y + h) setPixel(ax, ay, [255, 220, 120]);
  }
  // Probe body.
  const bx = x + Math.round(w * 0.3);
  const by = y + Math.round(h * 0.28);
  fillTriangle(bx, by, bx + 34, by + 10, bx, by + 20, GOLD);
  fillRect(bx - 6, by + 7, 9, 6, [200, 200, 200]);
  // Dish.
  circleOutline(bx + 44, by + 10, 12, [255, 255, 255]);
  // Antenna boom.
  line(bx + 4, by + 4, bx - 16, by - 8, [255, 255, 255]);
  fillCircle(bx - 18, by - 10, 2, RED);
}

// --------------------------------------------------------------- the page
const MX = 36; // left margin
const RX = W - MX; // right edge of content

function rule(y: number, thick: boolean): void {
  hline(MX, y, RX - MX, INK, thick ? 3 : 1);
}

function kicker(x: number, y: number, label: string): void {
  drawText(x, y, label, 2, RED);
  hline(x, y + 17, textWidth(label, 2), RED, 2);
}

function drawPage(): void {
  // Top rule + masthead.
  rule(26, true);
  drawTextCentered(512, 40, "THE WORLD LEDGER", 8, INK, 2);
  hline(MX, 108, RX - MX, INK, 1);
  // Date line — the day this page sums up, in red.
  drawTextCentered(512, 118, "THURSDAY, 19 NOVEMBER 2026", 3, RED);
  drawTextCentered(512, 146, "THE WORLD'S NEWS IN ONE PAGE", 2, GREY);
  hline(MX, 172, RX - MX, INK, 3);
  hline(MX, 178, RX - MX, INK, 1);

  // ---- LEAD: GTA VI -------------------------------------------------
  kicker(MX, 196, "LEAD STORY");
  drawText(MX, 220, "GRAND THEFT AUTO VI", 4, INK);
  drawText(MX, 252, "BEGINS GLOBAL ROLLOUT", 4, INK);
  drawPara(
    MX, 296,
    "Gamers enter Vice City after a 13-year wait as the long-awaited game launches worldwide.",
    620, 2, INK,
  );
  drawText(MX, 340, "After 13 years, Rockstar's sequel opens its doors.", 2, GREY);
  drawSkyline(700, 196, 288, 176);
  drawTextCentered(844, 380, "VICE CITY AT SUNSET", 2, GREY);

  rule(408, false);

  // ---- STORY 2: US / Iran -------------------------------------------
  kicker(MX, 426, "MIDDLE EAST");
  drawText(MX, 450, "US AND IRAN TRADE FIRE AGAIN", 3, INK);
  drawPara(
    MX, 482,
    "US forces struck a missile launch site on Iran's Qeshm Island on 17 November. Iran widened its attacks, targeting a US base in Kuwait and striking Bahrain again on 18 November.",
    700, 2, INK,
  );
  drawBurst(872, 500, 52);

  rule(566, false);

  // ---- ROW B: Anthropic IPO | Jeffries -------------------------------
  // Left column.
  kicker(MX, 584, "BUSINESS");
  drawText(MX, 608, "ANTHROPIC'S RECORD", 3, INK);
  drawText(MX, 634, "$81.3BN IPO", 3, INK);
  drawPara(
    MX, 664,
    "Shares priced at $83 in the biggest initial public offering of all time.",
    440, 2, INK,
  );
  drawBars(MX, 716, 200, 84);
  // Right column.
  const CX = 528;
  vline(508, 584, 216, INK, 1);
  kicker(CX, 584, "AMERICA");
  drawText(CX, 608, "JEFFRIES SET TO", 3, INK);
  drawText(CX, 634, "MAKE HISTORY", 3, INK);
  drawPara(
    CX, 664,
    "Democrat Hakeem Jeffries is set to become the first African-American Speaker of the US House.",
    440, 2, INK,
  );
  drawCapitol(CX + 330, 792, 1);

  rule(816, false);

  // ---- ROW C: EU Ukraine loan | Voyager 1 ----------------------------
  kicker(MX, 834, "EUROPE");
  drawText(MX, 858, "EU'S 45BN-EURO", 3, INK);
  drawText(MX, 884, "UKRAINE LOAN", 3, INK);
  drawPara(
    MX, 946,
    "The loan would be repaid after Russia pays reparations.",
    440, 2, INK,
  );
  drawEuroStars(448, 890, 34);
  vline(508, 834, 140, INK, 1);
  kicker(CX, 834, "SPACE");
  drawText(CX, 858, "VOYAGER 1", 3, INK);
  drawText(CX, 884, "LIGHT-DAY OUT", 3, INK);
  drawPara(
    CX, 946,
    "NASA's probe reaches one light-day from Earth, almost 50 years on.",
    440, 2, INK,
  );
  drawVoyager(832, 856, 150, 68);

  // ---- Footer --------------------------------------------------------
  hline(MX, 990, RX - MX, INK, 3);
  drawTextCentered(512, 998, "THE WORLD LEDGER - THURSDAY, 19 NOVEMBER 2026", 2, GREY);
}

function main(): void {
  drawPage();
  const png = encodePng();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
}

main();
