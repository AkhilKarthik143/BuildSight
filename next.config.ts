import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Manual PDFs live on lego.com / ikea.com, which browsers can't fetch directly (CORS).
  // These rewrites serve them from our own domain without going through a function.
  async rewrites() {
    return [
      { source: "/manual-pdf/lego/:file", destination: "https://www.lego.com/cdn/product-assets/product.bi.core.pdf/:file" },
      { source: "/manual-pdf/ikea/:path*", destination: "https://www.ikea.com/:path*" },
    ];
  },
};

export default nextConfig;
