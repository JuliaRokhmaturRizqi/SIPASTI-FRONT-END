"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FileText,
  FileUp,
  GraduationCap,
  Info,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import {
  formatFileSize,
  MAX_PDF_SIZE_BYTES,
  sanitizePlainText,
  validatePdfFileSync,
  verifyPdfMagicBytes,
} from "@/lib/security";
import { AuthUser, ApiErrorResponse } from "@/types/auth";
import {
  DokumenApiRecord,
  DokumenListResponse,
  DokumenStatus,
  DokumenUploadResponse,
  TahapDokumenNumber,
  TaskCardItem,
} from "@/types/dokumen";

/**
 * Definisi master 4 tahapan pelaporan administrasi Program Studi.
 * Dilengkapi fallback default yang realistis apabila API belum mengembalikan record lengkap.
 */
const DEFAULT_TAHAPAN_PELAPORAN: TaskCardItem[] = [
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
];

/**
 * Helper konfigurasi visual Badge Status sesuai spesifikasi:
 * - 'Belum Unggah' (Abu-abu)
 * - 'Review' (Kuning)
 * - 'Revisi' (Merah)
 * - 'Selesai' (Hijau)
 */
function getStatusBadgeStyle(status: DokumenStatus) {
  switch (status) {
    case "Selesai":
      return {
        badgeClass:
          "bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-500/20",
        dotClass: "bg-emerald-500",
        cardBorderClass: "border-slate-200/90 hover:border-emerald-300/80",
        stepCircleClass:
          "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20",
      };
    case "Review":
      return {
        badgeClass:
          "bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-500/20",
        dotClass: "bg-amber-500 animate-pulse",
        cardBorderClass: "border-amber-200/90 hover:border-amber-300",
        stepCircleClass:
          "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20",
      };
    case "Revisi":
      return {
        badgeClass:
          "bg-red-50 text-red-700 border-red-200 ring-1 ring-red-500/20",
        dotClass: "bg-red-500",
        cardBorderClass: "border-red-200 hover:border-red-300",
        stepCircleClass: "bg-red-600 text-white shadow-sm shadow-red-600/20",
      };
    case "Belum Unggah":
    default:
      return {
        badgeClass:
          "bg-slate-100 text-slate-600 border-slate-200 ring-1 ring-slate-400/15",
        dotClass: "bg-slate-400",
        cardBorderClass: "border-slate-200/90 hover:border-blue-300/70",
        stepCircleClass: "bg-slate-200 text-slate-700",
      };
  }
}

