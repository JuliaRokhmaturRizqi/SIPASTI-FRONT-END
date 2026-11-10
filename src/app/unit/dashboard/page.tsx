"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileCheck2,
  FilePlus2,
  FileQuestion,
  FileText,
  Loader2,
  Menu,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
import { AuthUser } from "@/types/auth";
import { PeriodeApiRecord, PeriodeListResponse } from "@/types/dokumen";
import {
  LaporanKinerjaItem,
  LaporanKinerjaListResponse,
  LaporanKinerjaStatus,
} from "@/types/laporan";
import UnitSidebar from "@/components/unit/UnitSidebar";
import UnitLaporanModal from "@/components/unit/UnitLaporanModal";

const ALLOWED_ROLES = ["biro", "pusat", "lab"] as const;

export interface UnitPeriodeOption {
  id: string;
  nama_periode: string;
}

/**
 * Helper konfigurasi visual badge status laporan kinerja
 */
function getLaporanStatusBadgeConfig(status: LaporanKinerjaStatus) {
  switch (status) {
    case "Selesai":
      return {
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dotClass: "bg-emerald-500",
        label: "Selesai",
      };
    case "Revisi":
      return {
        badgeClass: "bg-red-50 text-red-700 border-red-200",
        dotClass: "bg-red-500",
        label: "Revisi",
      };
    case "Review":
    default:
      return {
        badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
        dotClass: "bg-amber-500 animate-pulse",
        label: "Review",
      };
  }
}

