// Small line icons for the hub tabs (24x24, stroked with currentColor).

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
};

export type IconName = keyof typeof ICONS;

export default function Icon({ name, className = "h-4 w-4", strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
