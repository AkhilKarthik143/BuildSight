"use client";
/* eslint-disable @next/next/no-img-element -- step pictures are data URLs rendered in the browser */


import CheckErrorOverlay, { WarnGlyph } from "@/components/CheckErrorOverlay";
import { CATEGORY_TAG, issueCategory, issueLabel } from "@/lib/issueBox";
import { AnimatePresence, motion } from "motion/react";

import type { BuildModel } from "./useBuildModel";

export default function CheckResultPanel({ model }: { model: Pick<BuildModel, "check" | "verdict" | "setCheckState" | "target" | "issuePick" | "showBoxes" | "isPhone" | "setPhotoFor" | "setIssuePick" | "runCheck" | "setShowBoxes"> }) {
  const { check, verdict, setCheckState, target, issuePick, showBoxes, isPhone, setPhotoFor, setIssuePick, runCheck, setShowBoxes } = model;
  return (
    <AnimatePresence>
      {check && check.state !== "checking" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          // a mistake stays until Check again passes or Close; other results close on a tap
          onClick={verdict === "fix" ? undefined : () => setCheckState(null)}
          title={verdict === "fix" ? undefined : "Tap to dismiss"}
          className={`mt-4 overflow-hidden rounded-xl border p-3 text-sm ${verdict === "fix" ? "" : "cursor-pointer"} ${check.state === "error" || verdict === "unsure" || verdict === "notyet"
            ? "border-white/15 bg-white/5 text-white/80"
            : verdict === "pass"
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
              : "border-red-400/50 bg-red-500/10 text-red-50"
            }`}
        >
          {check.state === "error" ? (
            check.message
          ) : (
            <>
              <p className="text-[11px] font-semibold">
                {{ pass: "Verified", fix: "Hold on", notyet: "Not done yet", unsure: "Need a better look" }[verdict ?? "unsure"]}
                {verdict !== "unsure" && ` · ${Math.round(check.result.confidence * 100)}%`}
              </p>
              <p className="mt-1">{check.result.say}</p>
              {verdict === "fix" && check.result.issues.length > 0 && (
                <>
                  {/* Phones: just your photo with the boxes (the manual picture is already on screen). Desktop: side by side. */}
                  <div className="mt-3 grid grid-cols-[auto] items-start gap-2 sm:grid-cols-2">
                    <figure className="hidden sm:block">
                      <img src={target ?? ""} alt="Manual" className="max-h-56 w-full rounded-md bg-white object-contain" />
                      <figcaption className="mt-1 text-[10px] text-white/50">Manual</figcaption>
                    </figure>
                    <figure>
                      <CheckErrorOverlay
                        frame={check.frame}
                        issues={check.result.issues}
                        selected={issuePick}
                        show={showBoxes}
                        big={isPhone}
                        onOpen={() => setPhotoFor(check.id)}
                      />
                      <figcaption className="mt-1 text-[10px] text-white/50">Your build</figcaption>
                    </figure>
                  </div>
                  {/* phones: a long list scrolls inside the card so the card never grows past the header */}
                  <ol
                    className={`mt-3 space-y-1.5 ${isPhone ? "max-h-[22dvh] touch-pan-y overflow-y-auto overscroll-contain" : ""}`}
                    data-issue-list
                  >
                    {check.result.issues.map((issue, i) => (
                      <li key={i}>
                        <button
                          onClick={() => setIssuePick((p) => (p === i ? null : i))}
                          aria-label={issueLabel(issue, i + 1)}
                          aria-pressed={issuePick === i}
                          className={`flex w-full gap-2 rounded-lg px-2 py-1.5 text-left transition ${issuePick === i ? "bg-red-500/25" : "bg-black/20"}`}
                        >
                          <span className="mt-px flex h-[18px] min-w-[18px] items-center justify-center gap-0.5 rounded bg-red-500 px-1 text-[11px] font-bold leading-[18px] text-white">
                            <WarnGlyph />
                            {i + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="mr-1.5 rounded border border-red-400/60 px-1 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                              {CATEGORY_TAG[issueCategory(issue.kind)]}
                            </span>
                            <span className="font-semibold">{issue.part || "Piece"}</span>
                            {issue.problem && <span className="text-red-100/80">: {issue.problem}</span>}
                            {issue.fix && <span className="block text-white/85">{issue.fix}</span>}
                            {!issue.box && <span className="block text-[10px] text-white/45">Couldn&apos;t pin this one on the photo</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => runCheck()}
                      className="flex-1 rounded-lg bg-red-500 py-2 text-xs font-semibold text-white active:scale-[0.98]"
                    >
                      Check again
                    </button>
                    {check.result.issues.some((i) => i.box) && (
                      <button onClick={() => setShowBoxes((v) => !v)} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-medium">
                        {showBoxes ? "Hide boxes" : "Show boxes"}
                      </button>
                    )}
                    <button onClick={() => setCheckState(null)} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-medium">
                      Close
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