export default function UnitDashboardPage() {
  const router = useRouter();

  // State Otorisasi & Profil Pengguna
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State Periode Akademik & Laporan Kinerja
  const [periodeList, setPeriodeList] = useState<UnitPeriodeOption[]>([]);
  const [selectedPeriode, setSelectedPeriode] = useState<string>("");
  const [laporanList, setLaporanList] = useState<LaporanKinerjaItem[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  // State Modal Form Laporan Kegiatan
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  /**
   * Mengambil data laporan kinerja dari API:
   * GET /api/laporan-kinerja?id_periode={periodeId}
   */
  const fetchLaporanData = useCallback(
    async (periodeIdParam?: string, showSpinner = true) => {
      const targetPeriode = periodeIdParam ?? selectedPeriode;
      if (!targetPeriode) {
        setLaporanList([]);
        return;
      }

      if (showSpinner) {
        setIsFetching(true);
      }

      try {
        const response = await apiClient.get<LaporanKinerjaListResponse>(
          "/api/laporan-kinerja",
          {
            params: {
              id_periode: targetPeriode,
            },
          }
        );

        const records = response.data?.data || [];
        setLaporanList(records);
      } catch (err) {
        const axiosErr = err as AxiosError<{ message?: string }>;
        const status = axiosErr.response?.status;

        if (status === 401 || status === 403) {
          handleUnauthorizedExit();
          return;
        }

        toast.error(
          axiosErr.response?.data?.message ||
            "Gagal memuat data laporan kinerja dari server."
        );
      } finally {
        if (showSpinner) {
          setIsFetching(false);
        }
      }
    },
    [selectedPeriode, handleUnauthorizedExit]
  );

  // Inisialisasi Sesi Pengguna & Daftar Periode Aktif
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

        let initialPeriodeId = "";
        try {
          const periodeRes =
            await apiClient.get<PeriodeListResponse>("/api/periode");
          const rawPeriode = periodeRes.data?.data || [];

          // Filter periode aktif (status_aktif === true atau 1)
          const filteredActive = rawPeriode.filter(
            (p: PeriodeApiRecord) =>
              p.status_aktif === true || p.status_aktif === 1
          );

          if (isMounted) {
            if (filteredActive.length > 0) {
              const mappedOptions: UnitPeriodeOption[] = filteredActive.map(
                (p) => ({
                  id: String(p.id),
                  nama_periode: p.nama_periode,
                })
              );

              setPeriodeList(mappedOptions);
              initialPeriodeId = String(mappedOptions[0].id);
              setSelectedPeriode(initialPeriodeId);
            } else {
              setPeriodeList([]);
              setSelectedPeriode("");
            }
          }
        } catch {
          if (isMounted) {
            setPeriodeList([]);
            setSelectedPeriode("");
            toast.error("Gagal memuat daftar periode pelaporan dari server.");
          }
        }

        if (isMounted) {
          setUser(verifiedUser);
          setIsAuthorized(true);
          setIsCheckingAuth(false);
        }

        if (initialPeriodeId) {
          await fetchLaporanData(initialPeriodeId, true);
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
  }, [handleUnauthorizedExit, fetchLaporanData]);

  // Re-fetch laporan ketika selectedPeriode berubah
  const handlePeriodeChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const nextPeriodeId = e.target.value;
    setSelectedPeriode(nextPeriodeId);
    if (nextPeriodeId) {
      await fetchLaporanData(nextPeriodeId, true);
    }
  };

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

  // Objek Periode Terpilih
  const currentPeriodeObj = useMemo(() => {
    return (
      periodeList.find((p) => p.id === selectedPeriode) ||
      periodeList[0] ||
      null
    );
  }, [periodeList, selectedPeriode]);

  // Kalkulasi 4 Kartu Statistik berdasarkan laporanList
  const stats = useMemo(() => {
    let reviewCount = 0;
    let revisiCount = 0;
    let selesaiCount = 0;

    laporanList.forEach((item) => {
      if (item.status === "Review") reviewCount += 1;
      else if (item.status === "Revisi") revisiCount += 1;
      else if (item.status === "Selesai") selesaiCount += 1;
    });

    return {
      totalLaporan: laporanList.length,
      menungguReview: reviewCount,
      revisi: revisiCount,
      selesai: selesaiCount,
    };
  }, [laporanList]);

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
        {/* Header Transparan (Backdrop-Blur) */}
        <header className="h-16 py-2.5 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between gap-3 sticky top-0 z-30">
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
                Dashboard Kinerja Unit
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Tombol Refresh / Sinkronkan */}
            <button
              type="button"
              onClick={() => fetchLaporanData(selectedPeriode, true)}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#0D47A1] ${
                  isFetching ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">Sinkronkan</span>
            </button>

            {/* Indikator Profil User */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200/80 text-xs text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{safeUsername}</span>
              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-[#0D47A1] font-bold text-[10px]">
                {safeKategoriUnit}
              </span>
            </div>

            {/* Dropdown Pilihan Periode Pelaporan */}
            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 text-[#0D47A1] pointer-events-none absolute left-3.5" />
              <select
                aria-label="Pilih Periode Pelaporan"
                value={selectedPeriode}
                onChange={handlePeriodeChange}
                disabled={isFetching || periodeList.length === 0}
                className="appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-9 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 focus:border-[#0D47A1] focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/15 transition disabled:opacity-60 cursor-pointer"
              >
                {periodeList.length === 0 ? (
                  <option value="" disabled>
                    Tidak ada periode aktif
                  </option>
                ) : (
                  periodeList.map((periode) => (
                    <option key={periode.id} value={periode.id}>
                      {periode.nama_periode} (Aktif)
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3" />
            </div>
          </div>
        </header>

        {/* Konten Body */}
        <main className="p-5 sm:p-8 space-y-6 max-w-6xl w-full mx-auto flex-1">
          {/* Banner Informasi Unit Kerja */}
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
                  {safeNamaUnit}
                </h2>
                <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-2xl">
                  Sistem Pelaporan Administrasi Terintegrasi (SIPASTI) Super App.
                  Kelola dan laporkan kegiatan kinerja unit kerja Anda secara
                  berkala.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 text-xs font-semibold text-white">
                  <span>Periode:</span>
                  <strong className="text-[#FBC02D]">
                    {sanitizePlainText(currentPeriodeObj?.nama_periode || "-")}
                  </strong>
                </span>
              </div>
            </div>
          </section>

          {/* 4 Kartu Statistik Ringkas */}
          <section
            aria-label="Statistik Kinerja Unit"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {/* Card 1: Total Laporan */}
            <div className="bg-gradient-to-br from-[#1e5bb8] to-[#0D47A1] rounded-2xl border border-blue-400/25 p-5 shadow-sm text-white flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Total Laporan
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.totalLaporan}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Kegiatan Terdaftar
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/40 text-white flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Card 2: Menunggu Review */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl border border-amber-300/30 p-5 shadow-sm text-white flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Menunggu Review
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.menungguReview}
                </p>
                <p className="text-xs text-white/85 mt-1">
                  Menunggu Persetujuan
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/40 text-white flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Card 3: Revisi */}
            <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl border border-rose-300/30 p-5 shadow-sm text-white flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Perlu Revisi
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.revisi}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Perlu Diperbaiki
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/40 text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Card 4: Selesai */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl border border-emerald-300/30 p-5 shadow-sm text-white flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Selesai
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.selesai}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Laporan Tervalidasi
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/40 text-white flex items-center justify-center shrink-0">
                <FileCheck2 className="w-6 h-6 text-white" />
              </div>
            </div>
          </section>

          {/* Tombol Utama: + Buat Laporan Kegiatan Baru */}
          <section aria-label="Aksi Tambah Laporan">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              disabled={isFetching || periodeList.length === 0}
              className="w-full py-4 px-6 rounded-2xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-900 text-white font-bold text-sm sm:text-base shadow-md shadow-blue-900/15 hover:shadow-lg transition-all flex items-center justify-center gap-3 border border-blue-400/30 cursor-pointer disabled:opacity-50 group"
            >
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5 text-[#FBC02D]" />
              </div>
              <span>+ Buat Laporan Kegiatan Baru</span>
            </button>
          </section>

          {/* Daftar Laporan (Kartu Bersusun / Stacked Cards) */}
          <section
            aria-label="Daftar Laporan Kinerja Kegiatan"
            className={`space-y-4 transition-opacity duration-200 ${
              isFetching ? "opacity-60" : "opacity-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                Daftar Laporan Kegiatan ({laporanList.length})
              </h3>
              <span className="text-xs text-slate-500">
                Periode: {sanitizePlainText(currentPeriodeObj?.nama_periode || "-")}
              </span>
            </div>

            {laporanList.length === 0 ? (
              /* Empty State */
              <div className="bg-white rounded-2xl border border-slate-200/85 p-10 text-center space-y-3 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0D47A1] border border-blue-100 flex items-center justify-center mx-auto">
                  <FileQuestion className="w-7 h-7 text-[#0D47A1]" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-bold text-slate-800">
                    Belum Ada Laporan Kegiatan
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Belum ada laporan kinerja yang didaftarkan untuk periode{" "}
                    <strong>{sanitizePlainText(currentPeriodeObj?.nama_periode || "-")}</strong>.
                    Silakan klik tombol <strong>+ Buat Laporan Kegiatan Baru</strong> di atas untuk membuat laporan pertama unit Anda.
                  </p>
                </div>
              </div>
            ) : (
              /* Stacked Cards */
              laporanList.map((laporan) => {
                const statusBadge = getLaporanStatusBadgeConfig(laporan.status);
                const safeNamaKegiatan = sanitizePlainText(laporan.nama_kegiatan);
                const safeUraian = laporan.uraian
                  ? sanitizePlainText(laporan.uraian)
                  : "Belum ada uraian rincian kegiatan.";
                const safeCatatanRevisi = laporan.catatan_revisi
                  ? sanitizePlainText(laporan.catatan_revisi)
                  : null;

                const tanggalFormat = laporan.created_at
                  ? new Date(laporan.created_at).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : null;

                return (
                  <article
                    key={laporan.id}
                    className="bg-white rounded-2xl border border-slate-200/85 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all space-y-3.5"
                  >
                    {/* Header Kartu: Judul Kegiatan & Status Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0D47A1] border border-blue-100 flex items-center justify-center font-bold text-sm shrink-0">
                          <FileText className="w-5 h-5 text-[#0D47A1]" />
                        </div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {safeNamaKegiatan}
                        </h4>
                      </div>

                      {/* Badge Status */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shrink-0 w-fit ${statusBadge.badgeClass}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`}
                        />
                        <span>{statusBadge.label}</span>
                      </span>
                    </div>

                    {/* Uraian Singkat: Maksimal 2 Baris (line-clamp-2) */}
                    <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                      {safeUraian}
                    </p>

                    {/* Metadata Footer Kartu */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-4">
                        {tanggalFormat && (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{tanggalFormat}</span>
                          </span>
                        )}
                        {laporan.nama_penandatangan && (
                          <span className="text-slate-500">
                            Penandatangan:{" "}
                            <strong className="text-slate-700">
                              {sanitizePlainText(laporan.nama_penandatangan)}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Alert Box Catatan Revisi (Hanya muncul jika status Revisi) */}
                    {laporan.status === "Revisi" && (
                      <div className="rounded-xl bg-red-50 text-red-700 border border-red-200 p-3.5 flex items-start gap-2.5 text-xs">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-bold text-red-800">
                            Catatan Revisi dari Admin:
                          </p>
                          <p className="leading-relaxed">
                            {safeCatatanRevisi ||
                              "Laporan memerlukan perbaikan. Silakan tinjau dan perbarui rincian kegiatan Anda."}
                          </p>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>
        </main>
      </div>

      {/* Slide-over Panel Modal Form Laporan Kegiatan */}
      <UnitLaporanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedPeriode={selectedPeriode}
        periodeLabel={currentPeriodeObj?.nama_periode || ""}
        namaUnit={safeNamaUnit}
        kategoriUnit={safeKategoriUnit}
        onSuccess={() => fetchLaporanData(selectedPeriode, false)}
      />
    </div>
  );
}
