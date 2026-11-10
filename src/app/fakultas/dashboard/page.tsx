"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  GraduationCap,
  Info,
  Loader2,
  Menu,
  Paperclip,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
import { AuthUser } from "@/types/auth";
import {
  DokumenApiRecord,
  DokumenListResponse,
  DokumenStatus,
  DokumenUploadResponse,
  PeriodeListResponse,
  ProdiPeriodeOption,
  TahapDokumenNumber,
  TaskCardItem,
} from "@/types/dokumen";
import FakultasSidebar from "@/components/fakultas/FakultasSidebar";
import FakultasUploadModal from "@/components/fakultas/FakultasUploadModal";

export interface ProdiOptionItem {
  id: number;
  id_fakultas: number;
  nama_prodi: string;
  periode_mulai_aktif?: string | null;
}

/**
 * Definisi 4 Tahapan Baku Pelaporan Akademik (Sesuai SOP Format Surat Pernyataan)
 */
const DEFAULT_TAHAPAN_BLUEPRINT: Array<{
  tahap: TahapDokumenNumber;
  judul: string;
  deskripsi: string;
}> = [
  {
    tahap: 1,
    judul: "Tahap 1 (Kurikulum & Mata Kuliah)",
    deskripsi:
      "Unggah PDF Surat Pernyataan penginputan sajian kurikulum di SISFO yang masih berlaku dan ditandatangani oleh Kaprodi.",
  },
  {
    tahap: 2,
    judul: "Tahap 2 (Kelas & Jadwal)",
    deskripsi:
      "Unggah PDF Surat Pernyataan kevalidan penginputan kelas dan jadwal perkuliahan yang ada di SISFO.",
  },
  {
    tahap: 3,
    judul: "Tahap 3 (Nilai Perkuliahan)",
    deskripsi:
      "Unggah PDF Surat Pernyataan telah selesai proses entry nilai pada periode berjalan beserta rekapan laporan akhir.",
  },
  {
    tahap: 4,
    judul: "Tahap 4 (Yudisium & Transkrip)",
    deskripsi:
      "Unggah PDF Surat Pernyataan bahwa prodi telah selesai memproses kelulusan mahasiswa akhir dan mendokumentasikan transkrip nilai.",
  },
];

/**
 * Helper Konfigurasi Visual Badge Status
 */
function getStatusBadgeConfig(status: DokumenStatus) {
  switch (status) {
    case "Selesai":
      return {
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dotClass: "bg-emerald-500",
        stepCircleClass: "bg-emerald-600 text-white",
      };
    case "Review":
      return {
        badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
        dotClass: "bg-amber-500 animate-pulse",
        stepCircleClass: "bg-amber-500 text-slate-950",
      };
    case "Revisi":
      return {
        badgeClass: "bg-red-50 text-red-700 border-red-200",
        dotClass: "bg-red-500",
        stepCircleClass: "bg-red-600 text-white",
      };
    case "Belum Unggah":
    default:
      return {
        badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
        dotClass: "bg-slate-400",
        stepCircleClass: "bg-slate-200 text-slate-700",
      };
  }
}

/**
 * Membangun 4 Kartu Tugas dengan data riil dari API
 */
function mapApiDokumenToTaskCards(
  records: DokumenApiRecord[] = []
): TaskCardItem[] {
  return DEFAULT_TAHAPAN_BLUEPRINT.map((bp) => {
    const matched = records.find(
      (rec) => Number(rec.tahap_dokumen) === bp.tahap
    );

    if (!matched) {
      return {
        id: null,
        tahap: bp.tahap,
        judul: bp.judul,
        deskripsi: bp.deskripsi,
        status: "Belum Unggah",
        filePath: null,
        catatanRevisi: null,
        tanggalUpload: null,
        lampiran: [],
      };
    }

    return {
      id: matched.id ?? null,
      tahap: bp.tahap,
      judul: bp.judul,
      deskripsi: bp.deskripsi,
      status: matched.status || "Belum Unggah",
      filePath: matched.file_path || null,
      catatanRevisi: matched.catatan_revisi || null,
      tanggalUpload: matched.tanggal_upload || null,
      lampiran: matched.lampiran || [],
    };
  });
}

