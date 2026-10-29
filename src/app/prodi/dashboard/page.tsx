"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  GraduationCap,
  Loader2,
  LogOut,
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
import ProdiUploadModal from "@/components/prodi/ProdiUploadModal";

/**
 * Definisi 4 Tahapan Baku Pelaporan Akademik
 */
const DEFAULT_TAHAPAN_BLUEPRINT: Array<{
  tahap: TahapDokumenNumber;
  judul: string;
  deskripsi: string;
}> = [
  {
    tahap: 1,
    judul: "1. Kurikulum & Mata Kuliah",
    deskripsi:
      "Dokumen struktur kurikulum aktif, sebaran mata kuliah per semester, serta RPS yang telah disahkan.",
  },
  {
    tahap: 2,
    judul: "2. Kelas & Jadwal",
    deskripsi:
      "Daftar pembagian kelas paralel, penugasan dosen pengampu (SK Mengajar), dan jadwal perkuliahan.",
  },
  {
    tahap: 3,
    judul: "3. Nilai Perkuliahan",
    deskripsi:
      "Rekapitulasi nilai akhir mahasiswa (KHS/DPNA), berita acara penyerahan nilai, dan distribusi indeks prestasi.",
  },
  {
    tahap: 4,
    judul: "4. Yudisium & Transkrip",
    deskripsi:
      "Berita acara penetapan kelulusan (Yudisium), daftar lulusan periode berjalan, serta draf transkrip akademik.",
  },
];

/**
 * Fallback Master Periode apabila backend belum memiliki data periode
 */
const FALLBACK_PERIODE_LIST: ProdiPeriodeOption[] = [
  {
    id: "1",
    nama_periode: "2026/2027 Ganjil",
    status: "Buka",
    is_default: true,
  },
];

