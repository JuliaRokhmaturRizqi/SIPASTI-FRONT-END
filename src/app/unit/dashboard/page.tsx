"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { Toaster } from "react-hot-toast";
import {
  Briefcase,
  Building2,
  Info,
  Loader2,
  Menu,
  ShieldCheck,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
import { AuthUser } from "@/types/auth";
import UnitSidebar from "@/components/unit/UnitSidebar";

const ALLOWED_ROLES = ["biro", "pusat", "lab"] as const;

export default function UnitDashboardPage() {
  const router = useRouter();

  // State Otorisasi & Profil Pengguna
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    const initializeUnitDashboard = async () => {
      const session = getAuthSession();

      if (
        !session.token ||
        !session.role ||
        !ALLOWED_ROLES.includes(session.role as (typeof ALLOWED_ROLES)[number])
      ) {
        handleUnauthorizedExit();
        return;
      }

      if (session.user) {
        setUser(session.user);
      }

      try {
        const meResponse = await apiClient.get<{
          status: string;
          data: AuthUser;
        }>("/api/me");

        const verifiedUser = meResponse.data?.data;
        if (
          !verifiedUser ||
          !ALLOWED_ROLES.includes(
            verifiedUser.role as (typeof ALLOWED_ROLES)[number]
          )
        ) {
          handleUnauthorizedExit();
          return;
        }

        if (isMounted) {
          setUser(verifiedUser);
          setIsAuthorized(true);
          setIsCheckingAuth(false);
        }
      } catch (err) {
        const axiosErr = err as AxiosError;
        const status = axiosErr.response?.status;
        if (status === 401 || status === 403 || !axiosErr.response) {
          handleUnauthorizedExit();
        }
      }
    };

    initializeUnitDashboard();

    return () => {
      isMounted = false;
    };
  }, [handleUnauthorizedExit]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutSession();
    } catch {
      clearAuthSession();
    } finally {
      router.replace("/login");
    }
  };

  if (isCheckingAuth || !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl px-8 py-7 flex flex-col items-center gap-3 max-w-sm w-full text-center">
          <div className="w-11 h-11 rounded-xl bg-blue-950 text-white flex items-center justify-center shadow-sm">
            <Loader2 className="w-5 h-5 animate-spin text-[#FBC02D]" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Memverifikasi Otorisasi Sesi Unit Kerja...
          </p>
        </div>
      </div>
    );
  }

  const safeUsername = sanitizePlainText(user?.username || "operator_unit");
  const safeNamaUnit = sanitizePlainText(
    user?.unit_kerja?.nama_unit || "Unit Kerja"
  );
  const safeKategoriUnit = sanitizePlainText(
    user?.unit_kerja?.kategori_unit ||
      (user?.role
        ? `Unit ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`
        : "Unit Kerja")
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <Toaster position="top-right" />

      {/* Sidebar Navigasi Kiri */}
      <UnitSidebar
        username={safeUsername}
        namaUnit={safeNamaUnit}
        kategoriUnit={safeKategoriUnit}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      {/* Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Header Atas */}
        <header className="min-h-16 py-2.5 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              aria-label="Buka navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">
                Dashboard Unit Kerja
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200/80 text-xs text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{safeUsername}</span>
              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-[#0D47A1] font-bold text-[10px]">
                {safeKategoriUnit}
              </span>
            </div>
          </div>
        </header>

        {/* Konten Body */}
        <main className="p-5 sm:p-8 space-y-6 max-w-6xl w-full mx-auto flex-1">
          {/* Banner Selamat Datang */}
          <section
            aria-label="Banner Unit Kerja"
            className="rounded-2xl bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] text-white p-6 sm:p-7 shadow-sm border border-blue-800/30 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#FBC02D]">
                  <Briefcase className="w-3.5 h-3.5" />
                  {safeKategoriUnit}
                </span>
                <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
                  Selamat Datang di Dashboard Unit Kerja
                </h2>
                <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-2xl">
                  Sistem Pelaporan Administrasi Terintegrasi (SIPASTI) Super App.
                  Halaman ini disiapkan untuk mendukung pelaporan berkas dan
                  kinerja unit {safeNamaUnit}.
                </p>
              </div>

              <div className="shrink-0">
                <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 text-xs font-semibold text-white">
                  <Building2 className="w-4 h-4 text-[#FBC02D]" />
                  <strong>{safeNamaUnit}</strong>
                </span>
              </div>
            </div>
          </section>

          {/* Card Info Placeholder */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0D47A1] border border-blue-200/80 flex items-center justify-center mx-auto">
              <Info className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Modul Pelaporan Unit Kerja
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Pondasi integrasi untuk role {safeKategoriUnit} telah aktif. Fitur
              statistik pelaporan, upload dokumen, dan monitoring berkas akan
              dihadirkan pada tahap berikutnya.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
