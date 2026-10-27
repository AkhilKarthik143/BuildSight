// Runtime validation at the HTTP boundary. All images remain inline, never fetched URLs.
export function isImage(value: unknown, max = 4_000_000): value is string {
  if (typeof value !== "string" || value.length > max) return false;
  const comma = value.indexOf(",");
  return /^data:image\/(jpeg|png|webp|gif);base64$/.test(value.slice(0, comma)) &&
    comma >= 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value.slice(comma + 1));
}
export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const optionalText = (v: unknown, max: number) => v === undefined || text(v, max);
const strings = (v: unknown, count: number, max: number) => v === undefined || (Array.isArray(v) && v.length <= count && v.every(s => text(s, max)));
const optionalImage = (v: unknown) => v === undefined || isImage(v);
const parts = (v: unknown) => v === undefined || (Array.isArray(v) && v.length <= 24 && v.every(p => isRecord(p) && text(p.description, 120) && typeof p.qty === "number" && Number.isFinite(p.qty)));

export function validApiInput(route: string, v: unknown): v is Record<string, unknown> {
  if (!isRecord(v)) return false;
  switch (route) {
    case "extract": return isImage(v.page, 6_000_000);
    case "vision": return isImage(v.image) && optionalText(v.question, 4000);
    case "locate": return isImage(v.image) && text(v.part, 120) && !!(v.part as string).trim() && parts(v.parts);
    case "tts": return typeof v.text === "string" && !!v.text.trim() && v.text.length <= 16_000;
    case "check": return isImage(v.frame) && isImage(v.expected) && optionalImage(v.previous) && optionalText(v.instruction, 4000) && strings(v.watchFor, 24, 500) && parts(v.parts);
    case "where-am-i": return isImage(v.frame) && (v.complete === undefined || typeof v.complete === "boolean") &&
      Array.isArray(v.sheets) && v.sheets.length > 0 && v.sheets.length <= 8 && v.sheets.every(s => isRecord(s) && isImage(s.image) &&
        Array.isArray(s.numbers) && s.numbers.length > 0 && s.numbers.length <= 20 && s.numbers.every(n => Number.isSafeInteger(n) && n > 0 && n <= 160));
    case "assist": {
      const s = v.step;
      return text(v.question, 4000) && !!(v.question as string).trim() && optionalImage(v.frame) && optionalText(v.manual, 500) &&
        (v.format === undefined || v.format === "text" || v.format === "json") &&
        (v.history === undefined || (Array.isArray(v.history) && v.history.length <= 32 && v.history.every(t => isRecord(t) &&
          (t.role === "user" || t.role === "assistant") && text(t.text, 4000)))) &&
        (s === undefined || (isRecord(s) && (text(s.number, 40) || (typeof s.number === "number" && Number.isFinite(s.number))) &&
          text(s.instruction, 4000) && strings(s.parts, 24, 200) && strings(s.watchFor, 24, 500) && optionalText(s.selectedPart, 200)));
    }
    default: return true;
  }
}
