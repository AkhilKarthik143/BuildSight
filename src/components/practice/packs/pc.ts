// PC Build: install two DDR5 sticks and a graphics card, then plug in its power. 4 placements.
// The ATX board lies flat on the table, centred on the origin: x across its 244 mm side (rear I/O at -x),
// z along its 305 mm side (top edge at -z), PCB top at y = 1.6. Slot and part sizes come from dims.ts.
// The layout of parts on the board is typical of a modern ATX board, not one specific model.

import { PC, bracketWidth, dimmSlotX } from "../dims";
import type { Pack, Part, Placement, Vec3 } from "../engine";

const TOP = PC.PCB_T; // PCB top surface

// DIMM slots: right of the CPU socket, running along z. A1 is nearest the CPU.
export const DIMM = {
  firstX: 26,
  z0: -145, // slot starts 7.5 mm from the top edge
  get zc() {
    return this.z0 + PC.DIMM_SLOT_L / 2;
  },
  names: ["A1", "A2", "B1", "B2"] as const,
  x: (i: number) => dimmSlotX(26, i),
  // a seated stick's bottom edge
  seatY: TOP + PC.DIMM_SLOT_H - PC.DIMM_SEAT,
};

// PCIe: slots run along x; the top x16 is 1 expansion slot below the CPU area.
export const PCIE = {
  x0: -80, // rear end of every slot (towards the I/O)
  x16a: 12, // z of PCIEX16_1
  get x1() {
    return this.x16a + PC.EXPANSION_PITCH;
  },
  get x16b() {
    return this.x16a + 3 * PC.EXPANSION_PITCH;
  },
  get xc() {
    return this.x0 + PC.PCIE_X16_L / 2;
  },
  seatY: TOP + PC.PCIE_SLOT_H - PC.PCIE_SEAT,
};

// GPU model: origin at the bottom centre of its edge fingers. These are offsets from that origin.
export const GPU = {
  fingersFromBracket: 46, // bracket to the first finger
  get bracketX() {
    return -(this.fingersFromBracket + PC.GPU_FINGERS_L / 2);
  },
  socket: [0, 0, 0] as Vec3, // filled below
};
// 12V-2x6 power socket on the top edge, 55 mm from the far end, on the cooler side of the PCB.
GPU.socket = [GPU.bracketX + PC.GPU_L - 55, PC.GPU_H, 7];

export const EPS_SOCKET: Vec3 = [-20, TOP, -146]; // 8-pin CPU power, top edge above the socket
export const EPS_H = 12.8; // housing height

const parts: Record<string, Part> = {
  board: { id: "board", name: "motherboard", label: "ATX motherboard", spec: { kind: "motherboard" } },
  ddr5: { id: "ddr5", name: "DDR5 memory stick", label: "Memory DIMM", detail: "DDR5 · 133.35 mm", spec: { kind: "dimm", variant: "ddr5" } },
  ddr4: {
    id: "ddr4",
    name: "DDR4 stick",
    label: "Memory DIMM",
    detail: "DDR4 · 133.35 mm",
    spec: { kind: "dimm", variant: "ddr4" },
    wrongHint: "That's DDR4. Same length, but its notch sits 1.3 millimetres further over, so it won't go into a DDR5 slot.",
  },
  sodimm: {
    id: "sodimm",
    name: "laptop SO-DIMM",
    label: "Memory SO-DIMM",
    detail: "DDR5 · 69.6 mm",
    spec: { kind: "dimm", variant: "sodimm" },
    wrongHint: "That's a laptop SO-DIMM, about half the length. Desktop slots need the full-size stick.",
  },
  gpu: { id: "gpu", name: "graphics card", label: "Graphics card", detail: "Dual-slot · PCIe x16", spec: { kind: "gpu" } },
  nic: {
    id: "nic",
    name: "network card",
    label: "Expansion card",
    detail: "PCIe x1",
    spec: { kind: "nic" },
    wrongHint: "That's a small x1 network card. This step is the graphics card.",
  },
  plug12v: { id: "plug12v", name: "12V-2x6 power cable", label: "GPU power", detail: "12V-2x6 · 12 pins", spec: { kind: "plug", variant: "12v2x6" } },
  plugPcie8: {
    id: "plugPcie8",
    name: "8-pin PCIe cable",
    label: "GPU power",
    detail: "PCIe 8-pin",
    spec: { kind: "plug", variant: "pcie8" },
    wrongHint: "That's an older 8-pin PCIe plug. This card has a 12V-2x6 socket: twelve small pins.",
  },
  plugEps: {
    id: "plugEps",
    name: "8-pin CPU power cable",
    label: "CPU power",
    detail: "EPS 8-pin",
    spec: { kind: "plug", variant: "eps8" },
    wrongHint: "That's the CPU power cable. The graphics card takes the 12V-2x6 one.",
  },
};

