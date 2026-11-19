// The Daily Horizon - front page for Thursday, 19 November 2026.
// Round 2 of the news-image-20261119 entry: a completely new front page
// (new masthead, new layout, new lead stories) drawn from scratch.
// Renders a 1024x1024 PNG with a built-in 5x7 bitmap font and a
// hand-rolled PNG encoder. Node stdlib only, no network, fully
// deterministic: two runs write identical bytes to /output/entry.png.
import * as fs from "node:fs";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

type Color = [number, number, number];
const PAPER: Color = [247, 243, 234];
const INK: Color = [17, 17, 17];
const RED: Color = [176, 30, 30];
const NAVY: Color = [15, 42, 74];
const STEEL: Color = [70, 110, 150];
const GOLD: Color = [201, 162, 39];
const GRAY: Color = [96, 94, 88];
const WHITE: Color = [244, 242, 236];
const LIGHT: Color = [214, 208, 196];

// 5x7 bitmap font, uppercase + digits + punctuation. Each glyph is 7 rows
// of 5 characters; "#" is an inked pixel.
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
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "'": ["..#..", "..#..", "..#..", ".....", ".....", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".#.#.", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "/": ["....#", "....#", "...#.", "...#.", "..#..", ".#...", "#...."],
  "%": ["#...#", "#..#.", "...#.", "..#..", ".#...", "#..#.", "#...#"],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "&": [".###.", "#...#", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
  "=": [".....", ".....", ".###.", ".....", ".###.", ".....", "....."],
  "*": [".....", ".#.#.", ".###.", "#####", ".###.", ".#.#.", "....."],
};

// ---- PNG encoding (hand-rolled, stdlib zlib) ----
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(width: number, height: number, rgb: Uint8Array): Buffer {
  const stride = 1 + width * 3;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, y * stride + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- Canvas ----
const px = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: Color): void {
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

function fillCircle(cx: number, cy: number, r: number, c: Color): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    fillRect(cx - half, cy + y, half * 2 + 1, 1, c);
  }
}

function textWidth(s: string, scale: number): number {
  return s.length === 0 ? 0 : s.length * 6 * scale - scale;
}

