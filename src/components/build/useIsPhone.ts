"use client";
import { useSyncExternalStore } from "react";
// True on phone-width screens (Tailwind's `sm` breakpoint is 640px).
const PHONE_QUERY = "(max-width: 639px)";
export function useIsPhone() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(PHONE_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}
