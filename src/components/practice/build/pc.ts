// PC hardware geometry in real millimetres. Sizes come from dims.ts; board layout from packs/pc.ts.
// Board: lies flat, centred on the origin, x across the 244 mm side (I/O at -x), z along 305 mm (top edge at -z).
// DIMM: long axis z, standing up from y = 0, key notch at +offset for rotation 0.
// GPU: origin at the bottom centre of the edge fingers; bracket at -x, fans facing +z.
// Plug: origin at the centre of its mating face; clip on +z.

import * as THREE from "three";
import { PC, bracketWidth } from "../dims";
import { DIMM, EPS_H, EPS_SOCKET, GPU, PCIE } from "../packs/pc";
import type { MaterialFor } from "./materials";

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, name?: string) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

/** A box by its min/max corners (mm). */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: THREE.Material, name?: string) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return mesh(g, mat, name);
}

/** A rounded, bevelled slab from a footprint rectangle (x0..x1, z0..z1), y0..y1. */
function slab(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, mat: THREE.Material, r = 1.5, bevel = 0.5) {
  const w = x1 - x0 - 2 * bevel;
  const d = z1 - z0 - 2 * bevel;
  const s = new THREE.Shape();
  const rr = Math.min(r, w / 2, d / 2);
  s.moveTo(-w / 2 + rr, -d / 2);
  s.lineTo(w / 2 - rr, -d / 2);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + rr);
  s.lineTo(w / 2, d / 2 - rr);
  s.quadraticCurveTo(w / 2, d / 2, w / 2 - rr, d / 2);
  s.lineTo(-w / 2 + rr, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - rr);
  s.lineTo(-w / 2, -d / 2 + rr);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + rr, -d / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, y1 - y0 - 2 * bevel), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, bevel);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y0, (z0 + z1) / 2);
  return mesh(g, mat);
}

/** Many copies of one box (fins, pins, pads). */
function boxes(size: [number, number, number], centres: [number, number, number][], mat: THREE.Material, name?: string) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(...size), mat, centres.length);
  const m = new THREE.Matrix4();
  centres.forEach((c, i) => im.setMatrixAt(i, m.makeTranslation(c[0], c[1], c[2])));
  im.castShadow = im.receiveShadow = true;
  if (name) im.name = name;
  return im;
}

/** A shape drawn in a vertical plane: u along z, v up; extruded `t` thick along x, centred on x = 0. */
function sidePlate(shape: THREE.Shape, t: number, mat: THREE.Material, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, t - 2 * bevel), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 8 });
  g.translate(0, 0, -(t - 2 * bevel) / 2);
  g.rotateY(-Math.PI / 2); // shape x (u) -> z, extrusion -> x
  return mesh(g, mat);
}

/** A shape drawn in the x/y plane, extruded `t` along z starting at z0. */
function frontPlate(shape: THREE.Shape, z0: number, t: number, mat: THREE.Material, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, t - 2 * bevel), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 48 });
  g.translate(0, 0, z0 + bevel);
  return mesh(g, mat);
}

// ---------- latches: pivot groups the scene animates (userData.open = open angle) ----------

function latch(name: string, axis: "x" | "z", open: number, at: THREE.Vector3, size: [number, number, number], mat: THREE.Material) {
  const pivot = new THREE.Group();
  pivot.name = name;
  pivot.position.copy(at);
  pivot.userData = { open, axis };
  const tab = box(-size[0] / 2, 0, -size[2] / 2, size[0] / 2, size[1], size[2] / 2, mat);
  pivot.add(tab);
  // a small grip ridge on top
  pivot.add(box(-size[0] / 2, size[1] - 1.2, -size[2] / 2 - 0.6, size[0] / 2, size[1], size[2] / 2 + 0.6, mat));
  return pivot;
}

// ---------- motherboard ----------

