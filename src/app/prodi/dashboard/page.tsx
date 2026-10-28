"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  FileCheck2,
  FileText,
  GraduationCap,
  Loader2,
  LogOut,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
import { ApiErrorResponse, AuthUser } from "@/types/auth";
import {
  DokumenStatus,
  DokumenUploadResponse,
  ProdiPeriodeOption,
  TaskCardItem,
} from "@/types/dokumen";
import ProdiUploadModal from "@/components/prodi/ProdiUploadModal";

/**
 * Daftar Master Periode Pelaporan (Sistem Multi-Open: beberapa periode bisa berstatus 'Buka' bersamaan).
 * Dropdown hanya akan merender periode dengan status === 'Buka', dan memilih is_default === true sebagai nilai awal.
 */
const MASTER_PERIODE_LIST: ProdiPeriodeOption[] = [
  {
    id: "2026-ganjil",
    nama_periode: "2026/2027 Ganjil",
    status: "Buka",
    is_default: true,
  },
  {
    id: "2026-genap",
    nama_periode: "2026/2027 Genap",
    status: "Buka",
    is_default: false,
  },
  {
    id: "2025-remedial",
    nama_periode: "2025/2026 Susulan & Remedial",
    status: "Buka",
    is_default: false,
  },
  {
    id: "2025-reguler",
    nama_periode: "2025/2026 Ganjil (Ditutup)",
    status: "Tutup",
    is_default: false,
  },
];

/**
 * Data Dummy Awal untuk Ke-4 Kartu Tugas pada setiap Periode yang Terbuka (Multi-Open)
 */
const INITIAL_TASKS_BY_PERIODE: Record<string, TaskCardItem[]> = {
  "2026-ganjil": [
    {
      tahap: 1,
      judul: "1. Kurikulum & Mata Kuliah",
      deskripsi:
        "Dokumen struktur kurikulum aktif, sebaran mata kuliah per semester, serta RPS yang telah disahkan.",
      status: "Selesai",
      filePath: "dokumen-pelaporan/kurikulum-ti-2026-ganjil.pdf",
      catatanRevisi: null,
      tanggalUpload: "2026-10-19T09:00:00Z",
    },
    {
      tahap: 2,
      judul: "2. Kelas & Jadwal",
      deskripsi:
        "Daftar pembagian kelas paralel, penugasan dosen pengampu (SK Mengajar), dan jadwal perkuliahan.",
      status: "Selesai",
      filePath: "dokumen-pelaporan/kelas-jadwal-ti-2026-ganjil.pdf",
      catatanRevisi: null,
      tanggalUpload: "2026-10-21T10:30:00Z",
    },
    {
      tahap: 3,
      judul: "3. Nilai Perkuliahan",
      deskripsi:
        "Rekapitulasi nilai akhir mahasiswa (KHS/DPNA), berita acara penyerahan nilai, dan distribusi indeks prestasi.",
      status: "Revisi",
      filePath: "dokumen-pelaporan/nilai-perkuliahan-ti-2026-ganjil.pdf",
      catatanRevisi:
        "Rekapitulasi nilai mata kuliah wajib semester 3 dan 5 belum mencantumkan pengesahan Kaprodi serta lampiran berita acara nilai belum lengkap. Mohon perbaiki dan unggah ulang dalam format PDF.",
      tanggalUpload: "2026-10-23T14:15:00Z",
    },
    {
      tahap: 4,
      judul: "4. Yudisium & Transkrip",
      deskripsi:
        "Berita acara penetapan kelulusan (Yudisium), daftar lulusan periode berjalan, serta draf transkrip akademik.",
      status: "Belum Unggah",
      filePath: null,
      catatanRevisi: null,
      tanggalUpload: null,
    },
  ],
  "2026-genap": [
    {
      tahap: 1,
      judul: "1. Kurikulum & Mata Kuliah",
      deskripsi:
        "Dokumen struktur kurikulum aktif, sebaran mata kuliah per semester, serta RPS yang telah disahkan.",
      status: "Selesai",
      filePath: "dokumen-pelaporan/kurikulum-ti-2026-genap.pdf",
      catatanRevisi: null,
      tanggalUpload: "2026-10-25T08:30:00Z",
    },
    {
      tahap: 2,
      judul: "2. Kelas & Jadwal",
      deskripsi:
        "Daftar pembagian kelas paralel, penugasan dosen pengampu (SK Mengajar), dan jadwal perkuliahan.",
      status: "Review",
      filePath: "dokumen-pelaporan/kelas-jadwal-ti-2026-genap.pdf",
      catatanRevisi: null,
      tanggalUpload: "2026-10-26T11:20:00Z",
    },
    {
      tahap: 3,
      judul: "3. Nilai Perkuliahan",
      deskripsi:
        "Rekapitulasi nilai akhir mahasiswa (KHS/DPNA), berita acara penyerahan nilai, dan distribusi indeks prestasi.",
      status: "Belum Unggah",
      filePath: null,
      catatanRevisi: null,
      tanggalUpload: null,
    },
    {
      tahap: 4,
      judul: "4. Yudisium & Transkrip",
      deskripsi:
        "Berita acara penetapan kelulusan (Yudisium), daftar lulusan periode berjalan, serta draf transkrip akademik.",
      status: "Belum Unggah",
      filePath: null,
      catatanRevisi: null,
      tanggalUpload: null,
    },
  ],
  "2025-remedial": [
    {
      tahap: 1,
      judul: "1. Kurikulum & Mata Kuliah",
      deskripsi:
        "Dokumen struktur kurikulum aktif, sebaran mata kuliah per semester, serta RPS yang telah disahkan.",
      status: "Selesai",
      filePath: "dokumen-pelaporan/kurikulum-ti-2025-remedial.pdf",
      catatanRevisi: null,
      tanggalUpload: "2026-09-10T09:00:00Z",
    },
    {
      tahap: 2,
      judul: "2. Kelas & Jadwal",
      deskripsi:
        "Daftar pembagian kelas paralel, penugasan dosen pengampu (SK Mengajar), dan jadwal perkuliahan.",
      status: "Selesai",
      filePath: "dokumen-pelaporan/jadwal-ti-2025-remedial.pdf",
      catatanRevisi: null,
      tanggalUpload: "2026-09-12T10:15:00Z",
    },
    {
      tahap: 3,
      judul: "3. Nilai Perkuliahan",
      deskripsi:
        "Rekapitulasi nilai akhir mahasiswa (KHS/DPNA), berita acara penyerahan nilai, dan distribusi indeks prestasi.",
      status: "Selesai",
      filePath: "dokumen-pelaporan/nilai-ti-2025-remedial.pdf",
      catatanRevisi: null,
      tanggalUpload: "2026-09-20T16:00:00Z",
    },
    {
      tahap: 4,
      judul: "4. Yudisium & Transkrip",
      deskripsi:
        "Berita acara penetapan kelulusan (Yudisium), daftar lulusan periode berjalan, serta draf transkrip akademik.",
      status: "Review",
      filePath: "dokumen-pelaporan/yudisium-ti-2025-remedial.pdf",
      catatanRevisi: null,
      tanggalUpload: "2026-09-25T13:45:00Z",
    },
  ],
};

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

