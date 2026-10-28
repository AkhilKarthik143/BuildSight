"use client";
import CheckResultPanel from "./CheckResultPanel";
/* eslint-disable @next/next/no-img-element -- step pictures are data URLs rendered in the browser */


import PieceHologram from "@/components/PieceHologram";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";

import { stepLabel } from "@/lib/stepLabels";
import { AutoSpeedSettings, AutoToggle } from "./AutoControls";
import type { BuildModel } from "./useBuildModel";

export default function BuildStepCard({ model }: { model: Pick<BuildModel, "notice" | "setNotice" | "pending" | "setAdvance" | "phase" | "part" | "compact" | "roomForResult" | "holoState" | "step" | "MAX_PARTS" | "holoItems" | "stepKey" | "check" | "isPhone" | "setSheetOpen" | "sheetOpen" | "verdict" | "autoMode" | "autoSpeed" | "runCheck" | "doc" | "page" | "steps" | "preview" | "setPhase" | "setAttempt" | "restart" | "stripItems" | "stepIdx" | "thumbs" | "centerCurrent" | "jumpToStep" | "locating" | "autoStatus" | "activeSubs" | "setSubsteps" | "setCheckState" | "target" | "issuePick" | "showBoxes" | "setPhotoFor" | "setIssuePick" | "setShowBoxes"> }) {
  const { notice, setNotice, pending, setAdvance, phase, part, compact, roomForResult, holoState, step, MAX_PARTS, holoItems, stepKey, check, isPhone, setSheetOpen, sheetOpen, verdict, autoMode, autoSpeed, runCheck, doc, page, steps, preview, setPhase, setAttempt, restart, stripItems, stepIdx, thumbs, centerCurrent, jumpToStep, locating, autoStatus, activeSubs, setSubsteps } = model;
  return (
    <>
      {/* bottom: hologram + step card */}
      {/* above the manual panel (z-25) while a "where am I?" message shows, so it's never hidden */}
      <div className={`absolute inset-x-0 bottom-0 ${notice ? "z-30" : "z-10"} flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6 sm:left-6 sm:right-auto sm:w-[440px] sm:p-0`}>
        {/* "where am I?" result (asked for, or an automatic jump) */}
        <AnimatePresence>
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={() => setNotice(null)}
              role="status"
              className={`hud-panel rounded-2xl !bg-ink/95 px-4 py-3 text-sm ${notice.problems?.length ? "border border-amber-300/40 text-amber-50" : "text-sky-50"}`}
            >
              <p>{notice.text}</p>
              {notice.problems && notice.problems.length > 1 && (
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-white/75">
                  {notice.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {/* a pass: moving to the next step, with a chance to cancel */}
        <AnimatePresence>
          {pending && (
            <motion.div
              key={`advance-${pending.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              role="status"
              className="hud-panel overflow-hidden rounded-2xl border border-emerald-400/40 !bg-ink/95 text-sm text-emerald-100"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <p className="min-w-0 flex-1">
                  <span className="font-semibold">Verified</span>
                  <span className="text-emerald-100/70"> · {pending.started ? `next step in ${Math.round(pending.delay / 1000)} s` : "next step after this"}</span>
                </p>
                <button
                  onClick={() => setAdvance(null)}
                  className="shrink-0 rounded-lg border border-white/20 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15 active:scale-95"
                >
                  Cancel
                </button>
              </div>
              {pending.started && (
                <motion.div
                  className="h-1 origin-left bg-emerald-300/80"
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: pending.delay / 1000, ease: "linear" }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {phase.kind === "ready" && part && !compact && !roomForResult && (
          // On phones the manual panel sits top right (about 9rem wide), so keep the holograms left of it.
          <div className="flex items-end justify-start gap-3 pr-[10rem] sm:pr-0">
            {holoState !== "none" && step && (
              // Every part of the step as a hologram, numbered to match its boxes on the manual picture.
              <div className="flex max-w-full items-end gap-1 overflow-x-auto pb-4 [scrollbar-width:none] sm:gap-2">
                {step.parts.slice(0, MAX_PARTS).map((p, i) => {
                  const h = holoItems?.[i];
                  if(holoItems && !h?.cut) return null; // couldn't cut this one out of the manual
                  const many = step.parts.length > 1;
                  const lots = step.parts.length > 2; // one part is as small as two, so the row never dominates the screen
                  return (
                    <div
                      key={`${stepKey}-${i}`}
                      aria-label={`${p.name}, ${p.qty} needed`}
                      className={`relative shrink-0 ${lots ? "h-20 w-20 sm:h-28 sm:w-28" : "h-24 w-24 sm:h-32 sm:w-32"}`}
                    >
                      <PieceHologram state={h?.cut ? "ready" : "scanning"} cutout={h?.cut} size={h?.size} pieceKey={`${stepKey}-${i}`} />
                      {h?.cut && (
                        // How many to grab: big and bold, amber when it's more than one so it isn't missed.
                        <span
                          aria-hidden
                          className={`absolute right-0 top-0 rounded-lg px-2 py-0.5 text-base font-extrabold leading-tight shadow-[0_2px_10px_rgba(0,0,0,0.5)] ${p.qty > 1 ? "bg-amber-300 text-ink" : "bg-white text-ink"
                            }`}
                        >
                          ×{p.qty}
                        </span>
                      )}
                      {h?.cut && check?.state !== "checking" && (
                        <span className="absolute -bottom-3 left-1/2 flex max-w-full -translate-x-1/2 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-sky-200/80">
                          {many ? <span className="rounded bg-sky-300 px-1 text-[9px] font-bold leading-[14px] text-ink">{i + 1}</span> : <span>Next part</span>}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.section
            key={phase.kind} // one card for all steps: a step change updates it in place instead of fading it out and in
            initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            // Phones: swipe down to collapse to a slim bar, swipe up to expand.
            drag={isPhone ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.35}
            dragSnapToOrigin
            onDragEnd={(_, info) => {
              if(info.offset.y > 50 || info.velocity.y > 400) setSheetOpen(false);
              else if(info.offset.y < -50 || info.velocity.y < -400) setSheetOpen(true);
            }}
            className={`hud-panel holo-glow rounded-3xl touch-none sm:touch-auto ${compact ? "px-4 pb-3 pt-2" : "px-4 pb-4 pt-2 sm:p-5"}`}
          >
            {isPhone && (
              <button
                onClick={() => setSheetOpen((o) => !o)}
                aria-label={sheetOpen ? "Collapse step card" : "Expand step card"}
                className="mx-auto mb-2 block h-5 w-16"
              >
                <span className="mx-auto block h-1.5 w-10 rounded-full bg-white/30" />
              </button>
            )}

            {compact && phase.kind === "ready" && step && (
              <div className="flex items-center gap-3">
                <button onClick={() => setSheetOpen(true)} className="min-w-0 flex-1 text-left">
                  <p className="text-[11px] font-semibold text-holo">
                    {stepLabel(step)}
                    {check?.state === "result" && (
                      <span className={verdict === "pass" ? "text-emerald-300" : verdict === "fix" ? "text-red-300" : "text-white/50"}>
                        {" "}· {{ pass: "Verified", fix: "Hold on", notyet: "Not done yet", unsure: "Need a better look" }[verdict ?? "unsure"]}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm font-medium">{step.instruction}</p>
                </button>
                <AutoToggle on={autoMode} small />
                <AutoSpeedSettings speed={autoSpeed} small />
                <button
                  onClick={() => runCheck()}
                  disabled={check?.state === "checking"}
                  className="shrink-0 rounded-xl px-4 py-2.5 text-sm bg-holo font-semibold text-ink transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                >
                  {check?.state === "checking" ? "…" : "Check"}
                </button>
              </div>
            )}

            {phase.kind === "loading" && (
              <div>
                <p className="text-xs font-semibold text-holo">
                  {phase.label}
                  {doc && page > 0 && phase.label.startsWith("Reading page") ? ` of ${doc.numPages}` : ""}
                </p>
                {!compact && steps.length === 0 && page > 1 && (
                  <p className="mt-1 text-[11px] text-white/50">Finding step 1: manuals often open with safety and parts pages, which I skip.</p>
                )}
                <div className="scan-bar mt-3 h-1 rounded-full" />
                {compact ? null : preview ? (
                  <div className="relative mt-3 overflow-hidden rounded-xl bg-ink/60">
                    <img src={preview} alt="Manual page being read" className="max-h-56 w-full object-contain" />
                    <span className="hud-sweep pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-transparent via-sky-300/25 to-transparent" />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-white/50">Opening the manual…</p>
                )}
              </div>
            )}

            {phase.kind === "error" && (
              <div>
                <p className="text-xs font-semibold text-red-300">Something went wrong — try again</p>
                <p className="mt-2 text-sm text-white/80">{phase.message}</p>
                <div className="mt-4 flex gap-2">
                  <Link href="/" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">Back to hub</Link>
                  {doc && (
                    <button
                      onClick={() => {
                        setPhase({ kind: "loading", label: `Reading page ${page}` });
                        setAttempt((a) => a + 1);
                      }}
                      className="rounded-xl px-4 py-2.5 text-sm bg-holo font-semibold text-ink transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}

            {phase.kind === "done" && (
              <div>
                <p className="text-xs font-semibold text-emerald-300">Build complete</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">That&apos;s the last step in this manual.</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => restart(false)} className="rounded-xl px-4 py-2.5 text-sm bg-holo font-semibold text-ink transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
                    Start over
                  </button>
                  <Link href="/" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">Back to hub</Link>
                </div>
              </div>
            )}

            {phase.kind === "ready" && step && !compact && (
              <>
                {stripItems.length > 1 && (
                  <div
                    aria-label="All steps"
                    className="-mx-2 mb-2 flex snap-x gap-1.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {stripItems.map((item) => {
                      const key = `${item.page}-${item.idx}`;
                      const current = item.page === page && item.idx === stepIdx;
                      const thumb = thumbs[key];
                      return (
                        <button
                          key={key}
                          ref={current ? centerCurrent : undefined}
                          onClick={() => jumpToStep(item.page, item.idx)}
                          aria-current={current ? "step" : undefined}
                          aria-label={`Go to step ${item.step.number}${item.step.sub ? `, part ${item.step.sub}` : ""}`}
                          className={`relative h-10 w-14 shrink-0 snap-center overflow-hidden rounded-lg bg-white transition ${current ? "ring-2 ring-holo ring-offset-2 ring-offset-ink" : "opacity-60 hover:opacity-100"
                            }`}
                        >
                          {thumb ? <img src={thumb} alt="" className="h-full w-full object-contain" /> : <span className="absolute inset-0 animate-pulse bg-white/80" />}
                          <span className={`absolute left-0 top-0 rounded-br px-1 text-[9px] font-bold leading-[13px] ${current ? "bg-holo text-ink" : "bg-ink/80 text-white"}`}>
                            {item.step.number}
                            {item.step.sub ? `·${item.step.sub.split("/")[0]}` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-semibold text-holo">{stepLabel(step)}</p>
                  {/* the step is found from the camera automatically; while a check runs it says so here */}
                  <p className={`truncate pl-3 text-[11px] ${locating || autoMode ? "text-holo/80" : "text-white/40"}`} aria-live="polite">
                    {locating ? "Checking where you are…" : autoMode ? (autoStatus ?? "Auto · watching") : `${stepIdx + 1}/${steps.length} on page ${page}`}
                  </p>
                </div>
                {/* the card stays put between steps; just the new instruction fades in */}
                <motion.h1
                  key={stepKey}
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="mt-0.5 text-[17px] font-semibold leading-snug sm:text-2xl"
                >
                  {step.instruction}
                </motion.h1>

                {/* "I'm stuck": the step broken into smaller actions. Tap one to tick it off. */}
                <AnimatePresence>
                  {activeSubs && !roomForResult && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 overflow-hidden rounded-xl border border-holo/25 bg-holo/[0.06] px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-holo">Smaller steps</p>
                        <button onClick={() => setSubsteps(null)} aria-label="Hide smaller steps" className="px-1 text-xs text-white/40 hover:text-white/80">
                          ✕
                        </button>
                      </div>
                      <ol className="mt-1 space-y-1">
                        {activeSubs.items.map((text, i) => {
                          const done = activeSubs.done[i];
                          return (
                            <li key={i}>
                              <button
                                onClick={() => setSubsteps((sub) => sub && { ...sub, done: sub.done.map((d, j) => (j === i ? !d : d)) })}
                                aria-pressed={done}
                                className="flex w-full items-start gap-2 text-left text-[13px] leading-snug"
                              >
                                <span
                                  className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px] font-bold ${done ? "border-emerald-300 bg-emerald-300/20 text-emerald-200" : "border-white/30 text-white/55"
                                    }`}
                                >
                                  {done ? "✓" : i + 1}
                                </span>
                                <span className={done ? "text-white/40 line-through" : "text-white/85"}>{text}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>

                {step.watchFor[0] && !roomForResult && !(isPhone && activeSubs) && (
                  <p className="mt-2 flex gap-2 text-xs text-amber-200/90">
                    <span className="font-mono">⚠</span>
                    <span className="line-clamp-2">{step.watchFor[0]}</span>
                  </p>
                )}

                <CheckResultPanel model={model} />

                {/* Back / Next are gone: the step strip, voice ("next", "go to step 8") and auto-detect move between steps.
                    Phones hide it during a mistake review: "Check again" does the same and the photo needs the room. */}
                <div className={`${isPhone && verdict === "fix" ? "hidden" : "flex"} mt-3 gap-2`}>
                  <button
                    onClick={() => runCheck()}
                    disabled={check?.state === "checking"}
                    className="min-w-0 flex-1 rounded-xl py-2.5 text-sm bg-holo font-semibold text-ink transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                  >
                    {check?.state === "checking" ? "Checking…" : "Check build"}
                  </button>
                  <AutoToggle on={autoMode} />
                  <AutoSpeedSettings speed={autoSpeed} />
                </div>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

    </>
  );
}
