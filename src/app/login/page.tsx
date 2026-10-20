"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileCheck2,
  Loader2,
  Lock,
  ShieldCheck,
  User,
} from "lucide-react";
import {
  getAuthSession,
  getDashboardPathByRole,
  loginWithCredentials,
} from "@/lib/auth";
import { ApiErrorResponse } from "@/types/auth";

export default function LoginPage() {
  const router = useRouter();

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Request & feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<
    "credentials" | "ratelimit" | "network" | null
  >(null);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);

  // Cek sesi aktif saat halaman dibuka
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
      const result = await loginWithCredentials(trimmedUsername, password);
      const userRole = result.data.role;

      setIsSuccess(true);
      const targetPath = getDashboardPathByRole(userRole);
      router.push(targetPath);
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;

      if (!axiosError.response) {
        setErrorType("network");
        setErrorMessage(
          "Tidak dapat terhubung ke server API (http://localhost:8000). Pastikan backend Laravel sedang berjalan."
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
              "Data yang dikirimkan tidak valid."
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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50">
      {/* Panel Kiri: Branding & Informasi Sistem (Deep Blue #0D47A1 + Golden Yellow #FBC02D) */}
      <div className="relative lg:w-7/12 xl:w-1/2 bg-[#0D47A1] text-white flex flex-col justify-between p-8 sm:p-12 lg:p-16 overflow-hidden">
        {/* Dekorasi Latar Geometris */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#1565C0] opacity-50 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-[#FBC02D]/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-10"
        />

        {/* Header Branding */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#FBC02D] text-[#0D47A1] flex items-center justify-center shadow-lg shadow-black/20 font-bold">
            <Building2 className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#FBC02D]">
              Portal Akademik Resmi
            </span>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              SIPAT — Administrasi Terintegrasi
            </h1>
          </div>
        </div>

        {/* Konten Utama Hero Kiri */}
        <div className="relative z-10 my-10 lg:my-auto max-w-xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-[#FBC02D] animate-pulse" />
            <span className="text-xs font-medium text-blue-100">
              Monitoring & Evaluasi Pelaporan Program Studi
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[2.5rem] font-extrabold leading-tight tracking-tight mb-5">
            Sistem Pelaporan{" "}
            <span className="text-[#FBC02D] underline decoration-[#FBC02D]/40 decoration-wavy underline-offset-8">
              Administrasi
            </span>{" "}
            Terintegrasi
          </h2>

          <p className="text-blue-100/90 text-sm sm:text-base leading-relaxed mb-8">
            Platform terpusat untuk pengelolaan periode akademik, pengunggahan
            dokumen pelaporan bertahap (Tahap 1 s.d. Tahap 4), serta verifikasi
            dan validasi pemenuhan standar administrasi Program Studi.
          </p>

          {/* Kartu Fitur Utama */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-[#FBC02D]/20 text-[#FBC02D] shrink-0">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">
                  Pelaporan 4 Tahap
                </h3>
                <p className="text-xs text-blue-100/80 mt-1 leading-relaxed">
                  Alur pengumpulan dokumen terstruktur sesuai siklus periode
                  akademik aktif.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-[#FBC02D]/20 text-[#FBC02D] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">
                  Otorisasi Terproteksi
                </h3>
                <p className="text-xs text-blue-100/80 mt-1 leading-relaxed">
                  Keamanan berbasis token Sanctum dengan pemisahan hak akses
                  Admin &amp; Prodi.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Kiri */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-6 border-t border-white/15 text-xs text-blue-200">
          <span>
            &copy; {new Date().getFullYear()} Sistem Pelaporan Administrasi
            Terintegrasi
          </span>
          <span className="flex items-center gap-1.5 text-[#FBC02D] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FBC02D]" />
            Terhubung ke REST API v1.0
          </span>
        </div>
      </div>

      {/* Panel Kanan: Form Autentikasi Login */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/70 border border-slate-100 p-7 sm:p-10 relative overflow-hidden">
          {/* Aksen Garis Atas Deep Blue & Golden Yellow */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#FBC02D]" />

          {/* Header Form */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#0D47A1]/8 text-[#0D47A1] text-xs font-semibold mb-3">
              <Lock className="w-3.5 h-3.5 text-[#FBC02D] fill-[#FBC02D]" />
              Autentikasi Pengguna
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Selamat Datang
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Silakan masuk menggunakan akun Administrator atau Program Studi
              Anda.
            </p>
          </div>

          {/* Notifikasi Error / Rate Limit 429 */}
          {errorMessage && (
            <div
              role="alert"
              className={`mb-6 rounded-xl border p-4 flex items-start gap-3 transition-all ${
                errorType === "ratelimit"
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {errorType === "ratelimit" ? (
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs sm:text-sm">
                <p className="font-semibold">
                  {errorType === "ratelimit"
                    ? "Batas Percobaan Login Terlampaui (429)"
                    : errorType === "network"
                    ? "Gangguan Koneksi Server"
                    : "Autentikasi Gagal"}
                </p>
                <p className="mt-1 leading-relaxed opacity-90">
                  {errorMessage}
                </p>
                {errorType === "ratelimit" && retryCountdown > 0 && (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-200/70 text-amber-950 font-mono text-xs font-semibold">
                    <span>Coba lagi dalam:</span>
                    <span>{retryCountdown} detik</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notifikasi Sukses */}
          {isSuccess && (
            <div
              role="status"
              className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3 text-emerald-800"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs sm:text-sm">
                <p className="font-semibold">Login Berhasil!</p>
                <p className="opacity-90">
                  Mengalihkan Anda ke halaman dashboard...
                </p>
              </div>
            </div>
          )}

          {/* Form Login */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Input Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2"
              >
                Username
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  disabled={isFormDisabled}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username (misal: admin)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:bg-white focus:border-[#0D47A1] focus:outline-none focus:ring-3 focus:ring-[#0D47A1]/15 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Input Password dengan Toggle Show/Hide */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={isFormDisabled}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-12 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:bg-white focus:border-[#0D47A1] focus:outline-none focus:ring-3 focus:ring-[#0D47A1]/15 disabled:opacity-60 disabled:cursor-not-allowed"
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
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-[#0D47A1] focus:outline-none transition-colors disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Tombol Submit Login */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isFormDisabled}
                className="group relative w-full flex items-center justify-center gap-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#082f6e] active:bg-[#062354] text-white font-semibold py-3.5 px-5 text-sm shadow-lg shadow-[#0D47A1]/25 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[#FBC02D]/50 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-[#FBC02D]" />
                    <span>Memverifikasi Kredensial...</span>
                  </>
                ) : retryCountdown > 0 ? (
                  <>
                    <Clock className="w-5 h-5 text-[#FBC02D]" />
                    <span>Terkunci Sementara ({retryCountdown}d)</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Sistem</span>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#FBC02D] text-[#0D47A1] transition-transform group-hover:translate-x-1">
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Info Tambahan / Bantuan Kredensial Seeder untuk Pengujian */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs text-slate-600">
              <p className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FBC02D]" />
                Akun Demo (Database Seeder):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <button
                  type="button"
                  disabled={isFormDisabled}
                  onClick={() => {
                    setUsername("admin");
                    setPassword("password123");
                  }}
                  className="text-left p-2 rounded-lg bg-white border border-slate-200 hover:border-[#0D47A1] transition cursor-pointer"
                >
                  <span className="font-bold text-[#0D47A1] block">
                    Role Admin
                  </span>
                  <span className="font-mono text-slate-500">
                    admin / password123
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isFormDisabled}
                  onClick={() => {
                    setUsername("prodi_ti");
                    setPassword("password123");
                  }}
                  className="text-left p-2 rounded-lg bg-white border border-slate-200 hover:border-[#0D47A1] transition cursor-pointer"
                >
                  <span className="font-bold text-[#0D47A1] block">
                    Role Prodi (User)
                  </span>
                  <span className="font-mono text-slate-500">
                    prodi_ti / password123
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
