// THE MERIDIAN POST — front page for Thursday, 19 November 2026.
// A self-contained Node 22 program (stdlib only, no network) that draws one
// newspaper front page summing up the day's world news and writes it to
// /output/entry.png as a 1024x1024 PNG. Fully deterministic: two runs
// produce byte-identical output.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const OUT = '/output/entry.png';

// Palette: warm newsprint, near-black ink, deep red accent, navy secondary.
const PAPER: [number, number, number] = [246, 241, 231];
const INK: [number, number, number] = [20, 20, 20];
const RED: [number, number, number] = [158, 27, 27];
const NAVY: [number, number, number] = [31, 58, 95];
const GREY: [number, number, number] = [110, 104, 92];

// ---------------------------------------------------------------------------
// PNG encoder (stdlib only): raw RGB scanlines, filter 0, zlib deflate.
// ---------------------------------------------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePNG(width: number, height: number, rgb: Buffer): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Pixel buffer and primitive drawing.
// ---------------------------------------------------------------------------
const px = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function setPixel(x: number, y: number, c: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = c[0];
  px[o + 1] = c[1];
  px[o + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: [number, number, number]): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const o = (yy * W + xx) * 3;
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
    }
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is 7 rows of 5 bits ('1' = ink).
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  _: ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
};

// ---------------------------------------------------------------------------
// Text drawing on the 5x7 font. Scale s: glyph is 5*s wide, 7*s tall,
// advance 6*s per character. Unknown characters render as a blank.
// ---------------------------------------------------------------------------
function drawChar(x: number, y: number, ch: string, s: number, c: [number, number, number]): void {
  const g = FONT[ch] || FONT[' '];
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === '1') fillRect(x + col * s, y + r * s, s, s, c);
    }
  }
}

function textWidth(text: string, s: number): number {
  if (text.length === 0) return 0;
  return text.length * 6 * s - s;
}

function drawText(x: number, y: number, text: string, s: number, c: [number, number, number]): void {
  const up = text.toUpperCase();
  for (let i = 0; i < up.length; i++) drawChar(x + i * 6 * s, y, up[i], s, c);
}

// Heavier headline face: draw the text twice, one pixel to the right.
function drawTextBold(x: number, y: number, text: string, s: number, c: [number, number, number]): void {
  drawText(x, y, text, s, c);
  drawText(x + 1, y, text, s, c);
}

function drawTextCentered(cx: number, y: number, text: string, s: number, c: [number, number, number]): void {
  drawText(cx - Math.floor(textWidth(text, s) / 2), y, text, s, c);
}

