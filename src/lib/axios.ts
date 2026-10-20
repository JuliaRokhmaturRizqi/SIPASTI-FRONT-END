import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

export const TOKEN_COOKIE_KEY = "auth_token";
export const ROLE_COOKIE_KEY = "auth_role";
export const USER_COOKIE_KEY = "auth_user";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/**
 * Konfigurasi Axios Client utama untuk komunikasi dengan Laravel REST API (Sanctum).
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

/**
 * Request Interceptor:
 * Otomatis menyertakan header Authorization: Bearer <token> jika token tersedia di Cookie.
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
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
 * Menangani error global seperti sesi kadaluarsa (401 Unauthorized di luar halaman login).
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window !== "undefined" && error.response?.status === 401) {
      const requestUrl = error.config?.url || "";
      // Jangan hapus cookie atau redirect paksa jika error 401 berasal dari percobaan form /login
      if (!requestUrl.includes("/login")) {
        Cookies.remove(TOKEN_COOKIE_KEY, { path: "/" });
        Cookies.remove(ROLE_COOKIE_KEY, { path: "/" });
        Cookies.remove(USER_COOKIE_KEY, { path: "/" });
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
