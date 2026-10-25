"use client";

import { motion } from "motion/react";
import Icon from "@/components/hud/ExtraIcons";
import type { ExtraProject } from "@/data/extraCategories";

// A light tile like the product photos, with a faint holo grid that fades toward the edges.
const ART = {
  background: [
    "radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 30%, rgba(255,255,255,0.9) 75%)",
    "linear-gradient(rgba(92,200,255,0.16) 1px, transparent 1px) 0 0 / 22px 22px",
    "linear-gradient(90deg, rgba(92,200,255,0.16) 1px, transparent 1px) 0 0 / 22px 22px",
    "radial-gradient(circle at 50% 45%, #ffffff, #e6f1f8)",
  ].join(", "),
};

// A display-only project card, laid out like CatalogCard, with icon art in place of a product photo.
export default function ExtraCard({ project, category, index, onOpen }: { project: ExtraProject; category: string; index: number; onOpen: () => void }) {
  return (
    <motion.button
      layout
      onClick={onOpen}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ y: -4 }}
      transition={{ delay: Math.min(index, 12) * 0.025, type: "spring", stiffness: 260, damping: 26 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] transition-colors hover:border-holo/30 hover:shadow-[0_20px_50px_-20px_rgba(92,200,255,0.45)]"
    >
      <div style={ART} className="relative grid aspect-square w-full place-items-center overflow-hidden">
        <span className="grid h-[46%] w-[46%] place-items-center rounded-full bg-white shadow-[0_12px_30px_-12px_rgba(15,40,70,0.45)] ring-1 ring-holo/40 transition duration-500 group-hover:scale-[1.05]">
          <Icon name={project.icon} className="h-1/2 w-1/2 text-slate-800" strokeWidth={1.6} />
        </span>
        <span className="absolute left-2.5 top-2.5 flex gap-1">
          <span className="rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">{category}</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug tracking-tight">{project.title}</h3>
        <p className="mt-1 text-[11px] text-white/45">{project.subtitle}</p>
        <span className="mt-auto pt-3 text-xs font-semibold text-holo opacity-80 transition group-hover:opacity-100">Start →</span>
      </div>
    </motion.button>
  );
}