export function motherboard(mat: MaterialFor) {
  const g = new THREE.Group();
  const W = PC.ATX_W;
  const L = PC.ATX_L;
  const T = PC.PCB_T;

  // PCB with real mounting holes
  const s = new THREE.Shape();
  const r = 3;
  const hw = W / 2 - 0.3;
  const hl = L / 2 - 0.3;
  s.moveTo(-hw + r, -hl);
  s.lineTo(hw - r, -hl);
  s.quadraticCurveTo(hw, -hl, hw, -hl + r);
  s.lineTo(hw, hl - r);
  s.quadraticCurveTo(hw, hl, hw - r, hl);
  s.lineTo(-hw + r, hl);
  s.quadraticCurveTo(-hw, hl, -hw, hl - r);
  s.lineTo(-hw, -hl + r);
  s.quadraticCurveTo(-hw, -hl, -hw + r, -hl);
  const holes: [number, number][] = [[-114, -145], [0, -145], [114, -145], [-114, 6], [114, 6], [-114, 145], [0, 145], [114, 145]];
  for (const [x, z] of holes) {
    const p = new THREE.Path();
    p.absarc(x, -z, 1.98, 0, Math.PI * 2, true);
    s.holes.push(p);
  }
  const pcb = new THREE.ExtrudeGeometry(s, { depth: T - 0.6, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 1, curveSegments: 16 });
  pcb.translate(0, 0, 0.3);
  pcb.rotateX(-Math.PI / 2);
  g.add(mesh(pcb, mat("pcb"), "pcb"));
  for (const [x, z] of holes) {
    const ring = new THREE.RingGeometry(1.98, 3.6, 28);
    ring.rotateX(-Math.PI / 2);
    ring.translate(x, T + 0.02, z);
    g.add(mesh(ring, mat("gold")));
  }

  // rear I/O shroud with a thin light line
  g.add(slab(-121, -151, -98, -62, T, T + 36, mat("shroud"), 3, 0.8));
  g.add(box(-98.6, T + 6, -146, -98.2, T + 30, -66, mat("light")));

  // VRM heatsinks: finned, anodised
  g.add(slab(-96, -151, -40, -131, T, T + 6, mat("metalDark"), 1, 0.4));
  g.add(boxes([1.2, 18, 19], Array.from({ length: 13 }, (_, i) => [-93 + i * 4.3, T + 6 + 9, -141] as [number, number, number]), mat("metalDark")));
  g.add(slab(-96, -126, -80, -64, T, T + 6, mat("metalDark"), 1, 0.4));
  g.add(boxes([15, 18, 1.2], Array.from({ length: 14 }, (_, i) => [-88, T + 6 + 9, -123 + i * 4.3] as [number, number, number]), mat("metalDark")));
  // solid capacitors along the VRM
  const capGeo = new THREE.CylinderGeometry(2.5, 2.5, 7, 20);
  capGeo.translate(0, T + 3.5, 0);
  const caps = new THREE.InstancedMesh(capGeo, mat("metal"), 16);
  const cm = new THREE.Matrix4();
  for (let i = 0; i < 8; i++) caps.setMatrixAt(i, cm.makeTranslation(-90 + i * 6.5, 0, -126));
  for (let i = 0; i < 8; i++) caps.setMatrixAt(8 + i, cm.makeTranslation(-75, 0, -118 + i * 6.5));
  caps.castShadow = true;
  g.add(caps);

  // CPU socket (LGA): plastic base, steel load frame, lever, protective cap
  const cx = -30;
  const cz = -85;
  g.add(box(cx - 26, T, cz - 31, cx + 26, T + 4, cz + 31, mat("plastic")));
  const frame = new THREE.Shape();
  frame.moveTo(-25, -30);
  frame.lineTo(25, -30);
  frame.lineTo(25, 30);
  frame.lineTo(-25, 30);
  frame.closePath();
  const win = new THREE.Path();
  win.moveTo(-19, -23);
  win.lineTo(-19, 23);
  win.lineTo(19, 23);
  win.lineTo(19, -23);
  win.closePath();
  frame.holes.push(win);
  const fg = new THREE.ExtrudeGeometry(frame, { depth: 1.2, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 1 });
  fg.rotateX(-Math.PI / 2);
  fg.translate(cx, T + 4, cz);
  g.add(mesh(fg, mat("steel")));
  g.add(box(cx - 18, T + 4, cz - 22, cx + 18, T + 6.2, cz + 22, mat("plastic")));
  const lever = new THREE.CylinderGeometry(0.9, 0.9, 58, 12);
  lever.rotateX(Math.PI / 2);
  lever.translate(cx + 28, T + 5, cz);
  g.add(mesh(lever, mat("steel")));
  g.add(box(cx + 27, T + 4.2, cz + 28, cx + 33, T + 5.8, cz + 30, mat("steel")));

  // EPS 8-pin CPU power socket
  const [ex, , ez] = EPS_SOCKET;
  g.add(slab(ex - 9.2, ez - 4.8, ex + 9.2, ez + 4.8, T, T + EPS_H, mat("plastic"), 0.6, 0.3));
  g.add(boxes([3.4, 0.2, 3.4], Array.from({ length: 8 }, (_, i) => [ex - 6.3 + (i % 4) * 4.2, T + EPS_H + 0.05, ez - 2.1 + Math.floor(i / 4) * 4.2] as [number, number, number]), mat("chip")));

  // DIMM slots: housing, dark groove, key bump, hinged latches at both ends
  for (let i = 0; i < 4; i++) {
    const x = DIMM.x(i);
    const z0 = DIMM.z0;
    const z1 = z0 + PC.DIMM_SLOT_L;
    const w = PC.DIMM_SLOT_W / 2;
    const h = T + PC.DIMM_SLOT_H;
    g.add(slab(x - w, z0 + 7, x + w, z1 - 7, T, h, mat("plasticGray"), 0.6, 0.3));
    g.add(box(x - 0.9, h - 0.05, z0 + 8, x + 0.9, h + 0.02, z1 - 8, mat("chip")));
    g.add(box(x - 0.8, h - 1.6, DIMM.zc + PC.DDR5_KEY_OFFSET - 0.7, x + 0.8, h + 0.04, DIMM.zc + PC.DDR5_KEY_OFFSET + 0.7, mat("plasticGray"), `dimm-${i}-key`));
    g.add(latch(`dimm-${i}-a`, "x", -0.55, new THREE.Vector3(x, T, z0 + 6.5), [PC.DIMM_SLOT_W - 0.4, 10.5, 4.5], mat("plasticGray")));
    g.add(latch(`dimm-${i}-b`, "x", 0.55, new THREE.Vector3(x, T, z1 - 6.5), [PC.DIMM_SLOT_W - 0.4, 10.5, 4.5], mat("plasticGray")));
  }

  // 24-pin ATX power
  g.add(slab(108, -72, 118.5, -19.5, T, T + 12.5, mat("plastic"), 0.6, 0.3));
  g.add(boxes([3.4, 0.2, 3.4], Array.from({ length: 24 }, (_, i) => [110.9 + (i % 2) * 4.2, T + 12.55, -69.4 + Math.floor(i / 2) * 4.2] as [number, number, number]), mat("chip")));

  // PCIe slots: steel-armoured x16 with an end latch, an x1, a plain x16
  const slot = (z: number, len: number, armour: boolean, name: string) => {
    const x0 = PCIE.x0;
    const w = PC.PCIE_SLOT_W / 2;
    const h = T + PC.PCIE_SLOT_H;
    g.add(slab(x0, z - w, x0 + len, z + w, T, h, mat(armour ? "steel" : "plastic"), 0.6, 0.3));
    g.add(box(x0 + 1.5, h - 0.05, z - 0.95, x0 + len - 1.5, h + 0.03, z + 0.95, mat("chip"), name));
  };
  slot(PCIE.x16a, PC.PCIE_X16_L, true, "pcie-x16a");
  slot(PCIE.x1, PC.PCIE_X1_L, false, "pcie-x1");
  slot(PCIE.x16b, PC.PCIE_X16_L, false, "pcie-x16b");
  g.add(latch("pcie-a", "z", -0.6, new THREE.Vector3(PCIE.x0 + PC.PCIE_X16_L + 2.2, T, PCIE.x16a), [4.2, 12.5, PC.PCIE_SLOT_W - 0.6], mat("plasticGray")));

  // chipset and M.2 heatsinks
  g.add(slab(45, 82, 100, 130, T, T + 9, mat("metalDark"), 4, 1));
  g.add(slab(52, 90, 93, 122, T + 9, T + 9.6, mat("metal"), 2, 0.2));
  g.add(slab(-72, 94, 12, 110, T, T + 6, mat("metalDark"), 2, 0.6));
  g.add(box(-70, T + 6, 101.6, 10, T + 6.15, 102.4, mat("light")));

  g.name = "motherboard";
  return g;
}

