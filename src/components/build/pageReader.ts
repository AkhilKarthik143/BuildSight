import type { ExtractedStep } from "@/app/api/extract/route";
import { limiter } from "@/lib/limiter";
import { getPageSteps,savePageSteps,type Manual } from "@/lib/manuals";
import { openManualPdf,renderPage } from "@/lib/pdf";
import type { Prebuilt } from "@/lib/prebuilt";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { withGrid } from "./images";
const MAX_PARALLEL = 3;
// Where page images come from: pre-read images when we have them, otherwise the PDF (opened only if needed).
export type PageSource = { numPages: number; prebuilt: Prebuilt | null; render: (page: number) => Promise<string> };

export function makeSource(m: Manual, prebuilt: Prebuilt | null, numPages: number, doc?: PDFDocumentProxy): PageSource {
  let pdf: Promise<PDFDocumentProxy> | null = doc ? Promise.resolve(doc) : null;
  return {
    numPages,
    prebuilt,
    render: (page) =>
      prebuilt?.pages[String(page)]?.length
        ? Promise.resolve(`/steps/${prebuilt.id}/${page}.jpg`)
        : (pdf ??= openManualPdf(m)).then((d) => renderPage(d, page, 1000, 0.7)),
  };
}

type PageJob = { image: () => Promise<string>; steps: Promise<ExtractedStep[]> };

// Renders and reads pages, each at most once: shared by the current page and the read-ahead.
export function pageReader(manualId: string, source: PageSource) {
  const jobs = new Map<number, PageJob>();
  const read = new Map<number, ExtractedStep[]>(); // pages whose steps are known, for "where am I?"
  const limit = limiter(MAX_PARALLEL);
  const readPage = (page: number): PageJob => {
    const existing = jobs.get(page);
    if (existing) return existing;
    let rendered: Promise<string> | null = null;
    const image = () => (rendered ??= source.render(page));
    const steps = (async () => {
      const cached = await getPageSteps<ExtractedStep>(manualId, page);
      if (cached) return cached;
      const pre = source.prebuilt?.pages[String(page)];
      if (pre) {
        await savePageSteps(manualId, page, pre);
        return pre;
      }
      const pageImage = await image();
      const data = await limit(async () => {
        const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: await withGrid(pageImage) }) });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Couldn't read that page.");
        return body;
      });
      await savePageSteps(manualId, page, data.steps);
      return data.steps as ExtractedStep[];
    })();
    // Continuation pages: a page with no printed step number, or one whose number is lower than the
    // previous page's (step numbers only go up, so a lower one is a panel number from a sub-build),
    // continues the previous page's last step and takes its number.
    const numbered = steps.then(async (found) => {
      if (page < 2 || found.length === 0) return found;
      const before = await (jobs.get(page - 1)?.steps ?? getPageSteps<ExtractedStep>(manualId, page - 1)).catch(() => null);
      const last = before?.filter((s) => s.number).at(-1)?.number;
      if (!last) return found;
      return found.map((s) =>
        (s.continued && !s.number) || (s.number && s.number < last && !s.continued)
          ? { ...s, number: last, continued: true, sub: undefined }
          : s,
      );
    });
    const job = { image, steps: numbered };
    // A failed page can be retried.
    numbered.catch(() => jobs.delete(page));
    numbered.then((found) => read.set(page, found)).catch(() => {});
    jobs.set(page, job);
    return job;
  };
  // Pages read so far that have steps, in order, with their image (for "where am I?").
  const pages = () =>
    [...read.entries()]
      .filter(([, found]) => found.length)
      .sort(([a], [b]) => a - b)
      .map(([p, found]) => ({ page: p, steps: found, image: readPage(p).image }));
  return Object.assign(readPage, { pages, count: () => read.size });
}