interface ToastMessage {
  id: number;
  type: "success" | "error" | "info";
  title: string;
  description: string;
}

export default function ProdiDashboardPage() {
  const router = useRouter();

  // Filter hanya periode yang berstatus 'Buka'
  const openPeriodeOptions = useMemo(
    () => MASTER_PERIODE_LIST.filter((p) => p.status === "Buka"),
    []
  );

  // Cari periode default (is_default === true)
  const defaultPeriodeId = useMemo(() => {
    const foundDefault = openPeriodeOptions.find((p) => p.is_default);
    return foundDefault ? foundDefault.id : openPeriodeOptions[0]?.id || "";
  }, [openPeriodeOptions]);

  // State Otorisasi & Profil Pengguna
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // State Multi-Open Periode & Data Kartu Tugas per Periode
  const [selectedPeriodeId, setSelectedPeriodeId] =
    useState<string>(defaultPeriodeId);
  const [tasksByPeriode, setTasksByPeriode] = useState<
    Record<string, TaskCardItem[]>
  >(INITIAL_TASKS_BY_PERIODE);

  // State Modal Upload PDF & Modal Lihat Dokumen
  const [activeUploadTask, setActiveUploadTask] =
    useState<TaskCardItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activePreviewTask, setActivePreviewTask] =
    useState<TaskCardItem | null>(null);

  // State Toast Notification
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback(
    (type: ToastMessage["type"], title: string, description: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [
        ...prev,
        {
          id,
          type,
          title: sanitizePlainText(title),
          description: sanitizePlainText(description),
        },
      ]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  /**
   * Penanganan keluar aman saat sesi tidak sah (401/403)
   */
  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  /**
   * Route Protection: Wajib memiliki token otorisasi valid DAN role === 'user'
   */
  useEffect(() => {
    let isMounted = true;

    const verifyProdiAccess = async () => {
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
        }>("/me", {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        });

        const verifiedUser = meResponse.data?.data;
        if (!verifiedUser || verifiedUser.role !== "user") {
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

    verifyProdiAccess();

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

  /**
   * Mengambil daftar 4 kartu tugas untuk periode yang sedang dipilih di dropdown
   */
  const currentTasks = useMemo(() => {
    return (
      tasksByPeriode[selectedPeriodeId] ||
      INITIAL_TASKS_BY_PERIODE[defaultPeriodeId] ||
      []
    );
  }, [tasksByPeriode, selectedPeriodeId, defaultPeriodeId]);

  const currentPeriodeObj = useMemo(() => {
    return (
      openPeriodeOptions.find((p) => p.id === selectedPeriodeId) ||
      openPeriodeOptions[0]
    );
  }, [openPeriodeOptions, selectedPeriodeId]);

  /**
   * Kalkulasi Progress Bar Dinamis berdasarkan periode terpilih
   */
  const totalDokumen = currentTasks.length || 4;
  const selesaiCount = currentTasks.filter(
    (t) => t.status === "Selesai"
  ).length;
  const progressPercentage = Math.round((selesaiCount / totalDokumen) * 100);

  /**
   * Handler saat Dropdown 'Pilih Periode Pelaporan' diubah
   */
  const handlePeriodeSelectChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newPeriodeId = e.target.value;
    setSelectedPeriodeId(newPeriodeId);
    const targetObj = openPeriodeOptions.find((p) => p.id === newPeriodeId);
    if (targetObj) {
      pushToast(
        "info",
        "Periode Pelaporan Diubah",
        `Menampilkan tahapan dokumen untuk periode ${targetObj.nama_periode}.`
      );
    }
  };

  /**
   * Handler Submit Upload PDF dari Modal
   */
  const handleUploadPdfSubmit = async (file: File, task: TaskCardItem) => {
    const { token, role } = getAuthSession();
    if (!token || role !== "user") {
      handleUnauthorizedExit();
      return;
    }

    setIsUploading(true);
    const safeFileName = sanitizePlainText(file.name);

    try {
      const formData = new FormData();
      formData.append("tahap_dokumen", String(task.tahap));
      formData.append("periode_id", selectedPeriodeId);
      formData.append("file", file);

      const response = await apiClient.post<DokumenUploadResponse>(
        "/prodi/dokumen-pelaporan/upload",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const uploadedRecord = response.data?.data;

      setTasksByPeriode((prevMap) => {
        const listForPeriode = prevMap[selectedPeriodeId] || [];
        return {
          ...prevMap,
          [selectedPeriodeId]: listForPeriode.map((item) =>
            item.tahap === task.tahap
              ? {
                  ...item,
                  status: uploadedRecord?.status || "Review",
                  filePath: uploadedRecord?.file_path
                    ? sanitizePlainText(uploadedRecord.file_path)
                    : `dokumen-pelaporan/${safeFileName}`,
                  catatanRevisi: null,
                  tanggalUpload:
                    uploadedRecord?.tanggal_upload || new Date().toISOString(),
                }
              : item
          ),
        };
      });

      setActiveUploadTask(null);
      pushToast(
        "success",
        "Dokumen Berhasil Diunggah",
        `Berkas "${safeFileName}" untuk ${task.judul} kini berstatus Review.`
      );
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const status = axiosErr.response?.status;

      if (status === 401 || status === 403) {
        handleUnauthorizedExit();
        return;
      }

      const apiMsg =
        axiosErr.response?.data?.errors?.file?.[0] ||
        axiosErr.response?.data?.message ||
        "Gagal mengunggah dokumen ke server.";

      pushToast("error", "Gagal Mengunggah PDF", apiMsg);
    } finally {
      setIsUploading(false);
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
    user?.prodi?.nama_prodi || "S1 Teknik Informatika"
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Toast Notification Container */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-2xl border p-4 shadow-xl backdrop-blur-md flex items-start gap-3 transition-all ${
              toast.type === "success"
                ? "bg-white/95 border-emerald-200 text-slate-900"
                : toast.type === "error"
                ? "bg-white/95 border-red-200 text-slate-900"
                : "bg-white/95 border-blue-200 text-slate-900"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : toast.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <Sparkles className="w-5 h-5 text-[#0D47A1] shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs">
              <p className="font-bold text-slate-900">{toast.title}</p>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                {toast.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

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

          <div className="flex items-center gap-3">
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
                  value={selectedPeriodeId}
                  onChange={handlePeriodeSelectChange}
                  className="w-full appearance-none rounded-xl border border-white/90 bg-white pl-4 pr-10 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FBC02D] transition cursor-pointer"
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
          {currentTasks.map((task) => {
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
                key={`${selectedPeriodeId}-tahap-${task.tahap}`}
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
                      {/* Dirender murni sebagai plain text JSX (Bebas XSS) */}
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

      {/* Komponen Modular Modal Upload PDF (Validasi Ketat .pdf & Maksimal 2MB) */}
      <ProdiUploadModal
        isOpen={Boolean(activeUploadTask)}
        targetTask={activeUploadTask}
        periodeLabel={currentPeriodeObj?.nama_periode || ""}
        isUploading={isUploading}
        onClose={() => setActiveUploadTask(null)}
        onValidationError={(msg) =>
          pushToast("error", "Validasi Berkas Gagal", msg)
        }
        onSubmitFile={handleUploadPdfSubmit}
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

              <div className="flex items-center justify-end gap-2 pt-2">
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
