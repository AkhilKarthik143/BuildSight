"use client";

// A hologram of the real piece, cut out of the manual's parts box, floating above a projector.
// While the piece is being found it shows a scanning projector; then the piece "prints" in from the bottom.
// Size follows the manual's own scale (`size`, 0–1 of the stage), so pieces keep their proportions to each other.

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import type { Cutout } from "@/lib/cutout";

type Props = {
  state: "scanning" | "ready";
  cutout?: Cutout | null;
  size?: number; // 0–1: share of the stage height the piece takes
  pieceKey: string; // changes when the piece changes, to replay the build-in
};

const CYAN = "rgba(92,200,255,";

export default function PieceHologram({ state, cutout, size = 0.7, pieceKey }: Props) {
  return (
    <div className="relative h-full w-full">
      {/* projector beam */}
      <div
        className="pointer-events-none absolute bottom-3 left-1/2 h-[88%] w-[86%] -translate-x-1/2"
        style={{
          clipPath: "polygon(38% 100%, 62% 100%, 100% 0, 0 0)",
          background: `linear-gradient(to top, ${CYAN}0.32), ${CYAN}0.06) 70%, transparent)`,
        }}
      />
      {/* projector base: two rings, the outer one pulsing */}
      <motion.div
        className="absolute bottom-1 left-1/2 h-5 w-[70%] -translate-x-1/2 rounded-[50%] border"
        style={{ borderColor: `${CYAN}0.55)`, boxShadow: `0 0 18px ${CYAN}0.55), inset 0 0 10px ${CYAN}0.4)` }}
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="absolute bottom-[9px] left-1/2 h-2 w-[34%] -translate-x-1/2 rounded-[50%]"
        style={{ background: `${CYAN}0.7)`, filter: "blur(4px)" }}
      />

      <AnimatePresence mode="wait">
        {state === "scanning" ? (
          <motion.div key="scan" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* rotating reticle */}
            <motion.svg
              viewBox="0 0 100 100"
              className="absolute left-1/2 top-[38%] h-[52%] w-[52%] -translate-x-1/2 -translate-y-1/2"
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            >
              <circle cx="50" cy="50" r="44" fill="none" stroke={`${CYAN}0.7)`} strokeWidth="1.5" strokeDasharray="14 10" />
              <circle cx="50" cy="50" r="32" fill="none" stroke={`${CYAN}0.35)`} strokeWidth="1" strokeDasharray="2 5" />
              <path d="M50 2v10M50 88v10M2 50h10M88 50h10" stroke={`${CYAN}0.9)`} strokeWidth="1.5" />
            </motion.svg>
            {/* sweeping scan line */}
            <motion.div
              className="absolute left-[18%] right-[18%] h-px"
              style={{ background: `${CYAN}0.95)`, boxShadow: `0 0 8px 1px ${CYAN}0.8)` }}
              animate={{ top: ["14%", "66%", "14%"] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
            <p className="absolute inset-x-0 top-[72%] text-center font-mono text-[9px] tracking-[0.2em] text-sky-200/80">SCANNING PARTS BOX</p>
          </motion.div>
        ) : cutout ? (
          <motion.div
            key={pieceKey}
            className="absolute inset-x-0 bottom-6 top-1 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            {/* gentle float and a slight side-to-side turn (2D only: 3D layers draw a box around glowing images in Chrome) */}
            <motion.div
              className="relative flex h-full w-full items-center justify-center"
              animate={{ y: [0, -5, 0], scaleX: [1, 0.93, 1, 0.93, 1], skewY: [0, 1.5, 0, -1.5, 0] }}
              transition={{ y: { duration: 3.5, repeat: Infinity, ease: "easeInOut" }, scaleX: { duration: 8, repeat: Infinity, ease: "easeInOut" }, skewY: { duration: 8, repeat: Infinity, ease: "easeInOut" } }}
            >
              <PrintIn image={cutout.image} style={{ height: `${Math.round(size * 88)}%`, aspectRatio: `${cutout.pxWidth} / ${cutout.pxHeight}`, maxWidth: "94%" }}>
                <motion.img
                  src={cutout.image}
                  alt="Hologram of the next piece"
                  className="h-full w-full object-contain"
                  style={{ filter: `drop-shadow(0 0 3px ${CYAN}0.9)) drop-shadow(0 0 12px ${CYAN}0.4)) brightness(1.1)` }}
                  animate={{ opacity: [0.92, 0.92, 0.7, 0.92, 0.92] }}
                  transition={{ duration: 4.5, repeat: Infinity, times: [0, 0.6, 0.63, 0.66, 1] }}
                />
                {/* cyan tint + drifting scan lines, masked to the piece's shape */}
                <motion.div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    WebkitMaskImage: `url(${cutout.image})`,
                    maskImage: `url(${cutout.image})`,
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    backgroundImage: `repeating-linear-gradient(0deg, ${CYAN}0.2) 0px, ${CYAN}0.2) 1px, transparent 1px, transparent 4px), linear-gradient(${CYAN}0.1), ${CYAN}0.1))`,
                    mixBlendMode: "screen",
                  }}
                  animate={{ backgroundPositionY: ["0px", "40px"] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                />
              </PrintIn>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// "Prints" the piece in from the bottom up, with a bright print-head line riding the edge.
// No filters here: a filter on this layer makes Chrome draw a faint box around the glowing piece.
// The glow switches on as it lands (glow inside the revealing layer would show a box while printing).
function PrintIn({ image, style, children }: { image: string; style: React.CSSProperties; children: ReactNode }) {
  const [landed, setLanded] = useState(false);
  if (landed) return <div className="relative" style={style}>{children}</div>;
  const transition = { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] as const };
  return (
    <div className="relative" style={style}>
      <motion.div
        className="h-full w-full"
        initial={{ clipPath: "inset(100% 0 0 0)" }}
        animate={{ clipPath: "inset(0% 0 0 0)" }}
        transition={transition}
        onAnimationComplete={() => setLanded(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- generated in the browser, nothing to optimize */}
        <img src={image} alt="" className="h-full w-full object-contain" />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute -inset-x-2 h-0.5 rounded-full"
        style={{ background: `${CYAN}1)`, boxShadow: `0 0 10px 2px ${CYAN}0.9)` }}
        initial={{ top: "100%", opacity: 1 }}
        animate={{ top: "0%", opacity: 0 }}
        transition={{ top: transition, opacity: { duration: 0.25, delay: 0.75 } }}
      />
    </div>
  );
}
