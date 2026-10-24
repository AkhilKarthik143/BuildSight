// Placeholder build steps so the UI has something real to show.
// These get replaced by step records extracted from the actual LEGO manual.

export type Piece = {
  name: string; // spoken name, e.g. "red 2x4 brick"
  studsX: number; // width in studs
  studsY: number; // length in studs
  kind: "brick" | "plate";
  color: string; // the real piece color, shown as a chip
  qty: number;
};

export type Step = {
  number: number;
  instruction: string;
  pieces: Piece[];
  // Rough spot on the camera view where the piece goes, 0–1 from top-left.
  target: { x: number; y: number };
};

export const DEMO_STEPS: Step[] = [
  {
    number: 9,
    instruction: "Place the red 2x4 brick on the left edge, studs up.",
    pieces: [{ name: "red 2x4 brick", studsX: 2, studsY: 4, kind: "brick", color: "#d32f2f", qty: 1 }],
    target: { x: 0.38, y: 0.52 },
  },
  {
    number: 10,
    instruction: "Add two grey 1x2 plates across the front.",
    pieces: [{ name: "grey 1x2 plate", studsX: 1, studsY: 2, kind: "plate", color: "#9e9e9e", qty: 2 }],
    target: { x: 0.55, y: 0.6 },
  },
  {
    number: 11,
    instruction: "Cap it with the yellow 2x2 brick in the center.",
    pieces: [{ name: "yellow 2x2 brick", studsX: 2, studsY: 2, kind: "brick", color: "#fbc02d", qty: 1 }],
    target: { x: 0.5, y: 0.45 },
  },
];