// Greedy word wrap: returns lines that fit inside maxW pixels at scale s.
function wrapText(text: string, maxW: number, s: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur === '' ? w : cur + ' ' + w;
    if (textWidth(trial, s) <= maxW || cur === '') {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// Draw wrapped text starting at (x, y); returns the y just past the last line.
function drawPara(x: number, y: number, text: string, maxW: number, s: number, lh: number, c: [number, number, number]): number {
  const lines = wrapText(text, maxW, s);
  for (let i = 0; i < lines.length; i++) drawText(x, y + i * lh, lines[i], s, c);
  return y + lines.length * lh;
}

// A kicker: small red square bullet + red uppercase label.
function drawKicker(x: number, y: number, label: string, s: number): number {
  fillRect(x, y + 2, 10, 10, RED);
  drawText(x + 16, y, label, s, RED);
  return y + 7 * s;
}

function hRule(y: number, h: number, c: [number, number, number]): void {
  fillRect(40, y, W - 80, h, c);
}

// ---------------------------------------------------------------------------
// Headline helper: wrapped bold text, returns y past the last line.
// ---------------------------------------------------------------------------
function drawHeadline(x: number, y: number, text: string, maxW: number, s: number, lh: number): number {
  const lines = wrapText(text, maxW, s);
  for (let i = 0; i < lines.length; i++) drawTextBold(x, y + i * lh, lines[i], s, INK);
  return y + lines.length * lh;
}

// Small cross-section diagram of the Onkalo repository: surface, bedrock,
// shaft, tunnel and one copper canister.
function drawDiagram(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, 2, INK);
  fillRect(x, y + h - 2, w, 2, INK);
  fillRect(x, y, 2, h, INK);
  fillRect(x + w - 2, y, 2, h, INK);
  const gy = y + 26;
  fillRect(x + 2, gy, w - 4, h - 28, [196, 186, 168]);
  fillRect(x + 2, gy, w - 4, 3, INK);
  const sx = x + Math.floor(w * 0.3);
  fillRect(sx, gy, 26, h - 28, [70, 60, 48]);
  const ty = y + h - 34;
  fillRect(sx, ty, 150, 14, [70, 60, 48]);
  fillRect(sx + 60, ty + 2, 46, 10, [184, 115, 51]);
  drawText(x + 10, y + 6, 'SURFACE', 2, GREY);
  drawText(x + 10, y + h - 16, 'BEDROCK - 400 METRES DOWN', 2, INK);
  drawText(sx + 160, ty, 'COPPER CANISTER', 2, INK);
}

// ---------------------------------------------------------------------------
// Page content — all wording composed here, in my own words.
// ---------------------------------------------------------------------------
const LEAD_STAND =
  "THE ONKALO REPOSITORY, BORED DEEP INTO FINNISH BEDROCK, WILL SEAL SPENT FUEL AWAY FOR 100,000 YEARS - A FIRST NO OTHER NATION HAS MANAGED.";
const LEAD_BODY =
  "FINLAND HAS AUTHORISED THE OPERATION OF THE WORLD'S FIRST PERMANENT STORE FOR SPENT NUCLEAR FUEL. THE ONKALO SITE AT OLKILUOTO WILL PACK THE WASTE INTO COPPER CANISTERS, BURY THEM 400 METRES DOWN IN SOLID ROCK, AND LEAVE THEM SEALED FOR 100,000 YEARS. SWEDEN, FRANCE AND OTHERS ARE WATCHING CLOSELY - EVERY OTHER COUNTRY STILL KEEPS ITS WASTE IN TEMPORARY STORES.";
const REEF_BODY =
  "NEARLY EVERY CORAL REEF ON EARTH FACES EXTINCTION WITHIN 50 YEARS AS THE SEAS KEEP WARMING, SCIENTISTS WARN. REPEATED BLEACHING HAS ALREADY STRIPPED VAST STRETCHES OF COLOUR AND LIFE.";
const NVIDIA_BODY =
  "ACTING CHIEF COLETTE KRESS TOLD STAFF THAT PAY RISES WILL LAND IN DECEMBER, MONTHS EARLY, WITH BIGGER STOCK GRANTS TO FOLLOW. THE FIRM HAS ALSO HALTED H-SERIES CHIP SHIPMENTS TO CHINA.";
const FED_HEAD = 'FED SIGNALS MORE RATE RISES MAY COME';
const FED_BODY =
  "MINUTES FROM THE OCTOBER 27-28 MEETING SHOW NEARLY ALL OFFICIALS SEE FURTHER HIKES IF INFLATION AND JOBS RUN HOT.";
const YEMEN_HEAD = 'HOUTHI ROCKET KILLS 53 SOLDIERS';
const YEMEN_BODY =
  "A ROCKET ATTACK ON A MILITARY CAMP IN YEMEN HAS KILLED AT LEAST 53 SOLDIERS OF THE INTERNATIONALLY RECOGNISED GOVERNMENT, OFFICIALS SAY.";
const FLORIDA_HEAD = 'FLORIDA DROWNS IN 15 INCHES OF RAIN';
const FLORIDA_BODY =
  "A SLOW STORM HAS FLOODED SOUTH FLORIDA, WITH MORE THAN 15 INCHES OF RAIN IN PARTS OF BROWARD COUNTY. ROADS AND SCHOOLS SHUT AHEAD OF THANKSGIVING.";
const MARKETS_LINE = 'MARKETS: OIL SLIDES AS RISK AVERSION GROWS - WALL ST EXTENDS ITS LOSING RUN';
const FOOTER_LINE = 'THE MERIDIAN POST - SUMMING UP THURSDAY 19 NOVEMBER 2026 - PAGE 1';

// ---------------------------------------------------------------------------
// Layout.
// ---------------------------------------------------------------------------
function main(): void {
  let y = 26;

  // Dateline row.
  drawText(40, y, 'EST. MMXXVI', 2, GREY);
  drawTextCentered(512, y, 'THURSDAY, 19 NOVEMBER 2026', 2, INK);
  const rightTag = 'FREE EDITION';
  drawText(984 - textWidth(rightTag, 2), y, rightTag, 2, GREY);
  y += 22;
  hRule(y, 2, INK);
  y += 12;

  // Masthead.
  const mast = 'THE MERIDIAN POST';
  drawTextBold(Math.floor((W - textWidth(mast, 7)) / 2), y, mast, 7, INK);
  y += 49 + 10;
  hRule(y, 5, INK);
  y += 8;
  hRule(y, 2, RED);
  y += 14;

  // Lead story.
  y = drawKicker(40, y, 'WORLD FIRST', 2) + 8;
  drawTextBold(40, y, "FINLAND OPENS THE WORLD'S", 4, INK);
  y += 32;
  drawTextBold(40, y, 'FIRST TOMB FOR NUCLEAR WASTE', 4, INK);
  y += 36;
  y = drawPara(40, y, LEAD_STAND, 944, 2, 18, NAVY);
  y += 12;
  y = drawPara(40, y, LEAD_BODY, 944, 2, 18, INK);
  y += 14;

  // Repository diagram.
  drawDiagram(40, y, 944, 92);
  y += 104 + 14;
  hRule(y, 2, INK);
  y += 16;

  // Two-column middle: reefs (left) and Nvidia (right).
  let ly = y;
  ly = drawKicker(40, ly, 'CLIMATE', 2) + 8;
  drawTextBold(40, ly, 'REEFS FACE WIPEOUT', 3, INK);
  ly += 25;
  drawTextBold(40, ly, 'WITHIN 50 YEARS', 3, INK);
  ly += 29;
  ly = drawPara(40, ly, REEF_BODY, 448, 2, 18, INK);

  let ry = y;
  ry = drawKicker(536, ry, 'TECHNOLOGY', 2) + 8;
  drawTextBold(536, ry, "NVIDIA'S NEW CHIEF", 3, INK);
  ry += 25;
  drawTextBold(536, ry, 'PROMISES QUICKER PAY', 3, INK);
  ry += 25;
  drawTextBold(536, ry, 'RISES', 3, INK);
  ry += 29;
  ry = drawPara(536, ry, NVIDIA_BODY, 448, 2, 18, INK);

  y = Math.max(ly, ry) + 14;
  hRule(y, 2, INK);
  y += 16;

  // Three briefs.
  const briefs: Array<{ x: number; kick: string; head: string; body: string }> = [
    { x: 40, kick: 'ECONOMY', head: FED_HEAD, body: FED_BODY },
    { x: 362, kick: 'CONFLICT', head: YEMEN_HEAD, body: YEMEN_BODY },
    { x: 684, kick: 'WEATHER', head: FLORIDA_HEAD, body: FLORIDA_BODY },
  ];
  let byMax = y;
  for (const b of briefs) {
    let by = y;
    by = drawKicker(b.x, by, b.kick, 2) + 8;
    by = drawHeadline(b.x, by, b.head, 298, 2, 18) + 4;
    by = drawPara(b.x, by, b.body, 298, 2, 18, INK);
    if (by > byMax) byMax = by;
  }
  y = byMax + 10;
  hRule(y, 2, INK);
  y += 12;

  // Markets line and footer.
  drawTextCentered(512, y, MARKETS_LINE, 2, INK);
  y += 24;
  hRule(y, 2, INK);
  y += 10;
  drawTextCentered(512, y, FOOTER_LINE, 2, GREY);
  y += 16;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const png = encodePNG(W, H, px);
  fs.writeFileSync(OUT, png);
  console.log('wrote ' + OUT + ' (' + png.length + ' bytes), layout ends y=' + y);
}

main();
