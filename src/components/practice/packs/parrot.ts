// LEGO 31136 Exotic Parrot, book 1, steps 1–5: the base. 10 placements.
// Parts and colours follow the pre-read manual (public/steps/6455750.json, pages 5–7), with each colour mapped
// to the official LEGO colour (see PARROT_DATA_COLORS, checked by scripts/test-practice.mjs).
// Steps 6–9 build a separate sub-assembly on an axle (turned sideways), so the practice stops at the finished base.
//
// Layout (mm): the two 4x8 half-round plates make an 8x8 circle centred on the origin, studs on the 8 mm grid
// at ±4, ±12, ±20, ±28. Heights stack in plate units: plates 0–3.2, brick and slopes 3.2–12.8, tan plate 12.8–16.0,
// bar plate 16.0–19.2, top brick 19.2–28.8.

import { LEGO } from "../dims";
import { LEGO_COLORS } from "../colors";
import type { Pack, Part, Placement } from "../engine";

const C = LEGO_COLORS;
const P = LEGO.PLATE_H;

const parts: Record<string, Part> = {
  halfPlate: { id: "halfPlate", name: "bright green half-round plate", label: "Half-round 4x8", detail: "Bright Green", spec: { kind: "legoHalfRound", studs: 8, color: C.brightGreen.hex } },
  halfPlateDark: {
    id: "halfPlateDark",
    name: "dark green half-round plate",
    label: "Half-round 4x8",
    detail: "Dark Green",
    spec: { kind: "legoHalfRound", studs: 8, color: C.darkGreen.hex },
    wrongHint: "Right shape, wrong green. The base is bright green.",
  },
  roundPlate4Green: {
    id: "roundPlate4Green",
    name: "4x4 round plate",
    label: "Round plate 4x4",
    detail: "Bright Green",
    spec: { kind: "legoRoundPlate", studs: 4, color: C.brightGreen.hex },
    wrongHint: "That's a 4x4 round plate, half the size. The base is the big half-circle.",
  },
  roundBrick: { id: "roundBrick", name: "2x2 round brick", label: "Round brick 2x2", detail: "Reddish Brown", spec: { kind: "legoRoundBrick", color: C.reddishBrown.hex } },
  squareBrick: {
    id: "squareBrick",
    name: "2x2 square brick",
    label: "Brick 2x2",
    detail: "Reddish Brown",
    spec: { kind: "legoBrick", studsX: 2, studsZ: 2, plates: 3, color: C.reddishBrown.hex },
  },
  roundPlate2Brown: {
    id: "roundPlate2Brown",
    name: "2x2 round plate",
    label: "Round plate 2x2",
    detail: "Reddish Brown",
    spec: { kind: "legoRoundPlate", studs: 2, color: C.reddishBrown.hex },
  },
  slope: { id: "slope", name: "dark green 2x2 slope", label: "Slope 45° 2x2", detail: "Dark Green", spec: { kind: "legoSlope45", color: C.darkGreen.hex } },
  slopeBright: {
    id: "slopeBright",
    name: "bright green 2x2 slope",
    label: "Slope 45° 2x2",
    detail: "Bright Green",
    spec: { kind: "legoSlope45", color: C.brightGreen.hex },
    wrongHint: "Close, but that slope is bright green. Use the dark green ones.",
  },
  brickDarkGreen: {
    id: "brickDarkGreen",
    name: "dark green 2x2 brick",
    label: "Brick 2x2",
    detail: "Dark Green",
    spec: { kind: "legoBrick", studsX: 2, studsZ: 2, plates: 3, color: C.darkGreen.hex },
    wrongHint: "That's a plain 2x2 brick. This step needs the one with a sloped side.",
  },
  tanPlate: { id: "tanPlate", name: "tan 4x4 round plate", label: "Round plate 4x4", detail: "Tan · with hole", spec: { kind: "legoRoundPlate", studs: 4, color: C.tan.hex, hole: true } },
  tanPlate2: {
    id: "tanPlate2",
    name: "tan 2x2 round plate",
    label: "Round plate 2x2",
    detail: "Tan",
    spec: { kind: "legoRoundPlate", studs: 2, color: C.tan.hex },
    wrongHint: "That's the small 2x2 round plate. You need the 4x4 one with the hole.",
  },
  darkTanPlate: {
    id: "darkTanPlate",
    name: "dark tan 4x4 round plate",
    label: "Round plate 4x4",
    detail: "Dark Tan · with hole",
    spec: { kind: "legoRoundPlate", studs: 4, color: C.darkTan.hex, hole: true },
    wrongHint: "That one's dark tan. This step uses the lighter tan plate.",
  },
  barPlate: { id: "barPlate", name: "round plate with four bars", label: "Round 2x2 + bars", detail: "Reddish Brown", spec: { kind: "legoBarPlate", color: C.reddishBrown.hex } },
  barPlateGray: {
    id: "barPlateGray",
    name: "dark grey round plate with bars",
    label: "Round 2x2 + bars",
    detail: "Dark Bluish Gray",
    spec: { kind: "legoBarPlate", color: C.darkBluishGray.hex },
    wrongHint: "Right shape, wrong colour. The tree trunk is reddish brown.",
  },
};

const SLOPE_ROT = "Turn the slope so its studs face the round brick and the slope runs down towards the edge.";
const SLOPE_STUCK = "The slope sits right against the round brick: studs on the inside, slope facing out to the edge of the base.";

const slope = (id: string, pos: [number, number], rotY: number, say: string): Placement => ({
  id,
  part: "slope",
  decoys: ["brickDarkGreen", "slopeBright"],
  pos: [pos[0], P, pos[1]],
  rotY,
  symmetry: 1,
  startRotY: 0,
  snap: { kind: "grid", pitch: LEGO.PITCH },
  step: 3,
  title: "Dark green slopes",
  say,
  stuck: SLOPE_STUCK,
  rotHint: SLOPE_ROT,
  motion: "drop",
});