export default function FakultasDashboardPage() {
  const router = useRouter();

  // State Otorisasi & Profil Pengguna
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State Daftar Periode & Periode Aktif Terpilih
  const [activePeriods, setActivePeriods] = useState<ProdiPeriodeOption[]>([]);
  const [selectedPeriode, setSelectedPeriode] = useState<string>("");

  // State Daftar Program Studi & Program Studi Terpilih (Di bawah Fakultas Operator)
  const [prodiList, setProdiList] = useState<ProdiOptionItem[]>([]);
  const [selectedProdi, setSelectedProdi] = useState<string>("");

  // State Kartu Tugas & Loading Fetch
  const [taskCards, setTaskCards] = useState<TaskCardItem[]>(() =>
    mapApiDokumenToTaskCards([])
  );
  const [isFetchingDashboard, setIsFetchingDashboard] = useState<boolean>(false);

  // State Modal Upload, Modal Lihat Dokumen, & Accordion (Sistem Lipat)
  const [activeUploadTask, setActiveUploadTask] = useState<TaskCardItem | null>(
    null
  );
  const [activePreviewTask, setActivePreviewTask] =
    useState<TaskCardItem | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // State untuk melacak Task Card mana yang deskripsinya sedang dibuka (Expand)
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  const fetchDataDashboard = useCallback(
    async (
      periodeIdParam?: string,
      prodiIdParam?: string,
      showLoadingSpinner = true
    ) => {
      const targetPeriode = periodeIdParam ?? selectedPeriode;
      const targetProdi = prodiIdParam ?? selectedProdi;

      if (!targetPeriode || !targetProdi) {
        setTaskCards(mapApiDokumenToTaskCards([]));
        return;
      }

      if (showLoadingSpinner) {
        setIsFetchingDashboard(true);
      }

      try {
        const response = await apiClient.get<DokumenListResponse>(
          "/api/dokumen",
          {
            params: {
              id_periode: targetPeriode,
              id_prodi: targetProdi,
            },
          }
        );

        const records = response.data?.data || [];
        setTaskCards(mapApiDokumenToTaskCards(records));
      } catch (err) {
        const axiosErr = err as AxiosError<{ message?: string }>;
        const status = axiosErr.response?.status;

        if (status === 401 || status === 403) {
          handleUnauthorizedExit();
          return;
        }

        toast.error(
          axiosErr.response?.data?.message ||
            "Gagal memuat data dokumen pelaporan dari server."
        );
      } finally {
        if (showLoadingSpinner) {
          setIsFetchingDashboard(false);
        }
      }
    },
    [selectedPeriode, selectedProdi, handleUnauthorizedExit]
  );

  // Inisialisasi Sesi, Daftar Periode Aktif, dan Daftar Prodi Fakultas
  useEffect(() => {
    let isMounted = true;

    const initializeFakultasDashboard = async () => {
      const session = getAuthSession();

      if (!session.token || session.role !== "user") {
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
        if (!verifiedUser || verifiedUser.role !== "user") {
          handleUnauthorizedExit();
          return;
        }

        const [periodeResult, prodiResult] = await Promise.allSettled([
          apiClient.get<PeriodeListResponse>("/api/periode"),
          apiClient.get<{ status?: string; data?: ProdiOptionItem[] }>(
            "/api/prodi"
          ),
        ]);

        // 1. Proses Daftar Periode Aktif
        if (periodeResult.status === "fulfilled") {
          const rawPeriode = periodeResult.value.data?.data || [];
          const filteredActive = rawPeriode.filter(
            (p) => p.status_aktif === true || p.status_aktif === 1
          );

          if (isMounted) {
            if (filteredActive.length > 0) {
              const mappedOptions: ProdiPeriodeOption[] = filteredActive.map(
                (p) => ({
                  id: String(p.id),
                  nama_periode: p.nama_periode,
                  status: "Buka",
                  is_default: Boolean(p.is_default),
                })
              );

              setActivePeriods(mappedOptions);
              setSelectedPeriode(String(mappedOptions[0].id));
            } else {
              setActivePeriods([]);
              setSelectedPeriode("");
            }
          }
        } else if (isMounted) {
          setActivePeriods([]);
          setSelectedPeriode("");
          toast.error("Gagal memuat daftar periode akademik dari server.");
        }

        // 2. Proses Daftar Prodi yang berada di bawah naungan Fakultas User (id_fakultas)
        if (prodiResult.status === "fulfilled") {
          const allProdi = Array.isArray(prodiResult.value.data?.data)
            ? prodiResult.value.data.data
            : [];

          const filteredProdi = allProdi.filter(
            (p) => Number(p.id_fakultas) === Number(verifiedUser.id_fakultas)
          );

          if (isMounted) {
            setProdiList(filteredProdi);
            if (filteredProdi.length > 0) {
              setSelectedProdi(String(filteredProdi[0].id));
            } else {
              setSelectedProdi("");
            }
          }
        } else if (isMounted) {
          // Fallback ke relasi user.fakultas.prodi apabila endpoint /api/prodi gagal diakses
          const fallbackProdi: ProdiOptionItem[] = Array.isArray(
            verifiedUser.fakultas?.prodi
          )
            ? verifiedUser.fakultas.prodi
                .filter(
                  (p) =>
                    Number(p.id_fakultas) === Number(verifiedUser.id_fakultas)
                )
                .map((p) => ({
                  id: p.id,
                  id_fakultas: p.id_fakultas ?? Number(verifiedUser.id_fakultas),
                  nama_prodi: p.nama_prodi,
                  periode_mulai_aktif: p.periode_mulai_aktif,
                }))
            : [];

          setProdiList(fallbackProdi);
          if (fallbackProdi.length > 0) {
            setSelectedProdi(String(fallbackProdi[0].id));
          } else {
            setSelectedProdi("");
            toast.error("Gagal memuat daftar program studi dari server.");
          }
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

    initializeFakultasDashboard();

    return () => {
      isMounted = false;
    };
  }, [handleUnauthorizedExit]);

  // Efek Re-fetch Dokumen setiap kali selectedPeriode ATAU selectedProdi berubah
  useEffect(() => {
    if (!isAuthorized) return;

    if (!selectedPeriode || !selectedProdi) {
      setTaskCards(mapApiDokumenToTaskCards([]));
      return;
    }

    fetchDataDashboard(selectedPeriode, selectedProdi, true);
  }, [isAuthorized, selectedPeriode, selectedProdi, fetchDataDashboard]);

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

  const currentPeriodeObj = useMemo(() => {
    return (
      activePeriods.find((p) => p.id === selectedPeriode) ||
      activePeriods[0] ||
      null
    );
  }, [activePeriods, selectedPeriode]);

  const currentProdiObj = useMemo(() => {
    return (
      prodiList.find((p) => String(p.id) === String(selectedProdi)) ||
      prodiList[0] ||
      null
    );
  }, [prodiList, selectedProdi]);

  const totalDokumen = taskCards.length || 4;
  const selesaiCount = taskCards.filter((t) => t.status === "Selesai").length;
  const progressPercentage = Math.round((selesaiCount / totalDokumen) * 100);

  const handleProdiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProdiId = e.target.value;
    setSelectedProdi(newProdiId);
    setExpandedTaskId(null); // Tutup accordion jika prodi berubah
  };

  const handlePeriodeSelectChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newPeriodeId = e.target.value;
    setSelectedPeriode(newPeriodeId);
    setExpandedTaskId(null); // Tutup accordion jika periode berubah
  };

  const handleUploadSuccess = async (
    uploadedData?: DokumenUploadResponse["data"]
  ) => {
    if (uploadedData) {
      setTaskCards((prevCards) =>
        prevCards.map((card) =>
          card.tahap === Number(uploadedData.tahap_dokumen)
            ? {
                ...card,
                id: uploadedData.id ?? card.id,
                status: uploadedData.status || "Review",
                filePath: uploadedData.file_path || card.filePath,
                catatanRevisi: null,
                tanggalUpload:
                  uploadedData.tanggal_upload || new Date().toISOString(),
              }
            : card
        )
      );
    }
    await fetchDataDashboard(selectedPeriode, selectedProdi, false);
  };

  const handleDownloadPdf = async (task: TaskCardItem) => {
    if (!task.id) {
      toast.error("ID dokumen belum tersedia di server.");
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const response = await apiClient.get(
        `/api/dokumen/${task.id}/download`,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const fileName =
        task.filePath?.split("/").pop() || `dokumen-tahap-${task.tahap}.pdf`;
      link.setAttribute("download", sanitizePlainText(fileName));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Berkas PDF berhasil diunduh.");
    } catch {
      toast.error("Gagal mengunduh berkas PDF dari server.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const toggleAccordion = (tahapId: number) => {
    setExpandedTaskId((prev) => (prev === tahapId ? null : tahapId));
  };

  if (isCheckingAuth || !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl px-8 py-7 flex flex-col items-center gap-3 max-w-sm w-full text-center">
          <div className="w-11 h-11 rounded-xl bg-blue-950 text-white flex items-center justify-center shadow-sm">
            <Loader2 className="w-5 h-5 animate-spin text-[#FBC02D]" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Memverifikasi Otorisasi Sesi...
          </p>
        </div>
      </div>
    );
  }

  const safeUsername = sanitizePlainText(user?.username || "operator_fakultas");
  const safeFakultasName = sanitizePlainText(
    user?.fakultas?.nama_fakultas || "Unit Fakultas"
  );
  const safeSelectedProdiName = sanitizePlainText(
    currentProdiObj?.nama_prodi || "Belum Ada Program Studi"
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <Toaster position="top-right" />

      <FakultasSidebar
        username={safeUsername}
        fakultasName={safeFakultasName}
        nama_fakultas={safeFakultasName}
        fakultasLabel="Universitas Nurul Huda"
        completedCount={selesaiCount}
        totalCount={totalDokumen}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <header className="min-h-16 py-2.5 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">
                Overview Pelaporan
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                fetchDataDashboard(selectedPeriode, selectedProdi, true)
              }
              disabled={isFetchingDashboard}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#0D47A1] ${
                  isFetchingDashboard ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">Sinkronkan</span>
            </button>

            <div className="hidden xl:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200/80 text-xs text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{safeUsername}</span>
            </div>

            {/* Dropdown Pilih Program Studi */}
            <div className="relative flex items-center">
              <GraduationCap className="w-4 h-4 text-[#0D47A1] pointer-events-none absolute left-3.5" />
              <select
                aria-label="Pilih Program Studi"
                value={selectedProdi}
                onChange={handleProdiSelectChange}
                disabled={isFetchingDashboard || prodiList.length === 0}
                className="appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-9 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 focus:border-[#0D47A1] focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/15 transition disabled:opacity-60"
              >
                {prodiList.length === 0 ? (
                  <option value="" disabled>
                    Tidak ada program studi
                  </option>
                ) : (
                  prodiList.map((prodi) => (
                    <option key={prodi.id} value={String(prodi.id)}>
                      {prodi.nama_prodi}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3" />
            </div>

            {/* Dropdown Pilih Periode Pelaporan */}
            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 text-[#0D47A1] pointer-events-none absolute left-3.5" />
              <select
                aria-label="Pilih Periode Pelaporan"
                value={selectedPeriode}
                onChange={handlePeriodeSelectChange}
                disabled={isFetchingDashboard || activePeriods.length === 0}
                className="appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-9 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 focus:border-[#0D47A1] focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/15 transition disabled:opacity-60"
              >
                {activePeriods.length === 0 ? (
                  <option value="" disabled>
                    Tidak ada periode aktif
                  </option>
                ) : (
                  activePeriods.map((periode) => (
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

        <main className="p-5 sm:p-8 space-y-6 max-w-6xl w-full mx-auto flex-1">
          {/* Banner Biru Atas: Menampilkan Nama Program Studi Terpilih & Progress Bar */}
          <section
            aria-label="Banner Progress"
            className="rounded-2xl bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] text-white p-6 sm:p-7 shadow-sm border border-blue-800/30 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#FBC02D]">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {safeFakultasName}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {safeSelectedProdiName}
                </h2>
              </div>

              <div className="shrink-0 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 text-xs font-semibold text-white">
                  <span>Prodi:</span>
                  <strong className="text-[#FBC02D]">
                    {safeSelectedProdiName}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 text-xs font-semibold text-white">
                  <span>Periode:</span>
                  <strong className="text-[#FBC02D]">
                    {sanitizePlainText(currentPeriodeObj?.nama_periode || "-")}
                  </strong>
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-white/15 backdrop-blur-md border border-white/25 p-4 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs sm:text-sm">
                <span className="font-medium text-blue-50">
                  Capaian Kelengkapan Dokumen ({safeSelectedProdiName})
                </span>
                <span className="font-bold text-[#FBC02D]">
                  {selesaiCount} dari {totalDokumen} Dokumen Selesai
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-950/35 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#ffffff] to-white-400 transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </section>

          {/* Daftar 4 Kartu Tugas (Clean Accordion Design) */}
          <section
            aria-label="Daftar Kartu Tugas"
            className={`space-y-4 transition-opacity duration-200 ${
              isFetchingDashboard ? "opacity-60" : "opacity-100"
            }`}
          >
            {taskCards.map((task) => {
              const badgeCfg = getStatusBadgeConfig(task.status);
              const isNeedUpload =
                task.status === "Belum Unggah" || task.status === "Revisi";
              const isExpanded = expandedTaskId === task.tahap;

              const safeJudul = sanitizePlainText(task.judul);
              const safeDeskripsi = sanitizePlainText(task.deskripsi);
              const safeCatatanRevisi = task.catatanRevisi
                ? sanitizePlainText(task.catatanRevisi)
                : null;
              const safeFileName = task.filePath
                ? sanitizePlainText(
                    task.filePath.split("/").pop() || task.filePath
                  )
                : null;

              return (
                <article
                  key={`${selectedProdi}-${selectedPeriode}-tahap-${task.tahap}`}
                  className="bg-white rounded-xl border border-slate-200/85 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  {/* HEADER KARTU (Tampilan Utama yang Selalu Terlihat) */}
                  <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 ${badgeCfg.stepCircleClass}`}
                      >
                        {task.status === "Selesai" ? (
                          <FileCheck2 className="w-5 h-5" />
                        ) : (
                          <span>0{task.tahap}</span>
                        )}
                      </div>

                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900">
                            {safeJudul}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold border ${badgeCfg.badgeClass}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${badgeCfg.dotClass}`}
                            />
                            {task.status}
                          </span>
                        </div>

                        {/* Tombol Toggle Accordion (Lihat Ketentuan SOP) */}
                        <button
                          type="button"
                          onClick={() => toggleAccordion(task.tahap)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D47A1] hover:text-[#1565C0] transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                          {isExpanded
                            ? "Tutup Ketentuan SOP & Detail File"
                            : "Lihat Ketentuan SOP & Detail File"}
                        </button>
                      </div>
                    </div>

                    {/* Tombol Aksi Utama (Tetap Terlihat) */}
                    <div className="shrink-0 sm:self-center flex flex-wrap items-center gap-2">
                      {isNeedUpload ? (
                        <button
                          type="button"
                          onClick={() => setActiveUploadTask(task)}
                          disabled={!selectedProdi}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-900 text-white text-xs sm:text-sm font-semibold shadow-sm transition disabled:opacity-50"
                        >
                          <Upload className="w-4 h-4" />
                          <span>Upload PDF</span>
                        </button>
                      ) : (
                        <>
                          {task.tahap === 4 && task.status === "Review" && (
                            <button
                              type="button"
                              onClick={() => setActiveUploadTask(task)}
                              disabled={!selectedProdi}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0D47A1] border border-blue-200 text-xs sm:text-sm font-semibold transition disabled:opacity-50"
                            >
                              <Paperclip className="w-4 h-4" />
                              <span>Kelola Lampiran</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setActivePreviewTask(task)}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50/50 text-[#0D47A1] border border-[#0D47A1]/35 hover:border-[#0D47A1] text-xs sm:text-sm font-semibold transition"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Lihat Dokumen</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* AREA EXPANDABLE: Ketentuan SOP & Detail File (Disembunyikan secara default) */}
                  {isExpanded && (
                    <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-2 border-t border-slate-100 bg-slate-50/50">
                      <div className="flex items-start gap-2.5 mb-3">
                        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                          {safeDeskripsi}
                        </p>
                      </div>

                      {safeFileName && (
                        <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                            <FileText className="w-3.5 h-3.5 text-[#0D47A1]" />
                            {safeFileName}
                          </span>
                          {task.tahap === 4 &&
                            task.lampiran &&
                            task.lampiran.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#0D47A1] border border-blue-200 font-semibold">
                                <Paperclip className="w-3 h-3" />
                                {task.lampiran.length} Lampiran
                              </span>
                            )}
                          {task.tanggalUpload && (
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <Clock className="w-3 h-3" />
                              {new Date(task.tanggalUpload).toLocaleDateString(
                                "id-ID",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ALERT REVISI: Selalu terbuka jika statusnya 'Revisi' agar tidak terlewat oleh pengguna */}
                  {task.status === "Revisi" && (
                    <div className="mx-5 sm:mx-6 mb-5 sm:mb-6 rounded-xl bg-red-50 text-red-700 border border-red-200 p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-xs sm:text-sm">
                        <p className="font-bold text-red-800">
                          Catatan Revisi dari Admin:
                        </p>
                        <p className="leading-relaxed">
                          {safeCatatanRevisi ||
                            "Dokumen memerlukan revisi. Silakan perbaiki dan unggah ulang berkas PDF Anda."}
                        </p>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        </main>
      </div>

      {/* Komponen Modal Upload Fakultas */}
      <FakultasUploadModal
        isOpen={Boolean(activeUploadTask)}
        targetTask={activeUploadTask}
        targetProdiId={selectedProdi}
        prodiLabel={safeSelectedProdiName}
        selectedPeriode={selectedPeriode}
        periodeLabel={currentPeriodeObj?.nama_periode || ""}
        onClose={() => setActiveUploadTask(null)}
        onUploadSuccess={handleUploadSuccess}
        onLampiranDeleted={() =>
          fetchDataDashboard(selectedPeriode, selectedProdi, false)
        }
      />

      {activePreviewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileCheck2 className="w-5 h-5 text-[#FBC02D]" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Detail Dokumen Terunggah
                </h3>
              </div>
              <button
                onClick={() => setActivePreviewTask(null)}
                className="text-white/75 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div>
                  <span className="text-xs text-slate-500 block">
                    Program Studi
                  </span>
                  <span className="font-semibold text-slate-800">
                    {safeSelectedProdiName}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">
                    Periode Pelaporan
                  </span>
                  <span className="font-semibold text-slate-800">
                    {sanitizePlainText(currentPeriodeObj?.nama_periode || "")}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">
                    Tahapan Dokumen
                  </span>
                  <span className="font-bold text-slate-900">
                    {sanitizePlainText(activePreviewTask.judul)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">
                    Status Saat Ini
                  </span>
                  <span className="font-semibold text-[#0D47A1]">
                    {sanitizePlainText(activePreviewTask.status)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">
                    Berkas Tersimpan
                  </span>
                  <span className="font-mono text-xs text-slate-800 break-all">
                    {sanitizePlainText(
                      activePreviewTask.filePath || "Tidak tersedia"
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                {activePreviewTask.id && (
                  <button
                    onClick={() => handleDownloadPdf(activePreviewTask)}
                    disabled={isDownloadingPdf}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] text-white font-semibold text-xs transition disabled:opacity-50"
                  >
                    {isDownloadingPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FBC02D]" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Unduh PDF</span>
                  </button>
                )}
                <button
                  onClick={() => setActivePreviewTask(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 text-xs transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
