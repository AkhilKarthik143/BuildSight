import type { Pack } from "../engine";
import { parrot } from "./parrot";
import { pc } from "./pc";

export const PACKS = { parrot, pc } satisfies Record<string, Pack>;
export type PackId = keyof typeof PACKS;
