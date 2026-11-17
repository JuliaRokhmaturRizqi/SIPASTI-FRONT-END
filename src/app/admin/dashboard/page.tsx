"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  Activity,
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
  PieChart as PieChartIcon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
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
  dokumenRevisi: number;
  totalUnitKerja: number;
  totalLaporanKinerja: number;
  laporanMenungguAdmin: number;
  laporanSelesai: number;
  laporanRevisi: number;
}

interface ChartSlice {
  name: string;
  value: number;
  color: string;
}

interface RecentActivityItem {
  id: string;
  waktu: string;
  pengirim: string;
  deskripsi: string;
  modul: "Akademik" | "Kinerja";
  status: string;
  timestampMs: number;
}

interface DashboardSummaryApiResponse {
  status?: string;
  data?: {
    akademik?: {
      total_prodi?: number;
      total_dokumen?: number;
      tervalidasi?: number;
      menunggu_review?: number;
      revisi?: number;
    };
    kinerja?: {
      total_unit_kerja?: number;
      laporan_masuk?: number;
      menunggu_validasi_admin?: number;
      selesai?: number;
      revisi?: number;
    };
    charts?: {
      rasio_status?: Array<{ name?: string; label?: string; value?: number; count?: number }>;
    };
    rasio_status?: Array<{ name?: string; label?: string; value?: number; count?: number }>;
    recent_activities?: Array<{
      id?: string | number;
      waktu?: string;
      created_at?: string;
      pengirim?: string;
      unit?: string;
      deskripsi?: string;
      judul?: string;
      modul?: string;
      status?: string;
    }>;
    aktivitas_terbaru?: Array<{
      id?: string | number;
      waktu?: string;
      created_at?: string;
      pengirim?: string;
      unit?: string;
      deskripsi?: string;
      judul?: string;
      modul?: string;
      status?: string;
    }>;
  };
}

const INITIAL_STATS: ExecutiveStats = {
  totalProdi: 0,
  totalDokumenAkademik: 0,
  dokumenTervalidasi: 0,
  dokumenMenungguReview: 0,
  dokumenRevisi: 0,
  totalUnitKerja: 0,
  totalLaporanKinerja: 0,
  laporanMenungguAdmin: 0,
  laporanSelesai: 0,
  laporanRevisi: 0,
};

function formatActivityTime(dateInput?: string | null): string {
  if (!dateInput) return "Baru saja";
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) return dateInput;
  return parsed.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getActivityBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("selesai") || s.includes("valid")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (s.includes("revisi") || s.includes("tolak")) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  if (s.includes("menunggu") || s.includes("review")) {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  return "bg-blue-50 text-[#0D47A1] border-blue-200";
}

