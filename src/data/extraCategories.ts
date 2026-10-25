// Display-only hub categories beyond LEGO and IKEA. No manuals or build flow behind them:
// tapping a card shows a short toast. To remove them, delete this file, ExtraCard.tsx and
// ExtraIcons.tsx, and the lines in Hub.tsx that import them.

import type { IconName } from "@/components/hud/ExtraIcons";

export type ExtraProject = {
  id: string;
  title: string;
  subtitle: string; // shown where LEGO shows "#set · pcs · age"
  icon: IconName;
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
      { id: "pc-gaming", title: "Gaming PC build", subtitle: "12 steps · 2 hr · Intermediate", icon: "monitor" },
      { id: "pc-gpu", title: "Install a GPU", subtitle: "6 steps · 20 min · Beginner", icon: "gpu" },
      { id: "pc-ram", title: "Upgrade RAM", subtitle: "4 steps · 10 min · Beginner", icon: "ram" },
      { id: "pc-ssd", title: "Add an M.2 SSD", subtitle: "5 steps · 15 min · Beginner", icon: "drive" },
    ],
  },
  {
    id: "home",
    label: "Home Repair",
    icon: "home",
    description: "Fix a drip, swap a switch, patch a wall, with every step checked on camera.",
    projects: [
      { id: "home-faucet", title: "Fix a leaky faucet", subtitle: "7 steps · 30 min · Beginner", icon: "droplet" },
      { id: "home-switch", title: "Install a light switch", subtitle: "8 steps · 25 min · Intermediate", icon: "switch" },
      { id: "home-drywall", title: "Patch drywall", subtitle: "6 steps · 45 min · Beginner", icon: "wall" },
    ],
  },
  {
    id: "car",
    label: "Car Care",
    icon: "car",
    description: "Change a tire, check your oil, swap wiper blades, talked through hands-free at the curb.",
    projects: [
      { id: "car-tire", title: "Change a tire", subtitle: "9 steps · 30 min · Beginner", icon: "wheel" },
      { id: "car-oil", title: "Check engine oil", subtitle: "4 steps · 5 min · Beginner", icon: "oil" },
      { id: "car-wipers", title: "Replace wiper blades", subtitle: "5 steps · 10 min · Beginner", icon: "wiper" },
    ],
  },
  {
    id: "bike",
    label: "Bike Repair",
    icon: "bike",
    description: "Patch a flat, tune your brakes, clean the chain, without greasy fingers on your phone.",
    projects: [
      { id: "bike-flat", title: "Fix a flat tire", subtitle: "8 steps · 20 min · Beginner", icon: "wheel" },
      { id: "bike-brakes", title: "Adjust brakes", subtitle: "6 steps · 15 min · Intermediate", icon: "brake" },
      { id: "bike-chain", title: "Clean and oil the chain", subtitle: "5 steps · 15 min · Beginner", icon: "chain" },
    ],
  },
  {
    id: "field",
    label: "Field Technician",
    icon: "hardhat",
    description: "Service, install and wire equipment on site, with each connection verified before you sign off.",
    projects: [
      { id: "field-hvac", title: "HVAC filter service", subtitle: "6 steps · 20 min · Field", icon: "fan" },
      { id: "field-solar", title: "Solar panel mount", subtitle: "10 steps · 1 hr · Field", icon: "solar" },
      { id: "field-rack", title: "Network rack wiring", subtitle: "9 steps · 45 min · Field", icon: "network" },
    ],
  },
  {
    id: "aid",
    label: "First Aid",
    icon: "aid",
    description: "Pack a kit, use an AED, put on PPE the right way, with calm voice guidance step by step.",
    projects: [
      { id: "aid-kit", title: "Build a first-aid kit", subtitle: "8 steps · 15 min · Beginner", icon: "kit" },
      { id: "aid-aed", title: "Use an AED", subtitle: "7 steps · 3 min · Essential", icon: "heart" },
      { id: "aid-ppe", title: "Put on PPE", subtitle: "6 steps · 5 min · Essential", icon: "shield" },
    ],
  },
];