// ---------- memory sticks ----------

export function dimm(variant: "ddr5" | "ddr4" | "sodimm", mat: MaterialFor) {
  const g = new THREE.Group();
  const sodimm = variant === "sodimm";
  const L = sodimm ? PC.SODIMM_L : PC.DIMM_L;
  const H = sodimm ? PC.SODIMM_H : PC.DIMM_H;
  const key = variant === "ddr4" ? PC.DDR4_KEY_OFFSET : sodimm ? -8.0 : PC.DDR5_KEY_OFFSET;
  const kw = PC.KEY_W / 2;
  const kd = PC.KEY_DEPTH;
  const c = 1.0; // chamfered bottom corners

  // PCB outline in (u = along the stick, v = up): key notch at the bottom, latch notches at both ends
  const s = new THREE.Shape();
  const hl = L / 2;
  const n0 = sodimm ? 11 : 15;
  const n1 = n0 + 3.5;
  s.moveTo(-hl + c, 0);
  s.lineTo(key - kw, 0);
  s.lineTo(key - kw, kd);
  s.absarc(key, kd, kw, Math.PI, 0, true);
  s.lineTo(key + kw, 0);
  s.lineTo(hl - c, 0);
  s.lineTo(hl, c);
  s.lineTo(hl, n0);
  s.lineTo(hl - 2.2, n0 + 0.8);
  s.lineTo(hl - 2.2, n1 - 0.8);
  s.lineTo(hl, n1);
  s.lineTo(hl, H);
  s.lineTo(-hl, H);
  s.lineTo(-hl, n1);
  s.lineTo(-hl + 2.2, n1 - 0.8);
  s.lineTo(-hl + 2.2, n0 + 0.8);
  s.lineTo(-hl, n0);
  s.lineTo(-hl, c);
  s.closePath();
  g.add(sidePlate(s, PC.DIMM_PCB_T, mat(sodimm ? "pcbGreen" : "pcb"), 0));

  // gold contacts on both faces, 0.85 mm pitch, none across the key
  const pads: [number, number, number][] = [];
  const t = PC.DIMM_PCB_T / 2 + 0.03;
  for (let u = -hl + 3.2; u <= hl - 3.2; u += 0.85) {
    if (Math.abs(u - key) < kw + 0.6) continue;
    pads.push([t, 1.9, u], [-t, 1.9, u]);
  }
  g.add(boxes([0.06, 3.4, 0.6], pads, mat("gold"), "contacts"));

  if (sodimm) {
    for (let i = 0; i < 4; i++) g.add(box(0.5, 9, -hl + 8 + i * 14, 1.6, 21, -hl + 19 + i * 14, mat("chip")));
  } else {
    // aluminium heatspreader on each face, with a stepped top edge; total thickness 7.2 mm
    const spread = (PC.DIMM_HEATSPREADER_T - PC.DIMM_PCB_T) / 2;
    const hs = new THREE.Shape();
    hs.moveTo(-hl + 1, 5.6);
    hs.lineTo(hl - 1, 5.6);
    hs.lineTo(hl - 1, H - 3);
    hs.lineTo(hl - 9, H - 0.4);
    hs.lineTo(hl * 0.25, H - 0.4);
    hs.lineTo(hl * 0.18, H - 2.4);
    hs.lineTo(-hl + 9, H - 2.4);
    hs.lineTo(-hl + 1, H - 3);
    hs.closePath();
    const metal = mat(variant === "ddr5" ? "metal" : "metalDark");
    for (const side of [1, -1]) {
      const plate = sidePlate(hs, spread, metal, 0.35);
      plate.position.x = side * (PC.DIMM_PCB_T / 2 + spread / 2);
      g.add(plate);
    }
    // label sticker on the front face
    g.add(box(PC.DIMM_HEATSPREADER_T / 2, 12, -hl + 18, PC.DIMM_HEATSPREADER_T / 2 + 0.05, 20, -hl + 62, mat("plasticGray")));
    g.add(box(-0.45, H - 0.6, -hl + 1.5, 0.45, H, hl - 1.5, mat("light")));
  }
  g.name = `dimm-${variant}`;
  return g;
}

