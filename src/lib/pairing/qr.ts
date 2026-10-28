// QR Code, byte mode, error correction M, versions 1–6. No dependency.
// Matrices match the ISO layout (no quiet zone). The SVG adds the quiet zone.

const ECC_M: { version: number; blocks: number; data: number; ecc: number }[] = [
  { version: 1, blocks: 1, data: 16, ecc: 10 },
  { version: 2, blocks: 1, data: 28, ecc: 16 },
  { version: 3, blocks: 1, data: 44, ecc: 26 },
  { version: 4, blocks: 2, data: 32, ecc: 18 },
  { version: 5, blocks: 2, data: 43, ecc: 22 },
  { version: 6, blocks: 4, data: 27, ecc: 18 },
];

const ALIGN: Record<number, number[]> = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };

function gf() {
  const exp = new Uint8Array(512);
  const log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  const mul = (a: number, b: number) => (a && b ? exp[log[a] + log[b]] : 0);
  return { exp, log, mul };
}
const GF = gf();

function rsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= GF.mul(poly[j], GF.exp[i]);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: Uint8Array, degree: number): Uint8Array {
  const gen = rsGenerator(degree);
  const out = new Uint8Array(degree);
  for (const byte of data) {
    const factor = byte ^ out[0];
    out.copyWithin(0, 1);
    out[degree - 1] = 0;
    if (!factor) continue;
    for (let i = 0; i < degree; i++) out[i] ^= GF.mul(gen[i + 1], factor);
  }
  return out;
}

function bitsToBytes(bits: number[]): Uint8Array {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((bit, i) => {
    if (bit) out[i >> 3] |= 1 << (7 - (i & 7));
  });
  return out;
}

function dataCodewords(text: string, capacity: number): Uint8Array | null {
  const bytes = new TextEncoder().encode(text);
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);
  const capBits = capacity * 8;
  if (bits.length > capBits) return null;
  const term = Math.min(4, capBits - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  // A whole 0x00 when the stream is already aligned matches common encoders. Decoders
  // stop at the character count, and we only add it when a byte of capacity remains.
  if (bits.length % 8 === 0 && bits.length + 8 <= capBits) for (let i = 0; i < 8; i++) bits.push(0);
  if (bits.length > capBits) return null;
  const pad = [0xec, 0x11];
  let p = 0;
  while (bits.length < capBits) {
    push(pad[p], 8);
    p ^= 1;
  }
  return bitsToBytes(bits);
}

function sizeOf(version: number) {
  return 17 + 4 * version;
}

function empty(n: number) {
  return {
    dark: Array.from({ length: n }, () => Array<boolean>(n).fill(false)),
    fn: Array.from({ length: n }, () => Array<boolean>(n).fill(false)),
  };
}

function set(mod: ReturnType<typeof empty>, r: number, c: number, dark: boolean) {
  if (r < 0 || c < 0 || r >= mod.dark.length || c >= mod.dark.length || mod.fn[r][c]) return;
  mod.dark[r][c] = dark;
  mod.fn[r][c] = true;
}

function finder(mod: ReturnType<typeof empty>, r0: number, c0: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const on = r >= 0 && c >= 0 && r <= 6 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(mod, r0 + r, c0 + c, on);
    }
  }
}

function alignment(mod: ReturnType<typeof empty>, r0: number, c0: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const on = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      set(mod, r0 + r, c0 + c, on);
    }
  }
}

function functions(version: number) {
  const n = sizeOf(version);
  const mod = empty(n);
  finder(mod, 0, 0);
  finder(mod, 0, n - 7);
  finder(mod, n - 7, 0);
  for (let i = 0; i < n; i++) {
    set(mod, 6, i, i % 2 === 0);
    set(mod, i, 6, i % 2 === 0);
  }
  set(mod, n - 8, 8, true);
  const reserve = (r: number, c: number) => {
    if (r >= 0 && c >= 0 && r < n && c < n) mod.fn[r][c] = true;
  };
  for (let i = 0; i < 8; i++) {
    reserve(8, i === 6 ? 7 : i);
    reserve(i === 6 ? 7 : i, 8);
    reserve(8, n - 1 - i);
    reserve(n - 1 - i, 8);
  }
  reserve(8, 8);
  const pos = ALIGN[version];
  for (const r of pos) {
    for (const c of pos) {
      if (mod.fn[r][c]) continue;
      alignment(mod, r, c);
    }
  }
  return mod;
}

function formatBits(mask: number): number {
  let rem = mask << 10;
  for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  return ((mask << 10) | (rem & 0x3ff)) ^ 0x5412;
}

