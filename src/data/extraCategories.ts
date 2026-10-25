// Display-only hub categories beyond LEGO and IKEA. No manuals or build flow behind them:
// tapping a card shows a short toast. To remove them, delete this file, ExtraCard.tsx,
// public/images/extra and its CREDITS.md entries, and the lines in Hub.tsx that use them.

import type { IconName } from "@/components/hud/ExtraIcons";

export type ExtraProject = {
  id: string;
  title: string;
  subtitle: string; // shown where LEGO shows "#set · pcs · age"
  image: string; // square WebP in public/images/extra (sources in CREDITS.md)
  alt: string;
  href?: string; // opens Practice Mode instead of the demo toast
};

export type ExtraCategory = {
  id: string;
  label: string;
  icon: IconName;
  description: string;
  projects: ExtraProject[];
};

export const EXTRA_CATEGORIES: ExtraCategory[] = [
  {
    id: "pc",
    label: "PC Build",
    icon: "cpu",
    description: "Seat a CPU, route the cables, add more RAM. BuildSight checks each part before you power on.",
    projects: [
      {
        id: "pc-gpu",
        title: "Install RAM + GPU",
        subtitle: "4 steps · 10 min · Beginner",
        image: "/images/extra/pc/install-a-gpu.webp",
        alt: "An open PC tower on a desk with a graphics card fitted below the CPU cooler",
        href: "/practice/pc",
      },
      { id: "pc-gaming", title: "Gaming PC build", subtitle: "12 steps · 2 hr · Intermediate", image: "/images/extra/pc/gaming-pc-build.webp", alt: "An open PC case with the motherboard, water cooler and power supply installed" },
      { id: "pc-ram", title: "Upgrade RAM", subtitle: "4 steps · 10 min · Beginner", image: "/images/extra/pc/upgrade-ram.webp", alt: "Four RAM sticks seated in a motherboard's memory slots" },
      { id: "pc-ssd", title: "Add an M.2 SSD", subtitle: "5 steps · 15 min · Beginner", image: "/images/extra/pc/add-an-m2-ssd.webp", alt: "An M.2 SSD installed in its slot on a motherboard" },
    ],
  },
  {
    id: "home",
    label: "Home Repair",
    icon: "home",
    description: "Fix a drip, swap a switch, patch a wall, with every step checked on camera.",
    projects: [
      { id: "home-faucet", title: "Fix a leaky faucet", subtitle: "7 steps · 30 min · Beginner", image: "/images/extra/home/fix-a-leaky-faucet.webp", alt: "Water dripping from an outdoor faucet" },
      { id: "home-switch", title: "Install a light switch", subtitle: "8 steps · 25 min · Intermediate", image: "/images/extra/home/install-a-light-switch.webp", alt: "A wall switch pulled out of its box with the wires still connected" },
      { id: "home-drywall", title: "Patch drywall", subtitle: "6 steps · 45 min · Beginner", image: "/images/extra/home/patch-drywall.webp", alt: "Hands spreading plaster on a wall with two trowels" },
    ],
  },
  {
    id: "car",
    label: "Car Care",
    icon: "car",
    description: "Change a tire, check your oil, swap wiper blades, talked through hands-free at the curb.",
    projects: [
      { id: "car-tire", title: "Change a tire", subtitle: "9 steps · 30 min · Beginner", image: "/images/extra/car/change-a-tire.webp", alt: "Hands loosening a car wheel's lug nuts with a wrench" },
      { id: "car-oil", title: "Check engine oil", subtitle: "4 steps · 5 min · Beginner", image: "/images/extra/car/check-engine-oil.webp", alt: "A hand pulling the oil dipstick from a car engine" },
      { id: "car-wipers", title: "Replace wiper blades", subtitle: "5 steps · 10 min · Beginner", image: "/images/extra/car/replace-wiper-blades.webp", alt: "Close-up of a windshield wiper blade on a wet windshield" },
    ],
  },
  {
    id: "bike",
    label: "Bike Repair",
    icon: "bike",
    description: "Patch a flat, tune your brakes, clean the chain, without greasy fingers on your phone.",
    projects: [
      { id: "bike-flat", title: "Fix a flat tire", subtitle: "8 steps · 20 min · Beginner", image: "/images/extra/bike/fix-a-flat-tire.webp", alt: "A bicycle wheel with a flat tire resting on a concrete ledge" },
      { id: "bike-brakes", title: "Adjust brakes", subtitle: "6 steps · 15 min · Intermediate", image: "/images/extra/bike/adjust-brakes.webp", alt: "Close-up of a bicycle rim brake caliper next to the tire" },
      { id: "bike-chain", title: "Clean and oil the chain", subtitle: "5 steps · 15 min · Beginner", image: "/images/extra/bike/clean-and-oil-the-chain.webp", alt: "Hands working on a bike chain at a workbench" },
    ],
  },
  {
    id: "field",
    label: "Field Technician",
    icon: "hardhat",
    description: "Service, install and wire equipment on site, with each connection verified before you sign off.",
    projects: [
      { id: "field-hvac", title: "HVAC filter service", subtitle: "6 steps · 20 min · Field", image: "/images/extra/field/hvac-filter-service.webp", alt: "An air conditioner's outdoor unit mounted on a brick wall" },
      { id: "field-solar", title: "Solar panel mount", subtitle: "10 steps · 1 hr · Field", image: "/images/extra/field/solar-panel-mount.webp", alt: "A worker lifting a solar panel into place on a roof" },
      { id: "field-rack", title: "Network rack wiring", subtitle: "9 steps · 45 min · Field", image: "/images/extra/field/network-rack-wiring.webp", alt: "Network cables plugged into a numbered patch panel" },
    ],
  },
  {
    id: "aid",
    label: "First Aid",
    icon: "aid",
    description: "Pack a kit, use an AED, put on PPE the right way, with calm voice guidance step by step.",
    projects: [
      { id: "aid-kit", title: "Build a first-aid kit", subtitle: "8 steps · 15 min · Beginner", image: "/images/extra/aid/build-a-first-aid-kit.webp", alt: "An open first-aid bag full of bandages and supplies" },
      { id: "aid-aed", title: "Use an AED", subtitle: "7 steps · 3 min · Essential", image: "/images/extra/aid/use-an-aed.webp", alt: "Hands doing chest compressions on a CPR training dummy" },
      { id: "aid-ppe", title: "Put on PPE", subtitle: "6 steps · 5 min · Essential", image: "/images/extra/aid/put-on-ppe.webp", alt: "A person in a protective suit, face shield and blue gloves" },
    ],
  },
];
