// Hosts a manual URL is allowed to name. Search and the /manual-pdf rewrites both use this.
// IKEA's product-search API (sik.search.blue.cdtapps.com) is a separate fixed host: it is not
// accepted for any URL that came from a user, a query string, or a page we fetched.

const MANUAL_HOSTS = new Set(["lego.com", "www.lego.com", "ikea.com", "www.ikea.com"]);
const IKEA_SEARCH_HOST = "sik.search.blue.cdtapps.com";

function httpsHost(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  if (host !== url.hostname.toLowerCase()) return null;
  return url;
}

/** True only for https URLs whose host is exactly lego.com or ikea.com (with or without www). */
export function isAllowedManualUrl(raw: string): boolean {
  const url = httpsHost(raw);
  return !!url && MANUAL_HOSTS.has(url.hostname.toLowerCase());
}

/** The one hardcoded IKEA search endpoint. Never use this for a URL built from user input. */
export function isIkeaSearchUrl(raw: string): boolean {
  const url = httpsHost(raw);
  return !!url && url.hostname === IKEA_SEARCH_HOST;
}

/**
 * Same-origin PDF paths that the rewrites may forward.
 * LEGO: `/manual-pdf/lego/<digits>.pdf`. IKEA: an assembly-instructions PDF, nothing else.
 */
export function isSafeManualPdfPath(pathname: string): boolean {
  let path = pathname;
  for (let i = 0; i < 2; i++) {
    try {
      const next = decodeURIComponent(path);
      if (next === path) break;
      path = next;
    } catch {
      return false;
    }
  }
  if (path.includes("\\") || path.includes("@") || path.includes("..") || path.includes("//") || path.includes("\0")) return false;
  if (/^\/manual-pdf\/lego\/\d+\.pdf$/.test(path)) return true;
  return /^\/manual-pdf\/ikea\/[A-Za-z0-9/_\-.]+\/assembly_instructions\/[A-Za-z0-9/_\-.]+\.pdf$/.test(path);
}

/** Turn an allowlisted IKEA PDF URL into a same-origin rewrite path, or null. */
export function ikeaManualPath(pdfUrl: string): string | null {
  if (!isAllowedManualUrl(pdfUrl)) return null;
  const url = new URL(pdfUrl);
  if (url.search || url.hash) return null;
  const local = `/manual-pdf/ikea${url.pathname}`;
  return isSafeManualPdfPath(local) ? local : null;
}
