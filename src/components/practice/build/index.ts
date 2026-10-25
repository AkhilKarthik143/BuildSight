// Builds any practice part as a three.js group, with the given materials (solid, ghost or thumbnail).

import type * as THREE from "three";
import type { PartSpec } from "../engine";
import { barPlate, brick, halfRoundPlate, roundBrick, roundPlate, slope45 } from "./lego";
import type { MaterialFor } from "./materials";
import { dimm, gpu, motherboard, nic, plug } from "./pc";

export function buildPart(spec: PartSpec, mat: MaterialFor): THREE.Group {
  switch (spec.kind) {
    case "legoBrick":
      return brick(spec.studsX, spec.studsZ, spec.plates, spec.color, mat);
    case "legoRoundBrick":
      return roundBrick(spec.color, mat);
    case "legoRoundPlate":
      return roundPlate(spec.studs, spec.color, !!spec.hole, mat);
    case "legoHalfRound":
      return halfRoundPlate(spec.studs, spec.color, mat);
    case "legoSlope45":
      return slope45(spec.color, mat);
    case "legoBarPlate":
      return barPlate(spec.color, mat);
    case "motherboard":
      return motherboard(mat);
    case "dimm":
      return dimm(spec.variant, mat);
    case "gpu":
      return gpu(mat);
    case "nic":
      return nic(mat);
    case "plug":
      return plug(spec.variant, mat);
  }
}
