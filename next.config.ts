import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Azure container image builds a self-contained server (Dockerfile sets BUILD_STANDALONE); Vercel doesn't need it.
  ...(process.env.BUILD_STANDALONE ? { output: "standalone" as const } : {}),
  // Application Insights (src/instrumentation.node.ts) loads from node_modules at runtime rather than being bundled.
  serverExternalPackages: ["@azure/monitor-opentelemetry"],
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
  // Product photos are resized and cached by Next's image optimizer (LEGO's CDN ignores size params).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.lego.com", pathname: "/cdn/product-assets/**", search: "" },
      { protocol: "https", hostname: "www.ikea.com", pathname: "/us/en/images/products/**", search: "" },
    ],
  },
  // Manuals never change: let Vercel's CDN keep them, so only the first open hits lego.com / ikea.com.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // camera and microphone stay available on this origin; the build screen needs both
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self)" },
        ],
      },
      {
        source: "/manual-pdf/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
          { key: "CDN-Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
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