function drawText(x: number, y: number, s: string, scale: number, c: Color): void {
  let cx = x;
  for (const ch of s) {
    const glyph = FONT[ch] ?? FONT["?"];
    for (let r = 0; r < 7; r++) {
      const row = glyph[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === "#") fillRect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(cx: number, y: number, s: string, scale: number, c: Color): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

function drawTextRight(rightX: number, y: number, s: string, scale: number, c: Color): void {
  drawText(rightX - textWidth(s, scale), y, s, scale, c);
}

function wrapText(s: string, maxWidth: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line === "" ? w : line + " " + w;
    if (textWidth(test, scale) <= maxWidth) {
      line = test;
    } else {
      if (line !== "") lines.push(line);
      line = w;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

// Draws a wrapped paragraph; returns the y just below the last line.
function drawParagraph(x: number, y: number, maxWidth: number, s: string, scale: number, c: Color, lineGap: number): number {
  const lines = wrapText(s, maxWidth, scale);
  for (let i = 0; i < lines.length; i++) {
    drawText(x, y + i * (7 * scale + lineGap), lines[i], scale, c);
  }
  return y + lines.length * (7 * scale + lineGap);
}

// ---- Front page layout ----
const M = 36; // margin
const RIGHT = 988; // right edge of the text block

// Top bar and dateline
fillRect(0, 0, W, 10, INK);
drawText(M, 24, "THURSDAY, 19 NOVEMBER 2026", 2, INK);
drawTextRight(RIGHT, 24, "WORLD EDITION - NO. 323", 2, GRAY);

// Masthead
drawTextCentered(512, 48, "THE DAILY HORIZON", 6, INK);
fillRect(M, 100, 952, 6, RED);
fillRect(M, 110, 952, 2, INK);
drawTextCentered(512, 122, "THREE POWERS MEET IN SHENZHEN - BELEM RACES FOR A DEAL - BRIDGE HIT AGAIN", 2, GRAY);

// ---- Lead story: Trump, Xi and Putin in Shenzhen ----
drawText(M, 152, "SUMMIT IN SHENZHEN", 2, RED);
drawText(M, 172, "TRUMP, XI AND PUTIN MEET", 4, INK);
drawText(M, 206, "IN SHENZHEN", 4, INK);
drawParagraph(
  M, 246, 600,
  "THE FIRST THREE-WAY SUMMIT OF THE RIVAL POWERS OPENS THE APEC MEETING WITH HANDSHAKES, A HUG ON THE TARMAC, AND TALKS THAT COULD SHAPE NUCLEAR ARMS, TRADE AND UKRAINE.",
  2, INK, 2,
);
drawParagraph(
  M, 322, 600,
  "XI HUGGED TRUMP AS HE ARRIVED FOR THE APEC SUMMIT IN SHENZHEN. THE THREE LEADERS ARE DUE TO SIT DOWN TOGETHER ON THURSDAY, WITH UKRAINE, TAIWAN AND TRADE ON THE AGENDA. DIPLOMATS CALL IT THE MOST CONSEQUENTIAL MEETING OF THE YEAR.",
  2, INK, 2,
);
fillRect(M, 414, 5, 32, RED);
drawParagraph(
  50, 414, 580,
  "THE WORLD IS WATCHING, SAYS ONE ENVOY IN SHENZHEN.",
  2, GRAY, 2,
);

// ---- Illustration panel: globe over Shenzhen ----
fillRect(664, 150, 324, 296, NAVY);
const GX = 826;
const GY = 278;
for (const [sx, sy] of [[700, 180], [940, 170], [700, 420], [950, 400], [820, 162], [700, 250], [950, 250]] as const) {
  fillRect(sx, sy, 4, 4, WHITE);
}
fillCircle(GX, GY, 88, GOLD);
fillCircle(GX, GY, 82, NAVY);
fillCircle(GX, GY, 74, STEEL);
for (const dy of [-48, -24, 0, 24, 48]) {
  const half = Math.floor(Math.sqrt(74 * 74 - dy * dy));
  fillRect(GX - half, GY + dy - 1, half * 2, 2, WHITE);
}
for (const dx of [-37, 0, 37]) {
  const half = Math.floor(Math.sqrt(74 * 74 - dx * dx));
  fillRect(GX + dx - 1, GY - half, 2, half * 2, WHITE);
}
fillCircle(GX + 40, GY - 30, 5, RED);
drawTextCentered(GX, 380, "APEC 2026", 3, WHITE);
drawTextCentered(GX, 408, "SHENZHEN, CHINA", 2, GOLD);

fillRect(M, 462, 952, 2, INK);

// ---- Second row: COP30 and the Crimea bridge ----
drawText(M, 480, "CLIMATE - BELEM", 2, RED);
drawText(M, 502, "COP30 RACES TO SEAL", 3, INK);
drawText(M, 529, "THE BELEM DEAL", 3, INK);
drawParagraph(
  M, 560, 464,
  "NEGOTIATORS IN BELEM WORK THROUGH THE NIGHT AS BRAZIL PUSHES A STREAMLINED POLITICAL PACKAGE FOR ADOPTION, WITH FINANCE AND FOSSIL FUELS STILL UNSETTLED.",
  2, INK, 2,
);
drawText(524, 480, "WAR IN EUROPE", 2, RED);
drawText(524, 502, "CRIMEA BRIDGE HIT AGAIN", 3, INK);
drawText(524, 529, "TRAFFIC HALTED", 3, INK);
drawParagraph(
  524, 560, 464,
  "TRAFFIC ACROSS THE STRATEGIC BRIDGE LINKING CRIMEA TO RUSSIA WAS SUSPENDED AFTER A FRESH ATTACK, DAYS AFTER UKRAINIAN STRIKES DAMAGED THE KEY SUPPLY ROUTE.",
  2, INK, 2,
);

fillRect(M, 656, 952, 2, INK);

// ---- Markets strip ----
drawText(M, 672, "MARKETS", 3, INK);
fillRect(M, 696, 123, 3, RED);
drawText(M, 706, "OIL SLIDES", 2, INK);
drawParagraph(M, 728, 300, "RISK AVERSION RISES AS MIDDLE EAST TENSIONS WEIGH ON TRADING", 2, GRAY, 2);
fillRect(344, 706, 2, 84, LIGHT);
drawText(360, 706, "FED: MORE HIKES SEEN", 2, INK);
drawParagraph(360, 728, 300, "MINUTES SHOW NEARLY ALL OFFICIALS EXPECT FURTHER RISES TO TAME INFLATION", 2, GRAY, 2);
fillRect(668, 706, 2, 84, LIGHT);
drawText(684, 706, "OIL SLIDES ALL WEEK", 2, INK);
const barHeights = [64, 54, 44, 36, 28];
for (let i = 0; i < barHeights.length; i++) {
  const bx = 684 + i * 52;
  fillRect(bx, 790 - barHeights[i], 40, barHeights[i], i === barHeights.length - 1 ? RED : STEEL);
}
fillRect(684, 790, 304, 2, INK);

fillRect(M, 806, 952, 2, INK);

// ---- Bottom row: Gaza, Myanmar, Van Gogh ----
drawText(M, 822, "GAZA", 2, RED);
drawText(M, 844, "ISRAELI TROOPS IN RARE", 2, INK);
drawText(M, 862, "GAZA GROUND RAID", 2, INK);
drawParagraph(
  M, 884, 304,
  "TROOPS MOVED BEYOND THE CEASEFIRE LINE IN CENTRAL GAZA, SENDING FAMILIES FLEEING THEIR SHELTERS.",
  2, INK, 2,
);
drawText(360, 822, "JUSTICE", 2, RED);
drawText(360, 844, "MYANMAR FACES GENOCIDE", 2, INK);
drawText(360, 862, "VERDICT AT UN COURT", 2, INK);
drawParagraph(
  360, 884, 304,
  "THE UN COURT RULES ON ROHINGYA MASSACRE CLAIMS IN A HISTORIC CASE AGAINST MYANMAR.",
  2, INK, 2,
);
drawText(684, 822, "CULTURE", 2, RED);
drawText(684, 844, "VAN GOGH SELLS FOR", 2, INK);
drawText(684, 862, "$190.4M AT AUCTION", 2, INK);
drawParagraph(
  684, 884, 304,
  "THE PAINTING FETCHED A RECORD PRICE AFTER A ROW OVER ITS NAZI-ERA HISTORY.",
  2, INK, 2,
);

// ---- Also today + footer ----
drawTextCentered(512, 962, "ALSO: CYCLONE AKVAN NEARS INDIA - ESTONIA TO CLOSE RUSSIA BORDER", 2, GRAY);
fillRect(M, 988, 952, 2, INK);
drawTextCentered(512, 998, "THE DAILY HORIZON - THURSDAY 19 NOVEMBER 2026 - PAGE 1", 2, GRAY);

// ---- Write the image ----
const png = encodePNG(W, H, px);
fs.mkdirSync("/output", { recursive: true });
fs.writeFileSync("/output/entry.png", png);
console.log(`wrote /output/entry.png (${png.length} bytes)`);
