// Shared clamps for API bodies. Image data URLs are JPEG, PNG, GIF, or WebP only.

const IMAGE_PREFIX = /^data:image\/(jpeg|png|gif|webp);base64,/i;

export function asImage(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 32 || value.length > maxChars) return null;
  if (!IMAGE_PREFIX.test(value)) return null;
  return value;
}

/** Trimmed string, sliced to `max`. Missing or non-strings become "". */
export function asText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/** String list, or undefined when the field was omitted. A non-array becomes an empty list. */
export function asStringList(value: unknown, maxItems: number, maxLen: number): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim().slice(0, maxLen);
    if (text) out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}
