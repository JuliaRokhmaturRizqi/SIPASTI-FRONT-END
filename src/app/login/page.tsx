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
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e8f1fc] text-slate-900 overflow-x-hidden selection:bg-[#0D47A1] selection:text-white">
      {/* =========================================================================
          DECORATIVE BACKGROUND SHAPES (Sesuai Desain Modern SIPASTI)
          ========================================================================= */}

      {/* 1. Sudut Kanan Atas: Lengkungan Emas & Gelombang Biru Langit */}
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 pointer-events-none w-72 h-72 sm:w-96 sm:h-96 lg:w-[480px] lg:h-[480px] overflow-hidden z-0"
      >
        <svg
          viewBox="0 0 500 500"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Layer Gelombang Biru Muda Lembut */}
          <path
            d="M160 0C210 160 360 290 500 310V0H160Z"
            fill="#E3F2FD"
            fillOpacity="0.85"
          />
          {/* Layer Gelombang Biru Langit */}
          <path
            d="M260 0C300 130 400 220 500 240V0H260Z"
            fill="#90CAF9"
            fillOpacity="0.45"
          />
          {/* Aksen Lengkungan Kuning / Emas Khas Kampus */}
          <path
            d="M340 0C360 80 430 150 500 165V0H340Z"
            fill="#FBC02D"
          />
          <circle cx="500" cy="0" r="140" fill="#FFA000" fillOpacity="0.15" />
        </svg>
      </div>

      {/* 2. Sudut Kiri Bawah: Gelombang Biru Tua Melengkung */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 pointer-events-none w-64 h-64 sm:w-80 sm:h-80 lg:w-[460px] lg:h-[340px] overflow-hidden z-0"
      >
        <svg
          viewBox="0 0 460 340"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <path
            d="M0 140C140 150 240 230 280 340H0V140Z"
            fill="#1565C0"
            fillOpacity="0.12"
          />
          <path
            d="M0 210C110 220 190 270 230 340H0V210Z"
            fill="#0D47A1"
          />
        </svg>
      </div>

      {/* 3. Pola Titik Grid (Dot Matrix Pattern) */}
      <div
        aria-hidden="true"
        className="hidden md:grid grid-cols-6 gap-2.5 absolute top-16 left-[36%] opacity-25 pointer-events-none z-0"
      >
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        ))}
      </div>

      {/* =========================================================================
          TOP BRAND HEADER
          ========================================================================= */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-12 pt-6 sm:pt-8 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0D47A1] text-[#FBC02D] flex items-center justify-center shadow-md shadow-blue-900/15 border border-blue-800/30">
            <Building2 className="w-6 h-6 text-[#FBC02D]" />
          </div>
          <div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 block leading-tight">
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
            <div className="text-5xl sm:text-6xl lg:text-7xl font-black text-[#0D47A1] tracking-tight leading-none mt-1">
              SIPASTI
            </div>
            {/* Garis Aksen Kuning Horizontal */}
            <div className="w-20 h-1.5 bg-[#FBC02D] rounded-full mt-3.5" />
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-md mt-4">
              Sistem pelaporan administrasi terintegrasi untuk mendukung
              pengelolaan data dan pelaporan yang lebih efektif.
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
          <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(13,71,161,0.08)] border border-slate-100 p-8 sm:p-10 space-y-6">
            {/* Logo & Judul di Dalam Card */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-center justify-center shadow-xs mb-3">
                <div className="w-11 h-11 rounded-xl bg-[#0D47A1] text-[#FBC02D] flex items-center justify-center shadow-sm">
                  <Building2 className="w-6 h-6 text-[#FBC02D]" />
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                SIPASTI
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Sistem Pelaporan Administrasi Terintegrasi
              </p>

              {/* Garis Aksen Emas Bawah Judul Card */}
              <div className="w-10 h-1 bg-[#FBC02D] rounded-full mt-2.5" />
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
                  <User className="w-4 h-4 text-[#0D47A1]" />
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
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/15 transition duration-200 disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Input Password dengan Toggle Show/Hide */}
              <div>
                <label
                  htmlFor="password"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2"
                >
                  <Lock className="w-4 h-4 text-[#0D47A1]" />
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
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/15 transition duration-200 disabled:bg-slate-50 disabled:cursor-not-allowed"
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
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Tombol Masuk Biru Gradien */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isFormDisabled}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1976D2] hover:from-[#0B3D88] hover:to-[#1565C0] active:scale-[0.99] text-white font-bold py-3.5 px-4 text-sm shadow-md shadow-blue-900/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/40 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#FBC02D]" />
                      <span>Memproses...</span>
                    </>
                  ) : retryCountdown > 0 ? (
                    <span>Tunggu {retryCountdown}d</span>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
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
              <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3.5 flex items-start gap-2.5 text-xs text-blue-800">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
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
            className="hover:text-[#0D47A1] hover:underline font-medium transition cursor-pointer disabled:cursor-not-allowed"
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
            className="hover:text-[#0D47A1] hover:underline font-medium transition cursor-pointer disabled:cursor-not-allowed"
          >
            Prodi (prodi_ti / password123)
          </button>
        </div>
      </footer>
    </div>
  );
}
