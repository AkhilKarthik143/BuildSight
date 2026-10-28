// Pure catalog helpers. No catalog.json import, so tests can load this file under node.

export type CatalogManual = { label: string; size?: string; pdfPath: string; coverUrl?: string };

export type CatalogItem = {
  id: string;
  source: "lego" | "ikea";
  name: string;
  category: string;
  image: string;
  manuals: CatalogManual[];
  set?: string;
  age?: string;
  pieces?: number;
  year?: number;
  itemNo?: string;
  featured?: boolean;
};

export type CatalogResult = {
  source: "lego" | "ikea";
  title: string;
  subtitle: string;
  coverUrl?: string;
  pdfPath: string;
  sizeLabel?: string;
};

const ORDER = [
  "Creator", "City", "Technic", "Star Wars", "Harry Potter", "Minecraft", "Friends", "Icons", "Botanicals", "Ideas", "Architecture", "Speed Champions", "Classic",
  "Tables & desks", "Storage", "Seating", "Beds", "Kids",
];
const rank = (c: string) => (ORDER.includes(c) ? ORDER.indexOf(c) : ORDER.length);

export function categoriesOf(items: CatalogItem[]): string[] {
  return [...new Set(items.map((i) => i.category))].sort((a, b) => rank(a) - rank(b));
}

// Interleaves categories so "All" opens on a mix (a Creator set, a City set, a Technic set…).
export function mixed(all: CatalogItem[]): CatalogItem[] {
  const featured = all.filter((i) => i.featured);
  const items = all.filter((i) => !i.featured);
  const groups = categoriesOf(items).map((c) => items.filter((i) => i.category === c));
  const out: CatalogItem[] = [...featured];
  for (let row = 0; out.length < all.length; row++) for (const g of groups) if (g[row]) out.push(g[row]);
  return out;
}

export function matches(item: CatalogItem, q: string): boolean {
  const text = `${item.name} ${item.category} ${item.set ?? ""} ${item.itemNo ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => text.includes(w));
}

export function metaLine(item: CatalogItem): string {
  if (item.source === "lego") return [item.set && `#${item.set}`, item.pieces && `${item.pieces.toLocaleString()} pcs`, item.age].filter(Boolean).join(" · ");
  return item.manuals.length > 1 ? `${item.manuals.length} manuals` : "Assembly manual";
}

export function toResult(item: CatalogItem, manual: CatalogManual): CatalogResult {
  const brand = item.source === "lego" ? `LEGO ${item.set}` : `IKEA ${item.itemNo}`;
  return {
    source: item.source,
    title: item.name,
    subtitle: item.manuals.length > 1 ? `${brand} · ${manual.label}` : brand,
    coverUrl: item.image,
    pdfPath: manual.pdfPath,
    sizeLabel: manual.size,
  };
}
