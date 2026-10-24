"use client";

import { useEffect, useState } from "react";

// Top strip: wordmark, system status, clock.
export default function StatusBar({ right }: { right?: React.ReactNode }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  return (
    <header className="relative z-10 flex items-center justify-between gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
      <div className="flex items-center gap-3">
        <div className="relative grid h-8 w-8 place-items-center">
          <span className="absolute inset-0 rounded-full border border-holo/60" />
          <span className="absolute inset-1.5 rounded-full border border-dashed border-holo/50 spin-fast" />
          <span className="h-2 w-2 rounded-full bg-holo shadow-[0_0_12px_3px_rgba(79,195,255,0.8)]" />
        </div>
        <span className="font-hud text-lg font-semibold uppercase tracking-[0.35em] holo-text">BuildSight</span>
      </div>

      <div className="hidden items-center gap-5 font-mono text-[10px] uppercase tracking-[0.2em] text-holo/70 md:flex">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Vision online</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Manuals online</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 blink" />Voice standby</span>
      </div>

      <div className="flex items-center gap-4">
        {right}
        <span className="font-mono text-xs tabular-nums text-holo/80">
          {now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}
        </span>
      </div>
    </header>
  );
}
