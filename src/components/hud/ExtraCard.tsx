"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import Icon, { type IconName } from "@/components/hud/ExtraIcons";
import type { ExtraProject } from "@/data/extraCategories";

// A display-only project card, laid out like CatalogCard. The photo is a square WebP, so it fills the
// tile exactly like the LEGO product photos (same corners, zoom on hover, shimmer while loading).
export default function ExtraCard({
  project,
  category,
  icon,
  index,
  onOpen,
}: {
  project: ExtraProject;
  category: string;
  icon: IconName;
  index: number;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
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
      <div className="relative aspect-square w-full overflow-hidden bg-white/[0.03]">
        {!loaded && <span aria-hidden className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.06] to-white/[0.02]" />}
        <Image
          src={project.image}
          alt={project.alt}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
          priority={index < 4}
          onLoad={() => setLoaded(true)}
          className={`object-cover transition duration-500 group-hover:scale-[1.05] ${loaded ? "opacity-100" : "opacity-0"}`}
        />
        <span className="absolute left-2.5 top-2.5 flex gap-1">
          <span className="flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            <Icon name={icon} className="h-3 w-3" strokeWidth={2} />
            {category}
          </span>
          {project.href && <span className="rounded-md bg-holo px-2 py-0.5 text-[10px] font-semibold text-ink">AR</span>}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug tracking-tight">{project.title}</h3>
        <p className="mt-1 text-[11px] text-white/45">{project.subtitle}</p>
        <span className="mt-auto pt-3 text-xs font-semibold text-holo opacity-80 transition group-hover:opacity-100">{project.href ? "Practice in AR →" : "Start →"}</span>
      </div>
    </motion.button>
  );
}