function placeFormat(mod: ReturnType<typeof empty>, mask: number) {
  const bits = formatBits(mask);
  const n = mod.dark.length;
  let voffset = 0;
  let hoffset = 0;
  for (let i = 0; i < 8; i++) {
    const vbit = ((bits >> i) & 1) === 1;
    const hbit = ((bits >> (14 - i)) & 1) === 1;
    if (i === 6) {
      voffset += 1;
      hoffset = 1;
    }
    mod.dark[i + voffset][8] = vbit;
    mod.dark[8][i + hoffset] = hbit;
    mod.dark[8][n - 1 - i] = vbit;
    mod.dark[n - 1 - i][8] = hbit;
  }
  mod.dark[n - 8][8] = true;
}

function maskOf(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function placeData(base: ReturnType<typeof empty>, codewords: Uint8Array, mask: number) {
  const n = base.dark.length;
  const dark = base.dark.map((row) => row.slice());
  const fn = base.fn.map((row) => row.slice());
  let bit = 0;
  const total = codewords.length * 8;
  let upward = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < n; i++) {
      const r = upward ? n - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (fn[r][c]) continue;
        let on = false;
        if (bit < total) on = ((codewords[bit >> 3] >> (7 - (bit & 7))) & 1) === 1;
        bit++;
        if (maskOf(mask, r, c)) on = !on;
        dark[r][c] = on;
      }
    }
    upward = !upward;
  }
  return { dark, fn };
}

function penalty(dark: boolean[][]): number {
  const n = dark.length;
  let score = 0;
  const run = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < n; i++) {
      let count = 1;
      let prev = get(i, 0);
      for (let j = 1; j < n; j++) {
        const v = get(i, j);
        if (v === prev) count++;
        else {
          if (count >= 5) score += 3 + (count - 5);
          count = 1;
          prev = v;
        }
      }
      if (count >= 5) score += 3 + (count - 5);
    }
  };
  run((r, c) => dark[r][c]);
  run((c, r) => dark[r][c]);
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = dark[r][c];
      if (v === dark[r][c + 1] && v === dark[r + 1][c] && v === dark[r + 1][c + 1]) score += 3;
    }
  }
  const finder = (line: boolean[]) => {
    const s = line.map((b) => (b ? "1" : "0")).join("");
    for (const pat of ["10111010000", "00001011101"]) {
      let i = 0;
      while ((i = s.indexOf(pat, i)) !== -1) {
        score += 40;
        i++;
      }
    }
  };
  for (let i = 0; i < n; i++) {
    finder(dark[i]);
    finder(dark.map((row) => row[i]));
  }
  let darkCount = 0;
  for (const row of dark) for (const cell of row) if (cell) darkCount++;
  const ratio = Math.abs(darkCount / (n * n) * 100 - 50);
  score += Math.floor(ratio / 5) * 10;
  return score;
}

export function qrBytes(text: string): number[] {
  const spec = ECC_M.find((row) => dataCodewords(text, row.blocks * row.data));
  if (!spec) throw new Error("Text is too long for a pairing QR code.");
  const data = dataCodewords(text, spec.blocks * spec.data);
  if (!data) throw new Error("Text is too long for a pairing QR code.");
  const blocks: Uint8Array[] = [];
  const eccs: Uint8Array[] = [];
  for (let i = 0; i < spec.blocks; i++) {
    const slice = data.slice(i * spec.data, (i + 1) * spec.data);
    blocks.push(slice);
    eccs.push(rsRemainder(slice, spec.ecc));
  }
  const interleaved: number[] = [];
  for (let i = 0; i < spec.data; i++) for (const block of blocks) interleaved.push(block[i]);
  for (let i = 0; i < spec.ecc; i++) for (const block of eccs) interleaved.push(block[i]);
  return interleaved;
}

export function qrMatrix(text: string, forcedMask?: number): boolean[][] {
  const codewords = Uint8Array.from(qrBytes(text));
  const spec = ECC_M.find((row) => row.blocks * (row.data + row.ecc) === codewords.length);
  if (!spec) throw new Error("Text is too long for a pairing QR code.");
  const base = functions(spec.version);
  let best = placeData(base, codewords, forcedMask ?? 0);
  let bestScore = Infinity;
  let bestMask = forcedMask ?? 0;
  if (forcedMask === undefined) {
    for (let mask = 0; mask < 8; mask++) {
      const placed = placeData(base, codewords, mask);
      const score = penalty(placed.dark);
      if (score < bestScore) {
        best = placed;
        bestScore = score;
        bestMask = mask;
      }
    }
  }
  const mod = { dark: best.dark.map((row) => row.slice()), fn: best.fn.map((row) => row.slice()) };
  placeFormat(mod, bestMask);
  return mod.dark;
}

export function qrSvg(text: string): string {
  const matrix = qrMatrix(text);
  const n = matrix.length;
  const quiet = 4;
  const cells: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) cells.push(`<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`);
    }
  }
  const size = n + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/>${cells.join("")}</svg>`;
}
