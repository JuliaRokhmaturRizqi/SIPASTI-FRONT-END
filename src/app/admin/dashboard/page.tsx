"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { AuthUser } from "@/types/auth";
import {
  DokumenApiRecord,
  DokumenListResponse,
  PeriodeApiRecord,
  PeriodeListResponse,
} from "@/types/dokumen";
import { LaporanKinerjaItem } from "@/types/laporan";
import AdminSidebar from "@/components/admin/AdminSidebar";

interface ExecutiveStats {
  totalProdi: number;
  totalDokumenAkademik: number;
  dokumenTervalidasi: number;
  dokumenMenungguReview: number;
  totalUnitKerja: number;
  totalLaporanKinerja: number;
  laporanMenungguAdmin: number;
  laporanSelesai: number;
}

const INITIAL_STATS: ExecutiveStats = {
  totalProdi: 0,
  totalDokumenAkademik: 0,
  dokumenTervalidasi: 0,
  dokumenMenungguReview: 0,
  totalUnitKerja: 0,
  totalLaporanKinerja: 0,
  laporanMenungguAdmin: 0,
  laporanSelesai: 0,
};

export default function AdminDashboardExecutivePage() {
  const router = useRouter();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [activePeriodeName, setActivePeriodeName] = useState<string>(
    "Periode Aktif"
  );
  const [activePeriodeId, setActivePeriodeId] = useState<string>("");
  const [stats, setStats] = useState<ExecutiveStats>(INITIAL_STATS);
  const [isFetchingStats, setIsFetchingStats] = useState<boolean>(false);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  const fetchExecutiveSummary = useCallback(
    async (periodeId: string) => {
      setIsFetchingStats(true);
      try {
        const [prodiRes, dokumenRes, unitRes, kinerjaRes] =
          await Promise.allSettled([
            apiClient.get<{ data?: unknown[] }>("/api/prodi"),
            apiClient.get<DokumenListResponse>("/api/dokumen", {
              params: periodeId ? { id_periode: periodeId } : undefined,
            }),
            apiClient.get<{ data?: unknown[] }>("/api/unit-kerja"),
            apiClient.get<{ data?: LaporanKinerjaItem[] }>(
              "/api/laporan-kinerja",
              {
                params: periodeId ? { periode_id: periodeId } : undefined,
              }
            ),
          ]);

        const totalProdi =
          prodiRes.status === "fulfilled" && Array.isArray(prodiRes.value.data?.data)
            ? prodiRes.value.data.data.length
            : 0;

        const dokumenRecords: DokumenApiRecord[] =
          dokumenRes.status === "fulfilled" &&
          Array.isArray(dokumenRes.value.data?.data)
            ? dokumenRes.value.data.data
            : [];

        const dokumenTervalidasi = dokumenRecords.filter(
          (d) => d.status === "Selesai"
        ).length;
        const dokumenMenungguReview = dokumenRecords.filter(
          (d) => d.status === "Review"
        ).length;

        const totalUnitKerja =
          unitRes.status === "fulfilled" && Array.isArray(unitRes.value.data?.data)
            ? unitRes.value.data.data.length
            : 0;

        const kinerjaRecords: LaporanKinerjaItem[] =
          kinerjaRes.status === "fulfilled" &&
          Array.isArray(kinerjaRes.value.data?.data)
            ? kinerjaRes.value.data.data
            : [];

        const laporanMenungguAdmin = kinerjaRecords.filter(
          (l) =>
            l.status_laporan === "menunggu_admin" ||
            (!l.status_laporan && l.status === "Review")
        ).length;
        const laporanSelesai = kinerjaRecords.filter(
          (l) =>
            l.status_laporan === "selesai" ||
            (!l.status_laporan && l.status === "Selesai")
        ).length;

        setStats({
          totalProdi,
          totalDokumenAkademik: dokumenRecords.length,
          dokumenTervalidasi,
          dokumenMenungguReview,
          totalUnitKerja,
          totalLaporanKinerja: kinerjaRecords.length,
          laporanMenungguAdmin,
          laporanSelesai,
        });
      } catch (err) {
        const axiosErr = err as AxiosError<{ message?: string }>;
        if (
          axiosErr.response?.status === 401 ||
          axiosErr.response?.status === 403
        ) {
          handleUnauthorizedExit();
          return;
        }
        toast.error("Gagal memuat ringkasan eksekutif dari server.");
      } finally {
        setIsFetchingStats(false);
      }
    },
    [handleUnauthorizedExit]
  );

  useEffect(() => {
    let isMounted = true;

    const initDashboard = async () => {
      const session = getAuthSession();
      if (!session.token || session.role !== "admin") {
        handleUnauthorizedExit();
        return;
      }

      if (session.user && isMounted) {
        setUser(session.user);
      }

      try {
        const meRes = await apiClient.get("/api/me");
        const meUser = meRes.data?.data || meRes.data?.user;
        if (meUser && meUser.role !== "admin") {
          handleUnauthorizedExit();
          return;
        }
        if (meUser && isMounted) {
          setUser(meUser);
        }
      } catch {
        // Abaikan jika /api/me opsional
      }

      try {
        const periodeRes = await apiClient.get<PeriodeListResponse>(
          "/api/periode"
        );
        const allPeriode: PeriodeApiRecord[] = periodeRes.data?.data || [];
        const activePeriode =
          allPeriode.find(
            (p) => p.status_aktif === true || p.status_aktif === 1
          ) ||
          allPeriode.find((p) => Boolean(p.is_default)) ||
          allPeriode[0];

        if (isMounted) {
          const pId = activePeriode ? String(activePeriode.id) : "";
          setActivePeriodeId(pId);
          setActivePeriodeName(
            activePeriode?.nama_periode || "Semua Periode"
          );
          setIsAuthorized(true);
          setIsCheckingAuth(false);
          await fetchExecutiveSummary(pId);
        }
      } catch (err) {
        const axiosErr = err as AxiosError<{ message?: string }>;
        if (
          axiosErr.response?.status === 401 ||
          axiosErr.response?.status === 403
        ) {
          handleUnauthorizedExit();
          return;
        }
        if (isMounted) {
          setIsAuthorized(true);
          setIsCheckingAuth(false);
          toast.error("Gagal memuat periode aktif.");
        }
      }
    };

    initDashboard();

    return () => {
      isMounted = false;
    };
  }, [handleUnauthorizedExit, fetchExecutiveSummary]);

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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#0D47A1] mb-3" />
        <p className="text-sm font-semibold text-slate-700">
          Memuat Executive Summary SIPASTI...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row antialiased font-sans">
      <Toaster position="top-right" />

      <AdminSidebar
        username={user?.username || "admin"}
        pendingReviewCount={stats.dokumenMenungguReview}
        pendingUnitReviewCount={stats.laporanMenungguAdmin}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header Mobile */}
        <header className="lg:hidden h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#0D47A1]" />
              <span className="font-bold text-sm text-slate-900">
                Dashboard Utama
              </span>
            </div>
          </div>
        </header>

        {/* Banner Sambutan Executive Summary */}
        <section className="bg-gradient-to-r from-[#0f172a] via-blue-950 to-[#0D47A1] text-white px-4 sm:px-6 lg:px-8 py-7 border-b border-white/10 shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold uppercase tracking-wider text-[#FBC02D]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Executive Summary Administrator</span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white">
                Overview Sistem SIPASTI - {activePeriodeName}
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/90 max-w-2xl leading-relaxed">
                Ringkasan eksekutif capaian pelaporan Modul Akademik dan Modul
                Kinerja Unit Universitas Nurul Huda pada periode aktif.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs font-semibold text-white">
                <Calendar className="w-4 h-4 text-[#FBC02D]" />
                <span>{activePeriodeName}</span>
              </div>
              <button
                type="button"
                onClick={() => fetchExecutiveSummary(activePeriodeId)}
                disabled={isFetchingStats}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#0f172a] hover:bg-blue-50 text-xs sm:text-sm font-bold shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-4 h-4 text-[#0D47A1] ${
                    isFetchingStats ? "animate-spin" : ""
                  }`}
                />
                <span>Segarkan Ringkasan</span>
              </button>
            </div>
          </div>
        </section>

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Seksi 1: Ringkasan Modul Akademik */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0f172a] text-[#FBC02D] flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Perkembangan Pelaporan Akademik
                  </h2>
                  <p className="text-xs text-slate-500">
                    Rekapitulasi status dokumen pelaporan Program Studi pada{" "}
                    {activePeriodeName}.
                  </p>
                </div>
              </div>
              <Link
                href="/admin/pemantauan-akademik"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0D47A1] hover:underline"
              >
                <span>Lihat Detail Akademik</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Mini Card 1: Total Prodi */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Prodi
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                    {stats.totalProdi}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Program studi aktif
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-[#0D47A1] flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              {/* Mini Card 2: Total Dokumen Masuk */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Dokumen Masuk
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                    {stats.totalDokumenAkademik}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Total unggahan periode ini
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
              </div>

              {/* Mini Card 3: Dokumen Tervalidasi */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    Dokumen Tervalidasi
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-900 mt-1">
                    {stats.dokumenTervalidasi}
                  </p>
                  <p className="text-[11px] text-emerald-700/80 mt-0.5">
                    Sudah disahkan admin
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <FileCheck2 className="w-5 h-5" />
                </div>
              </div>

              {/* Mini Card 4: Menunggu Review */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Menunggu Review
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-amber-950 mt-1">
                    {stats.dokumenMenungguReview}
                  </p>
                  <p className="text-[11px] text-amber-800/80 mt-0.5">
                    Perlu pemeriksaan admin
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </div>
          </section>

          {/* Seksi 2: Ringkasan Modul Kinerja Unit */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0f172a] text-[#FBC02D] flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Perkembangan Kinerja Unit &amp; Lembaga
                  </h2>
                  <p className="text-xs text-slate-500">
                    Rekapitulasi laporan kinerja Biro, Pusat, dan Laboratorium
                    pada {activePeriodeName}.
                  </p>
                </div>
              </div>
              <Link
                href="/admin/laporan-kinerja"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0D47A1] hover:underline"
              >
                <span>Lihat Detail Kinerja</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Mini Card 1: Total Unit Kerja */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Unit Kerja
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                    {stats.totalUnitKerja}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Biro, Pusat &amp; Lab
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-[#0D47A1] flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>

              {/* Mini Card 2: Laporan Kinerja Masuk */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Laporan Kinerja Masuk
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                    {stats.totalLaporanKinerja}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Total laporan periode ini
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5" />
                </div>
              </div>

              {/* Mini Card 3: Menunggu Validasi Admin (Warning) */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                    Menunggu Validasi Admin
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-rose-950 mt-1">
                    {stats.laporanMenungguAdmin}
                  </p>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    Siap divalidasi akhir
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              {/* Mini Card 4: Laporan Selesai */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    Laporan Selesai
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-900 mt-1">
                    {stats.laporanSelesai}
                  </p>
                  <p className="text-[11px] text-emerald-700/80 mt-0.5">
                    Disahkan &amp; siap cetak PDF
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </div>
          </section>

          {/* Navigasi Cepat (Quick Actions) */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/admin/pemantauan-akademik"
              className="group bg-[#0f172a] hover:bg-blue-950 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex items-center justify-between gap-4 transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-6 h-6 text-[#FBC02D]" />
                </div>
                <div className="min-w-0">
                  <p className="text-base sm:text-lg font-bold text-white">
                    Buka Pemantauan Akademik
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Periksa matriks dokumen Prodi dan lakukan validasi berkas.
                  </p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-5 h-5 text-[#FBC02D]" />
              </div>
            </Link>

            <Link
              href="/admin/laporan-kinerja"
              className="group bg-white hover:bg-blue-50/40 text-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-[#0D47A1]/40 flex items-center justify-between gap-4 transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center shrink-0">
                  <Briefcase className="w-6 h-6 text-[#0D47A1]" />
                </div>
                <div className="min-w-0">
                  <p className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#0D47A1] transition-colors">
                    Buka Pemantauan Kinerja
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tinjau laporan kinerja Biro/Pusat/Lab dan sahkan dokumen PDF.
                  </p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-[#0D47A1] group-hover:text-white flex items-center justify-center shrink-0 transition-all">
                <ArrowRight className="w-5 h-5" />
              </div>
            </Link>
          </section>
        </main>
      </div>
    </div>
  );
}