export default function ProdiDashboardPage() {
  const router = useRouter();

  // State Otorisasi & Profil Pengguna
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // State Data Pelaporan
  const [periodeAktif, setPeriodeAktif] = useState<string>("2026/2027 Ganjil");
  const [tasks, setTasks] = useState<TaskCardItem[]>(DEFAULT_TAHAPAN_PELAPORAN);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // State Modal Upload Dokumen
  const [activeUploadTask, setActiveUploadTask] =
    useState<TaskCardItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // State Modal Lihat Dokumen
  const [activePreviewTask, setActivePreviewTask] =
    useState<TaskCardItem | null>(null);

  /**
   * Penanganan terpusat untuk error otorisasi 401/403:
   * Membersihkan sesi secara aman tanpa crash dan mengarahkan paksa ke /login.
   */
  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  /**
   * Menggabungkan data dokumen dari API dengan struktur 4 tahapan standar
   * serta menyanitasi setiap string (XSS Prevention).
   */
  const mergeApiRecordsWithDefaults = useCallback(
    (records: DokumenApiRecord[]) => {
      if (!Array.isArray(records) || records.length === 0) return;

      const validStatuses: DokumenStatus[] = [
        "Belum Unggah",
        "Review",
        "Revisi",
        "Selesai",
      ];

      setTasks((prevTasks) =>
        prevTasks.map((defaultItem) => {
          const matched = records.find(
            (r) => Number(r.tahap_dokumen) === defaultItem.tahap
          );
          if (!matched) return defaultItem;

          const safeStatus: DokumenStatus = validStatuses.includes(
            matched.status
          )
            ? matched.status
            : "Belum Unggah";

          return {
            ...defaultItem,
            status: safeStatus,
            filePath: matched.file_path
              ? sanitizePlainText(matched.file_path)
              : null,
            catatanRevisi: matched.catatan_revisi
              ? sanitizePlainText(matched.catatan_revisi)
              : null,
            tanggalUpload: matched.tanggal_upload
              ? sanitizePlainText(matched.tanggal_upload)
              : null,
          };
        })
      );
    },
    []
  );

  /**
   * Mengambil data dokumen pelaporan prodi secara aman (dengan header Bearer Token & try-catch).
   */
  const fetchDokumenPelaporan = useCallback(
    async (token: string) => {
      setIsLoadingData(true);
      try {
        const response = await apiClient.get<DokumenListResponse>(
          "/prodi/dokumen-pelaporan",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data?.periode_aktif) {
          setPeriodeAktif(sanitizePlainText(response.data.periode_aktif));
        }

        if (Array.isArray(response.data?.data) && response.data.data.length > 0) {
          mergeApiRecordsWithDefaults(response.data.data);
        }
      } catch (err) {
        const axiosErr = err as AxiosError<ApiErrorResponse>;
        const status = axiosErr.response?.status;
        if (status === 401 || status === 403) {
          handleUnauthorizedExit();
          return;
        }
        // Jika terjadi gangguan jaringan non-fatal, pertahankan tampilan dengan pesan informatif
      } finally {
        setIsLoadingData(false);
      }
    },
    [handleUnauthorizedExit, mergeApiRecordsWithDefaults]
  );

  /**
   * INSTRUKSI KEAMANAN 1: Route Protection (Otorisasi Ketat)
   * Hanya mengizinkan akses jika terdapat token valid DAN role === 'user'.
   */
  useEffect(() => {
    let isMounted = true;

    const verifyAccessAndLoad = async () => {
      const session = getAuthSession();

      // Tolak segera jika tidak ada token atau role bukan 'user'
      if (!session.token || session.role !== "user") {
        handleUnauthorizedExit();
        return;
      }

      if (session.user) {
        setUser(session.user);
      }

      try {
        // Verifikasi keabsahan token & role langsung ke server (/api/me)
        const meResponse = await apiClient.get<{
          status: string;
          data: AuthUser;
        }>("/me", {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        });

        const verifiedUser = meResponse.data.data;

        if (!verifiedUser || verifiedUser.role !== "user") {
          handleUnauthorizedExit();
          return;
        }

        if (isMounted) {
          setUser(verifiedUser);
          setIsAuthorized(true);
          setIsCheckingAuth(false);
        }

        await fetchDokumenPelaporan(session.token);
      } catch (err) {
        const axiosErr = err as AxiosError;
        const status = axiosErr.response?.status;
        if (status === 401 || status === 403 || !axiosErr.response) {
          handleUnauthorizedExit();
        }
      }
    };

    verifyAccessAndLoad();

    return () => {
      isMounted = false;
    };
  }, [fetchDokumenPelaporan, handleUnauthorizedExit]);

  /**
   * Handler Logout dengan pembersihan sesi aman.
   */
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
   * Membuka Modal Upload Dokumen untuk tahapan tertentu.
   */
  const openUploadModal = (task: TaskCardItem) => {
    setActiveUploadTask(task);
    setSelectedFile(null);
    setFileError(null);
    setFeedbackBanner(null);
  };

  /**
   * Menutup Modal Upload Dokumen.
   */
  const closeUploadModal = () => {
    if (isUploading) return;
    setActiveUploadTask(null);
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * INSTRUKSI KEAMANAN 2: Strict File Validation (Validasi Upload Klien)
   * Memvalidasi ekstensi .pdf, MIME application/pdf, batas maksimal 5MB, dan Magic Bytes %PDF-.
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0] || null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    // 1. Validasi sinkron (ekstensi .pdf, anti double-extension, MIME type, ukuran <= 5MB)
    const syncCheck = validatePdfFileSync(file);
    if (!syncCheck.valid) {
      setSelectedFile(null);
      setFileError(
        syncCheck.error || "Berkas tidak memenuhi kriteria keamanan."
      );
      e.target.value = "";
      return;
    }

    // 2. Validasi biner header PDF (%PDF-) untuk mencegah pemalsuan ekstensi
    const isGenuinePdf = await verifyPdfMagicBytes(file);
    if (!isGenuinePdf) {
      setSelectedFile(null);
      setFileError(
        "Berkas ditolak! Struktur internal berkas bukan dokumen PDF yang valid."
      );
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  /**
   * INSTRUKSI KEAMANAN 4: Secure API Call untuk Upload Dokumen PDF
   */
  const handleUploadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeUploadTask || isUploading) return;

    // Validasi ulang sebelum pengiriman
    const syncCheck = validatePdfFileSync(selectedFile);
    if (!syncCheck.valid || !selectedFile) {
      setFileError(
        syncCheck.error || "Silakan pilih berkas PDF yang valid (maksimal 5MB)."
      );
      return;
    }

    const isGenuinePdf = await verifyPdfMagicBytes(selectedFile);
    if (!isGenuinePdf) {
      setFileError(
        "Berkas ditolak! Struktur internal berkas bukan dokumen PDF yang valid."
      );
      return;
    }

    const { token, role } = getAuthSession();
    if (!token || role !== "user") {
      handleUnauthorizedExit();
      return;
    }

    setIsUploading(true);
    setFileError(null);

    try {
      const formData = new FormData();
      formData.append("tahap_dokumen", String(activeUploadTask.tahap));
      formData.append("file", selectedFile);

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
      const safeFileName = sanitizePlainText(selectedFile.name);
      const targetTahap: TahapDokumenNumber = activeUploadTask.tahap;

      // Perbarui state kartu tugas menjadi 'Review'
      setTasks((prev) =>
        prev.map((item) =>
          item.tahap === targetTahap
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
        )
      );

      setFeedbackBanner({
        type: "success",
        message: sanitizePlainText(
          response.data?.message ||
            `Dokumen "${activeUploadTask.judul}" berhasil diunggah dan kini berstatus Review.`
        ),
      });

      setActiveUploadTask(null);
      setSelectedFile(null);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const status = axiosErr.response?.status;

      // Jika terjadi 401/403, lakukan logout aman tanpa crash
      if (status === 401 || status === 403) {
        handleUnauthorizedExit();
        return;
      }

      const apiMsg =
        axiosErr.response?.data?.errors?.file?.[0] ||
        axiosErr.response?.data?.message ||
        "Gagal mengunggah dokumen. Pastikan ukuran PDF tidak melebihi 5MB dan koneksi stabil.";

      setFileError(sanitizePlainText(apiMsg));
    } finally {
      setIsUploading(false);
    }
  };

  // Perhitungan Progres Dokumen Selesai
  const totalDokumen = tasks.length;
  const selesaiCount = tasks.filter((t) => t.status === "Selesai").length;
  const reviewCount = tasks.filter((t) => t.status === "Review").length;
  const revisiCount = tasks.filter((t) => t.status === "Revisi").length;
  const progressPercentage = Math.round((selesaiCount / totalDokumen) * 100);

  // Layar pemuatan selama verifikasi otorisasi berlangsung (mencegah kebocoran UI/Flash of Unauthorized Content)
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
          <p className="text-xs text-slate-500">
            Memastikan hak akses Operator Program Studi yang valid.
          </p>
        </div>
      </div>
    );
  }

  const safeUsername = sanitizePlainText(user?.username || "Operator Prodi");
  const safeProdiName = sanitizePlainText(
    user?.prodi?.nama_prodi || "Program Studi Teknik Informatika"
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Header Bar: Deep Blue Harmony dengan Aksen Golden Yellow */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border-b border-white/10 shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <GraduationCap className="w-5 h-5 text-[#FBC02D]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  SIPASTI
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-[#FBC02D]/15 text-[#FBC02D] border border-[#FBC02D]/30">
                  Portal Prodi
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate max-w-[200px] sm:max-w-xs">
                {safeProdiName}
              </p>
            </div>
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-xs text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{safeUsername}</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/15 text-xs font-medium text-white transition cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5 text-[#FBC02D]" />
              <span>{isLoggingOut ? "Keluar..." : "Keluar"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container (max-w-5xl) */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-6">
        {/* Banner Periode Aktif & Progress Bar */}
        <section
          aria-label="Ringkasan Periode Aktif"
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-[#0D47A1] to-blue-950 text-white p-6 sm:p-8 shadow-xl shadow-blue-950/10 border border-blue-800/40"
        >
          {/* Ambient Glass Orbs */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-500/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#FBC02D]/10 blur-3xl"
          />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Informasi Periode */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-xs font-medium text-blue-100">
                <Calendar className="w-3.5 h-3.5 text-[#FBC02D]" />
                <span>Siklus Pelaporan Akademik</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Periode Aktif: {periodeAktif}
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/85 max-w-xl leading-relaxed">
                Unggah seluruh dokumen administrasi wajib Program Studi dalam
                format PDF terverifikasi untuk pemenuhan evaluasi semester.
              </p>
            </div>

            {/* Kotak Progress Bar Glassmorphism */}
            <div className="w-full md:w-80 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 sm:p-5 shrink-0">
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-blue-100">Progres Pelaporan</span>
                <span className="text-[#FBC02D] font-bold">
                  {selesaiCount} dari {totalDokumen} Dokumen Selesai
                </span>
              </div>

              {/* Track Progress Bar */}
              <div
                role="progressbar"
                aria-valuenow={selesaiCount}
                aria-valuemin={0}
                aria-valuemax={totalDokumen}
                className="w-full h-2.5 rounded-full bg-slate-950/50 overflow-hidden p-0.5 border border-white/10"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#e4e8f0] to-white transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              {/* Meta Ringkasan Status Kecil */}
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-100/90">
                <span>Capaian: {progressPercentage}%</span>
                <div className="flex items-center gap-2.5">
                  {reviewCount > 0 && (
                    <span className="text-amber-300 font-medium">
                      {reviewCount} Review
                    </span>
                  )}
                  {revisiCount > 0 && (
                    <span className="text-red-300 font-medium">
                      {revisiCount} Perlu Revisi
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feedback Banner setelah aksi Upload */}
        {feedbackBanner && (
          <div
            role="status"
            className={`rounded-xl border p-4 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-xs transition-all ${
              feedbackBanner.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-medium">{feedbackBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Section Header: Daftar Kartu Tugas (Task Cards) */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Tahapan Dokumen Pelaporan
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Selesaikan ke-4 tahapan dokumen di bawah ini secara berurutan.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const { token } = getAuthSession();
              if (token) fetchDokumenPelaporan(token);
            }}
            disabled={isLoadingData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-blue-700 ${
                isLoadingData ? "animate-spin" : ""
              }`}
            />
            <span>Muat Ulang</span>
          </button>
        </div>

        {/* 4 Task Cards (Vertikal Berurutan) */}
        <section aria-label="Daftar Tugas Pelaporan" className="space-y-4">
          {tasks.map((task) => {
            const style = getStatusBadgeStyle(task.status);
            const isUploadAction =
              task.status === "Belum Unggah" || task.status === "Revisi";

            // INSTRUKSI KEAMANAN 3: Sanitasi penuh sebelum dirender sebagai plain text JSX
            const safeJudul = sanitizePlainText(task.judul);
            const safeDeskripsi = sanitizePlainText(task.deskripsi);
            const safeCatatanRevisi = task.catatanRevisi
              ? sanitizePlainText(task.catatanRevisi)
              : null;
            const safeFileName = task.filePath
              ? sanitizePlainText(task.filePath.split("/").pop() || task.filePath)
              : null;

            return (
              <article
                key={task.tahap}
                className={`bg-white rounded-2xl border ${style.cardBorderClass} shadow-xs hover:shadow-md transition-all duration-200 p-5 sm:p-6`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Bagian Kiri: Indikator Tahap, Judul, Deskripsi, & Metadata */}
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 ${style.stepCircleClass}`}
                    >
                      {task.status === "Selesai" ? (
                        <FileCheck2 className="w-5 h-5" />
                      ) : (
                        <span>0{task.tahap}</span>
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900">
                          {safeJudul}
                        </h3>

                        {/* Badge Status */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.badgeClass}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${style.dotClass}`}
                          />
                          {task.status}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {safeDeskripsi}
                      </p>

                      {/* Info Berkas Terunggah */}
                      {safeFileName && (
                        <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                            <FileText className="w-3.5 h-3.5 text-blue-700" />
                            {safeFileName}
                          </span>
                          {task.tanggalUpload && (
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <Clock className="w-3 h-3" />
                              Diperbarui:{" "}
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

                  {/* Bagian Kanan: Tombol Aksi Kontekstual */}
                  <div className="sm:self-center shrink-0 pt-2 sm:pt-0">
                    {isUploadAction ? (
                      <button
                        type="button"
                        onClick={() => openUploadModal(task)}
                        className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-sm transition cursor-pointer ${
                          task.status === "Revisi"
                            ? "bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-red-600/15"
                            : "bg-[#0D47A1] hover:bg-blue-900 active:bg-blue-950 shadow-blue-900/15"
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        <span>Upload Dokumen</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActivePreviewTask(task)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200/90 text-xs sm:text-sm font-semibold transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-[#0D47A1]" />
                        <span>Lihat Dokumen</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Alert Box Catatan Revisi (HANYA MUNCUL JIKA STATUS === 'Revisi') */}
                {task.status === "Revisi" && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl bg-gradient-to-r from-red-50 via-orange-50/70 to-red-50/50 border border-red-200/90 border-l-4 border-l-red-600 p-4 flex items-start gap-3"
                  >
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs sm:text-sm">
                      <p className="font-bold text-red-900">
                        Catatan Revisi dari Administrator:
                      </p>
                      {/* Render murni sebagai plain text JSX (XSS-Safe, Tanpa dangerouslySetInnerHTML) */}
                      <p className="text-red-800/95 leading-relaxed">
                        {safeCatatanRevisi ||
                          "Dokumen memerlukan perbaikan sesuai standar pelaporan akademik. Silakan unggah ulang berkas PDF yang telah diperbaiki."}
                      </p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </main>

      {/* MODAL POP-UP UPLOAD DOKUMEN (Strict PDF & 5MB Validation) */}
      {activeUploadTask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-upload-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-slate-900 via-[#0D47A1] to-blue-950 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                  <FileUp className="w-4 h-4 text-[#FBC02D]" />
                </div>
                <div>
                  <h3
                    id="modal-upload-title"
                    className="text-sm sm:text-base font-bold"
                  >
                    Upload Dokumen Pelaporan
                  </h3>
                  <p className="text-[11px] text-blue-200">
                    {sanitizePlainText(activeUploadTask.judul)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeUploadModal}
                disabled={isUploading}
                className="text-white/70 hover:text-white p-1 rounded-lg transition cursor-pointer disabled:opacity-40"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Modal */}
            <form onSubmit={handleUploadSubmit} className="p-6 space-y-5">
              {/* Aturan Keamanan Berkas */}
              <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 p-3.5 flex items-start gap-3 text-xs text-slate-700">
                <Info className="w-4 h-4 text-[#0D47A1] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">
                    Ketentuan Keamanan Unggahan Berkas:
                  </p>
                  <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                    <li>
                      Hanya menerima format berkas{" "}
                      <strong className="text-slate-900">.pdf</strong>{" "}
                      (Application/PDF).
                    </li>
                    <li>
                      Ukuran berkas maksimal{" "}
                      <strong className="text-slate-900">
                        5 MB ({formatFileSize(MAX_PDF_SIZE_BYTES)})
                      </strong>
                      .
                    </li>
                  </ul>
                </div>
              </div>

              {/* Alert Error Validasi File */}
              {fileError && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-xs text-red-800"
                >
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">
                    {fileError}
                  </span>
                </div>
              )}

              {/* Area Input File (Strict accept="application/pdf") */}
              <div>
                <label
                  htmlFor="pdf-upload-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2"
                >
                  Pilih Berkas Dokumen (.PDF)
                </label>

                <label
                  htmlFor="pdf-upload-input"
                  className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed p-6 text-center transition cursor-pointer ${
                    selectedFile
                      ? "border-emerald-400 bg-emerald-50/40"
                      : fileError
                      ? "border-red-300 bg-red-50/20"
                      : "border-slate-300 bg-slate-50/70 hover:bg-slate-100/70 hover:border-[#0D47A1]"
                  }`}
                >
                  <FileText
                    className={`w-8 h-8 mb-2 ${
                      selectedFile ? "text-emerald-600" : "text-slate-400"
                    }`}
                  />
                  {selectedFile ? (
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-bold text-emerald-900 break-all">
                        {sanitizePlainText(selectedFile.name)}
                      </p>
                      <p className="text-xs text-emerald-700 font-medium">
                        Ukuran: {formatFileSize(selectedFile.size)} &bull;
                        Terverifikasi PDF
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-700">
                        Klik untuk memilih berkas PDF
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Format wajib .pdf (Maksimal 5 MB)
                      </p>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    id="pdf-upload-input"
                    name="file"
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={isUploading}
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* Footer Tombol Modal */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeUploadModal}
                  disabled={isUploading}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-blue-900 text-xs sm:text-sm font-semibold text-white shadow-md shadow-blue-900/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#FBC02D]" />
                      <span>Mengunggah...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-[#FBC02D]" />
                      <span>Unggah Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL POP-UP LIHAT DOKUMEN (Untuk Status 'Review' atau 'Selesai') */}
      {activePreviewTask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-[#0D47A1] to-blue-950 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileCheck2 className="w-5 h-5 text-[#FBC02D]" />
                <h3
                  id="modal-preview-title"
                  className="text-sm sm:text-base font-bold"
                >
                  Detail Dokumen Terunggah
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePreviewTask(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg transition cursor-pointer"
                aria-label="Tutup detail dokumen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div>
                  <span className="text-xs text-slate-500 block">
                    Tahapan Pelaporan
                  </span>
                  <span className="font-bold text-slate-900">
                    {sanitizePlainText(activePreviewTask.judul)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block">
                    Status Verifikasi
                  </span>
                  <span className="font-semibold text-[#0D47A1]">
                    {sanitizePlainText(activePreviewTask.status)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block">
                    Nama Berkas Tersimpan
                  </span>
                  <span className="font-mono text-xs text-slate-800 break-all">
                    {sanitizePlainText(
                      activePreviewTask.filePath || "Tidak tersedia"
                    )}
                  </span>
                </div>

                {activePreviewTask.tanggalUpload && (
                  <div>
                    <span className="text-xs text-slate-500 block">
                      Waktu Unggah
                    </span>
                    <span className="text-slate-800">
                      {new Date(
                        activePreviewTask.tanggalUpload
                      ).toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {activePreviewTask.filePath && (
                  <a
                    href={`http://localhost:8000/storage/${encodeURI(
                      sanitizePlainText(activePreviewTask.filePath)
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D47A1] hover:bg-blue-900 text-white font-semibold text-xs transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#FBC02D]" />
                    <span>Buka Berkas PDF</span>
                  </a>
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