export default function AdminDashboardExecutivePage() {
  const router = useRouter();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [activePeriodeName, setActivePeriodeName] =
    useState<string>("Periode Aktif");
  const [activePeriodeId, setActivePeriodeId] = useState<string>("");
  const [stats, setStats] = useState<ExecutiveStats>(INITIAL_STATS);
  const [customChartSlices, setCustomChartSlices] = useState<ChartSlice[] | null>(
    null
  );
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>(
    []
  );
  const [isFetchingStats, setIsFetchingStats] = useState<boolean>(true);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  const fetchFallbackSummary = useCallback(async (periodeId: string) => {
    const [prodiRes, dokumenRes, unitRes, kinerjaRes] = await Promise.allSettled([
      apiClient.get<{ data?: unknown[] }>("/api/prodi"),
      apiClient.get<DokumenListResponse>("/api/dokumen", {
        params: periodeId ? { id_periode: periodeId } : undefined,
      }),
      apiClient.get<{ data?: unknown[] }>("/api/unit-kerja"),
      apiClient.get<{ data?: LaporanKinerjaItem[] }>("/api/laporan-kinerja", {
        params: periodeId ? { periode_id: periodeId } : undefined,
      }),
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
    const dokumenRevisi = dokumenRecords.filter(
      (d) => d.status === "Revisi"
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
    const laporanRevisi = kinerjaRecords.filter(
      (l) =>
        l.status_laporan === "revisi_admin" ||
        l.status_laporan === "revisi_pimpinan" ||
        (!l.status_laporan && l.status === "Revisi")
    ).length;

    setStats({
      totalProdi,
      totalDokumenAkademik: dokumenRecords.length,
      dokumenTervalidasi,
      dokumenMenungguReview,
      dokumenRevisi,
      totalUnitKerja,
      totalLaporanKinerja: kinerjaRecords.length,
      laporanMenungguAdmin,
      laporanSelesai,
      laporanRevisi,
    });
    setCustomChartSlices(null);

    const combinedActivities: RecentActivityItem[] = [
      ...dokumenRecords.map((doc) => {
        const rawTime = doc.tanggal_upload;
        return {
          id: `doc-${doc.id ?? Math.random()}`,
          waktu: formatActivityTime(rawTime),
          pengirim: doc.prodi?.nama_prodi || "Program Studi",
          deskripsi: `mengunggah Dokumen Tahap ${doc.tahap_dokumen}`,
          modul: "Akademik" as const,
          status: doc.status || "Review",
          timestampMs: rawTime ? new Date(rawTime).getTime() || 0 : 0,
        };
      }),
      ...kinerjaRecords.map((lap) => {
        const rawTime = lap.updated_at || lap.created_at;
        const statusLabel =
          lap.status_laporan === "selesai"
            ? "Selesai"
            : lap.status_laporan === "menunggu_admin"
              ? "Menunggu Admin"
              : lap.status_laporan === "menunggu_pimpinan"
                ? "Menunggu Pimpinan"
                : lap.status_laporan === "revisi_admin" ||
                    lap.status_laporan === "revisi_pimpinan"
                  ? "Revisi"
                  : lap.status || "Review";

        return {
          id: `kinerja-${lap.id}`,
          waktu: formatActivityTime(rawTime),
          pengirim:
            lap.unit_kerja?.nama_unit ||
            lap.identitas_laporan?.nama_unit ||
            "Unit Kerja",
          deskripsi: `mengirimkan Laporan Kinerja${lap.bulan_laporan ? ` (${lap.bulan_laporan})` : ""}`,
          modul: "Kinerja" as const,
          status: statusLabel,
          timestampMs: rawTime ? new Date(rawTime).getTime() || 0 : 0,
        };
      }),
    ]
      .sort((a, b) => b.timestampMs - a.timestampMs)
      .slice(0, 5);

    setRecentActivities(combinedActivities);
  }, []);

  const fetchExecutiveSummary = useCallback(
    async (periodeId: string) => {
      setIsFetchingStats(true);
      try {
        const response = await apiClient.get<DashboardSummaryApiResponse>(
          "/api/admin/dashboard-summary",
          {
            params: periodeId ? { periode_id: periodeId } : undefined,
          }
        );

        const payload = response.data?.data;
        if (payload && (payload.akademik || payload.kinerja)) {
          const ak = payload.akademik || {};
          const kn = payload.kinerja || {};

          setStats({
            totalProdi: ak.total_prodi ?? 0,
            totalDokumenAkademik: ak.total_dokumen ?? 0,
            dokumenTervalidasi: ak.tervalidasi ?? 0,
            dokumenMenungguReview: ak.menunggu_review ?? 0,
            dokumenRevisi: ak.revisi ?? 0,
            totalUnitKerja: kn.total_unit_kerja ?? 0,
            totalLaporanKinerja: kn.laporan_masuk ?? 0,
            laporanMenungguAdmin: kn.menunggu_validasi_admin ?? 0,
            laporanSelesai: kn.selesai ?? 0,
            laporanRevisi: kn.revisi ?? 0,
          });

          const rawCharts =
            payload.charts?.rasio_status || payload.rasio_status || null;
          if (Array.isArray(rawCharts) && rawCharts.length > 0) {
            const palette = ["#10b981", "#f59e0b", "#0D47A1", "#ef4444"];
            setCustomChartSlices(
              rawCharts.map((item, idx) => ({
                name: item.name || item.label || `Status ${idx + 1}`,
                value: Number(item.value ?? item.count ?? 0),
                color: palette[idx % palette.length],
              }))
            );
          } else {
            setCustomChartSlices(null);
          }

          const rawLogs =
            payload.recent_activities || payload.aktivitas_terbaru || [];
          setRecentActivities(
            rawLogs.slice(0, 5).map((log, idx) => ({
              id: String(log.id ?? idx),
              waktu: log.waktu || formatActivityTime(log.created_at),
              pengirim: log.pengirim || log.unit || "Unit/Prodi",
              deskripsi: log.deskripsi || log.judul || "mengirimkan laporan",
              modul:
                log.modul?.toLowerCase() === "akademik" ? "Akademik" : "Kinerja",
              status: log.status || "Review",
              timestampMs: log.created_at
                ? new Date(log.created_at).getTime() || 0
                : 0,
            }))
          );
          return;
        }

        await fetchFallbackSummary(periodeId);
      } catch (err) {
        const axiosErr = err as AxiosError<{ message?: string }>;
        if (
          axiosErr.response?.status === 401 ||
          axiosErr.response?.status === 403
        ) {
          handleUnauthorizedExit();
          return;
        }
        // Fallback otomatis jika endpoint summary belum tersedia
        try {
          await fetchFallbackSummary(periodeId);
        } catch {
          toast.error("Gagal memuat ringkasan eksekutif dari server.");
        }
      } finally {
        setIsFetchingStats(false);
      }
    },
    [handleUnauthorizedExit, fetchFallbackSummary]
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
          setActivePeriodeName(activePeriode?.nama_periode || "Semua Periode");
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
          setIsFetchingStats(false);
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

  // Data Donut Chart: Rasio Status Laporan
  const chartData = useMemo<ChartSlice[]>(() => {
    if (customChartSlices && customChartSlices.length > 0) {
      return customChartSlices;
    }

    const selesaiTotal = stats.dokumenTervalidasi + stats.laporanSelesai;
    const reviewTotal = stats.dokumenMenungguReview + stats.laporanMenungguAdmin;
    const revisiTotal = stats.dokumenRevisi + stats.laporanRevisi;

    const slices: ChartSlice[] = [
      { name: "Selesai / Tervalidasi", value: selesaiTotal, color: "#10b981" },
      { name: "Menunggu Review", value: reviewTotal, color: "#f59e0b" },
    ];
    if (revisiTotal > 0) {
      slices.push({
        name: "Perlu Revisi",
        value: revisiTotal,
        color: "#0D47A1",
      });
    }
    return slices;
  }, [customChartSlices, stats]);

  const totalChartReports = useMemo(
    () => chartData.reduce((acc, item) => acc + item.value, 0),
    [chartData]
  );

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

          {/* Seksi 3: Layout Grid 2 Kolom (Grafik Donut & Aktivitas Terkini) */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Kolom Kiri: Donut Chart Rasio Status Laporan */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0D47A1] border border-blue-200/70 flex items-center justify-center shrink-0">
                    <PieChartIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      Rasio Status Laporan
                    </h2>
                    <p className="text-xs text-slate-500">
                      Proporsi laporan selesai vs menunggu review pada periode aktif.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-center">
                {isFetchingStats ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-3">
                    <div className="w-40 h-40 rounded-full border-12 border-slate-100 border-t-[#0D47A1] animate-spin" />
                    <p className="text-xs font-semibold text-slate-500">
                      Memuat grafik rasio laporan...
                    </p>
                  </div>
                ) : totalChartReports === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center gap-2 text-slate-500">
                    <PieChartIcon className="w-10 h-10 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">
                      Belum ada data laporan pada periode ini
                    </p>
                    <p className="text-xs text-slate-400">
                      Grafik rasio akan muncul otomatis setelah laporan masuk.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="h-64 w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={62}
                            outerRadius={92}
                            paddingAngle={4}
                            dataKey="value"
                            nameKey="name"
                          >
                            {chartData.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val) => {
                              const num = Number(val) || 0;
                              const pct =
                                totalChartReports > 0
                                  ? ((num / totalChartReports) * 100).toFixed(1)
                                  : "0";
                              return [`${num} Laporan (${pct}%)`, "Jumlah"];
                            }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                      {chartData.map((slice) => {
                        const pct =
                          totalChartReports > 0
                            ? ((slice.value / totalChartReports) * 100).toFixed(
                                1
                              )
                            : "0";
                        return (
                          <div
                            key={slice.name}
                            className="rounded-xl bg-slate-50 border border-slate-200/70 px-3 py-2"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: slice.color }}
                              />
                              <span className="text-[11px] font-semibold text-slate-600 truncate">
                                {slice.name}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 mt-0.5">
                              {pct}%{" "}
                              <span className="text-xs font-medium text-slate-500">
                                ({slice.value})
                              </span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Kolom Kanan: Aktivitas Pelaporan Terbaru */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/70 flex items-center justify-center shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      Aktivitas Pelaporan Terbaru
                    </h2>
                    <p className="text-xs text-slate-500">
                      5 log pengiriman laporan terbaru dari Prodi &amp; Unit Kerja.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 flex-1">
                {isFetchingStats ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((skeleton) => (
                      <div
                        key={skeleton}
                        className="h-14 rounded-xl bg-slate-100 animate-pulse"
                      />
                    ))}
                  </div>
                ) : recentActivities.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center gap-2 text-slate-500">
                    <Activity className="w-10 h-10 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">
                      Belum ada aktivitas pelaporan terbaru
                    </p>
                    <p className="text-xs text-slate-400">
                      Aktivitas akan tampil ketika Prodi atau Unit mengirimkan
                      laporan.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {recentActivities.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-blue-50/30 p-3.5 transition-colors flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-[#0D47A1] mt-2 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-slate-800 leading-snug">
                              <span className="font-mono text-[11px] font-semibold text-slate-500 mr-1.5">
                                [{sanitizePlainText(item.waktu)}]
                              </span>
                              <strong className="text-slate-900">
                                {sanitizePlainText(item.pengirim)}
                              </strong>{" "}
                              {sanitizePlainText(item.deskripsi)}
                            </p>
                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                              Modul {item.modul}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${getActivityBadgeClass(
                            item.status
                          )}`}
                        >
                          {sanitizePlainText(item.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
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
