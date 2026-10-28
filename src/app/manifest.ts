import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BuildSight",
    short_name: "BuildSight",
    description: "Hands-free build copilot. It watches the build and talks you through the manual.",
    start_url: "/",
    display: "standalone",
    background_color: "#04070d",
    theme_color: "#04070d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
