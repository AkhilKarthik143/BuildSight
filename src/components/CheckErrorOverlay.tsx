"use client";
/* eslint-disable @next/next/no-img-element -- the checked photo is a data URL from the camera */

import { motion } from "motion/react";
import type { CheckResult } from "@/app/api/check/route";

// The photo a step check judged, with a numbered amber box on each mistake Claude could place.
// Boxes are 0-1 of that exact photo, and the wrapper is sized to the rendered image (no object-fit crop or
// letterbox), so percentages of the wrapper are percentages of the photo. Numbers match the problem list.
// `selected` (a 0-based issue index) brightens that box and fades the others.
export default function CheckErrorOverlay({
  frame,
  issues,
  selected,
  show = true,
}: {
  frame: string;
  issues: CheckResult["issues"];
  selected: number | null;
  show?: boolean;
}) {
  return (
    <div className="relative w-fit max-w-full">
      <img src={frame} alt="Your build" className="block h-auto max-h-44 w-auto max-w-full rounded-md sm:max-h-56" />
      {show &&
        issues.map((issue, i) =>
          issue.box ? (
            <motion.span
              key={`${i}-${issue.box.x}-${issue.box.y}`}
              aria-hidden
              data-issue-box={i + 1}
              initial={{ opacity: 0, scale: 1.25 }}
              animate={{ opacity: selected == null || selected === i ? 1 : 0.35, scale: 1 }}
              transition={{ duration: 0.25 }}
              className={`issue-box pointer-events-none absolute rounded-md border-2 border-amber-300 bg-amber-300/10 ${selected === i ? "issue-box-on" : ""}`}
              style={{
                left: `${issue.box.x * 100}%`,
                top: `${issue.box.y * 100}%`,
                width: `${issue.box.w * 100}%`,
                height: `${issue.box.h * 100}%`,
              }}
            >
              <span className="absolute -left-1.5 -top-2 rounded bg-amber-300 px-1 text-[10px] font-bold leading-[15px] text-ink">{i + 1}</span>
            </motion.span>
          ) : null,
        )}
    </div>
  );
}
