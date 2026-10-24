"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Loader2,
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
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Ambient Mesh Gradient Orbs untuk menonjolkan efek Glassmorphism */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[30rem] w-[30rem] rounded-full bg-blue-800/10 blur-3xl"
      />

      {/* Centered Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-2xl p-8 sm:p-10">
        {/* Header Card */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            SIPASTI
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Sistem Pelaporan Administrasi Terintegrasi
          </p>
        </div>

        {/* Notifikasi Error / Rate Limit 429 */}
        {errorMessage && (
          <div
            role="alert"
            className={`mb-6 rounded-xl border p-3.5 flex items-start gap-3 text-xs sm:text-sm backdrop-blur-md transition-all ${
              errorType === "ratelimit"
                ? "bg-amber-500/15 border-amber-400/40 text-amber-100"
                : "bg-red-500/15 border-red-400/40 text-red-100"
            }`}
          >
            {errorType === "ratelimit" ? (
              <Clock className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="leading-relaxed">{errorMessage}</p>
              {errorType === "ratelimit" && retryCountdown > 0 && (
                <p className="mt-1.5 font-mono text-xs text-amber-200 font-medium">
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
            className="mb-6 rounded-xl border border-emerald-400/40 bg-emerald-500/15 p-3.5 flex items-center gap-3 text-xs sm:text-sm text-emerald-100 backdrop-blur-md"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>Login berhasil. Mengalihkan ke dashboard...</span>
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Input Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-medium text-white/90 mb-2"
            >
              Username
            </label>
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
              className="w-full rounded-xl bg-white/5 border border-white/30 px-4 py-3 text-sm text-white placeholder:text-white/40 transition duration-200 focus:outline-none focus:border-white/80 focus:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Input Password dengan Toggle Show/Hide */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-white/90 mb-2"
            >
              Password
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
                className="w-full rounded-xl bg-white/5 border border-white/30 pl-4 pr-11 py-3 text-sm text-white placeholder:text-white/40 transition duration-200 focus:outline-none focus:border-white/80 focus:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-white/50 hover:text-white/90 focus:outline-none transition-colors disabled:opacity-40 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Tombol Login */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isFormDisabled}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium py-3 px-4 text-sm shadow-lg shadow-blue-950/50 transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400/60 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : retryCountdown > 0 ? (
                <span>Tunggu {retryCountdown}d</span>
              ) : (
                <span>Masuk</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Informasi Akun Demo (Subtle di luar Card bagian bawah) */}
      <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/40">
        <span>Demo:</span>
        <button
          type="button"
          disabled={isFormDisabled}
          onClick={() => {
            setUsername("admin");
            setPassword("password123");
          }}
          className="hover:text-white/70 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          Admin (admin / password123)
        </button>
        <span aria-hidden="true">&bull;</span>
        <button
          type="button"
          disabled={isFormDisabled}
          onClick={() => {
            setUsername("prodi_ti");
            setPassword("password123");
          }}
          className="hover:text-white/70 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          Prodi (prodi_ti / password123)
        </button>
      </div>
    </main>
  );
}
