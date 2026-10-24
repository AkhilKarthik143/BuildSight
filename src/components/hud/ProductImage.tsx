"use client";

import Image from "next/image";
import { useState } from "react";

// Product photo on a white tile: resized by Next's optimizer, shimmer until loaded, then fades in.
export default function ProductImage({ src, sizes, padded = true, className = "" }: { src: string; sizes: string; padded?: boolean; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  // LEGO/IKEA CDNs ignore resize params; drop them so the optimizer's allow-list matches.
  const clean = src.split("?")[0];
  return (
    <>
      {!loaded && <span aria-hidden className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />}
      <Image
        src={clean}
        alt=""
        fill
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        className={`object-contain transition duration-500 ${padded ? "p-3" : ""} ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
      />
    </>
  );
}
