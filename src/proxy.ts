import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate for the admin area: bounce requests with no session cookie
 * to the login page. This is NOT the security boundary — every admin page,
 * server action and route handler re-validates the session against the
 * database and checks the admin's role.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  const hasCookie = request.cookies.has("__Host-ggz_admin") || request.cookies.has("ggz_admin");
  if (!hasCookie) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
