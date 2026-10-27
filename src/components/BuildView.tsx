"use client";
import BuildHeader from "./build/BuildHeader";
import BuildOverlays from "./build/BuildOverlays";
import BuildStepCard from "./build/BuildStepCard";



import CameraFeed from "@/components/CameraFeed";
import { LiveIssueBoxes } from "@/components/CheckErrorOverlay";
import VoicePanel from "@/components/VoicePanel";
import { describePart } from "@/lib/parts";

import { useBuildModel } from "./build/useBuildModel";
export default function BuildView() {
  const m = useBuildModel();
  const { camera, check, verdict, showBoxes, issuePick, liveCamera, muted, compact, onCommand, onAction, manual, step } = m;
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-ink text-white">
      <CameraFeed ref={camera} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/70 via-transparent to-ink/80" />
      {/* the mistake boxes on the live camera too, while the camera stays where it was for the check */}
      {check?.state === "result" && verdict === "fix" && showBoxes && (
        <LiveIssueBoxes issues={check.result.issues} selected={issuePick} baseline={check.sample} camera={liveCamera} />
      )}

      <BuildHeader model={m} />
      <BuildOverlays model={m} />
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

      <BuildStepCard model={m} />
    </main>
  );
}