/**
 * Helper Konfigurasi Visual Badge Status:
 * - Abu-abu: Belum Unggah
 * - Kuning: Review
 * - Merah: Revisi
 * - Hijau: Selesai
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
 * Membangun 4 Kartu Tugas dengan menggabungkan Blueprint Tahapan (1-4)
 * dengan data riil dari API GET /api/dokumen?id_periode=...
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
    };
  });
}

export default function ProdiDashboardPage() {
  const router = useRouter();

  // State Otorisasi & Profil Pengguna
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // State Daftar Periode Multi-Open & Periode Aktif Terpilih
  const [periodeList, setPeriodeList] = useState<ProdiPeriodeOption[]>(
    FALLBACK_PERIODE_LIST
  );
  const [selectedPeriode, setSelectedPeriode] = useState<string>("1");

  // State Kartu Tugas & Loading Fetch Data Dashboard
  const [taskCards, setTaskCards] = useState<TaskCardItem[]>(() =>
    mapApiDokumenToTaskCards([])
  );
  const [isFetchingDashboard, setIsFetchingDashboard] = useState<boolean>(false);

  // State Modal Upload PDF & Modal Lihat Dokumen
  const [activeUploadTask, setActiveUploadTask] =
    useState<TaskCardItem | null>(null);
  const [activePreviewTask, setActivePreviewTask] =
    useState<TaskCardItem | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Filter hanya periode yang berstatus 'Buka'
  const openPeriodeOptions = useMemo(() => {
    const filtered = periodeList.filter((p) => p.status === "Buka");
    return filtered.length > 0 ? filtered : FALLBACK_PERIODE_LIST;
  }, [periodeList]);

  /**
   * Penanganan keluar aman saat sesi tidak sah (401/403)
   */
  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  /**
   * Fungsi Utama fetchDataDashboard():
   * Mengambil data dokumen pelaporan terbaru dari endpoint GET /api/dokumen?id_periode={selectedPeriode}
   * menggunakan Axios instance ber-interceptor Bearer token.
   */
  const fetchDataDashboard = useCallback(
    async (periodeIdParam?: string, showLoadingSpinner = true) => {
      const targetPeriode = periodeIdParam || selectedPeriode;
      if (!targetPeriode) return;

      if (showLoadingSpinner) {
        setIsFetchingDashboard(true);
      }

      try {
        const response = await apiClient.get<DokumenListResponse>(
          "/api/dokumen",
          {
            params: {
              id_periode: targetPeriode,
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
    [selectedPeriode, handleUnauthorizedExit]
  );

  /**
   * Route Protection & Inisialisasi Data Periode + Dokumen:
   * Wajib memiliki token otorisasi valid DAN role === 'user'
   */
  useEffect(() => {
    let isMounted = true;

    const initializeProdiDashboard = async () => {
      const session = getAuthSession();

      if (!session.token || session.role !== "user") {
        handleUnauthorizedExit();
        return;
      }

      if (session.user) {
        setUser(session.user);
      }

      try {
        // 1. Verifikasi sesi pengguna ke /api/me
        const meResponse = await apiClient.get<{
          status: string;
          data: AuthUser;
        }>("/api/me");

        const verifiedUser = meResponse.data?.data;
        if (!verifiedUser || verifiedUser.role !== "user") {
          handleUnauthorizedExit();
          return;
        }

        // 2. Ambil daftar periode akademik dari /api/periode
        let initialPeriodeId = "1";
        try {
          const periodeRes =
            await apiClient.get<PeriodeListResponse>("/api/periode");
          const rawPeriode = periodeRes.data?.data || [];

          if (rawPeriode.length > 0) {
            const mappedOptions: ProdiPeriodeOption[] = rawPeriode.map((p) => ({
              id: String(p.id),
              nama_periode: p.nama_periode,
              status: p.status_pelaporan === "Buka" ? "Buka" : "Tutup",
              is_default: Boolean(p.is_default),
            }));

            const openOnly = mappedOptions.filter((p) => p.status === "Buka");
            const defaultOption =
              openOnly.find((p) => p.is_default) ||
              openOnly[0] ||
              mappedOptions[0];

            if (isMounted) {
              setPeriodeList(mappedOptions);
              if (defaultOption) {
                initialPeriodeId = defaultOption.id;
                setSelectedPeriode(defaultOption.id);
              }
            }
          }
        } catch {
          // Gunakan fallback jika endpoint periode belum tersedia
        }

        if (isMounted) {
          setUser(verifiedUser);
          setIsAuthorized(true);
          setIsCheckingAuth(false);
        }

        // 3. Muat data kartu tugas dari backend untuk periode awal
        await fetchDataDashboard(initialPeriodeId, true);
      } catch (err) {
        const axiosErr = err as AxiosError;
        const status = axiosErr.response?.status;
        if (status === 401 || status === 403 || !axiosErr.response) {
          handleUnauthorizedExit();
        }
      }
    };

    initializeProdiDashboard();

    return () => {
      isMounted = false;
    };
  }, [handleUnauthorizedExit, fetchDataDashboard]);

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
      openPeriodeOptions.find((p) => p.id === selectedPeriode) ||
      openPeriodeOptions[0]
    );
  }, [openPeriodeOptions, selectedPeriode]);

  /**
   * Kalkulasi Progress Bar Dinamis berdasarkan periode terpilih
   */
  const totalDokumen = taskCards.length || 4;
  const selesaiCount = taskCards.filter((t) => t.status === "Selesai").length;
  const progressPercentage = Math.round((selesaiCount / totalDokumen) * 100);

  /**
   * Handler saat Dropdown 'Pilih Periode Pelaporan' diubah
   */
  const handlePeriodeSelectChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newPeriodeId = e.target.value;
    setSelectedPeriode(newPeriodeId);
    await fetchDataDashboard(newPeriodeId, true);
  };

  /**
   * Callback setelah upload dokumen di Modal berhasil (200 OK):
   * 1. Optimistic update agar kartu langsung berubah menjadi 'Review' (kuning)
   * 2. Trigger fetchDataDashboard() untuk sinkronisasi penuh dengan database backend
   */
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

    await fetchDataDashboard(selectedPeriode, false);
  };

  /**
   * Fungsi Unduh PDF Terenkripsi dari Backend (/api/dokumen/{id}/download)
   */
  const handleDownloadPdf = async (task: TaskCardItem) => {
    if (!task.id) {
      toast.error("ID dokumen belum tersedia di server.");
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const response = await apiClient.get(
        `/api/dokumen/${task.id}/download`,
        {
          responseType: "blob",
        }
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

  const safeUsername = sanitizePlainText(user?.username || "prodi_ti");
  const safeProdiName = sanitizePlainText(
    user?.prodi?.nama_prodi || "Program Studi"
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* React Hot Toast Container (Hijau untuk Sukses, Merah untuk Error) */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: "14px",
            fontSize: "13px",
            fontWeight: 600,
            padding: "12px 16px",
          },
          success: {
            style: {
              background: "#ecfdf5",
              color: "#065f46",
              border: "1px solid #6ee7b7",
            },
            iconTheme: {
              primary: "#059669",
              secondary: "#ecfdf5",
            },
          },
          error: {
            style: {
              background: "#fef2f2",
              color: "#991b1b",
              border: "1px solid #fca5a5",
            },
            iconTheme: {
              primary: "#dc2626",
              secondary: "#fef2f2",
            },
          },
        }}
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0D47A1] text-white flex items-center justify-center shadow-xs">
              <GraduationCap className="w-5 h-5 text-[#FBC02D]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-slate-900">
                  SIPASTI
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-[#0D47A1] border border-blue-200/80">
                  Operator Prodi
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-[220px] sm:max-w-xs">
                {safeProdiName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchDataDashboard(selectedPeriode, true)}
              disabled={isFetchingDashboard}
              title="Muat ulang status dokumen"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-xs font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#0D47A1] ${
                  isFetchingDashboard ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">Sinkronkan</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/80 text-xs text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{safeUsername}</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5 text-red-600" />
              <span>{isLoggingOut ? "Keluar..." : "Keluar"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container (max-w-5xl) */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8">
        {/* Banner Atas Interaktif: Dropdown 'Pilih Periode Pelaporan' (Multi-Open) & Progress Bar Dinamis */}
        <section
          aria-label="Pilih Periode Pelaporan dan Progres Dokumen"
          className="rounded-2xl bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] text-white p-6 sm:p-8 shadow-md shadow-blue-900/10 border border-blue-800/30 space-y-6"
        >
          {/* Baris Atas: Judul & Dropdown Pilih Periode Pelaporan */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#FBC02D]">
                <Calendar className="w-3.5 h-3.5" />
                Pelaporan Multi-Periode Terbuka
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Kelengkapan Dokumen Program Studi
              </h1>
              <p className="text-xs sm:text-sm text-blue-50/90">
                Pilih periode pelaporan yang berstatus buka dan unggah berkas
                PDF pada setiap tahapan.
              </p>
            </div>

            {/* Elemen Dropdown <select> 'Pilih Periode Pelaporan' */}
            <div className="w-full md:w-72 shrink-0">
              <label
                htmlFor="pilih-periode-select"
                className="block text-xs font-semibold text-blue-100 mb-1.5"
              >
                Pilih Periode Pelaporan
              </label>
              <div className="relative">
                <select
                  id="pilih-periode-select"
                  value={selectedPeriode}
                  onChange={handlePeriodeSelectChange}
                  disabled={isFetchingDashboard}
                  className="w-full appearance-none rounded-xl border border-white/90 bg-white pl-4 pr-10 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FBC02D] transition cursor-pointer disabled:opacity-60"
                >
                  {openPeriodeOptions.map((periode) => (
                    <option key={periode.id} value={periode.id}>
                      {periode.nama_periode}{" "}
                      {periode.is_default ? "(Default)" : "(Buka)"}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#0D47A1] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* Progress Bar Dinamis di Bawah Dropdown */}
          <div className="rounded-xl bg-white/15 backdrop-blur-md border border-white/25 p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-medium text-blue-50">
                Progres Periode{" "}
                <strong className="text-white">
                  {sanitizePlainText(currentPeriodeObj?.nama_periode || "")}
                </strong>
              </span>
              <span className="font-bold text-[#FBC02D]">
                {selesaiCount} dari {totalDokumen} Dokumen Selesai
              </span>
            </div>

            <div
              role="progressbar"
              aria-valuenow={selesaiCount}
              aria-valuemin={0}
              aria-valuemax={totalDokumen}
              className="w-full h-2.5 rounded-full bg-slate-950/35 overflow-hidden p-0.5"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FBC02D] to-emerald-400 transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </section>

        {/* Daftar 4 Task Cards (Kartu Tugas Vertikal) */}
        <section aria-label="Daftar Kartu Tugas Pelaporan" className="space-y-4">
          {taskCards.map((task) => {
            const badgeCfg = getStatusBadgeConfig(task.status);
            const isNeedUpload =
              task.status === "Belum Unggah" || task.status === "Revisi";

            // Sanitasi anti-XSS sebelum dirender sebagai plain text
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
                key={`${selectedPeriode}-tahap-${task.tahap}`}
                className="bg-white rounded-2xl border border-slate-200/85 shadow-xs hover:shadow-md transition-all duration-200 p-5 sm:p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Info Tahapan & Badge Status */}
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

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">
                          {safeJudul}
                        </h2>

                        {/* Badge Status */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold border ${badgeCfg.badgeClass}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${badgeCfg.dotClass}`}
                          />
                          {task.status}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {safeDeskripsi}
                      </p>

                      {safeFileName && (
                        <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                            <FileText className="w-3.5 h-3.5 text-[#0D47A1]" />
                            {safeFileName}
                          </span>
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
                  </div>

                  {/* Tombol Aksi: 'Upload PDF' (Primary) atau 'Lihat Dokumen' (Outline) */}
                  <div className="shrink-0 sm:self-center">
                    {isNeedUpload ? (
                      <button
                        type="button"
                        onClick={() => setActiveUploadTask(task)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-900 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-blue-900/15 transition cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Upload PDF</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActivePreviewTask(task)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50/50 text-[#0D47A1] border border-[#0D47A1]/35 hover:border-[#0D47A1] text-xs sm:text-sm font-semibold transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Lihat Dokumen</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Alert Box Revisi: Khusus untuk status 'Revisi' (bg-red-50 text-red-700) */}
                {task.status === "Revisi" && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl bg-red-50 text-red-700 border border-red-200 p-4 flex items-start gap-3"
                  >
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

      {/* Komponen Modal Upload PDF Terintegrasi dengan POST /api/dokumen/upload */}
      <ProdiUploadModal
        isOpen={Boolean(activeUploadTask)}
        targetTask={activeUploadTask}
        selectedPeriode={selectedPeriode}
        periodeLabel={currentPeriodeObj?.nama_periode || ""}
        onClose={() => setActiveUploadTask(null)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Modal Lihat Dokumen (Untuk Status 'Review' atau 'Selesai') */}
      {activePreviewTask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-lihat-dokumen-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileCheck2 className="w-5 h-5 text-[#FBC02D]" />
                <h3
                  id="modal-lihat-dokumen-title"
                  className="text-sm sm:text-base font-bold text-white"
                >
                  Detail Dokumen Terunggah
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePreviewTask(null)}
                className="text-white/75 hover:text-white p-1 rounded-lg transition cursor-pointer"
                aria-label="Tutup detail dokumen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
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
                    type="button"
                    onClick={() => handleDownloadPdf(activePreviewTask)}
                    disabled={isDownloadingPdf}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] text-white font-semibold text-xs transition cursor-pointer disabled:opacity-50"
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
                  type="button"
                  onClick={() => setActivePreviewTask(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 text-xs transition cursor-pointer"
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
