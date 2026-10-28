// Reject /manual-pdf paths that are not an allowlisted LEGO or IKEA instruction PDF.
// The rewrites themselves already point only at www.lego.com and www.ikea.com; this stops
// the IKEA rewrite from being used as an open proxy for the rest of that host.
import { NextResponse, type NextRequest } from "next/server";
import { isSafeManualPdfPath } from "@/lib/hosts";

export function proxy(request: NextRequest) {
  if (!isSafeManualPdfPath(request.nextUrl.pathname)) {
    return NextResponse.json({ error: "Manual host not allowed." }, { status: 400 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/manual-pdf/:path*",
};
