"use client";



import { IssueBoxes } from "@/components/CheckErrorOverlay";
import ManualPanel from "@/components/ManualPanel";
import ZoomViewer from "@/components/ZoomViewer";
import { photoLabel } from "@/lib/issueBox";
import { AnimatePresence, motion } from "motion/react";

import { stepLabel } from "@/lib/stepLabels";
import type { BuildModel } from "./useBuildModel";

export default function BuildOverlays({ model }: { model: Pick<BuildModel, "check" | "target" | "phase" | "step" | "showManual" | "marks" | "compact" | "setZoomOpen" | "zoomOpen" | "pageImage" | "setShowManual" | "photoOpen" | "showBoxes" | "issuePick" | "setPhotoFor"> }) {
  const { check, target, phase, step, showManual, marks, compact, setZoomOpen, zoomOpen, pageImage, setShowManual, photoOpen, showBoxes, issuePick, setPhotoFor } = model;
  return (
    <>
      {/* reticle: shows while a check is running */}
      <AnimatePresence>
        {check?.state === "checking" && !check.auto && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute left-1/2 top-[42%] z-10 -translate-x-1/2 -translate-y-1/2">
            <svg viewBox="0 0 200 200" className="h-56 w-56">
              <g className="spin-fast" style={{ transformBox: "fill-box" }}>
                <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(79,195,255,0.8)" strokeWidth="2" strokeDasharray="30 20" />
              </g>
              <g className="spin-rev" style={{ transformBox: "fill-box" }}>
                <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(79,195,255,0.5)" strokeWidth="1.5" strokeDasharray="4 8" />
              </g>
              <path d="M100 20v20M100 160v20M20 100h20M160 100h20" stroke="rgba(79,195,255,0.9)" strokeWidth="2" />
            </svg>
            <p className="mt-2 text-center text-xs font-medium text-sky-200 holo-text">Checking your build…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* target state: the manual's picture of this step (drag to move, corner grip to resize, tap to zoom) */}
      <AnimatePresence>
        {target && phase.kind === "ready" && (
          <ManualPanel
            key={target.slice(-40)}
            target={target}
            stepNumber={step && stepLabel(step).replace(/^Step /, "")}
            glow={showManual}
            marks={marks}
            compact={compact}
            defaultClassName={`absolute right-3 top-20 z-10 transition-[width] duration-300 sm:right-6 sm:top-24 sm:w-72 ${compact ? "w-24" : "w-36"}`}
            onOpen={() => setZoomOpen(true)}
          />
        )}
      </AnimatePresence>

      {/* full-screen zoom viewer for the manual picture */}
      <AnimatePresence>
        {zoomOpen && target && phase.kind === "ready" && (
          <ZoomViewer
            key="zoom"
            target={target}
            pageImage={pageImage}
            stepNumber={step && stepLabel(step).replace(/^Step /, "")}
            glow={showManual}
            onGlowChange={setShowManual}
            marks={marks}
            onClose={() => setZoomOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* full-screen checked photo with the mistake boxes (same viewer, photo mode) */}
      <AnimatePresence>
        {photoOpen && check?.state === "result" && (
          <ZoomViewer
            key="photo"
            target={check.frame}
            pageImage={null}
            stepNumber={step && stepLabel(step).replace(/^Step /, "")}
            glow={false}
            onGlowChange={() => { }}
            photo={{ label: photoLabel(check.result.issues), overlay: showBoxes && <IssueBoxes issues={check.result.issues} selected={issuePick} /> }}
            onClose={() => setPhotoFor(null)}
          />
        )}
      </AnimatePresence>


    </>
  );
}
