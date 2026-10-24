// Grid, glow, slow rotating rings and a scan sweep. Decorative only.

export default function HudBackdrop({ rings = true }: { rings?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(30,120,180,0.35),transparent_60%)]" />
      <div className="hud-grid absolute inset-0" />
      {rings && (
        <svg className="absolute left-1/2 top-[18%] h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 opacity-60" viewBox="0 0 900 900">
          <g className="spin-slow" style={{ transformBox: "fill-box" }}>
            <circle cx="450" cy="450" r="420" fill="none" stroke="rgba(79,195,255,0.12)" strokeWidth="1" />
            <circle cx="450" cy="450" r="420" fill="none" stroke="rgba(79,195,255,0.45)" strokeWidth="2" strokeDasharray="2 18" />
          </g>
          <g className="spin-rev" style={{ transformBox: "fill-box" }}>
            <circle cx="450" cy="450" r="340" fill="none" stroke="rgba(79,195,255,0.35)" strokeWidth="1.5" strokeDasharray="120 40 20 40" />
          </g>
          <g className="spin-fast" style={{ transformBox: "fill-box" }}>
            <circle cx="450" cy="450" r="270" fill="none" stroke="rgba(79,195,255,0.25)" strokeWidth="6" strokeDasharray="4 10" />
          </g>
          <circle cx="450" cy="450" r="200" fill="none" stroke="rgba(79,195,255,0.12)" strokeWidth="1" />
        </svg>
      )}
      <div className="hud-sweep absolute inset-x-0 top-0" />
      <div className="hud-scanlines absolute inset-0" />
    </div>
  );
}
