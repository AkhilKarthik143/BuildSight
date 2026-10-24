"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import HudBackdrop from "@/components/hud/HudBackdrop";
import ManualCard from "@/components/hud/ManualCard";
import StatusBar from "@/components/hud/StatusBar";
import { addFromResult, addUpload, listManuals, removeManual, type Manual, type ManualResult } from "@/lib/manuals";

const QUICK_PICKS = [
  { label: "LEGO 31163 · Playful Cat", q: "31163" },
  { label: "IKEA · LACK side table", q: "lack side table" },
  { label: "IKEA · KALLAX shelf", q: "kallax" },
];

const isSetNumber = (q: string) => /^\d{4,7}(-\d)?$/.test(q.trim());

export default function Hub() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState<string | null>(null);
  const [results, setResults] = useState<ManualResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [library, setLibrary] = useState<Manual[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    listManuals().then(setLibrary).catch(() => setLibrary([]));
  }, []);

  const search = useCallback(async (q: string) => {
    const text = q.trim();
    if (text.length < 2) return;
    setQuery(text);
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results);
      setSearched(text);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }, []);

  async function open(result: ManualResult) {
    setOpening(result.pdfPath);
    const m = await addFromResult(result);
    router.push(`/build/${m.id}`);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("That isn't a PDF. Drop a PDF manual.");
      return;
    }
    setOpening("upload");
    const m = await addUpload(file);
    router.push(`/build/${m.id}`);
  }

  async function remove(id: string) {
    await removeManual(id);
    setLibrary((l) => l?.filter((m) => m.id !== id) ?? null);
  }

  const detected = query.trim() ? (isSetNumber(query) ? "LEGO set" : "IKEA search") : null;

  return (
    <div
      className="relative min-h-dvh w-full overflow-x-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        upload(e.dataTransfer.files?.[0]);
      }}
    >
      <HudBackdrop />
      <StatusBar />

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-5 pb-24 sm:px-8">
        {/* hero + command console */}
        <section className="flex flex-col items-center pt-14 text-center sm:pt-24">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-mono text-[11px] uppercase tracking-[0.4em] text-holo/70"
          >
            Build assistant ready
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="mt-3 font-hud text-4xl font-semibold uppercase tracking-[0.08em] holo-text sm:text-6xl"
          >
            What are we building?
          </motion.h1>
          <p className="mt-3 max-w-xl text-sm text-white/60 sm:text-base">
            Enter a LEGO set number or an IKEA product, or drop in any PDF manual. I&apos;ll read it and walk you through every step.
          </p>

          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            onSubmit={(e) => {
              e.preventDefault();
              search(query);
            }}
            className="hud-panel holo-glow mt-10 flex w-full max-w-2xl items-center gap-3 rounded-2xl p-2 pl-5"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-holo" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="31163  ·  lack side table  ·  kallax"
              aria-label="Search manuals"
              className="min-w-0 flex-1 bg-transparent py-3 font-mono text-base text-white placeholder:text-white/30 focus:outline-none"
            />
            <AnimatePresence>
              {detected && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="hidden shrink-0 rounded-sm border border-holo/40 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-holo sm:block"
                >
                  {detected}
                </motion.span>
              )}
            </AnimatePresence>
            <button
              type="submit"
              disabled={searching}
              className="shrink-0 rounded-xl bg-holo px-5 py-3 font-hud text-sm font-bold uppercase tracking-[0.2em] text-ink transition hover:brightness-110 active:scale-95 disabled:opacity-60"
            >
              {searching ? "Scanning" : "Search"}
            </button>
          </motion.form>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {QUICK_PICKS.map((p) => (
              <button
                key={p.q}
                onClick={() => search(p.q)}
                className="rounded-full border border-holo/25 bg-holo/5 px-3 py-1.5 font-mono text-[11px] text-holo/80 transition hover:border-holo/60 hover:text-holo"
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => fileInput.current?.click()}
              className="rounded-full border border-dashed border-holo/40 px-3 py-1.5 font-mono text-[11px] text-holo/80 transition hover:border-holo hover:text-holo"
            >
              ⤒ Upload PDF
            </button>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => upload(e.target.files?.[0])} />
          </div>
        </section>

        {/* search results */}
        <AnimatePresence mode="wait">
          {(searching || searched || error) && (
            <motion.section
              key={searched ?? "searching"}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-14"
            >
              <SectionTitle
                label={searching ? "Scanning databases" : error ? "Search error" : `Results for “${searched}”`}
                count={searching || error ? undefined : results.length}
              />
              {searching && <div className="scan-bar mt-4 h-0.5 w-full rounded-full" />}
              {error && <p className="mt-4 font-mono text-sm text-rose-300">{error}</p>}
              {!searching && !error && results.length === 0 && (
                <p className="mt-4 font-mono text-sm text-white/50">
                  No manuals found. LEGO needs a set number (e.g. 31163); for IKEA try the product name.
                </p>
              )}
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((r, i) => (
                  <ManualCard
                    key={r.pdfPath}
                    index={i}
                    source={r.source}
                    title={r.title}
                    subtitle={r.subtitle}
                    coverUrl={r.coverUrl}
                    meta={r.sizeLabel}
                    action="Build"
                    busy={opening === r.pdfPath}
                    onAction={() => open(r)}
                  />
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* library */}
        <section className="mt-16">
          <SectionTitle label="Your manuals" count={library?.length} />
          {library && library.length === 0 && (
            <div className="hud-panel mt-5 rounded-xl p-8 text-center">
              <p className="font-hud text-lg uppercase tracking-widest text-holo/80">No manuals loaded</p>
              <p className="mt-1 text-sm text-white/50">Search above or drop a PDF anywhere on this page.</p>
            </div>
          )}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {library?.map((m, i) => (
                <ManualCard
                  key={m.id}
                  index={i}
                  source={m.source}
                  title={m.title}
                  subtitle={m.subtitle}
                  coverUrl={m.coverUrl}
                  meta={m.pageCount ? `Page ${m.page} of ${m.pageCount}` : "Not started"}
                  progress={m.pageCount ? m.page / m.pageCount : 0}
                  action={m.page > 1 ? "Resume" : "Start"}
                  onAction={() => router.push(`/build/${m.id}`)}
                  onRemove={() => remove(m.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* drag-and-drop overlay */}
      <AnimatePresence>
        {(dragging || opening === "upload") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-ink/80 backdrop-blur-sm"
          >
            <div className="hud-panel holo-glow rounded-2xl border-dashed px-12 py-10 text-center">
              <p className="font-hud text-2xl font-semibold uppercase tracking-[0.2em] holo-text">
                {opening === "upload" ? "Loading manual" : "Drop manual to load"}
              </p>
              <p className="mt-2 font-mono text-xs text-holo/70">PDF · any build instructions</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionTitle({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px w-6 bg-holo" />
      <h2 className="font-hud text-sm font-semibold uppercase tracking-[0.3em] text-holo">{label}</h2>
      {count != null && <span className="font-mono text-xs text-white/40">[{String(count).padStart(2, "0")}]</span>}
      <span className="h-px flex-1 bg-gradient-to-r from-holo/40 to-transparent" />
    </div>
  );
}