const dimmSpot = (i: number, hint: string) => ({ pos: [DIMM.x(i), DIMM.seatY, DIMM.zc] as Vec3, label: DIMM.names[i], hint });

const RAM_ROT = "Right slot, but the stick is backwards: the notch doesn't line up with the key. Turn it around.";

const placements: Placement[] = [
  {
    id: "ram-a2",
    part: "ddr5",
    decoys: ["ddr4", "sodimm"],
    pos: [DIMM.x(1), DIMM.seatY, DIMM.zc],
    rotY: 0,
    symmetry: 1,
    startRotY: Math.PI, // comes out backwards: line up the notch first
    snap: { kind: "points", radius: PC.DIMM_SLOT_PITCH / 2, stretch: [1, 20] },
    wrongSpots: [
      dimmSpot(0, "That's A1. With two sticks, use A2 and B2: the second and fourth slots from the CPU."),
      dimmSpot(2, "That's B1. Start with A2, the second slot from the CPU."),
      dimmSpot(3, "That's B2, the second stick's slot. Start with A2."),
    ],
    step: 1,
    title: "First stick in A2",
    say: "Step 1. Pick the DDR5 stick and line up its notch with the key in slot A2, the second slot from the CPU. Push straight down until both latches click.",
    stuck: "Slot A2 is the second one from the CPU socket. The notch on the stick sits just off centre: match it to the bump in the slot.",
    rotHint: RAM_ROT,
    done: "Click. Both latches are shut.",
    motion: "insert",
    spawn: [DIMM.x(1) + 52, DIMM.seatY, DIMM.zc + 30],
    latches: ["dimm-1-a", "dimm-1-b"],
    label: "A2",
    focus: { target: [DIMM.x(1) + 4, 14, DIMM.zc + 6], distance: 330 },
  },
  {
    id: "ram-b2",
    part: "ddr5",
    decoys: ["sodimm", "ddr4"],
    pos: [DIMM.x(3), DIMM.seatY, DIMM.zc],
    rotY: 0,
    symmetry: 1,
    startRotY: 0,
    snap: { kind: "points", radius: PC.DIMM_SLOT_PITCH / 2, stretch: [1, 20] },
    wrongSpots: [
      dimmSpot(0, "That's A1. The second stick goes in B2, the slot furthest from the CPU."),
      dimmSpot(2, "That's B1. Skip one: the second stick goes in B2, the last slot."),
    ],
    step: 2,
    title: "Second stick in B2",
    say: "Step 2. The second stick goes in B2, the slot furthest from the CPU. That pairs it with A2 for dual channel.",
    stuck: "B2 is the fourth slot, the one furthest from the CPU. Same notch direction as the first stick.",
    rotHint: RAM_ROT,
    done: "Both sticks in. Dual channel is set.",
    motion: "insert",
    spawn: [DIMM.x(3) + 44, DIMM.seatY, DIMM.zc + 30],
    latches: ["dimm-3-a", "dimm-3-b"],
    label: "B2",
    focus: { target: [DIMM.x(2) + 4, 14, DIMM.zc + 6], distance: 330 },
  },
  {
    id: "gpu",
    part: "gpu",
    decoys: ["nic"],
    pos: [PCIE.xc, PCIE.seatY, PCIE.x16a],
    rotY: 0,
    symmetry: 1,
    startRotY: 0,
    snap: { kind: "points", radius: 9, stretch: [12, 1] },
    wrongSpots: [
      { pos: [PCIE.xc, PCIE.seatY, PCIE.x1], label: "PCIEX1_1", hint: "That's a short x1 slot. The card needs the long x16 slot at the top." },
      { pos: [PCIE.xc, PCIE.seatY, PCIE.x16b], label: "PCIEX16_2", hint: "That's the second x16 slot, which runs at fewer lanes. Use the top one, nearest the CPU." },
    ],
    step: 3,
    title: "Graphics card",
    say: "Step 3. Line the graphics card up with the top x16 slot, metal bracket towards the back of the board, and press down until the slot latch clicks.",
    stuck: "Use the long slot nearest the CPU. The card stands upright with its bracket at the ports end and the fans facing down the board.",
    rotHint: "Turn the card around: the metal bracket goes at the back, by the rear ports.",
    done: "Seated. The retention latch clicked shut.",
    motion: "insert",
    spawn: [PCIE.xc + 40, PCIE.seatY, PCIE.x16a + 95],
    latches: ["pcie-a"],
    label: "PCIEX16_1",
    focus: { target: [30, 55, 25], distance: 760 },
  },
  {
    id: "power",
    part: "plug12v",
    decoys: ["plugPcie8", "plugEps"],
    pos: [PCIE.xc + GPU.socket[0], PCIE.seatY + GPU.socket[1], PCIE.x16a + GPU.socket[2]],
    rotY: 0,
    symmetry: 1,
    startRotY: Math.PI,
    snap: { kind: "points", radius: 22 },
    spawn: [PCIE.xc + GPU.socket[0] + 10, PCIE.seatY + GPU.socket[1], PCIE.x16a + GPU.socket[2] + 55],
    wrongSpots: [{ pos: [EPS_SOCKET[0], TOP + EPS_H, EPS_SOCKET[2]], label: "CPU power", hint: "That's the CPU power socket. The graphics card's socket is on its top edge." }],
    step: 4,
    title: "Power cable",
    say: "Step 4. Plug the 12V-2x6 cable into the socket on the top edge of the card, clip facing the clip, and push until it's fully seated.",
    stuck: "The socket is on the top edge of the graphics card, near the far end. The plug's clip lines up with the ridge on the socket.",
    rotHint: "Flip the plug: the clip has to line up with the latch ridge on the socket.",
    done: "Fully seated, no gap. That's the whole install.",
    motion: "insert",
    focus: { target: [PCIE.xc + GPU.socket[0] - 20, PCIE.seatY + GPU.socket[1] - 25, PCIE.x16a + 20], distance: 380 },
  },
];

