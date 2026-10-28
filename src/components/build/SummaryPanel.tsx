"use client";

export function SummaryPanel({ markdown, onClose }: { markdown: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-end bg-ink/70 p-4 sm:place-items-center" role="dialog" aria-label="Build summary">
      <div className="hud-panel max-h-[80dvh] w-full max-w-lg overflow-y-auto rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Build summary</h2>
          <button type="button" onClick={onClose} aria-label="Close summary" className="rounded-lg px-2 py-1 text-xs text-white/70 hover:text-white">
            Close
          </button>
        </div>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/85">{markdown}</pre>
        <button
          type="button"
          className="mt-3 rounded-xl bg-holo px-3 py-2 text-sm font-semibold text-ink"
          onClick={() => {
            const blob = new Blob([markdown], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "buildsight-session.md";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download Markdown
        </button>
      </div>
    </div>
  );
}
