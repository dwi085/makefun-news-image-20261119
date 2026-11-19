// THE MERIDIAN POST — front page for Thursday, 19 November 2026.
// Node 22, standard library only. No network. Fully deterministic:
// a hand-built 5x7 bitmap font, a small rasterizer, and a hand-rolled
// PNG encoder (zlib deflate at a fixed level). Writes one image to
// $MAKEFUN_OUTPUT_DIR/entry.png (or /output/entry.png).
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const W = 1024;
const H = 1024;
const MARGIN = 36;
const INK = [17, 17, 17];
const PAPER = [255, 255, 255];
const RED = [150, 20, 20];
const GREY = [105, 105, 105];
const LIGHT = [233, 233, 233];
const COPPER = [184, 115, 51];
const DARK = [52, 52, 52];
const BANDS = [
  [224, 208, 178],
  [208, 192, 162],
  [192, 178, 148],
  [178, 164, 136],
];

// ---------- framebuffer ----------
const px = Buffer.alloc(W * H * 3, 255);

function setPixel(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
      i += 3;
    }
  }
}

function hline(x, y, w, c, t) {
  fillRect(x, y, w, t === undefined ? 1 : t, c);
}

function vline(x, y, h, c, t) {
  fillRect(x, y, t === undefined ? 1 : t, h, c);
}

function outline(x, y, w, h, c, t) {
  const tt = t === undefined ? 1 : t;
  fillRect(x, y, w, tt, c);
  fillRect(x, y + h - tt, w, tt, c);
  fillRect(x, y, tt, h, c);
  fillRect(x + w - tt, y, tt, h, c);
}

// ---------- 5x7 bitmap font (rows are 5-char strings, '1' = ink) ----------
const FONT = {
  'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '00000', '01100', '01000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '01100', '01000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
};

function glyph(ch) {
  return FONT[ch] || FONT[' '];
}

function textWidth(s, scale) {
  if (!s.length) return 0;
  return s.length * 6 * scale - scale;
}

function drawChar(x, y, ch, scale, c) {
  const g = glyph(ch);
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === '1') fillRect(x + col * scale, y + r * scale, scale, scale, c);
    }
  }
}

function drawText(x, y, s, scale, c) {
  const up = String(s).toUpperCase();
  for (let i = 0; i < up.length; i++) {
    drawChar(x + i * 6 * scale, y, up[i], scale, c);
  }
}

