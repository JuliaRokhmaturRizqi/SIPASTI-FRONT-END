import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

export const TOKEN_COOKIE_KEY = "auth_token";
export const ROLE_COOKIE_KEY = "auth_role";
export const USER_COOKIE_KEY = "auth_user";

/**
 * Base URL Backend Laravel (Default: http://localhost:8000)
 */
const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * Instance Axios Global untuk komunikasi HTTP antara Next.js dan API Laravel Sanctum.
 */
const apiClient = axios.create({
  baseURL: BACKEND_BASE_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

/**
 * Request Interceptor:
 * 1. Menormalisasi prefix endpoint '/api' agar pemanggilan '/api/login' maupun '/login' selalu konsisten.
 * 2. Mengambil token autentikasi dari Cookies (js-cookie) dan menyisipkannya ke header Authorization: Bearer <token>.
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.url && !config.url.startsWith("http")) {
      const cleanPath = config.url.startsWith("/")
        ? config.url
        : `/${config.url}`;
      config.url = cleanPath.startsWith("/api/")
        ? cleanPath
        : `/api${cleanPath}`;
    }

    if (typeof window !== "undefined") {
      const token = Cookies.get(TOKEN_COOKIE_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor:
 * Jika menerima error 401 (Unauthorized), otomatis hapus token & data sesi dari Cookies
 * dan redirect user ke halaman /login.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window !== "undefined" && error.response?.status === 401) {
      const requestUrl = error.config?.url || "";
      const isLoginAttempt = requestUrl.endsWith("/login");

      // Hapus seluruh cookie autentikasi
      Cookies.remove(TOKEN_COOKIE_KEY, { path: "/" });
      Cookies.remove(ROLE_COOKIE_KEY, { path: "/" });
      Cookies.remove(USER_COOKIE_KEY, { path: "/" });

      // Redirect otomatis ke /login jika 401 terjadi di luar proses submit form login
      if (!isLoginAttempt && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
