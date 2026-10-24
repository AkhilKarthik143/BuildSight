// Soft glow, faint grid and two slow rings. Decorative only.

export default function HudBackdrop({ rings = true }: { rings?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(30,120,180,0.28),transparent_60%)]" />
      <div className="hud-grid absolute inset-0 opacity-60" />
      {rings && (
        <svg className="absolute left-1/2 top-[16%] h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 opacity-40" viewBox="0 0 900 900">
          <g className="spin-slow" style={{ transformBox: "fill-box" }}>
            <circle cx="450" cy="450" r="420" fill="none" stroke="rgba(79,195,255,0.35)" strokeWidth="1.5" strokeDasharray="2 18" />
          </g>
          <g className="spin-rev" style={{ transformBox: "fill-box" }}>
            <circle cx="450" cy="450" r="330" fill="none" stroke="rgba(79,195,255,0.25)" strokeWidth="1" strokeDasharray="120 40 20 40" />
          </g>
        </svg>
      )}
    </div>
  );
}