// ---------- graphics card ----------

function fan(mat: MaterialFor) {
  const g = new THREE.Group();
  const hub = new THREE.CylinderGeometry(15, 15, 5, 40);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, mat("fan")));
  const cap = new THREE.CircleGeometry(13, 40);
  cap.translate(0, 0, 2.55);
  g.add(mesh(cap, mat("plasticGray")));
  const ring = new THREE.RingGeometry(13.2, 13.9, 48);
  ring.translate(0, 0, 2.6);
  g.add(mesh(ring, mat("light")));
  // swept blades
  const b = new THREE.Shape();
  b.moveTo(14, -3);
  b.quadraticCurveTo(30, -10, 42, -2);
  b.quadraticCurveTo(43, 6, 40, 11);
  b.quadraticCurveTo(28, 4, 14, 5);
  b.closePath();
  const blade = new THREE.ExtrudeGeometry(b, { depth: 1.1, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 1, curveSegments: 10 });
  blade.translate(0, 0, -0.55);
  for (let i = 0; i < 9; i++) {
    const m = mesh(blade, mat("fan"));
    const pitch = new THREE.Group();
    pitch.add(m);
    pitch.rotation.z = (i / 9) * Math.PI * 2;
    m.rotation.set(0.28, 0, 0);
    g.add(pitch);
  }
  const frame = new THREE.TorusGeometry(44.5, 1.4, 10, 64);
  g.add(mesh(frame, mat("shroud")));
  return g;
}

