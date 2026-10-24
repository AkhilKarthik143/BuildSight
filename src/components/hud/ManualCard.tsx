/* eslint-disable @next/next/no-img-element -- covers come from lego.com / ikea.com at arbitrary sizes */
"use client";

import { motion } from "motion/react";
import type { ManualSource } from "@/lib/manuals";

const SOURCE_LABEL: Record<ManualSource, string> = { lego: "LEGO", ikea: "IKEA", upload: "PDF" };

type Props = {
  source: ManualSource;
  title: string;
  subtitle: string;
  coverUrl?: string;
  meta?: string; // "19.96 MB" or "Page 12 of 100"
  progress?: number; // 0–1, library cards only
  action: string;
  busy?: boolean;
  index?: number;
  onAction: () => void;
  onRemove?: () => void;
};

export default function ManualCard({ source, title, subtitle, coverUrl, meta, progress, action, busy, index = 0, onAction, onRemove }: Props) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 240, damping: 26 }}
      className="hud-panel group flex flex-col overflow-hidden rounded-xl"
    >
      <button
        onClick={onAction}
        disabled={busy}
        className={`relative aspect-[4/3] w-full overflow-hidden text-left ${coverUrl ? "bg-white" : "bg-[radial-gradient(circle_at_50%_60%,rgba(79,195,255,0.18),transparent_70%)]"}`}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            className={`absolute inset-0 h-full w-full transition duration-500 group-hover:scale-105 ${source === "lego" ? "object-contain" : "object-contain p-4"}`}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <svg viewBox="0 0 48 48" className="h-16 w-16 text-holo/70" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 6h18l8 8v28H12z" />
              <path d="M30 6v8h8M17 24h14M17 30h14M17 36h9" />
            </svg>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-sm bg-black/75 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.2em] text-white">
          {SOURCE_LABEL[source]}
        </span>
        {busy && <span className="scan-bar absolute inset-x-0 bottom-0 h-1" />}
      </button>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-hud text-lg font-semibold leading-tight">{title}</h3>
        <p className="font-mono text-[11px] uppercase tracking-wider text-holo/70">{subtitle}</p>
        {progress != null && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-holo/10">
            <div className="h-full rounded-full bg-holo shadow-[0_0_8px_rgba(79,195,255,0.9)]" style={{ width: `${Math.max(3, progress * 100)}%` }} />
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="font-mono text-[11px] text-white/50">{meta}</span>
          <div className="flex items-center gap-2">
            {onRemove && (
              <button onClick={onRemove} aria-label={`Remove ${title}`} className="rounded-md px-2 py-1.5 font-mono text-[11px] text-white/40 transition hover:text-rose-300">
                Remove
              </button>
            )}
            <button
              onClick={onAction}
              disabled={busy}
              className="rounded-md border border-holo/50 bg-holo/15 px-3 py-1.5 font-hud text-sm font-semibold uppercase tracking-widest text-holo transition hover:bg-holo hover:text-ink active:scale-95 disabled:opacity-50"
            >
              {busy ? "Loading" : action}
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