function drawTextCentered(cx, y, s, scale, c) {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

function wrapText(text, maxW, scale) {
  const words = String(text).split(' ').filter(function (w) { return w.length > 0; });
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (textWidth(test, scale) <= maxW) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawPara(x, y, text, maxW, scale, c, leading) {
  const lines = wrapText(text, maxW, scale);
  const lh = 7 * scale + leading;
  let yy = y;
  for (const line of lines) {
    drawText(x, yy, line, scale, c);
    yy += lh;
  }
  return yy;
}

// ---------- PNG encoder (truecolor, filter 0, zlib level 9) ----------
const CRC_TABLE = (function () {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    px.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- front page layout ----------
// Content flows from a cursor; the page must end by y ~1016.
const CONTENT_W = W - MARGIN * 2; // 952
const COL_W = Math.floor((CONTENT_W - 24) / 2); // two columns, 24px gutter -> 464
const BRIEF_W = Math.floor((CONTENT_W - 48) / 3); // three briefs, 24px gutters -> 301

// Cross-section diagram of the Onkalo repository, drawn inside a box.
function drawOnkalo(x, y, w, h) {
  outline(x, y, w, h, INK, 1);
  drawText(x + 10, y + 8, 'ONKALO: 400 M DOWN', 1, INK);
  hline(x + 10, y + 22, w - 20, GREY, 1);
  const surfY = y + 52;
  const tunY = y + 118;
  // bedrock bands (below the surface line)
  const bedTop = surfY + 2;
  const bedBot = y + h - 2;
  let band = 0;
  for (let yy = bedTop; yy < bedBot; yy += 16) {
    fillRect(x + 1, yy, w - 2, Math.min(16, bedBot - yy), BANDS[band % BANDS.length]);
    band++;
  }
  // surface line and label
  hline(x + 1, surfY, w - 2, INK, 2);
  drawText(x + w - 78, y + 34, 'SURFACE', 1, INK);
  // depth marker on the left edge
  vline(x + 30, surfY, tunY + 18 - surfY, GREY, 1);
  hline(x + 24, surfY, 12, GREY, 1);
  hline(x + 24, tunY + 18, 12, GREY, 1);
  drawText(x + 40, y + 82, '400 M', 1, INK);
  // vertical shaft from the surface down to the tunnel
  fillRect(x + 150, surfY, 10, tunY - surfY, DARK);
  // horizontal deposition tunnel
  fillRect(x + 150, tunY, w - 150 - 20, 18, DARK);
  // copper canisters standing in the tunnel
  for (let i = 0; i < 6; i++) {
    fillRect(x + 220 + i * 110, tunY - 4, 12, 26, COPPER);
  }
  drawText(x + 300, y + 82, 'BEDROCK', 1, INK);
  drawText(x + 220, tunY + 26, 'COPPER CANISTERS', 1, INK);
}

function render() {
  // dateline row
  drawText(MARGIN, 30, 'THURSDAY, 19 NOVEMBER 2026', 1, INK);
  const right = 'FREE EDITION - NO. 3';
  drawText(W - MARGIN - textWidth(right, 1), 30, right, 1, INK);
  hline(MARGIN, 44, CONTENT_W, INK, 1);

  // centered masthead
  const mast = 'THE MERIDIAN POST';
  drawText(Math.floor((W - textWidth(mast, 7)) / 2), 56, mast, 7, INK);
  hline(MARGIN, 112, CONTENT_W, RED, 3);
  hline(MARGIN, 117, CONTENT_W, INK, 1);
  drawTextCentered(Math.floor(W / 2), 126, 'THE WORLD IN ONE PAGE', 1, GREY);
  hline(MARGIN, 142, CONTENT_W, INK, 1);

  // lead story: kicker + headline + body
  drawText(MARGIN, 154, 'FINLAND - NUCLEAR WASTE', 1, RED);
  drawText(MARGIN, 168, "FINLAND OPENS THE WORLD'S FIRST", 3, INK);
  drawText(MARGIN, 193, 'TOMB FOR NUCLEAR WASTE', 3, INK);
  let y = drawPara(MARGIN, 226, 'Finland has opened Onkalo, the world\'s first permanent tomb for nuclear waste. Copper canisters holding spent fuel will be sealed 400 metres down in solid bedrock, where they must stay safe for 100,000 years.', CONTENT_W, 2, INK, 10);
  y = drawPara(MARGIN, y + 8, 'Engineers lowered the first canisters this week after decades of tests. The site on Olkiluoto island is designed to outlast languages, nations and ice ages.', CONTENT_W, 2, INK, 10);

  // Onkalo cross-section diagram, full width
  const diagY = y + 14;
  drawOnkalo(MARGIN, diagY, CONTENT_W, 180);
  drawText(MARGIN, diagY + 188, 'CROSS-SECTION: THE ONKALO REPOSITORY ON OLKILUOTO ISLAND.', 1, GREY);
  y = diagY + 188 + 16;
  hline(MARGIN, y, CONTENT_W, INK, 1);

  // middle: two columns
  const midY = y + 12;
  const col2X = MARGIN + COL_W + 24;
  drawText(MARGIN, midY, 'CORAL REEFS FACE WIPEOUT', 2, INK);
  drawText(MARGIN, midY + 18, 'WITHIN 50 YEARS', 2, INK);
  drawText(col2X, midY, "NVIDIA'S NEW CHIEF PROMISES", 2, INK);
  drawText(col2X, midY + 18, 'QUICKER PAY RISES', 2, INK);
  const bodyY = midY + 40;
  const endL = drawPara(MARGIN, bodyY, 'Scientists warn the world\'s coral reefs could vanish within 50 years as oceans warm. Bleaching has already hit reefs from Australia to the Caribbean, and recovery is slowing. Reefs shelter a quarter of all marine life and guard coasts from storms.', COL_W, 2, INK, 10);
  const endR = drawPara(col2X, bodyY, 'Nvidia\'s new chief has promised staff quicker pay rises as the chipmaker fights to keep its engineers. The company also halted shipments of its H-series chips to China, a move that rattled suppliers and sent shares sliding.', COL_W, 2, INK, 10);
  const midEnd = Math.max(endL, endR);
  vline(MARGIN + COL_W + 12, midY, midEnd - midY, GREY, 1);
  y = midEnd + 12;
  hline(MARGIN, y, CONTENT_W, INK, 1);

  // three briefs
  const briefY = y + 12;
  const briefs = [
    { head: 'FED SIGNALS MORE RISES', body: 'The Federal Reserve signalled more rate rises may come as inflation stays sticky.' },
    { head: 'HOUTHI ROCKET KILLS 53', body: 'A Houthi rocket strike killed 53 soldiers in Yemen, the deadliest attack this year.' },
    { head: 'FLORIDA DROWNS IN RAIN', body: 'Florida drowned under 15 inches of rain as a slow storm flooded streets.' },
  ];
  let briefEnd = briefY;
  for (let i = 0; i < briefs.length; i++) {
    const bx = MARGIN + i * (BRIEF_W + 24);
    fillRect(bx, briefY + 3, 8, 8, RED);
    drawText(bx + 14, briefY, briefs[i].head, 2, INK);
    const be = drawPara(bx, briefY + 24, briefs[i].body, BRIEF_W, 1, INK, 5);
    if (be > briefEnd) briefEnd = be;
  }
  vline(MARGIN + BRIEF_W + 12, briefY, briefEnd - briefY, GREY, 1);
  vline(MARGIN + 2 * BRIEF_W + 24 + 12, briefY, briefEnd - briefY, GREY, 1);
  y = briefEnd + 12;
  hline(MARGIN, y, CONTENT_W, INK, 1);

  // markets line
  const mktY = y + 12;
  fillRect(MARGIN, mktY, CONTENT_W, 34, LIGHT);
  outline(MARGIN, mktY, CONTENT_W, 34, INK, 1);
  drawTextCentered(Math.floor(W / 2), mktY + 13, 'MARKETS: OIL SLIDES AS WALL STREET EXTENDS ITS LOSING RUN', 1, INK);
  y = mktY + 34 + 12;
  hline(MARGIN, y, CONTENT_W, INK, 1);

  // footer
  drawTextCentered(Math.floor(W / 2), y + 12, 'THE MERIDIAN POST - WORLD NEWS IN ONE PAGE - 19 NOVEMBER 2026', 1, GREY);
  const finalY = y + 12 + 7;
  console.log('layout_final_y ' + finalY);
  return finalY;
}

// Coarse ASCII preview for a quick layout sanity check (stdout only).
function preview() {
  const cols = 128;
  const rows = 64;
  let out = '';
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      const x = Math.floor((c + 0.5) * W / cols);
      const yy = Math.floor((r + 0.5) * H / rows);
      const i = (yy * W + x) * 3;
      const v = px[i] + px[i + 1] + px[i + 2];
      line += v < 300 ? '#' : (v < 650 ? '+' : ' ');
    }
    out += line + '\n';
  }
  console.log(out);
}

function main() {
  const finalY = render();
  if (finalY > 1016) throw new Error('layout overflows: final y ' + finalY);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  fs.mkdirSync(outDir, { recursive: true });
  const png = encodePNG();
  const outPath = path.join(outDir, 'entry.png');
  fs.writeFileSync(outPath, png);
  const sha = crypto.createHash('sha256').update(png).digest('hex');
  console.log('wrote ' + outPath);
  console.log('size ' + png.length + ' bytes');
  console.log('sha256 ' + sha);
  console.log('dimensions ' + W + 'x' + H);
  let clear = true;
  for (let yy = 1016; yy < H && clear; yy++) {
    for (let xx = 0; xx < W; xx++) {
      const i = (yy * W + xx) * 3;
      if (px[i] !== 255 || px[i + 1] !== 255 || px[i + 2] !== 255) { clear = false; break; }
    }
  }
  console.log('bottom_clear_1016_1023 ' + clear);
  preview();
}

main();