export const pc: Pack = {
  id: "pc",
  title: "Install RAM + GPU",
  subtitle: "PC Build · ATX board, DDR5, PCIe x16",
  base: "board",
  parts,
  placements,
  camera: { target: [10, 10, -10], distance: 640, polar: 0.86, azimuth: 0.5, fov: 34, minDistance: 120, maxDistance: 1100 },
  stage: { radius: 330, shadowFar: 180 },
  spawn: [0, 0, 120],
  lift: 40,
  rotateStep: Math.PI,
  labels: [
    // staggered: the slots are only 7.6 mm apart
    ...DIMM.names.map((text, i) => ({ text, pos: [DIMM.x(i), TOP + PC.DIMM_SLOT_H + 2, DIMM.z0 - (i % 2 ? 16 : 6)] as Vec3 })),
    { text: "PCIEX16_1", pos: [PCIE.x0 - 14, TOP + 2, PCIE.x16a] },
    { text: "PCIEX16_2", pos: [PCIE.x0 - 14, TOP + 2, PCIE.x16b] },
  ],
  intro: "Let's practise installing memory and a graphics card. Pick the right part from the tray, then drag it to the glowing outline.",
  finish: { title: "You're ready to build it for real", body: "Memory in A2 and B2, the graphics card in the top x16 slot, and its power cable fully seated." },
};

/** Bracket for a dual-slot card covers two expansion slots. */
export const GPU_BRACKET_W = bracketWidth(PC.BRACKET_SLOTS);
