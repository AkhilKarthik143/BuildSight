// Small line icons for hub tabs and the display-only category cards (24x24, stroked with currentColor).

const ICONS = {
  // tabs
  brick: (
    <>
      <rect x="3" y="9" width="18" height="11" rx="1.5" />
      <path d="M6.5 9V6.5h4V9M13.5 9V6.5h4V9" />
    </>
  ),
  chair: (
    <>
      <path d="M7 3h10v8H7zM5 11h14v3H5zM7 14v7M17 14v7" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <rect x="9.5" y="9.5" width="5" height="5" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
  home: <path d="M3 11 12 4l9 7M5 9.5V20h5v-6h4v6h5V9.5" />,
  car: (
    <>
      <path d="M3 16v-4l2.2-5A2 2 0 0 1 7 6h10a2 2 0 0 1 1.8 1L21 12v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3.5 12h17" />
      <circle cx="7.5" cy="17" r="2" />
      <circle cx="16.5" cy="17" r="2" />
    </>
  ),
  bike: (
    <>
      <circle cx="5.5" cy="16" r="3.5" />
      <circle cx="18.5" cy="16" r="3.5" />
      <path d="M5.5 16 9 9h7l2.5 7M9 9l3.5 7h-7M12 6h2.5M16 9l-1-3h2" />
    </>
  ),
  hardhat: <path d="M3 18h18v-2a9 9 0 0 0-18 0zM10 7V5h4v2M9 7.5V12M15 7.5V12" />,
  aid: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M9 6V4h6v2M12 10v6M9 13h6" />
    </>
  ),
  // PC
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16v4" />
    </>
  ),
  gpu: (
    <>
      <rect x="2" y="6" width="20" height="10" rx="1.5" />
      <circle cx="8" cy="11" r="2.5" />
      <circle cx="16" cy="11" r="2.5" />
      <path d="M5 16v3M9 16v3" />
    </>
  ),
  ram: (
    <>
      <rect x="2" y="7" width="20" height="8" rx="1" />
      <path d="M6 10v2M10 10v2M14 10v2M18 10v2M4 15v3M8 15v3M12 15v3M16 15v3M20 15v3" />
    </>
  ),
  drive: (
    <>
      <rect x="2" y="9" width="20" height="6" rx="1" />
      <path d="M6 11h5M14 11h2M19 12h0.01" />
    </>
  ),
  // Home
  droplet: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11zM9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" />,
  switch: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <rect x="10" y="7" width="4" height="10" rx="1" />
      <path d="M10 12h4" />
    </>
  ),
  wall: <path d="M3 5h18v14H3zM3 9.5h18M3 14.5h18M9 5v4.5M15 5v4.5M6 9.5v5M12 9.5v5M18 9.5v5M9 14.5V19M15 14.5V19" />,
  // Car
  wheel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 3v6.5M12 14.5V21M3 12h6.5M14.5 12H21" />
    </>
  ),
  oil: <path d="M3 10h9l3 3 5-3-6 8H3zM6 10V7h3v3M20 14v1.5" />,
  wiper: <path d="M4 19 18 5M18 5l2 2M8 15l-3-3M12 11l-3-3M16 7l-3-3M3 21h18" />,
  // Bike
  brake: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M7 5.5 5 3M17 5.5 19 3M8 4.8v3M16 4.8v3" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  chain: (
    <>
      <rect x="2" y="9" width="10" height="6" rx="3" />
      <rect x="12" y="9" width="10" height="6" rx="3" />
      <path d="M8 12h8" />
    </>
  ),
  // Field technician
  fan: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="M12 10.5C11 7 12 5 14 5s2 3-2 5.5M13.5 12c3.5-1 5.5 0 5.5 2s-3 2-5.5-2M12 13.5c1 3.5 0 5.5-2 5.5s-2-3 2-5.5M10.5 12C7 13 5 12 5 10s3-2 5.5 2" />
    </>
  ),
  solar: <path d="M4 15 7 5h10l3 10zM5.5 10h13M10.5 5 9.5 15M13.5 5l1 10M12 15v4M8 21h8" />,
  network: (
    <>
      <rect x="3" y="3" width="18" height="6" rx="1" />
      <rect x="3" y="12" width="18" height="6" rx="1" />
      <path d="M6 6h.01M6 15h.01M10 6h8M10 15h8M12 18v3" />
    </>
  ),
  // First aid
  kit: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V4h8v3M12 10.5v6M9 13.5h6" />
    </>
  ),
  heart: <path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 6.5a4.5 4.5 0 0 1 8 3c0 5.9-8 10.5-8 10.5zM5 12h4l1.5-3 3 6 1.5-3h4" />,
  shield: <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6zM9 12l2 2 4-4" />,
};

export type IconName = keyof typeof ICONS;

export default function Icon({ name, className = "h-4 w-4", strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
