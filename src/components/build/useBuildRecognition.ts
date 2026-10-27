"use client";

import { speak } from "@/lib/speech";
import { AUTO_MIN_CONFIDENCE, decide, MAX_TILES, whereAmI, type Tile } from "@/lib/whereAmI";
import { useCallback, useEffect } from "react";

import type { BuildNavigation } from "./useBuildNavigation";
import type { BuildState } from "./useBuildState";
export function useBuildRecognition(s: BuildState, n: BuildNavigation) {
  const { camera: cameraRef, doc, page, muted, locating, setLocating, notice, setNotice, autoJump: autoJumpRef, step } = s;
  const { reader, openTile, thumbsFor } = n;
  // "Where am I?": compares the cameraRef with every step picture read so far. Jumps to the next step, or back to
  // an earlier step that looks broken. Asked for: always answers. Automatic: silent unless the step changes.
  const findMyPlace = useCallback(
    async (automatic = false) => {
      if(!reader || !doc || locating) return;
      const frame = cameraRef.current?.capture();
      const say = (text: string, problems?: string[]) => {
        setNotice({ text, problems });
        if(!muted) speak(text);
      };
      if(!frame) return automatic ? undefined : say("The cameraRef isn't ready yet.");
      const pages = reader.pages();
      if(!pages.length) return automatic ? undefined : say("I haven't read any steps yet. Give me a moment.");
      setLocating(true);
      if(!automatic) setNotice({ text: "Finding your place…" });
      try {
        // The same step pictures the strip shows: already cut, so this is nearly free after the first time.
        const tiles: Tile[] = [];
        for(const pg of pages) {
          const urls = await thumbsFor(pg);
          for(const [idx, st] of pg.steps.entries()) {
            if(tiles.length >= MAX_TILES) break;
            tiles.push({ tile: tiles.length + 1, page: pg.page, number: st.number, image: urls[idx] });
          }
        }
        const complete = reader.count() >= doc.numPages;
        const result = await whereAmI({ frame, tiles, complete });
        const place = decide(result, tiles, complete, step && { page, number: step.number }, automatic ? AUTO_MIN_CONFIDENCE : 0);
        if(place.action === "fix" || place.action === "goto") {
          autoJumpRef.current = true;
          say(place.say, place.action === "fix" ? place.problems : undefined);
          openTile(place.target);
        } else if(!automatic) {
          say(place.say);
        }
      } catch(e) {
        if(!automatic) say(e instanceof Error && e.message ? e.message : "I couldn't find your place.");
      } finally {
        setLocating(false);
      }
    },
    [reader, doc, locating, cameraRef, setLocating, setNotice, muted, step, page, thumbsFor, autoJumpRef, openTile],
  );
  // The notice fades after a while (problem lists stay longer). Tap to dismiss.
  useEffect(() => {
    if(!notice || locating) return;
    const t = setTimeout(() => setNotice(null), notice.problems?.length ? 20000 : 8000);
    return () => clearTimeout(t);
  }, [notice, locating, setNotice]);

  return { findMyPlace };
}
export type BuildRecognition = ReturnType<typeof useBuildRecognition>;
