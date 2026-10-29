import { NextRequest, NextResponse } from "next/server";

const TOKEN_COOKIE_KEY = "auth_token";
const ROLE_COOKIE_KEY = "auth_role";
const USER_COOKIE_KEY = "auth_user";

/**
 * Next.js Middleware untuk Proteksi Rute berdasarkan Token & Role di Cookies:
 * - /admin/:path* -> Wajib memiliki token dan role === 'admin'
 * - /prodi/:path* -> Wajib memiliki token dan role === 'user'
 * - Jika tidak sah, otomatis redirect ke /login
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(TOKEN_COOKIE_KEY)?.value;
  const role = request.cookies.get(ROLE_COOKIE_KEY)?.value;

  const loginUrl = new URL("/login", request.url);

  // 1. Proteksi Rute /admin/:path*
  if (pathname.startsWith("/admin")) {
    if (!token || role !== "admin") {
      const response = NextResponse.redirect(loginUrl);
      // Hapus cookie jika sesi tidak valid agar tidak memicu redirect loop di /login
      response.cookies.delete(TOKEN_COOKIE_KEY);
      response.cookies.delete(ROLE_COOKIE_KEY);
      response.cookies.delete(USER_COOKIE_KEY);
      return response;
    }
  }

  // 2. Proteksi Rute /prodi/:path*
  if (pathname.startsWith("/prodi")) {
    if (!token || role !== "user") {
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(TOKEN_COOKIE_KEY);
      response.cookies.delete(ROLE_COOKIE_KEY);
      response.cookies.delete(USER_COOKIE_KEY);
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/prodi/:path*"],
};
