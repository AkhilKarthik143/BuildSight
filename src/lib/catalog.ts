// The browsable catalog, built by scripts/build-catalog.mjs (every item verified to have instructions).

import data from "../data/catalog.json" with { type: "json" };
import { mixed, type CatalogItem } from "./catalogQuery.ts";

export type { CatalogItem, CatalogManual, CatalogResult } from "./catalogQuery.ts";
export { categoriesOf, matches, metaLine, mixed, toResult } from "./catalogQuery.ts";

export const LEGO = mixed(data.lego as CatalogItem[]);
export const IKEA = mixed(data.ikea as CatalogItem[]);
