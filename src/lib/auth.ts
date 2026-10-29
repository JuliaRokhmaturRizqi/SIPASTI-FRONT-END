import Cookies from "js-cookie";
import apiClient, {
  ROLE_COOKIE_KEY,
  TOKEN_COOKIE_KEY,
  USER_COOKIE_KEY,
} from "./axios";
import { AuthUser, LoginSuccessResponse, UserRole } from "@/types/auth";

/**
 * Opsi keamanan Cookie default (berlaku 1 hari, SameSite Strict).
 */
const getCookieOptions = (): Cookies.CookieAttributes => ({
  expires: 1,
  path: "/",
  sameSite: "strict",
  secure:
    typeof window !== "undefined" && window.location.protocol === "https:",
});

/**
 * Menyimpan Token Sanctum, Role, dan profil singkat User ke dalam Cookie.
 */
export function setAuthSession(
  token: string,
  role: UserRole,
  user?: AuthUser | null
): void {
  const options = getCookieOptions();
  Cookies.set(TOKEN_COOKIE_KEY, token, options);
  Cookies.set(ROLE_COOKIE_KEY, role, options);
  if (user) {
    Cookies.set(USER_COOKIE_KEY, JSON.stringify(user), options);
  }
}

/**
 * Menghapus seluruh data autentikasi dari Cookie.
 */
export function clearAuthSession(): void {
  Cookies.remove(TOKEN_COOKIE_KEY, { path: "/" });
  Cookies.remove(ROLE_COOKIE_KEY, { path: "/" });
  Cookies.remove(USER_COOKIE_KEY, { path: "/" });
}

/**
 * Mengambil informasi sesi dari Cookie (client-side).
 */
export function getAuthSession(): {
  token: string | undefined;
  role: UserRole | undefined;
  user: AuthUser | null;
} {
  const token = Cookies.get(TOKEN_COOKIE_KEY);
  const rawRole = Cookies.get(ROLE_COOKIE_KEY);
  const role: UserRole | undefined =
    rawRole === "admin" || rawRole === "user" ? rawRole : undefined;
  const rawUser = Cookies.get(USER_COOKIE_KEY);

  let user: AuthUser | null = null;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser) as AuthUser;
    } catch {
      user = null;
    }
  }

  return { token, role, user };
}

/**
 * Menentukan path redirect dashboard berdasarkan role user.
 */
export function getDashboardPathByRole(role?: UserRole | string): string {
  if (role === "admin") {
    return "/admin/dashboard";
  }
  return "/prodi/dashboard";
}

/**
 * Memanggil endpoint POST /api/login dan menyimpan sesi ke Cookies jika berhasil.
 */
export async function loginWithCredentials(
  username: string,
  password: string
): Promise<LoginSuccessResponse> {
  const response = await apiClient.post<LoginSuccessResponse>("/api/login", {
    username,
    password,
  });

  const { access_token, role, user } = response.data.data;
  setAuthSession(access_token, role, user);

  return response.data;
}

/**
 * Memanggil endpoint POST /api/logout untuk mencabut token Sanctum dan menghapus sesi lokal.
 */
export async function logoutSession(): Promise<void> {
  try {
    await apiClient.post("/api/logout");
  } finally {
    clearAuthSession();
  }
}