export function gpu(mat: MaterialFor) {
  const g = new THREE.Group();
  const bx = GPU.bracketX;
  const x1 = bx + PC.GPU_L;
  const top = PC.GPU_H;
  const fl = PC.GPU_FINGERS_L / 2;

  // PCB with the x16 edge (key notch 11.65 mm from the rear end of the fingers)
  const p = new THREE.Shape();
  const pcbEnd = bx + 268;
  const notch = -fl + 11.65;
  p.moveTo(bx + 3, 6);
  p.lineTo(-fl - 2, 6);
  p.lineTo(-fl, 0);
  p.lineTo(notch - 0.8, 0);
  p.lineTo(notch - 0.8, 7);
  p.lineTo(notch + 0.8, 7);
  p.lineTo(notch + 0.8, 0);
  p.lineTo(fl, 0);
  p.lineTo(fl + 2, 6);
  p.lineTo(pcbEnd, 6);
  p.lineTo(pcbEnd, 112);
  p.lineTo(bx + 3, 112);
  p.closePath();
  g.add(frontPlate(p, -0.785, 1.57, mat("pcb")));
  const pads: [number, number, number][] = [];
  for (let x = -fl + 1; x <= fl - 1; x += 1.0) {
    if (Math.abs(x - notch) < 1.4) continue;
    pads.push([x, 3.6, 0.82], [x, 3.6, -0.82]);
  }
  g.add(boxes([0.7, 6.4, 0.06], pads, mat("gold"), "fingers"));

  // fin stack and heatpipes behind the fans
  const fins: [number, number, number][] = [];
  for (let x = bx + 10; x < x1 - 8; x += 2.1) fins.push([x, 63, 17.5]);
  g.add(boxes([0.35, 98, 25], fins, mat("metal"), "fins"));
  for (let i = 0; i < 4; i++) {
    const pipe = new THREE.CylinderGeometry(3, 3, PC.GPU_L - 30, 16);
    pipe.rotateZ(Math.PI / 2);
    pipe.translate(bx + PC.GPU_L / 2 + 5, 20 + i * 27, 6);
    g.add(mesh(pipe, mat("copper")));
  }

  // shroud: front plate with fan openings, top and bottom rails (cut away round the power socket)
  const fanX = [bx + PC.GPU_L * 0.31, bx + PC.GPU_L * 0.71];
  const fy = 66;
  // drawn 0.8 mm inside the final outline: the bevel grows it back
  const e = 0.8;
  const sh = new THREE.Shape();
  sh.moveTo(bx + 4 + e, 8 + e);
  sh.lineTo(x1 - 14, 8 + e);
  sh.lineTo(x1 - e, 22);
  sh.lineTo(x1 - e, top - 14);
  sh.lineTo(x1 - 14, top - e);
  sh.lineTo(bx + 4 + e, top - e);
  sh.closePath();
  for (const x of fanX) {
    const h = new THREE.Path();
    h.absarc(x, fy, 46 + e, 0, Math.PI * 2, true);
    sh.holes.push(h);
  }
  g.add(frontPlate(sh, PC.GPU_T - 4 - 4, 4, mat("shroud"), 0.8));
  const front = PC.GPU_T - 4;
  g.add(box(bx + 4, top - 4, 12, x1 - 14, top - 0.4, front - 3, mat("shroud")));
  g.add(box(bx + 4, 8, 4, x1 - 14, 12, front - 3, mat("shroud")));
  g.add(box(x1 - 4, 22, 4, x1, top - 14, front - 3, mat("shroud")));
  // silver trim and a light line along the bottom
  g.add(box(bx + 20, top - 0.4, 14, x1 - 30, top, front - 5, mat("metal")));
  g.add(box(bx + 30, 10, front - 0.3, x1 - 40, 11.6, front + 0.02, mat("light")));
  for (const x of fanX) {
    const f = fan(mat);
    f.position.set(x, fy, front - 6);
    g.add(f);
  }

  // backplate
  const bp = new THREE.Shape();
  bp.moveTo(bx + 4, 6);
  bp.lineTo(pcbEnd, 6);
  bp.lineTo(pcbEnd, 112);
  bp.lineTo(bx + 4, 112);
  bp.closePath();
  g.add(frontPlate(bp, -4.0, 2.4, mat("metalDark"), 0.4));
  g.add(boxes([60, 1.6, 0.04], Array.from({ length: 10 }, (_, i) => [bx + 200, 22 + i * 8, -3.99] as [number, number, number]), mat("chip")));

  // I/O bracket: 120 mm tall, two slots wide, with a bent screw tab and the display outputs
  const bw = bracketWidth(PC.BRACKET_SLOTS);
  const z0 = -3;
  const br = new THREE.Shape();
  br.moveTo(z0 + 9, -18);
  br.lineTo(z0 + 19, -18);
  br.lineTo(z0 + 19, -6);
  br.lineTo(z0 + bw, -6);
  br.lineTo(z0 + bw, PC.BRACKET_H - 18);
  br.lineTo(z0, PC.BRACKET_H - 18);
  br.lineTo(z0, -6);
  br.lineTo(z0 + 9, -6);
  br.closePath();
  const plate = sidePlate(br, PC.BRACKET_T, mat("steel"));
  plate.position.x = bx - PC.BRACKET_T / 2;
  g.add(plate);
  g.add(box(bx - 11, PC.BRACKET_H - 18, z0, bx, PC.BRACKET_H - 18 + PC.BRACKET_T, z0 + bw, mat("steel")));
  const ports: [number, number][] = [[14, 16], [34, 16], [54, 16], [76, 14]];
  for (const [y, len] of ports) {
    g.add(box(bx - 2.2, y - len / 2, 2.5, bx - PC.BRACKET_T, y + len / 2, 11, mat("steel")));
    g.add(box(bx - 2.3, y - len / 2 + 1, 3.5, bx - 2.2, y + len / 2 - 1, 10, mat("chip")));
  }
  g.add(boxes([0.3, 3, 14], Array.from({ length: 12 }, (_, i) => [bx - PC.BRACKET_T - 0.1, 2 + i * 7.5, z0 + bw - 10] as [number, number, number]), mat("chip")));

  // 12V-2x6 power socket on the top edge
  const [sx, sy, sz] = GPU.socket;
  g.add(slab(sx - 9.4, sz - 3.8, sx + 9.4, sz + 3.8, sy - 12, sy, mat("plastic"), 0.5, 0.25));
  g.add(box(sx - 2.5, sy - 4, sz + 3.6, sx + 2.5, sy - 0.6, sz + 4.8, mat("plastic"), "socket-ridge"));
  g.add(boxes([2.2, 0.2, 2.2], Array.from({ length: 12 }, (_, i) => [sx - 7.5 + (i % 6) * 3.0, sy - 0.09, sz - 1.5 + Math.floor(i / 6) * 3.0] as [number, number, number]), mat("chip")));

  g.name = "gpu";
  return g;
}

