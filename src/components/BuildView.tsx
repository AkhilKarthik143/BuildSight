/* eslint-disable @next/next/no-img-element -- step pictures are data URLs rendered in the browser */
"use client";

import CameraFeed from "@/components/CameraFeed";
import CheckErrorOverlay, { IssueBoxes, LiveIssueBoxes, WarnGlyph } from "@/components/CheckErrorOverlay";
import ManualPanel from "@/components/ManualPanel";
import PieceHologram from "@/components/PieceHologram";
import VoicePanel from "@/components/VoicePanel";
import ZoomViewer from "@/components/ZoomViewer";
import { CATEGORY_TAG, issueCategory, issueLabel, photoLabel } from "@/lib/issueBox";
import { describePart } from "@/lib/parts";
import { stopSpeaking } from "@/lib/speech";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";

import { stepLabel } from "@/lib/stepLabels";
import { AutoSpeedSettings, AutoToggle } from "./build/AutoControls";
import { useBuildModel } from "./build/useBuildModel";
export default function BuildView() {
  const m = useBuildModel();
  const { camera, liveCamera, manual, doc, page, pageImage, steps, stepIdx, phase, setPhase, target, setCheckState, issuePick, setIssuePick, showBoxes, setShowBoxes, setPhotoFor, setAdvance, muted, setMuted, showManual, setShowManual, zoomOpen, setZoomOpen, isPhone, sheetOpen, setSheetOpen, compact, stepKey, setSubsteps, activeSubs, check, verdict, photoOpen, setAttempt, preview, readCount, locating, notice, setNotice, autoMode, autoSpeed, autoStatus, step, part, restart, stripItems, thumbs, jumpToStep, centerCurrent, MAX_PARTS, marks, holoItems, holoState, runCheck, pending, onAction, onCommand, roomForResult } = m;
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-ink text-white">
      <CameraFeed ref={camera} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/70 via-transparent to-ink/80" />
      {/* the mistake boxes on the live camera too, while the camera stays where it was for the check */}
      {check?.state === "result" && verdict === "fix" && showBoxes && (
        <LiveIssueBoxes issues={check.result.issues} selected={issuePick} baseline={check.sample} camera={liveCamera} />
      )}

      {/* top bar */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <Link href="/" className="hud-panel flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white/85 transition hover:text-white">
          ← Hub
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[15px] font-semibold tracking-tight">{manual?.title ?? "BuildSight"}</p>
          {/* the page number never gets cut off: only the subtitle truncates */}
          <p className="flex justify-center whitespace-nowrap text-[11px] text-white/50">
            <span className="min-w-0 truncate">{manual?.subtitle}</span>
            {doc && page > 0 && <span className="shrink-0 pl-1">{manual?.subtitle ? "· " : ""}Page {page}/{doc.numPages}</span>}
            {doc && readCount > 0 && readCount < doc.numPages && <span className="hidden shrink-0 sm:inline"> · read {readCount}/{doc.numPages}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/\/645575\d\.pdf$/.test(manual?.pdfPath ?? "") && (
            <Link
              href="/practice/parrot"
              aria-label="Practice in AR"
              title="Practice in AR"
              className="hud-panel grid h-9 place-items-center rounded-xl px-2.5 text-xs font-semibold text-holo transition hover:text-white"
            >
              AR
            </Link>
          )}
          <button
            onClick={() => restart()}
            disabled={!doc}
            aria-label="Restart from step 1"
            title="Restart from step 1"
            className="hud-panel grid h-9 w-9 place-items-center rounded-xl text-white/85 transition hover:text-white disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          </button>
          <button
            onClick={() => {
              setMuted((m) => !m);
              stopSpeaking();
            }}
            className="hud-panel h-9 rounded-xl px-3 text-xs font-medium text-white/85 transition hover:text-white"
            aria-pressed={muted}
          >
            {muted ? "Voice off" : "Voice on"}
          </button>
        </div>
      </header>

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

      {/* voice: talk to BuildSight (top-left on phones, bottom-right on desktop) */}
      <div className={`absolute left-3 right-[10.5rem] top-20 z-20 sm:left-auto sm:right-6 sm:top-auto sm:bottom-6 sm:w-80`}>
        <VoicePanel
          getFrame={() => camera.current?.capture() ?? null}
          muted={muted}
          compact={compact}
          onCommand={onCommand}
          onAction={onAction}
          context={{
            manual: manual?.title,
            step: step && { number: step.sub ? `${step.number} (${step.sub.replace("/", " of ")})` : step.number, instruction: step.instruction, parts: step.parts.map((p) => `${p.qty}x ${describePart(p)}`), watchFor: step.watchFor },
          }}
        />
      </div>

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
    </main>
  );
}