const placements: Placement[] = [
  {
    id: "half-a",
    part: "halfPlate",
    decoys: ["halfPlateDark", "roundPlate4Green"],
    pos: [0, 0, 0],
    rotY: 0,
    symmetry: 1,
    startRotY: 0,
    snap: { kind: "grid", pitch: LEGO.PITCH },
    step: 1,
    title: "Half-round base",
    say: "Step 1. Find the bright green half-round plate and lay it flat on the outline, straight edge towards you.",
    stuck: "It's the big bright green half-circle. Lay it flat inside the outline with the straight edge facing you.",
    rotHint: "Turn it so the straight edge faces you.",
    motion: "drop",
  },
  {
    id: "brick-1",
    part: "roundBrick",
    decoys: ["squareBrick", "roundPlate2Brown"],
    pos: [0, P, 0],
    rotY: 0,
    symmetry: 0,
    snap: { kind: "grid", pitch: LEGO.PITCH },
    step: 1,
    title: "Round brick on the edge",
    say: "Now the reddish-brown 2x2 round brick. Press it onto the middle of the straight edge, half of it hanging over.",
    stuck: "Put the round brick at the centre of the straight edge: two studs on the plate, two hanging off. It will hold the second half.",
    motion: "drop",
  },
  {
    id: "half-b",
    part: "halfPlate",
    decoys: ["roundPlate4Green", "halfPlateDark"],
    pos: [0, 0, 0],
    rotY: Math.PI,
    symmetry: 1,
    startRotY: 0,
    snap: { kind: "grid", pitch: LEGO.PITCH },
    step: 2,
    title: "Close the circle",
    say: "Step 2. Take the second bright green half-round plate, turn it around, and push it under the overhang to close the circle.",
    stuck: "Turn the half-circle so the two straight edges meet, then slide it under the round brick's overhanging studs.",
    rotHint: "Turn it around so the two straight edges meet.",
    motion: "drop",
  },
  slope("slope-front", [0, 16], 0, "Step 3. Four dark green 2x2 slopes go around the round brick: studs in, slopes out. Start with the one in front."),
  slope("slope-right", [16, 0], Math.PI / 2, "Next slope on the right side. Turn it so the slope faces out."),
  slope("slope-back", [0, -16], Math.PI, "Now the slope at the back, sloping away from you."),
  slope("slope-left", [-16, 0], -Math.PI / 2, "Last slope, on the left."),
  {
    id: "tan-plate",
    part: "tanPlate",
    decoys: ["tanPlate2", "darkTanPlate"],
    pos: [0, 4 * P, 0],
    rotY: 0,
    symmetry: 0,
    snap: { kind: "grid", pitch: LEGO.PITCH },
    step: 4,
    title: "Tan round plate",
    say: "Step 4. Cap it with the tan 4x4 round plate, the one with a hole, centred over the slopes.",
    stuck: "Centre the tan round plate on top: it rests on the round brick and the inner studs of all four slopes.",
    motion: "drop",
  },
  {
    id: "bar-plate",
    part: "barPlate",
    decoys: ["roundPlate2Brown", "barPlateGray"],
    pos: [0, 5 * P, 0],
    rotY: 0,
    symmetry: 4,
    snap: { kind: "grid", pitch: LEGO.PITCH },
    step: 5,
    title: "Round plate with bars",
    say: "Step 5. Press the reddish-brown round plate with four bars onto the centre of the tan plate, bars pointing up.",
    stuck: "It goes dead centre on the tan plate, on the four studs around the hole, with the bars sticking up.",
    motion: "drop",
  },
  {
    id: "brick-2",
    part: "roundBrick",
    decoys: ["squareBrick", "roundPlate2Brown"],
    pos: [0, 6 * P, 0],
    rotY: 0,
    symmetry: 0,
    snap: { kind: "grid", pitch: LEGO.PITCH },
    step: 5,
    title: "Round brick between the bars",
    say: "Last one: another reddish-brown 2x2 round brick, pushed down between the four bars.",
    stuck: "Drop the round brick straight down in the middle, between the bars, onto the plate's four studs.",
    motion: "drop",
  },
];

export const parrot: Pack = {
  id: "parrot",
  title: "Exotic Parrot",
  subtitle: "LEGO 31136 · Book 1, steps 1–5",
  parts,
  placements,
  camera: { target: [0, 6, 0], distance: 235, polar: 0.98, azimuth: 0.42, fov: 32, minDistance: 50, maxDistance: 420 },
  stage: { radius: 110, shadowFar: 70 },
  spawn: [40, 0, 40],
  lift: 16,
  rotateStep: Math.PI / 2,
  intro: "Let's practise the parrot's base. Pick the right part from the tray, then drag it onto the glowing outline.",
  finish: { title: "You're ready to build it for real", body: "That's the parrot's base: steps 1 to 5, with every part where it belongs." },
};

/** Which part of the pre-read manual each practice part comes from (page, step, part index), for the colour check. */
export const PARROT_DATA_COLORS: { page: string; step: number; part: number; partId: string }[] = [
  { page: "5", step: 1, part: 0, partId: "roundBrick" },
  { page: "5", step: 1, part: 1, partId: "halfPlate" },
  { page: "5", step: 2, part: 0, partId: "halfPlate" },
  { page: "6", step: 3, part: 0, partId: "slope" },
  { page: "7", step: 4, part: 0, partId: "tanPlate" },
  { page: "7", step: 5, part: 0, partId: "roundBrick" },
  { page: "7", step: 5, part: 1, partId: "barPlate" },
];
