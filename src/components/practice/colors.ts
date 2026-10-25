// Official LEGO colours (LEGO names, sRGB values as published by LEGO / used by Rebrickable and LDraw).
// The manual reading (public/steps/*.json) guesses colours from the printed page, so they're mapped to the nearest
// official colour before a part is drawn.

export const LEGO_COLORS = {
  reddishBrown: { name: "Reddish Brown", hex: "#582A12" },
  brightGreen: { name: "Bright Green", hex: "#4B9F4A" },
  darkGreen: { name: "Dark Green", hex: "#184632" },
  lime: { name: "Lime", hex: "#BBE90B" },
  tan: { name: "Tan", hex: "#E4CD9E" },
  darkTan: { name: "Dark Tan", hex: "#958A73" },
  brightRed: { name: "Bright Red", hex: "#C91A09" },
  brightYellow: { name: "Bright Yellow", hex: "#F2CD37" },
  brightBlue: { name: "Bright Blue", hex: "#0055BF" },
  white: { name: "White", hex: "#F4F4F4" },
  black: { name: "Black", hex: "#05131D" },
  lightBluishGray: { name: "Light Bluish Gray", hex: "#A0A5A9" },
  darkBluishGray: { name: "Dark Bluish Gray", hex: "#6C6E68" },
} as const;

export type LegoColor = keyof typeof LEGO_COLORS;

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// CIELAB distance (ΔE76): close to how people see colour differences, unlike plain RGB distance.
function lab(hex: string): [number, number, number] {
  const lin = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lin;
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function distance(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** The official LEGO colour nearest to a colour read off the manual page. */
export function nearestLegoColor(hex: string): LegoColor {
  let best: LegoColor = "lightBluishGray";
  let bestD = Infinity;
  for (const key of Object.keys(LEGO_COLORS) as LegoColor[]) {
    const d = distance(hex, LEGO_COLORS[key].hex);
    if (d < bestD) {
      bestD = d;
      best = key;
    }
  }
  return best;
}
