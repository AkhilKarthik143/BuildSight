// Product/manual destinations, including every redirect, must stay on these HTTPS origins.
export function allowedManualUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password && (!u.port || u.port === "443") &&
      ["lego.com", "ikea.com"].some(host => u.hostname === host || u.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

export const IKEA_SEARCH = "https://sik.search.blue.cdtapps.com/us/en/search-result-page";
const allowedDiscovery = (u: URL) => u.origin + u.pathname === IKEA_SEARCH && !u.username && !u.password;

export async function safeSearchFetch(raw: string, init: RequestInit = {}, discovery = false): Promise<Response> {
  let url = new URL(raw);
  for (let hop = 0; hop <= 3; hop++) {
    if (!(discovery ? allowedDiscovery(url) : allowedManualUrl(url.href))) throw new Error("Unsupported search host.");
    const res = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(10_000) });
    if (![301, 302, 303, 307, 308].includes(res.status)) return res;
    const location = res.headers.get("location");
    await res.body?.cancel();
    if (!location) throw new Error("Invalid search redirect.");
    url = new URL(location, url);
  }
  throw new Error("Too many search redirects.");
}

// Bound upstream HTML/JSON too; allowed origins can still return oversized responses.
export async function searchText(response: Response, maxBytes = 4 * 1024 * 1024): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "", bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error("Search response too large."); }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}
