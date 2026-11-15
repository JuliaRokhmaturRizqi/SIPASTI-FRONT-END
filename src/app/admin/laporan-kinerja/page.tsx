"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Menu,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
  XCircle,
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
  LaporanKinerjaValidasiResponse,
} from "@/types/laporan";
import AdminSidebar from "@/components/admin/AdminSidebar";

export interface AdminPeriodeOption {
  id: string;
  nama_periode: string;
}

/**
 * Format tanggal Indonesia ramah pengguna
 */
function formatTanggalIndo(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Helper konfigurasi visual badge status laporan kinerja (Workflow Bertingkat + Legacy)
 */
function getStatusBadgeConfig(laporan: LaporanKinerjaItem) {
  switch (laporan.status_laporan) {
    case "selesai":
      return {
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dotClass: "bg-emerald-500",
        label: "Selesai",
      };
    case "revisi_admin":
      return {
        badgeClass: "bg-red-50 text-red-700 border-red-200",
        dotClass: "bg-red-500",
        label: "Revisi Admin",
      };
    case "revisi_pimpinan":
      return {
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
        dotClass: "bg-rose-500",
        label: "Revisi Pimpinan",
      };
    case "menunggu_admin":
      return {
        badgeClass: "bg-blue-50 text-[#0D47A1] border-blue-200",
        dotClass: "bg-[#0D47A1] animate-pulse",
        label: "Menunggu Validasi Admin",
      };
    case "menunggu_pimpinan":
      return {
        badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
        dotClass: "bg-amber-500 animate-pulse",
        label: "Menunggu Review Pimpinan",
      };
    default:
      break;
  }

  switch (laporan.status) {
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

/**
 * Helper resolusi nama string kategori dari berbagai kemungkinan struktur data (string atau objek)
 */
function resolveKategoriLabel(kategori: unknown): string {
  if (!kategori) return "";
  if (typeof kategori === "string") return kategori;
  if (typeof kategori === "object" && kategori !== null) {
    const record = kategori as { nama_kategori?: string; label?: string };
    return record.nama_kategori || record.label || "";
  }
  return "";
}

/**
 * Helper badge kategori unit kerja
 */
function getKategoriBadgeConfig(kategori?: unknown) {
  const safeStr = resolveKategoriLabel(kategori).toLowerCase();
  switch (safeStr) {
    case "biro":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "pusat":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "lab":
    case "laboratorium":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "fakultas":
      return "bg-amber-50 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export default function AdminLaporanKinerjaPage() {
  const router = useRouter();

  // State Otorisasi & Profil Admin
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State Periode Akademik & Data Laporan
  const [periodeList, setPeriodeList] = useState<AdminPeriodeOption[]>([]);
  const [selectedPeriode, setSelectedPeriode] = useState<string>("");
  const [laporanList, setLaporanList] = useState<LaporanKinerjaItem[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  // State Filter & Pencarian
  const [filterUnitKerja, setFilterUnitKerja] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // State Modal Validasi Admin
  const [selectedLaporanForValidation, setSelectedLaporanForValidation] =
    useState<LaporanKinerjaItem | null>(null);
  const [validationStatus, setValidationStatus] = useState<
    "selesai" | "revisi_admin"
  >("selesai");
  const [catatanAdmin, setCatatanAdmin] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // State Unduh PDF & Export Excel
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  /**
   * Mengambil data laporan kinerja dari API:
   * GET /api/laporan-kinerja?id_periode={periodeId}
   * Bagi role Admin, backend mengembalikan seluruh laporan dari semua Biro/Pusat/Lab.
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

    const initializeAdminLaporan = async () => {
      const session = getAuthSession();

      if (!session.token || session.role !== "admin") {
        handleUnauthorizedExit();
        return;
      }

      if (session.user) {
        setUser(session.user);
      }

      try {
        const meRes = await apiClient.get<{ status: string; user?: AuthUser }>(
          "/api/me"
        );
        if (meRes.data?.user) {
          if (meRes.data.user.role !== "admin") {
            handleUnauthorizedExit();
            return;
          }
          if (isMounted) {
            setUser(meRes.data.user);
          }
        }
      } catch {
        // Abaikan jika endpoint /api/me opsional
      }

      try {
        const periodeRes = await apiClient.get<PeriodeListResponse>(
          "/api/periode"
        );
        const allPeriode: PeriodeApiRecord[] = periodeRes.data?.data || [];

        const validOptions: AdminPeriodeOption[] = allPeriode.map((p) => ({
          id: String(p.id),
          nama_periode: p.nama_periode,
        }));

        if (isMounted) {
          setPeriodeList(validOptions);

          const defaultActive =
            allPeriode.find(
              (p) => Boolean(p.is_default) || Boolean(p.status_aktif)
            ) || allPeriode[0];

          if (defaultActive) {
            const activeIdStr = String(defaultActive.id);
            setSelectedPeriode(activeIdStr);
            fetchLaporanData(activeIdStr, true);
          }
          setIsAuthorized(true);
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
        toast.error("Gagal memuat daftar periode akademik.");
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    initializeAdminLaporan();

    return () => {
      isMounted = false;
    };
  }, [handleUnauthorizedExit, fetchLaporanData]);

  // Handler Ganti Pilihan Periode
  const handlePeriodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedPeriode(newId);
    fetchLaporanData(newId, true);
  };

  // Handler Logout Sesi
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutSession();
      toast.success("Berhasil keluar dari sesi admin.");
      router.replace("/login");
    } catch {
      clearAuthSession();
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  /**
   * Ekstraksi daftar Unit Kerja unik dari data laporan
   */
  const unitKerjaOptions = useMemo(() => {
    const map = new Map<
      number,
      { id: number; nama_unit: string; kategori_unit?: string }
    >();

    laporanList.forEach((item) => {
      if (item.unit_kerja && item.unit_kerja.id) {
        const catStr = resolveKategoriLabel(
          item.unit_kerja.kategori_unit || item.unit_kerja.kategori
        );
        map.set(item.unit_kerja.id, {
          id: item.unit_kerja.id,
          nama_unit: item.unit_kerja.nama_unit,
          kategori_unit: catStr,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.nama_unit.localeCompare(b.nama_unit)
    );
  }, [laporanList]);

  // 4 Kartu Statistik berdasarkan seluruh data laporan pada periode terpilih
  const stats = useMemo(() => {
    const total = laporanList.length;
    const menungguAdmin = laporanList.filter(
      (item) => item.status_laporan === "menunggu_admin"
    ).length;
    const menungguPimpinan = laporanList.filter(
      (item) => item.status_laporan === "menunggu_pimpinan"
    ).length;
    const revisiPimpinan = laporanList.filter(
      (item) => item.status_laporan === "revisi_pimpinan"
    ).length;
    const revisiAdmin = laporanList.filter(
      (item) => item.status_laporan === "revisi_admin"
    ).length;
    const selesai = laporanList.filter(
      (item) =>
        item.status_laporan === "selesai" ||
        (!item.status_laporan && item.status === "Selesai")
    ).length;
    const revisi =
      revisiPimpinan +
      revisiAdmin +
      laporanList.filter(
        (item) => !item.status_laporan && item.status === "Revisi"
      ).length;
    const review =
      menungguAdmin +
      menungguPimpinan +
      laporanList.filter(
        (item) => !item.status_laporan && item.status === "Review"
      ).length;

    return {
      total,
      review,
      menungguAdmin,
      menungguPimpinan,
      revisi,
      revisiPimpinan,
      revisiAdmin,
      selesai,
    };
  }, [laporanList]);

  // Filter, Search & Prioritas Urutan (menunggu_admin paling atas)
  const filteredLaporanList = useMemo(() => {
    const filtered = laporanList.filter((item) => {
      // Filter Unit Kerja
      if (
        filterUnitKerja !== "ALL" &&
        String(item.id_unit_kerja) !== filterUnitKerja
      ) {
        return false;
      }

      // Filter Status (Workflow bertingkat)
      if (filterStatus !== "ALL") {
        const effectiveStatus =
          item.status_laporan ||
          (item.status === "Selesai"
            ? "selesai"
            : item.status === "Revisi"
              ? "revisi_admin"
              : "menunggu_admin");
        if (effectiveStatus !== filterStatus) {
          return false;
        }
      }

      // Filter Query Pencarian
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const namaKegiatan = item.nama_kegiatan?.toLowerCase() || "";
        const uraian = item.uraian?.toLowerCase() || "";
        const namaUnit = item.unit_kerja?.nama_unit?.toLowerCase() || "";
        const penandatangan = (
          item.identitas_laporan?.penanggung_jawab ||
          item.nama_penandatangan ||
          ""
        ).toLowerCase();
        const penyusun = (
          item.identitas_laporan?.penyusun || ""
        ).toLowerCase();
        const aspekText = Array.isArray(item.pembahasan_json)
          ? item.pembahasan_json
              .map((p) => `${p.aspek || ""} ${p.realisasi || ""}`)
              .join(" ")
              .toLowerCase()
          : "";

        return (
          namaKegiatan.includes(query) ||
          uraian.includes(query) ||
          namaUnit.includes(query) ||
          penandatangan.includes(query) ||
          penyusun.includes(query) ||
          aspekText.includes(query)
        );
      }

      return true;
    });

    // Prioritaskan laporan berstatus menunggu_admin di paling atas
    return [...filtered].sort((a, b) => {
      const aPriority = a.status_laporan === "menunggu_admin" ? 0 : 1;
      const bPriority = b.status_laporan === "menunggu_admin" ? 0 : 1;
      return aPriority - bPriority;
    });
  }, [laporanList, filterUnitKerja, filterStatus, searchQuery]);

  /**
   * Buka Modal Validasi untuk Laporan
   */
  const handleOpenValidationModal = (laporan: LaporanKinerjaItem) => {
    setSelectedLaporanForValidation(laporan);
    setValidationStatus("selesai");
    setCatatanAdmin(laporan.catatan_admin || laporan.catatan_revisi || "");
    setValidationError(null);
  };

  const handleCloseValidationModal = () => {
    if (isValidating) return;
    setSelectedLaporanForValidation(null);
    setValidationStatus("selesai");
    setCatatanAdmin("");
    setValidationError(null);
  };

  /**
   * Eksekusi Validasi Admin:
   * POST /api/laporan-kinerja/{id}/validasi-admin
   * Payload JSON: { status: 'selesai' | 'revisi_admin', catatan_admin?: string | null }
   */
  const handleExecuteValidation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedLaporanForValidation || isValidating) return;

    if (validationStatus === "revisi_admin") {
      const trimmedReason = catatanAdmin.trim();
      if (!trimmedReason || trimmedReason.length < 5) {
        const errorMsg =
          "Catatan revisi Admin wajib diisi minimal 5 karakter apabila laporan ditolak/direvisi.";
        setValidationError(errorMsg);
        toast.error(errorMsg);
        return;
      }
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      const payload = {
        status: validationStatus,
        catatan_admin:
          validationStatus === "revisi_admin" ? catatanAdmin.trim() : null,
      };

      const response = await apiClient.post<LaporanKinerjaValidasiResponse>(
        `/api/laporan-kinerja/${selectedLaporanForValidation.id}/validasi-admin`,
        payload
      );

      const successMsg =
        response.data?.message ||
        (validationStatus === "selesai"
          ? "Laporan kinerja telah disahkan oleh Admin."
          : "Laporan kinerja dikembalikan untuk direvisi.");
      toast.success(successMsg);

      // Tutup modal dan refresh data laporan
      handleCloseValidationModal();
      await fetchLaporanData(selectedPeriode, false);
    } catch (err) {
      const axiosErr = err as AxiosError<{
        message?: string;
        errors?: Record<string, string[]>;
      }>;

      if (
        axiosErr.response?.status === 401 ||
        axiosErr.response?.status === 403
      ) {
        handleUnauthorizedExit();
        return;
      }

      const serverMsg =
        axiosErr.response?.data?.message ||
        axiosErr.response?.data?.errors?.catatan_revisi?.[0] ||
        "Gagal memvalidasi laporan kinerja.";
      setValidationError(serverMsg);
      toast.error(serverMsg);
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * Unduh PDF Dokumen Resmi:
   * GET /api/laporan-kinerja/{id}/pdf (responseType: 'blob')
   */
  const handleDownloadPdf = async (laporan: LaporanKinerjaItem) => {
    if (downloadingId !== null) return;

    setDownloadingId(laporan.id);

    const unitSlug = (laporan.unit_kerja?.nama_unit || "unit-kerja")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const dateSlug = new Date().toISOString().split("T")[0];
    const fileName = `laporan-kinerja-${unitSlug}-${dateSlug}.pdf`;

    try {
      const response = await apiClient.get<Blob>(
        `/api/laporan-kinerja/${laporan.id}/pdf`,
        {
          responseType: "blob",
        }
      );

      const pdfBlob = new Blob([response.data], { type: "application/pdf" });
      const blobUrl = window.URL.createObjectURL(pdfBlob);

      const anchor = document.createElement("a");
      anchor.style.display = "none";
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      window.setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);

      toast.success(`Dokumen PDF ${fileName} berhasil diunduh.`);
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (
        axiosErr.response?.status === 401 ||
        axiosErr.response?.status === 403
      ) {
        handleUnauthorizedExit();
        return;
      }
      toast.error("Gagal mengunduh berkas PDF resmi dari server.");
    } finally {
      setDownloadingId(null);
    }
  };

  /**
   * Export Rekapitulasi Laporan Kinerja ke Excel (.xlsx):
   * GET /api/laporan-kinerja/export/excel (responseType: 'blob')
   */
  const handleExportExcel = async () => {
    if (isExportingExcel) return;

    setIsExportingExcel(true);
    const loadingToastId = toast.loading(
      "Menyiapkan berkas Excel Rekap Kinerja Unit..."
    );

    const dateSlug = new Date().toISOString().split("T")[0];
    const fileName = `Rekap_Kinerja_Unit_${dateSlug}.xlsx`;

    try {
      const response = await apiClient.get<Blob>(
        "/api/laporan-kinerja/export/excel",
        {
          params: selectedPeriode ? { id_periode: selectedPeriode } : undefined,
          responseType: "blob",
        }
      );

      const excelBlob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const blobUrl = window.URL.createObjectURL(excelBlob);

      const anchor = document.createElement("a");
      anchor.style.display = "none";
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      window.setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);

      toast.success(`Rekapitulasi Excel (${fileName}) berhasil diunduh.`, {
        id: loadingToastId,
      });
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (
        axiosErr.response?.status === 401 ||
        axiosErr.response?.status === 403
      ) {
        toast.dismiss(loadingToastId);
        handleUnauthorizedExit();
        return;
      }
      toast.error("Gagal mengunduh rekapitulasi Excel dari server.", {
        id: loadingToastId,
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Label periode aktif terpilih
  const currentPeriodeObj = useMemo(
    () => periodeList.find((p) => p.id === selectedPeriode),
    [periodeList, selectedPeriode]
  );

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-[#0D47A1] animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-700">
          Memverifikasi sesi Administrator...
        </p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row antialiased text-slate-900 font-sans">
      <Toaster position="top-right" />

      {/* Sidebar Navigasi Administrator */}
      <AdminSidebar
        username={user?.username || "admin"}
        pendingUnitReviewCount={stats.review}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      {/* Konten Utama Admin */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header Mobile Bar */}
        <header className="lg:hidden h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#0D47A1]" />
              <span className="font-bold text-sm tracking-tight text-slate-900">
                Pemantauan Kinerja Unit
              </span>
            </div>
          </div>
        </header>

        {/* Banner Header Section (Menyatu dengan aksen biru lembut & border bawah) */}
        <section className="bg-blue-50/50 border-b border-blue-100/80 px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0D47A1]/10 text-[#0D47A1] border border-[#0D47A1]/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Panel Monitoring Admin
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Pemantauan Kinerja Unit Kerja
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Validasi laporan kinerja kegiatan dari seluruh unit (Biro,
                Pusat, dan Laboratorium), berikan catatan evaluasi, serta unduh
                berkas laporan resmi PDF.
              </p>
            </div>

            {/* Kontrol Refresh & Pilihan Periode di Sisi Kanan */}
            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => fetchLaporanData(selectedPeriode, true)}
                disabled={isFetching}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
                title="Segarkan data laporan"
              >
                <RefreshCw
                  className={`w-4 h-4 text-slate-500 ${
                    isFetching ? "animate-spin text-[#0D47A1]" : ""
                  }`}
                />
                <span>Segarkan</span>
              </button>

              {/* Dropdown Periode Akademik */}
              <div className="relative min-w-[210px]">
                <label htmlFor="periode-select" className="sr-only">
                  Pilih Periode Akademik
                </label>
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#0D47A1]">
                  <Calendar className="w-4 h-4" />
                </div>
                <select
                  id="periode-select"
                  value={selectedPeriode}
                  onChange={handlePeriodeChange}
                  disabled={isFetching || periodeList.length === 0}
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1] appearance-none cursor-pointer transition-all duration-200 disabled:opacity-50"
                >
                  {periodeList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama_periode}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {/* Tombol Export Excel */}
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExportingExcel || isFetching}
                className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
                title="Unduh Rekapitulasi Laporan Kinerja dalam format Excel (.xlsx)"
              >
                {isExportingExcel ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                <span>Export Excel</span>
              </button>
            </div>
          </div>
        </section>

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* 4 Kartu Statistik Bergradasi (Solid Gradient Cards) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Laporan (Biru) */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1e5bb8] to-[#0D47A1] text-white shadow-md shadow-blue-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Total Laporan
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.total}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Dari semua unit kerja
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                <FileText className="w-6 h-6" />
              </div>
            </div>

            {/* 2. Menunggu Review (Kuning/Emas) */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Menunggu Review
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.review}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Perlu divalidasi admin
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            {/* 3. Perlu Revisi (Merah) */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-red-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Perlu Revisi
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.revisi}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Dikembalikan ke unit
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            {/* 4. Laporan Selesai (Hijau) */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Laporan Selesai
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.selesai}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Siap cetak PDF resmi
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </section>

          {/* Area Filter Cerdas (Filter Bar dalam satu container putih memanjang) */}
          <section className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center">
            {/* Dropdown Filter Unit Kerja */}
            <div className="relative min-w-[220px] sm:w-auto w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Building2 className="w-4 h-4" />
              </div>
              <select
                value={filterUnitKerja}
                onChange={(e) => setFilterUnitKerja(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1] appearance-none cursor-pointer transition-all duration-200"
              >
                <option value="ALL">Semua Unit Kerja ({stats.total})</option>
                {unitKerjaOptions.map((unit) => (
                  <option key={unit.id} value={String(unit.id)}>
                    {unit.nama_unit}{" "}
                    {unit.kategori_unit ? `(${unit.kategori_unit})` : ""}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {/* Dropdown Filter Status */}
            <div className="relative min-w-[215px] sm:w-auto w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Filter className="w-4 h-4" />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1] appearance-none cursor-pointer transition-all duration-200"
              >
                <option value="ALL">Semua Status ({stats.total})</option>
                <option value="menunggu_admin">
                  Menunggu Validasi Admin ({stats.menungguAdmin})
                </option>
                <option value="menunggu_pimpinan">
                  Menunggu Review Pimpinan ({stats.menungguPimpinan})
                </option>
                <option value="revisi_pimpinan">
                  Revisi Pimpinan ({stats.revisiPimpinan})
                </option>
                <option value="revisi_admin">
                  Revisi Admin ({stats.revisiAdmin})
                </option>
                <option value="selesai">Selesai ({stats.selesai})</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {/* Search Bar Dominan (flex-1) */}
            <div className="relative flex-1 min-w-[240px]">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama kegiatan, rincian uraian, unit kerja, atau pimpinan..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1] transition-all duration-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </section>

          {/* Daftar Kartu Bersusun (Stacked Cards) */}
          <section className="space-y-4">
            {isFetching ? (
              <div className="py-20 bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-3 shadow-xs">
                <Loader2 className="w-8 h-8 text-[#0D47A1] animate-spin" />
                <p className="text-xs font-semibold text-slate-500">
                  Memuat daftar laporan kinerja unit...
                </p>
              </div>
            ) : filteredLaporanList.length === 0 ? (
              <div className="py-16 px-4 bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
                  <FileText className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  Belum Ada Laporan Kinerja
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                  {laporanList.length === 0
                    ? `Belum ada unit kerja yang mengunggah laporan kinerja untuk periode ${currentPeriodeObj?.nama_periode || "ini"}.`
                    : "Tidak ada laporan yang cocok dengan filter atau kata kunci pencarian."}
                </p>
              </div>
            ) : (
              filteredLaporanList.map((laporan) => {
                const statusBadge = getStatusBadgeConfig(laporan);
                const safeNamaUnit = sanitizePlainText(
                  laporan.unit_kerja?.nama_unit || "Unit Kerja Tidak Terdaftar"
                );
                const kategoriLabel = resolveKategoriLabel(
                  laporan.unit_kerja?.kategori ||
                    laporan.unit_kerja?.kategori_unit
                );
                const fallbackTitle = laporan.bulan_laporan
                  ? `Laporan Kinerja Bulan ${laporan.bulan_laporan}`
                  : `Laporan Kinerja #${laporan.id}`;
                const safeNamaKegiatan = sanitizePlainText(
                  laporan.nama_kegiatan || fallbackTitle
                );
                const pembahasanList = Array.isArray(laporan.pembahasan_json)
                  ? laporan.pembahasan_json
                  : [];
                const kendalaList = Array.isArray(laporan.kendala_json)
                  ? laporan.kendala_json
                  : [];
                const dukunganList = Array.isArray(laporan.dukungan_json)
                  ? laporan.dukungan_json
                  : [];
                const tindakLanjutList = Array.isArray(laporan.tindak_lanjut_json)
                  ? laporan.tindak_lanjut_json
                  : [];
                const firstAspek =
                  pembahasanList.length > 0
                    ? `${pembahasanList.length} Aspek Kinerja — ${pembahasanList[0].aspek || ""}${pembahasanList[0].realisasi ? `: ${pembahasanList[0].realisasi}` : ""}`
                    : null;
                const safeRingkasan =
                  laporan.ringkasan_pelaksanaan ||
                  laporan.identitas_laporan?.ringkasan_pelaksanaan ||
                  null;
                const safeUraian = sanitizePlainText(
                  safeRingkasan ||
                    firstAspek ||
                    laporan.uraian ||
                    "Laporan kinerja unit kerja terstruktur."
                );
                const penanggungJawab =
                  laporan.identitas_laporan?.penanggung_jawab ||
                  laporan.nama_penandatangan ||
                  null;
                const penyusun = laporan.identitas_laporan?.penyusun || null;
                const tanggalFormat = formatTanggalIndo(
                  laporan.updated_at || laporan.created_at
                );
                const safeCatatanRevisi = sanitizePlainText(
                  laporan.catatan_admin || laporan.catatan_revisi || ""
                );
                const isDownloadingThis = downloadingId === laporan.id;
                const isReadyForAdmin =
                  laporan.status_laporan === "menunggu_admin" ||
                  (!laporan.status_laporan && laporan.status === "Review");
                const isRevisionStatus =
                  laporan.status_laporan === "revisi_admin" ||
                  laporan.status_laporan === "revisi_pimpinan" ||
                  (!laporan.status_laporan && laporan.status === "Revisi");
                const isCompletedStatus =
                  laporan.status_laporan === "selesai" ||
                  (!laporan.status_laporan && laporan.status === "Selesai");

                return (
                  <article
                    key={laporan.id}
                    className="group bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs transition-all duration-200 hover:shadow-md hover:border-[#0D47A1]/30 hover:-translate-y-0.5 flex flex-col gap-4"
                  >
                    {/* Header Kartu: Nama Unit Kerja Menonjol di Atas Nama Kegiatan */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                      <div className="space-y-1.5">
                        {/* 1. Nama Unit Kerja & Kategori */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/80 border border-blue-200/70 uppercase tracking-wider text-xs font-bold text-[#0D47A1]">
                            <Building2 className="w-3.5 h-3.5 shrink-0 text-[#0D47A1]" />
                            <span>{safeNamaUnit}</span>
                          </span>

                          {kategoriLabel && (
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${getKategoriBadgeConfig(
                                kategoriLabel
                              )}`}
                            >
                              Unit {kategoriLabel}
                            </span>
                          )}

                          {laporan.bulan_laporan && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#0D47A1] border border-blue-200 shadow-2xs">
                              <Calendar className="w-3 h-3 text-[#FBC02D]" />
                              <span>Bulan {sanitizePlainText(laporan.bulan_laporan)}</span>
                            </span>
                          )}
                        </div>

                        {/* 2. Nama Kegiatan */}
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#0D47A1] transition-colors duration-200 leading-snug pt-0.5">
                          {safeNamaKegiatan}
                        </h2>
                      </div>

                      {/* Badge Status Laporan */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shrink-0 w-fit ${statusBadge.badgeClass}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`}
                        />
                        <span>{statusBadge.label}</span>
                      </span>
                    </div>

                    {/* Tipografi Deskripsi Uraian Kegiatan */}
                    <p className="text-xs sm:text-sm text-slate-600 line-clamp-3 leading-relaxed">
                      {safeUraian}
                    </p>

                    {/* Ringkasan Identitas & Tabel Dinamis / Legacy */}
                    {pembahasanList.length > 0 ? (
                      <div className="rounded-xl bg-slate-50/90 border border-slate-200/70 p-3.5 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-slate-600">
                          {penanggungJawab && (
                            <span>
                              Penanggung Jawab:{" "}
                              <strong className="text-slate-900">
                                {sanitizePlainText(penanggungJawab)}
                              </strong>
                            </span>
                          )}
                          {penyusun && (
                            <span>
                              Penyusun:{" "}
                              <strong className="text-slate-900">
                                {sanitizePlainText(penyusun)}
                              </strong>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#0D47A1] border border-blue-200 font-semibold">
                            {pembahasanList.length} Pembahasan
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                            {kendalaList.length} Kendala
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                            {dukunganList.length} Dukungan
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                            {tindakLanjutList.length} Tindak Lanjut
                          </span>
                        </div>
                      </div>
                    ) : (
                      (laporan.kendala || laporan.dukungan) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/90 p-3.5 rounded-xl border border-slate-100">
                          {laporan.kendala && (
                            <div>
                              <span className="font-semibold text-slate-700 block mb-0.5">
                                Kendala Pelaksanaan:
                              </span>
                              <span className="text-slate-600 line-clamp-2 leading-relaxed">
                                {sanitizePlainText(laporan.kendala)}
                              </span>
                            </div>
                          )}
                          {laporan.dukungan && (
                            <div>
                              <span className="font-semibold text-slate-700 block mb-0.5">
                                Dukungan Dibutuhkan:
                              </span>
                              <span className="text-slate-600 line-clamp-2 leading-relaxed">
                                {sanitizePlainText(laporan.dukungan)}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    )}

                    {/* Alert Box Catatan Revisi jika berstatus Revisi */}
                    {isRevisionStatus && (
                      <div className="rounded-xl bg-red-50 text-red-700 border border-red-200 p-3.5 flex items-start gap-2.5 text-xs">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5 flex-1">
                          <p className="font-bold text-red-800">
                            {laporan.status_laporan === "revisi_pimpinan"
                              ? "Catatan Revisi dari Pimpinan:"
                              : "Catatan Revisi dari Admin:"}
                          </p>
                          <p className="leading-relaxed">
                            {safeCatatanRevisi ||
                              "Laporan dikembalikan untuk perbaikan. Belum ada catatan rincian."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Footer Kartu: Metadata & Aksi Tombol */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 text-xs text-slate-500">
                      {/* Metadata dengan Flexbox gap konsisten */}
                      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                        {tanggalFormat && (
                          <span className="inline-flex items-center gap-1.5 text-slate-500">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{tanggalFormat}</span>
                          </span>
                        )}

                        {penanggungJawab && (
                          <span className="inline-flex items-center gap-1.5 text-slate-600">
                            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              Pimpinan:{" "}
                              <strong className="text-slate-800 font-semibold">
                                {sanitizePlainText(penanggungJawab)}
                              </strong>
                            </span>
                          </span>
                        )}

                        {laporan.link_bukti && (
                          <a
                            href={laporan.link_bukti}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/70 text-[#0D47A1] hover:bg-[#0D47A1] hover:text-white font-semibold transition-all duration-200 shadow-2xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Bukti Kegiatan</span>
                          </a>
                        )}
                      </div>

                      {/* Tombol Aksi: Pratinjau PDF (Selalu tersedia) & Validasi/Review (menunggu_admin) */}
                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(laporan)}
                          disabled={isDownloadingThis}
                          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold text-xs sm:text-sm shadow-xs transition-all duration-200 cursor-pointer disabled:opacity-50 ${
                            isCompletedStatus
                              ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
                              : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {isDownloadingThis ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Memuat PDF...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 text-red-600" />
                              <span>
                                {isCompletedStatus
                                  ? "Unduh PDF Resmi"
                                  : "Pratinjau PDF"}
                              </span>
                            </>
                          )}
                        </button>

                        {isReadyForAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenValidationModal(laporan)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-900 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all duration-200 cursor-pointer"
                          >
                            <ShieldAlert className="w-4 h-4 text-[#FBC02D]" />
                            <span>Validasi/Review</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </main>
      </div>

      {/* Modal Pop-up Validasi Laporan Kinerja */}
      {selectedLaporanForValidation && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0D47A1]">
                  Evaluasi & Otorisasi
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Validasi Laporan Kinerja
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseValidationModal}
                disabled={isValidating}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Isi Detail Laporan (Scrollable) */}
            <form
              onSubmit={handleExecuteValidation}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs sm:text-sm">
                {/* Unit Kerja & Info Meta */}
                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#0D47A1] uppercase tracking-wider">
                      {selectedLaporanForValidation.unit_kerja?.nama_unit ||
                        selectedLaporanForValidation.identitas_laporan
                          ?.nama_unit ||
                        "Unit Kerja"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2.5 py-0.5 rounded-md font-semibold bg-white text-[#0D47A1] border border-blue-200">
                        Periode: {currentPeriodeObj?.nama_periode || "-"}
                        {selectedLaporanForValidation.bulan_laporan
                          ? ` • Bulan ${selectedLaporanForValidation.bulan_laporan}`
                          : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadPdf(selectedLaporanForValidation)
                        }
                        disabled={
                          downloadingId === selectedLaporanForValidation.id
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-semibold cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-red-600" />
                        <span>Pratinjau PDF</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                    <p className="sm:col-span-2">
                      Nama Kegiatan:{" "}
                      <strong className="text-slate-900">
                        {selectedLaporanForValidation.nama_kegiatan ||
                          selectedLaporanForValidation.identitas_laporan
                            ?.nama_kegiatan ||
                          "-"}
                      </strong>
                    </p>
                    <p>
                      Penanggung Jawab:{" "}
                      <strong className="text-slate-900">
                        {selectedLaporanForValidation.identitas_laporan
                          ?.penanggung_jawab ||
                          selectedLaporanForValidation.nama_penandatangan ||
                          "-"}
                      </strong>
                    </p>
                    <p>
                      Penyusun (Staf):{" "}
                      <strong className="text-slate-900">
                        {selectedLaporanForValidation.identitas_laporan
                          ?.penyusun || "-"}
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Ringkasan Pelaksanaan */}
                {(selectedLaporanForValidation.ringkasan_pelaksanaan ||
                  selectedLaporanForValidation.identitas_laporan
                    ?.ringkasan_pelaksanaan) && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Ringkasan Pelaksanaan
                    </label>
                    <p className="whitespace-pre-line leading-relaxed text-xs">
                      {selectedLaporanForValidation.ringkasan_pelaksanaan ||
                        selectedLaporanForValidation.identitas_laporan
                          ?.ringkasan_pelaksanaan}
                    </p>
                  </div>
                )}

                {/* Tabel Pembahasan (JSON) atau Legacy */}
                {Array.isArray(selectedLaporanForValidation.pembahasan_json) &&
                selectedLaporanForValidation.pembahasan_json.length > 0 ? (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Pembahasan &amp; Realisasi Kinerja
                    </label>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                            <th className="py-2 px-3 font-bold">Aspek</th>
                            <th className="py-2 px-3 font-bold">Realisasi</th>
                            <th className="py-2 px-3 font-bold">Analisis</th>
                            <th className="py-2 px-3 font-bold">Bukti</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedLaporanForValidation.pembahasan_json.map(
                            (row, idx) => (
                              <tr key={idx} className="align-top">
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {sanitizePlainText(row.aspek || "-")}
                                </td>
                                <td className="py-2 px-3 text-slate-700 whitespace-pre-line">
                                  {sanitizePlainText(row.realisasi || "-")}
                                </td>
                                <td className="py-2 px-3 text-slate-600 whitespace-pre-line">
                                  {sanitizePlainText(row.analisis || "-")}
                                </td>
                                <td className="py-2 px-3">
                                  {row.link ? (
                                    <a
                                      href={row.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[#0D47A1] hover:underline font-semibold"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      <span>Link</span>
                                    </a>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Nama Kegiatan
                      </label>
                      <p className="font-bold text-slate-900 text-sm sm:text-base">
                        {selectedLaporanForValidation.nama_kegiatan}
                      </p>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Uraian Kegiatan
                      </label>
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {selectedLaporanForValidation.uraian ||
                          "Tidak ada uraian kegiatan."}
                      </div>
                    </div>
                  </>
                )}

                {/* Kesimpulan & Rekomendasi */}
                {(selectedLaporanForValidation.kesimpulan ||
                  selectedLaporanForValidation.rekomendasi) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Kesimpulan
                      </span>
                      <p className="text-xs text-slate-700 whitespace-pre-line">
                        {selectedLaporanForValidation.kesimpulan || "-"}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Rekomendasi
                      </span>
                      <p className="text-xs text-slate-700 whitespace-pre-line">
                        {selectedLaporanForValidation.rekomendasi || "-"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Form Keputusan Validasi Admin */}
                <div className="rounded-xl p-4 space-y-3 border border-slate-200 bg-slate-50">
                  <div>
                    <label
                      htmlFor="status-validasi-admin"
                      className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5"
                    >
                      Keputusan Validasi Admin{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="status-validasi-admin"
                      value={validationStatus}
                      disabled={isValidating}
                      onChange={(e) => {
                        setValidationStatus(
                          e.target.value as "selesai" | "revisi_admin"
                        );
                        if (validationError) setValidationError(null);
                      }}
                      className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20"
                    >
                      <option value="selesai">
                        Selesai (Sahkan Laporan Kinerja)
                      </option>
                      <option value="revisi_admin">
                        Tolak / Revisi (Kembalikan ke Unit)
                      </option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="catatan-admin-unit"
                        className={`text-xs font-bold uppercase tracking-wider ${
                          validationStatus === "revisi_admin"
                            ? "text-red-900"
                            : "text-slate-700"
                        }`}
                      >
                        Catatan Admin{" "}
                        {validationStatus === "revisi_admin" && (
                          <span className="text-red-600">*</span>
                        )}
                      </label>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {catatanAdmin.length}/2000
                      </span>
                    </div>

                    <textarea
                      id="catatan-admin-unit"
                      rows={3}
                      maxLength={2000}
                      disabled={isValidating}
                      required={validationStatus === "revisi_admin"}
                      value={catatanAdmin}
                      onChange={(e) => {
                        setCatatanAdmin(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      placeholder={
                        validationStatus === "revisi_admin"
                          ? "Wajib tuliskan instruksi revisi yang jelas untuk unit terkait..."
                          : "Opsional: tuliskan catatan pengesahan jika diperlukan..."
                      }
                      className="w-full rounded-xl bg-white border border-slate-300 p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 disabled:opacity-50"
                    />

                    {validationError && (
                      <p
                        role="alert"
                        className="text-xs font-semibold text-red-600 flex items-center gap-1.5 pt-1"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{validationError}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Modal: Tombol Aksi */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseValidationModal}
                  disabled={isValidating}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isValidating}
                  className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 ${
                    validationStatus === "revisi_admin"
                      ? "bg-red-600 hover:bg-red-700 active:bg-red-800"
                      : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                  }`}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Memproses...</span>
                    </>
                  ) : validationStatus === "revisi_admin" ? (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Kirim Revisi Admin</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Simpan &amp; Sahkan (Selesai)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
