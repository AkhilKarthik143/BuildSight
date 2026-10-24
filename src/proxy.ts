import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken, passcode, safeEqual } from "@/lib/access";

// Runs before every request (except static assets, see matcher) and enforces the passcode lock.
export async function proxy(request: NextRequest) {
  const code = passcode();
  if (!code) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname === "/unlock" || pathname === "/api/unlock") return NextResponse.next();

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await accessToken(code))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked. Enter the passcode first." }, { status: 401 });
  }
  const unlock = new URL("/unlock", request.url);
  if (pathname !== "/") unlock.searchParams.set("next", pathname + search);
  return NextResponse.redirect(unlock);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