/** PCIe x1 network card (decoy): small green board, single-slot bracket, one network port. */
export function nic(mat: MaterialFor) {
  const g = new THREE.Group();
  const p = new THREE.Shape();
  p.moveTo(-30, 5);
  p.lineTo(-12, 5);
  p.lineTo(-12, 0);
  p.lineTo(-3, 0);
  p.lineTo(-3, 5);
  p.lineTo(40, 5);
  p.lineTo(40, 60);
  p.lineTo(-30, 60);
  p.closePath();
  g.add(frontPlate(p, -0.8, 1.6, mat("pcbGreen")));
  g.add(boxes([0.7, 4, 0.06], Array.from({ length: 8 }, (_, i) => [-11 + i * 1.0, 2.5, 0.83] as [number, number, number]), mat("gold")));
  g.add(box(4, 20, 0.8, 20, 36, 3.5, mat("chip")));
  const br = new THREE.Shape();
  br.moveTo(-2, -12);
  br.lineTo(16.4, -12);
  br.lineTo(16.4, 102);
  br.lineTo(-2, 102);
  br.closePath();
  const plate = sidePlate(br, PC.BRACKET_T, mat("steel"));
  plate.position.x = -32;
  g.add(plate);
  g.add(box(-31.6, 30, 1, -18, 44, 14, mat("metal")));
  g.name = "nic";
  return g;
}

