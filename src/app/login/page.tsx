"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import Cookies from "js-cookie";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  LogIn,
  User,
} from "lucide-react";
import apiClient, {
  ROLE_COOKIE_KEY,
  TOKEN_COOKIE_KEY,
  USER_COOKIE_KEY,
} from "@/lib/axios";
import { getAuthSession, getDashboardPathByRole } from "@/lib/auth";
import { ApiErrorResponse, LoginSuccessResponse } from "@/types/auth";

export default function LoginPage() {
  const router = useRouter();

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Request & UI feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<
    "credentials" | "ratelimit" | "network" | null
  >(null);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);

  // Cek sesi aktif di Cookies saat halaman dibuka
  useEffect(() => {
    const { token, role } = getAuthSession();
    if (token && role) {
      router.replace(getDashboardPathByRole(role));
    }
  }, [router]);

  // Countdown timer untuk Rate Limit (HTTP 429)
  useEffect(() => {
    if (retryCountdown <= 0) {
      if (errorType === "ratelimit") {
        setErrorMessage(null);
        setErrorType(null);
      }
      return;
    }

    const timer = setInterval(() => {
      setRetryCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [retryCountdown, errorType]);

  /**
   * Handler Submit Login:
   * - Melakukan POST request ke /api/login menggunakan Axios Global
   * - Menyimpan token & role ke Cookies (js-cookie)
   * - Melakukan redirect dinamis (/admin/dashboard atau /prodi/dashboard)
   * - Menampilkan pesan error rapi di UI tanpa console.log
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (retryCountdown > 0 || isLoading) return;

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setErrorType("credentials");
      setErrorMessage("Mohon lengkapi Username dan Password Anda.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setErrorType(null);

    try {
      const response = await apiClient.post<LoginSuccessResponse>(
        "/api/login",
        {
          username: trimmedUsername,
          password,
        }
      );

      const { access_token, role, user } = response.data.data;

      // Simpan token dan role pengguna ke dalam Cookies (js-cookie)
      const cookieOptions: Cookies.CookieAttributes = {
        expires: 1,
        path: "/",
        sameSite: "strict",
        secure:
          typeof window !== "undefined" &&
          window.location.protocol === "https:",
      };

      Cookies.set(TOKEN_COOKIE_KEY, access_token, cookieOptions);
      Cookies.set(ROLE_COOKIE_KEY, role, cookieOptions);
      if (user) {
        Cookies.set(USER_COOKIE_KEY, JSON.stringify(user), cookieOptions);
      }

      setIsSuccess(true);

      // Redirect dinamis berdasarkan role pengguna
      if (role === "admin") {
        router.push("/admin/dashboard");
      } else if (role === "user") {
        router.push("/fakultas/dashboard");
      } else if (role === "biro" || role === "pusat" || role === "lab") {
        router.push("/unit/dashboard");
      } else {
        router.push("/login");
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;

      if (!axiosError.response) {
        setErrorType("network");
        setErrorMessage(
          "Tidak dapat terhubung ke server API. Pastikan backend Laravel sedang berjalan."
        );
      } else {
        const status = axiosError.response.status;
        const data = axiosError.response.data;

        if (status === 429) {
          const seconds = data?.retry_after ?? 60;
          setErrorType("ratelimit");
          setRetryCountdown(seconds);
          setErrorMessage(
            data?.message ||
              `Terlalu banyak percobaan login. Silakan coba lagi dalam ${seconds} detik.`
          );
        } else if (status === 401) {
          setErrorType("credentials");
          setErrorMessage(
            data?.message || "Kredensial yang Anda masukkan tidak valid."
          );
        } else if (status === 422) {
          const firstFieldErrors = data?.errors
            ? Object.values(data.errors)[0]
            : null;
          setErrorType("credentials");
          setErrorMessage(
            firstFieldErrors?.[0] ||
              data?.message ||
              "Data kredensial yang dikirimkan tidak valid."
          );
        } else {
          setErrorType("network");
          setErrorMessage(
            data?.message ||
              `Terjadi kesalahan pada server (Kode: ${status}). Silakan coba beberapa saat lagi.`
          );
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isFormDisabled = isLoading || isSuccess || retryCountdown > 0;

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-slate-50 text-slate-900 overflow-x-hidden selection:bg-unuha-green selection:text-white">
      {/* =========================================================================
          DECORATIVE AMBIENT GLOW BACKGROUND (UNUHA Green & Gold)
          ========================================================================= */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        {/* Pendaran cahaya unuha-green-light di pojok kanan atas */}
        <div className="absolute -top-24 -right-24 w-[420px] h-[420px] sm:w-[540px] sm:h-[540px] rounded-full bg-unuha-green-light blur-[100px] opacity-20" />
        {/* Pendaran halus unuha-gold di pojok kiri bawah */}
        <div className="absolute -bottom-28 -left-24 w-[360px] h-[360px] sm:w-[460px] sm:h-[460px] rounded-full bg-unuha-gold blur-[120px] opacity-15" />
      </div>

      {/* =========================================================================
          TOP BRAND HEADER
          ========================================================================= */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-12 pt-6 sm:pt-8 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-unuha-green to-unuha-green-light flex items-center justify-center shadow-soft border border-white/40">
            <Building2 className="w-6 h-6 text-unuha-gold" />
          </div>
          <div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-unuha-green block leading-tight">
              SIPASTI
            </span>
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium block leading-tight">
              Sistem Pelaporan Administrasi Terintegrasi
            </span>
          </div>
        </div>
      </header>

      {/* =========================================================================
          MAIN CONTAINER (2 KOLOM: HERO + ILUSTRASI DI KIRI & CARD FORM DI KANAN)
          ========================================================================= */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-12 py-8 sm:py-12 flex-1 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-14">
        {/* KOLOM KIRI: Teks Sambutan & Ilustrasi Elemen Login */}
        <section
          aria-label="Informasi SIPASTI"
          className="flex-1 w-full max-w-xl flex flex-col justify-center space-y-4"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-800 tracking-tight">
              Selamat Datang di
            </h1>
            <div className="text-5xl sm:text-6xl lg:text-7xl font-black text-unuha-green tracking-tight leading-none mt-1">
              SIPASTI
            </div>
            {/* Garis Aksen Emas Horizontal */}
            <div className="w-20 h-1.5 bg-unuha-gold rounded-full mt-3.5" />
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-md mt-4">
              Sistem pelaporan administrasi terintegrasi Universitas Nurul Huda
              untuk mendukung pengelolaan data dan pelaporan yang lebih efektif.
            </p>
          </div>

          {/* Gambar Elemen Login (Laptop, Tanaman, dan Checklist Kelulusan) */}
          <div className="relative pt-2 w-full max-w-lg">
            <Image
              src="/images/elemen-login.png"
              alt="Ilustrasi Dasbor dan Pelaporan SIPASTI"
              width={560}
              height={350}
              priority
              className="w-full h-auto drop-shadow-md select-none pointer-events-none"
            />
          </div>
        </section>

        {/* KOLOM KANAN: Card Form Login SIPASTI */}
        <section
          aria-label="Form Login"
          className="w-full max-w-md shrink-0"
        >
          <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-soft border border-white/50 p-8 sm:p-10 space-y-6">
            {/* Logo & Judul di Dalam Card */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50/80 border border-emerald-100 flex items-center justify-center shadow-xs mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-unuha-green to-unuha-green-light flex items-center justify-center shadow-sm">
                  <Building2 className="w-6 h-6 text-unuha-gold" />
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-unuha-green tracking-tight">
                SIPASTI
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Sistem Pelaporan Administrasi Terintegrasi
              </p>

              {/* Garis Aksen Emas Bawah Judul Card */}
              <div className="w-10 h-1 bg-unuha-gold rounded-full mt-2.5" />
            </div>

            {/* Notifikasi Error di UI Form (Tanpa console.log) */}
            {errorMessage && (
              <div
                role="alert"
                className={`rounded-2xl border p-3.5 flex items-start gap-2.5 text-xs sm:text-sm transition-all ${
                  errorType === "ratelimit"
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                {errorType === "ratelimit" ? (
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="leading-relaxed font-medium">{errorMessage}</p>
                  {errorType === "ratelimit" && retryCountdown > 0 && (
                    <p className="mt-1 font-mono text-xs text-amber-900 font-semibold">
                      Coba lagi dalam {retryCountdown} detik
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Notifikasi Sukses */}
            {isSuccess && (
              <div
                role="status"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 flex items-center gap-2.5 text-xs sm:text-sm text-emerald-800"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">
                  Login berhasil. Mengalihkan ke dashboard...
                </span>
              </div>
            )}

            {/* Form Login Interaktif */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Input Username */}
              <div>
                <label
                  htmlFor="username"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2"
                >
                  <User className="w-4 h-4 text-unuha-gold" />
                  <span>Username</span>
                </label>
                <div className="relative">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    disabled={isFormDisabled}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-unuha-green focus:ring-2 focus:ring-unuha-green/15 transition duration-200 disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                  <User className="w-4 h-4 text-unuha-gold/80 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Input Password dengan Toggle Show/Hide */}
              <div>
                <label
                  htmlFor="password"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2"
                >
                  <Lock className="w-4 h-4 text-unuha-gold" />
                  <span>Password</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={isFormDisabled}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-unuha-green focus:ring-2 focus:ring-unuha-green/15 transition duration-200 disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    disabled={isFormDisabled}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-unuha-green focus:outline-none transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Tombol Masuk Gradasi UNUHA Green */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isFormDisabled}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-unuha-green to-unuha-green-light hover:scale-[1.02] hover:shadow-lg hover:shadow-unuha-green/25 active:scale-[0.99] text-white font-bold py-3.5 px-4 text-sm shadow-md shadow-unuha-green/15 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-unuha-green/40 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-unuha-gold" />
                      <span>Memproses...</span>
                    </>
                  ) : retryCountdown > 0 ? (
                    <span>Tunggu {retryCountdown}d</span>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 text-unuha-gold" />
                      <span>Masuk</span>
                    </>
                  )}
                </button>
              </div>

              {/* Garis Pembatas 'atau' */}
              <div className="relative flex items-center justify-center my-4">
                <div className="w-full border-t border-slate-200" />
                <span className="bg-white px-3 text-xs font-medium text-slate-400 absolute">
                  atau
                </span>
              </div>

              {/* Banner Informasi Bantuan */}
              <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3.5 flex items-start gap-2.5 text-xs text-unuha-green">
                <Info className="w-4 h-4 text-unuha-gold shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Pastikan Anda memasukkan username dan password dengan benar.
                </span>
              </div>
            </form>
          </div>
        </section>
      </main>

      {/* =========================================================================
          BOTTOM FOOTER (HAK CIPTA & KREDENSIAL DEMO INTERAKTIF)
          ========================================================================= */}
      <footer className="relative z-10 w-full border-t border-slate-200/80 bg-white/70 backdrop-blur-md py-3.5 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <span>&copy; SIPASTI</span>
          <span>&bull;</span>
          <span>Sistem Pelaporan Administrasi Terintegrasi</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
          <span className="font-semibold text-slate-600">Demo</span>
          <span>|</span>
          <button
            type="button"
            disabled={isFormDisabled}
            onClick={() => {
              setUsername("admin");
              setPassword("password123");
            }}
            className="hover:text-unuha-green hover:underline font-medium transition cursor-pointer disabled:cursor-not-allowed"
          >
            Admin (admin / password123)
          </button>
          <span>|</span>
          <button
            type="button"
            disabled={isFormDisabled}
            onClick={() => {
              setUsername("prodi_ti");
              setPassword("password123");
            }}
            className="hover:text-unuha-green hover:underline font-medium transition cursor-pointer disabled:cursor-not-allowed"
          >
            Prodi (prodi_ti / password123)
          </button>
        </div>
      </footer>
    </div>
  );
}