// ---------- power plugs ----------

export function plug(variant: "12v2x6" | "pcie8" | "eps8", mat: MaterialFor) {
  const g = new THREE.Group();
  const twelve = variant === "12v2x6";
  const cols = twelve ? 6 : 4;
  const pitch = twelve ? PC.PIN_PITCH_12V2X6 : PC.PIN_PITCH_PCIE8;
  const w = cols * pitch + 0.85;
  const d = 2 * pitch + (twelve ? 1.6 : 1.2);
  const h = twelve ? 12 : 15;
  g.add(slab(-w / 2, -d / 2, w / 2, d / 2, 0, h, mat("plastic"), 0.6, 0.3));
  // the latch clip on +z (EPS has it on the other side, plus a different key)
  const clipZ = variant === "eps8" ? -1 : 1;
  g.add(box(-2.4, 2, clipZ * (d / 2), 2.4, h - 1, clipZ * (d / 2 + 1.4), mat("plastic"), "clip"));
  g.add(box(-2.4, 1.2, clipZ * (d / 2 + 1.1), 2.4, 2.6, clipZ * (d / 2 + 2.1), mat("plastic")));
  // pin openings on the mating face
  const holes: [number, number, number][] = [];
  for (let i = 0; i < cols * 2; i++) holes.push([-((cols - 1) * pitch) / 2 + (i % cols) * pitch, -0.05, (Math.floor(i / cols) - 0.5) * pitch]);
  g.add(boxes([pitch * 0.62, 0.12, pitch * 0.62], holes, mat("chip")));
  // the cable: a sleeved bundle rising, then curving away
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, h - 1, 0),
    new THREE.Vector3(0, h + 14, 0),
    new THREE.Vector3(8, h + 34, 0),
    new THREE.Vector3(34, h + 46, 0),
    new THREE.Vector3(80, h + 52, 0),
  ]);
  g.add(mesh(new THREE.TubeGeometry(path, 48, twelve ? 4.2 : 5, 14, false), mat("fan"), "cable"));
  g.name = `plug-${variant}`;
  return g;
}
