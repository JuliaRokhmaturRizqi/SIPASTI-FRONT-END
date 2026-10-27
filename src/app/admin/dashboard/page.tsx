"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileSearch,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import {
  sanitizePlainText,
  validateAndSanitizeRejectionReason,
} from "@/lib/security";
import { ApiErrorResponse, AuthUser } from "@/types/auth";
import {
  AdminMatrixCell,
  AdminMatrixResponse,
  AdminProdiRow,
  AdminValidasiResponse,
  DokumenStatus,
  TahapDokumenNumber,
} from "@/types/dokumen";

/**
 * Definisi 4 Kolom Tahapan Pelaporan pada Matriks Pemantauan
 */
const TAHAP_COLUMNS: Array<{
  nomor: TahapDokumenNumber;
  label: string;
  sublabel: string;
}> = [
  { nomor: 1, label: "Tahap 1", sublabel: "Kurikulum & Mata Kuliah" },
  { nomor: 2, label: "Tahap 2", sublabel: "Kelas & Jadwal" },
  { nomor: 3, label: "Tahap 3", sublabel: "Nilai Perkuliahan" },
  { nomor: 4, label: "Tahap 4", sublabel: "Yudisium & Transkrip" },
];

/**
 * Fallback data Matriks Pemantauan yang realistis apabila API belum mengembalikan data
 */
const INITIAL_MATRIX_DATA: AdminProdiRow[] = [
  {
    id_prodi: 1,
    nama_prodi: "S1 Teknik Informatika",
    tahapan: {
      1: {
        id: 101,
        tahap_dokumen: 1,
        status: "Selesai",
        catatan_revisi: null,
        tanggal_upload: "2026-10-19T09:00:00Z",
        has_file: true,
      },
      2: {
        id: 102,
        tahap_dokumen: 2,
        status: "Selesai",
        catatan_revisi: null,
        tanggal_upload: "2026-10-21T10:30:00Z",
        has_file: true,
      },
      3: {
        id: 103,
        tahap_dokumen: 3,
        status: "Revisi",
        catatan_revisi:
          "Rekapitulasi nilai mata kuliah wajib semester 3 dan 5 belum mencantumkan pengesahan Kaprodi serta lampiran berita acara nilai belum lengkap.",
        tanggal_upload: "2026-10-23T14:15:00Z",
        has_file: true,
      },
      4: {
        id: 104,
        tahap_dokumen: 4,
        status: "Belum Unggah",
        catatan_revisi: null,
        tanggal_upload: null,
        has_file: false,
      },
    },
  },
  {
    id_prodi: 2,
    nama_prodi: "S1 Sistem Informasi",
    tahapan: {
      1: {
        id: 201,
        tahap_dokumen: 1,
        status: "Selesai",
        catatan_revisi: null,
        tanggal_upload: "2026-10-18T08:30:00Z",
        has_file: true,
      },
      2: {
        id: 202,
        tahap_dokumen: 2,
        status: "Review",
        catatan_revisi: null,
        tanggal_upload: "2026-10-24T09:15:00Z",
        has_file: true,
      },
      3: {
        id: 203,
        tahap_dokumen: 3,
        status: "Review",
        catatan_revisi: null,
        tanggal_upload: "2026-10-24T11:40:00Z",
        has_file: true,
      },
      4: {
        id: 204,
        tahap_dokumen: 4,
        status: "Belum Unggah",
        catatan_revisi: null,
        tanggal_upload: null,
        has_file: false,
      },
    },
  },
  {
    id_prodi: 3,
    nama_prodi: "S1 Pendidikan Matematika",
    tahapan: {
      1: {
        id: 301,
        tahap_dokumen: 1,
        status: "Selesai",
        catatan_revisi: null,
        tanggal_upload: "2026-10-17T10:00:00Z",
        has_file: true,
      },
      2: {
        id: 302,
        tahap_dokumen: 2,
        status: "Selesai",
        catatan_revisi: null,
        tanggal_upload: "2026-10-20T13:20:00Z",
        has_file: true,
      },
      3: {
        id: 303,
        tahap_dokumen: 3,
        status: "Selesai",
        catatan_revisi: null,
        tanggal_upload: "2026-10-22T15:10:00Z",
        has_file: true,
      },
      4: {
        id: 304,
        tahap_dokumen: 4,
        status: "Review",
        catatan_revisi: null,
        tanggal_upload: "2026-10-24T13:05:00Z",
        has_file: true,
      },
    },
  },
  {
    id_prodi: 4,
    nama_prodi: "S1 Manajemen Pendidikan",
    tahapan: {
      1: {
        id: 401,
        tahap_dokumen: 1,
        status: "Review",
        catatan_revisi: null,
        tanggal_upload: "2026-10-24T08:00:00Z",
        has_file: true,
      },
      2: {
        id: 402,
        tahap_dokumen: 2,
        status: "Revisi",
        catatan_revisi:
          "Distribusi SKS dosen tetap pada jadwal semester ganjil belum sesuai SK Dekan.",
        tanggal_upload: "2026-10-22T11:00:00Z",
        has_file: true,
      },
      3: {
        id: 403,
        tahap_dokumen: 3,
        status: "Belum Unggah",
        catatan_revisi: null,
        tanggal_upload: null,
        has_file: false,
      },
      4: {
        id: 404,
        tahap_dokumen: 4,
        status: "Belum Unggah",
        catatan_revisi: null,
        tanggal_upload: null,
        has_file: false,
      },
    },
  },
];

type SidebarMenuKey = "dashboard" | "periode" | "prodi";

interface ToastMessage {
  id: number;
  type: "success" | "error" | "info";
  title: string;
  description: string;
}

interface ActiveValidationTarget {
  id_prodi: number;
  nama_prodi: string;
  cell: AdminMatrixCell;
  tahapLabel: string;
  tahapSublabel: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();

  // State Otorisasi & Profil Admin
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // State Navigasi Sidebar
  const [activeMenu, setActiveMenu] = useState<SidebarMenuKey>("dashboard");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State Data Matriks Pemantauan
  const [periodeAktif, setPeriodeAktif] = useState("2026/2027 Ganjil");
  const [matrixRows, setMatrixRows] =
    useState<AdminProdiRow[]>(INITIAL_MATRIX_DATA);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);

  // State Modal Validasi (Pop-up)
  const [validationTarget, setValidationTarget] =
    useState<ActiveValidationTarget | null>(null);
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [isSubmittingValidation, setIsSubmittingValidation] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // State Toast Notification
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  /**
   * Menampilkan Toast Notification yang hilang otomatis setelah 4.5 detik.
   */
  const pushToast = useCallback(
    (type: ToastMessage["type"], title: string, description: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const safeTitle = sanitizePlainText(title);
      const safeDesc = sanitizePlainText(description);

      setToasts((prev) => [
        ...prev,
        { id, type, title: safeTitle, description: safeDesc },
      ]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  /**
   * Penanganan terpusat ketika sesi tidak sah (401/403):
   * Membersihkan Cookie dan mengarahkan paksa ke /login.
   */
  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  /**
   * Mengambil data Matriks Pemantauan dari endpoint GET /api/admin/matriks-pemantauan
   */
  const fetchMatrixData = useCallback(
    async (token: string, showRefreshToast = false) => {
      setIsLoadingMatrix(true);
      try {
        const response = await apiClient.get<AdminMatrixResponse>(
          "/admin/matriks-pemantauan",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data?.periode_aktif) {
          setPeriodeAktif(sanitizePlainText(response.data.periode_aktif));
        }

        if (
          Array.isArray(response.data?.data) &&
          response.data.data.length > 0
        ) {
          // Sanitasi seluruh teks dari API sebelum disimpan ke state
          const sanitizedRows: AdminProdiRow[] = response.data.data.map(
            (row) => {
              const cleanTahapan = {} as Record<
                TahapDokumenNumber,
                AdminMatrixCell
              >;
              ([1, 2, 3, 4] as TahapDokumenNumber[]).forEach((num) => {
                const cell = row.tahapan?.[num];
                cleanTahapan[num] = {
                  id: Number(cell?.id || row.id_prodi * 100 + num),
                  tahap_dokumen: num,
                  status: cell?.status || "Belum Unggah",
                  catatan_revisi: cell?.catatan_revisi
                    ? sanitizePlainText(cell.catatan_revisi)
                    : null,
                  tanggal_upload: cell?.tanggal_upload
                    ? sanitizePlainText(cell.tanggal_upload)
                    : null,
                  has_file: Boolean(cell?.has_file ?? cell?.status !== "Belum Unggah"),
                };
              });

              return {
                id_prodi: Number(row.id_prodi),
                nama_prodi: sanitizePlainText(row.nama_prodi),
                tahapan: cleanTahapan,
              };
            }
          );

          setMatrixRows(sanitizedRows);
        }

        if (showRefreshToast) {
          pushToast(
            "info",
            "Matriks Diperbarui",
            "Data pemantauan akademik terbaru berhasil dimuat."
          );
        }
      } catch (err) {
        const axiosErr = err as AxiosError<ApiErrorResponse>;
        const status = axiosErr.response?.status;
        if (status === 401 || status === 403) {
          handleUnauthorizedExit();
          return;
        }
        if (showRefreshToast) {
          pushToast(
            "error",
            "Gagal Memuat Data Baru",
            "Menampilkan data matriks terakhir yang tersimpan."
          );
        }
      } finally {
        setIsLoadingMatrix(false);
      }
    },
    [handleUnauthorizedExit, pushToast]
  );

  /**
   * INSTRUKSI KEAMANAN 1: Route Authorization (Hanya untuk role === 'admin')
   */
  useEffect(() => {
    let isMounted = true;

    const verifyAdminAccess = async () => {
      const session = getAuthSession();

      if (!session.token || session.role !== "admin") {
        handleUnauthorizedExit();
        return;
      }

      if (session.user) {
        setUser(session.user);
      }

      try {
        const meRes = await apiClient.get<{ status: string; data: AuthUser }>(
          "/me",
          {
            headers: {
              Authorization: `Bearer ${session.token}`,
            },
          }
        );

        const verifiedUser = meRes.data?.data;
        if (!verifiedUser || verifiedUser.role !== "admin") {
          handleUnauthorizedExit();
          return;
        }

        if (isMounted) {
          setUser(verifiedUser);
          setIsAuthorized(true);
          setIsCheckingAuth(false);
        }

        await fetchMatrixData(session.token, false);
      } catch (err) {
        const axiosErr = err as AxiosError;
        const status = axiosErr.response?.status;
        if (status === 401 || status === 403 || !axiosErr.response) {
          handleUnauthorizedExit();
        }
      }
    };

    verifyAdminAccess();

    return () => {
      isMounted = false;
    };
  }, [fetchMatrixData, handleUnauthorizedExit]);

  /**
   * Handler Logout Aman
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
   * Membuka Modal Validasi ketika Badge 'Review' diklik
   */
  const openValidationModal = (
    row: AdminProdiRow,
    nomorTahap: TahapDokumenNumber
  ) => {
    const cell = row.tahapan[nomorTahap];
    if (!cell || cell.status !== "Review") return;

    const colMeta = TAHAP_COLUMNS.find((c) => c.nomor === nomorTahap)!;

    setValidationTarget({
      id_prodi: row.id_prodi,
      nama_prodi: sanitizePlainText(row.nama_prodi),
      cell,
      tahapLabel: colMeta.label,
      tahapSublabel: colMeta.sublabel,
    });
    setIsRejectMode(false);
    setRejectionReason("");
    setRejectionError(null);
  };

  const closeValidationModal = () => {
    if (isSubmittingValidation || isDownloadingPdf) return;
    setValidationTarget(null);
    setIsRejectMode(false);
    setRejectionReason("");
    setRejectionError(null);
  };

  /**
   * INSTRUKSI KEAMANAN 2: Secure File Download via Blob & Bearer Token
   * Tidak mengekspos URL path mentah di frontend; mengambil stream biner PDF
   * menggunakan header Authorization: Bearer <token> lalu memicu unduhan Blob.
   */
  const handleSecureBlobDownload = async () => {
    if (!validationTarget || isDownloadingPdf) return;

    const { token, role } = getAuthSession();
    if (!token || role !== "admin") {
      handleUnauthorizedExit();
      return;
    }

    setIsDownloadingPdf(true);

    const safeProdiSlug = validationTarget.nama_prodi
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const downloadFilename = `SIPASTI-Tahap-${validationTarget.cell.tahap_dokumen}-${safeProdiSlug}.pdf`;

    try {
      const response = await apiClient.get<Blob>(
        `/admin/dokumen-pelaporan/${validationTarget.cell.id}/download`,
        {
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/pdf",
          },
        }
      );

      const pdfBlob = new Blob([response.data], { type: "application/pdf" });
      const blobUrl = window.URL.createObjectURL(pdfBlob);

      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = downloadFilename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      // Segera cabut Object URL dari memori browser demi keamanan
      window.setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);

      pushToast(
        "success",
        "Unduhan Terenkripsi Berhasil",
        `Berkas ${downloadFilename} berhasil diunduh melalui kanal aman.`
      );
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;

      if (status === 401 || status === 403) {
        handleUnauthorizedExit();
        return;
      }

      pushToast(
        "error",
        "Gagal Mengunduh Dokumen",
        "Berkas PDF tidak dapat diunduh saat ini. Silakan periksa koneksi server API."
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  /**
   * INSTRUKSI KEAMANAN 3 & 4:
   * - Sanitasi input pada textarea 'Alasan Penolakan' sebelum dikirim via API
   * - Error handling dengan try-catch & Toast Notification tanpa crash
   */
  const handleValidationDecision = async (decision: "Selesai" | "Revisi") => {
    if (!validationTarget || isSubmittingValidation) return;

    // Jika Admin klik tombol "Tolak" pertama kali, buka panel textarea Alasan Penolakan
    if (decision === "Revisi" && !isRejectMode) {
      setIsRejectMode(true);
      setRejectionError(null);
      return;
    }

    let sanitizedReason: string | null = null;
    if (decision === "Revisi") {
      const validation = validateAndSanitizeRejectionReason(rejectionReason);
      if (!validation.valid) {
        setRejectionError(
          validation.error || "Alasan penolakan wajib diisi dengan benar."
        );
        return;
      }
      sanitizedReason = validation.sanitized;
    }

    const { token, role } = getAuthSession();
    if (!token || role !== "admin") {
      handleUnauthorizedExit();
      return;
    }

    setIsSubmittingValidation(true);
    setRejectionError(null);

    try {
      const response = await apiClient.patch<AdminValidasiResponse>(
        `/admin/dokumen-pelaporan/${validationTarget.cell.id}/validasi`,
        {
          status: decision,
          catatan_revisi: sanitizedReason,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const targetProdiId = validationTarget.id_prodi;
      const targetTahap = validationTarget.cell.tahap_dokumen;

      // Perbarui state Matriks Pemantauan secara instan
      setMatrixRows((prevRows) =>
        prevRows.map((row) => {
          if (row.id_prodi !== targetProdiId) return row;
          return {
            ...row,
            tahapan: {
              ...row.tahapan,
              [targetTahap]: {
                ...row.tahapan[targetTahap],
                status: decision,
                catatan_revisi: sanitizedReason,
              },
            },
          };
        })
      );

      pushToast(
        "success",
        decision === "Selesai"
          ? "Dokumen Diterima (Valid)"
          : "Dokumen Ditolak (Perlu Revisi)",
        response.data?.message ||
          `${validationTarget.tahapLabel} (${validationTarget.nama_prodi}) berhasil diperbarui menjadi ${decision}.`
      );

      setValidationTarget(null);
      setIsRejectMode(false);
      setRejectionReason("");
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const status = axiosErr.response?.status;

      if (status === 401 || status === 403) {
        handleUnauthorizedExit();
        return;
      }

      const serverMsg =
        axiosErr.response?.data?.errors?.catatan_revisi?.[0] ||
        axiosErr.response?.data?.message ||
        "Terjadi gangguan saat menyimpan hasil validasi dokumen.";

      pushToast("error", "Validasi Gagal Disimpan", serverMsg);
    } finally {
      setIsSubmittingValidation(false);
    }
  };

  /**
   * Kalkulasi 4 Kartu Statistik Ringkas dari Matriks Pemantauan
   */
  const stats = useMemo(() => {
    let menungguReview = 0;
    let revisi = 0;
    let selesai = 0;

    matrixRows.forEach((row) => {
      ([1, 2, 3, 4] as TahapDokumenNumber[]).forEach((num) => {
        const st = row.tahapan[num]?.status;
        if (st === "Review") menungguReview += 1;
        else if (st === "Revisi") revisi += 1;
        else if (st === "Selesai") selesai += 1;
      });
    });

    return {
      totalProdi: matrixRows.length,
      menungguReview,
      revisi,
      selesai,
    };
  }, [matrixRows]);

  /**
   * Filter baris Prodi berdasarkan pencarian
   */
  const filteredRows = useMemo(() => {
    const q = sanitizePlainText(searchQuery).toLowerCase();
    if (!q) return matrixRows;
    return matrixRows.filter((row) =>
      row.nama_prodi.toLowerCase().includes(q)
    );
  }, [matrixRows, searchQuery]);

  /**
   * Render Badge Status pada sel tabel Matriks Pemantauan:
   * - Abu-abu: Belum
   * - Kuning: Review (Interaktif / Bisa diklik untuk membuka Modal Validasi)
   * - Merah: Revisi
   * - Hijau: Selesai
   */
  const renderMatrixBadge = (
    row: AdminProdiRow,
    nomorTahap: TahapDokumenNumber
  ) => {
    const cell = row.tahapan[nomorTahap];
    const status: DokumenStatus = cell?.status || "Belum Unggah";

    if (status === "Review") {
      return (
        <button
          type="button"
          onClick={() => openValidationModal(row, nomorTahap)}
          title="Klik untuk membuka Modal Validasi Dokumen"
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs hover:shadow ring-2 ring-transparent hover:ring-amber-400/40 transition-all cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Review</span>
          <FileSearch className="w-3.5 h-3.5 text-amber-700 transition-transform group-hover:scale-110" />
        </button>
      );
    }

    if (status === "Selesai") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Selesai</span>
        </span>
      );
    }

    if (status === "Revisi") {
      return (
        <span
          title={
            cell?.catatan_revisi
              ? `Catatan Revisi: ${sanitizePlainText(cell.catatan_revisi)}`
              : "Menunggu perbaikan dari Prodi"
          }
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span>Revisi</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        <span>Belum</span>
      </span>
    );
  };

  // Tampilan penjaga rute selama verifikasi token & role === 'admin'
  if (isCheckingAuth || !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl px-8 py-7 flex flex-col items-center gap-3 max-w-sm w-full text-center">
          <div className="w-11 h-11 rounded-xl bg-blue-950 text-white flex items-center justify-center shadow-sm">
            <Loader2 className="w-5 h-5 animate-spin text-[#FBC02D]" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Memverifikasi Otoritas Administrator...
          </p>
          <p className="text-xs text-slate-500">
            Memastikan token sesi dan hak akses Admin yang sah.
          </p>
        </div>
      </div>
    );
  }

  const safeAdminUsername = sanitizePlainText(user?.username || "admin");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* TOAST NOTIFICATION CONTAINER */}
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

      {/* BACKDROP SIDEBAR MOBILE */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* SIDEBAR NAVIGASI KIRI (Deep Blue + Golden Yellow Accent) */}
      <aside
        aria-label="Navigasi Utama Administrator"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 text-white border-r border-white/10 flex flex-col justify-between transition-transform duration-200 ${
          isMobileSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div>
          <div className="h-16 px-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
                <Building2 className="w-5 h-5 text-[#FBC02D]" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-white block leading-none">
                  SIPASTI
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#FBC02D]">
                  Admin Panel
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="lg:hidden text-white/70 hover:text-white p-1"
              aria-label="Tutup menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Menu Navigasi: Dashboard, Manajemen Periode, Data Prodi */}
          <div className="p-4 space-y-1.5">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Menu Utama
            </p>

            <button
              type="button"
              onClick={() => {
                setActiveMenu("dashboard");
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer ${
                activeMenu === "dashboard"
                  ? "bg-[#0D47A1] text-white shadow-md shadow-blue-950/50 border border-white/15"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <LayoutDashboard
                  className={`w-4 h-4 ${
                    activeMenu === "dashboard"
                      ? "text-[#FBC02D]"
                      : "text-slate-400"
                  }`}
                />
                <span>Dashboard</span>
              </span>
              {stats.menungguReview > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FBC02D] text-slate-950">
                  {stats.menungguReview}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMobileSidebarOpen(false);
                router.push("/admin/periode");
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer ${
                activeMenu === "periode"
                  ? "bg-[#0D47A1] text-white shadow-md shadow-blue-950/50 border border-white/15"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Calendar
                className={`w-4 h-4 ${
                  activeMenu === "periode" ? "text-[#FBC02D]" : "text-slate-400"
                }`}
              />
              <span>Manajemen Periode</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMenu("prodi");
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer ${
                activeMenu === "prodi"
                  ? "bg-[#0D47A1] text-white shadow-md shadow-blue-950/50 border border-white/15"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <GraduationCap
                className={`w-4 h-4 ${
                  activeMenu === "prodi" ? "text-[#FBC02D]" : "text-slate-400"
                }`}
              />
              <span>Data Prodi</span>
            </button>
          </div>
        </div>

        {/* Profil Admin & Tombol Logout di Bawah Sidebar */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FBC02D]/20 border border-[#FBC02D]/40 flex items-center justify-center text-[#FBC02D] font-bold text-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {safeAdminUsername}
              </p>
              <p className="text-[10px] text-slate-400">
                Otoritas Administrator
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-red-500/20 hover:border-red-400/30 border border-white/10 text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4 text-[#FBC02D]" />
            <span>{isLoggingOut ? "Keluar..." : "Keluar Sesi"}</span>
          </button>
        </div>
      </aside>

      {/* AREA KONTEN UTAMA DI SEBELAH KANAN */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Top Bar Konten Kanan (Blur Transparan) */}
        <header className="h-16 bg-white/70 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200/80 bg-white/80 text-slate-700 hover:bg-slate-100"
              aria-label="Buka navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">
                Dashboard Pemantauan Akademik
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50/80 backdrop-blur-xs border border-blue-200/70 text-xs font-semibold text-[#0D47A1]">
              <Calendar className="w-3.5 h-3.5 text-[#0D47A1]" />
              <span>Periode: {periodeAktif}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                const { token } = getAuthSession();
                if (token) fetchMatrixData(token, true);
              }}
              disabled={isLoadingMatrix}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-xs border border-slate-200/80 hover:bg-white text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#0D47A1] ${
                  isLoadingMatrix ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">Sinkronkan</span>
            </button>
          </div>
        </header>

        {/* Konten Utama */}
        <main className="p-4 sm:p-8 space-y-6 max-w-7xl w-full mx-auto flex-1">
          {/* 4 KARTU STATISTIK RINGKAS (Soft Colored Cards, White Typography & Blurred White-Bordered Icon Box) */}
          <section
            aria-label="Statistik Ringkas Pemantauan"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {/* Card 1: Total Prodi (Soft Deep Blue) */}
            <div className="bg-gradient-to-br from-[#1e5bb8] to-[#0D47A1] rounded-2xl border border-blue-400/25 p-5 shadow-md shadow-blue-900/10 flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Total Prodi
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white mt-1">
                  {stats.totalProdi}
                </p>
                <p className="text-[11px] text-white/85 mt-1">
                  Program Studi Terdaftar
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/60 text-white flex items-center justify-center shrink-0 shadow-inner">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Card 2: Menunggu Review (Soft Warm Amber) */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl border border-amber-300/30 p-5 shadow-md shadow-amber-900/10 flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Menunggu Review
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white mt-1">
                  {stats.menungguReview}
                </p>
                <p className="text-[11px] text-white/90 mt-1">
                  Klik badge kuning untuk validasi
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/60 text-white flex items-center justify-center shrink-0 shadow-inner">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Card 3: Revisi (Soft Rose / Coral Red) */}
            <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl border border-rose-300/30 p-5 shadow-md shadow-rose-900/10 flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Revisi
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white mt-1">
                  {stats.revisi}
                </p>
                <p className="text-[11px] text-white/85 mt-1">
                  Dikembalikan ke Prodi
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/60 text-white flex items-center justify-center shrink-0 shadow-inner">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Card 4: Selesai (Soft Emerald / Teal Green) */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl border border-emerald-300/30 p-5 shadow-md shadow-emerald-900/10 flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Selesai
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white mt-1">
                  {stats.selesai}
                </p>
                <p className="text-[11px] text-white/85 mt-1">
                  Dokumen Tervalidasi
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/60 text-white flex items-center justify-center shrink-0 shadow-inner">
                <FileCheck2 className="w-6 h-6 text-white" />
              </div>
            </div>
          </section>

          {/* Sub-View Kontekstual jika Menu Manajemen Periode / Data Prodi dipilih */}
          {activeMenu === "periode" && (
            <section className="bg-gradient-to-r from-slate-900 via-[#0D47A1] to-blue-950 rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#FBC02D]">
                  Pengaturan Siklus Pelaporan
                </span>
                <h2 className="text-lg font-bold mt-0.5">
                  Periode Akademik Aktif: {periodeAktif}
                </h2>
                <p className="text-xs text-blue-100/90 mt-1">
                  Seluruh unggahan dokumen Program Studi saat ini terikat pada
                  periode aktif di atas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveMenu("dashboard")}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition cursor-pointer shrink-0"
              >
                Kembali ke Matriks Utama
              </button>
            </section>
          )}

          {/* MATRIKS PEMANTAUAN (TABEL UTAMA) */}
          <section
            aria-label="Matriks Pemantauan Pelaporan Prodi"
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
          >
            {/* Header Tabel Matriks: Soft Blue Gradient, White Text, Highlighted 'Review', White Search Input */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] text-white border-b border-blue-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Matriks Pemantauan Dokumen Program Studi
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 backdrop-blur-xs text-white border border-white/30">
                    Interaktif
                  </span>
                </div>
                <p className="text-xs text-blue-50/95 mt-1.5 leading-relaxed">
                  Klik pada badge berstatus{" "}
                  <span className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md bg-[#FBC02D] text-slate-950 font-extrabold shadow-2xs">
                    Review
                  </span>{" "}
                  untuk membuka Modal Validasi, mengunduh berkas PDF terenkripsi,
                  dan menyetujui atau menolak dokumen.
                </p>
              </div>

              {/* Pencarian Nama Prodi: Kolom Putih + Icon Search Biru Senada */}
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="w-4 h-4 text-[#1565C0] pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari Program Studi..."
                  className="w-full rounded-xl border border-white/90 bg-white pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#FBC02D]/80"
                />
              </div>
            </div>

            {/* Tabel Responsif */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-3.5 px-5 sm:px-6 min-w-[220px]">
                      Program Studi
                    </th>
                    {TAHAP_COLUMNS.map((col) => (
                      <th
                        key={col.nomor}
                        className="py-3.5 px-4 text-center min-w-[155px]"
                      >
                        <span className="block text-[#0D47A1]">
                          {col.label}
                        </span>
                        <span className="block text-[10px] font-medium normal-case text-slate-500 mt-0.5">
                          {col.sublabel}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-10 text-center text-slate-500 text-xs"
                      >
                        Tidak ada Program Studi yang cocok dengan pencarian
                        Anda.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const safeProdi = sanitizePlainText(row.nama_prodi);
                      const doneInRow = (
                        [1, 2, 3, 4] as TahapDokumenNumber[]
                      ).filter(
                        (n) => row.tahapan[n]?.status === "Selesai"
                      ).length;

                      return (
                        <tr
                          key={row.id_prodi}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-4 px-5 sm:px-6">
                            <div className="font-bold text-slate-900">
                              {safeProdi}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Capaian: {doneInRow}/4 Tahap Selesai
                            </div>
                          </td>
                          {TAHAP_COLUMNS.map((col) => (
                            <td
                              key={col.nomor}
                              className="py-4 px-4 text-center align-middle"
                            >
                              {renderMatrixBadge(row, col.nomor)}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Legenda Tabel */}
            <div className="px-5 sm:px-6 py-3.5 bg-slate-50/70 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-semibold text-slate-700">
                  Keterangan Status:
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Belum (Abu-abu)
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Review (Kuning &bull; Klik untuk Validasi)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Revisi (Merah)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Selesai (Hijau)
                </span>
              </div>
              <span>Total: {filteredRows.length} Program Studi</span>
            </div>
          </section>
        </main>
      </div>

      {/* MODAL VALIDASI DOKUMEN (POP-UP INTERAKTIF SAAT BADGE 'REVIEW' DIKLIK) */}
      {validationTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-validasi-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-slate-900 via-[#0D47A1] to-blue-950 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                  <FileSearch className="w-5 h-5 text-[#FBC02D]" />
                </div>
                <div>
                  <h3
                    id="modal-validasi-title"
                    className="text-sm sm:text-base font-bold"
                  >
                    Validasi Dokumen Pelaporan
                  </h3>
                  <p className="text-[11px] text-blue-200">
                    {validationTarget.nama_prodi}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeValidationModal}
                disabled={isSubmittingValidation || isDownloadingPdf}
                className="text-white/70 hover:text-white p-1 rounded-lg transition cursor-pointer disabled:opacity-40"
                aria-label="Tutup modal validasi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-6 space-y-5">
              {/* Informasi Dokumen (Tanpa mengekspos raw file path) */}
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-3 text-xs sm:text-sm">
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                  <span className="text-xs text-slate-500">Program Studi</span>
                  <span className="font-bold text-slate-900">
                    {validationTarget.nama_prodi}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                  <span className="text-xs text-slate-500">
                    Tahapan Dokumen
                  </span>
                  <span className="font-semibold text-[#0D47A1]">
                    {validationTarget.tahapLabel}:{" "}
                    {validationTarget.tahapSublabel}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                  <span className="text-xs text-slate-500">Waktu Unggah</span>
                  <span className="text-slate-700 font-medium">
                    {validationTarget.cell.tanggal_upload
                      ? new Date(
                          validationTarget.cell.tanggal_upload
                        ).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Periode Aktif Berjalan"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Otorisasi Berkas
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Terlindungi Bearer Token (Blob Stream)
                  </span>
                </div>
              </div>

              {/* Tombol Unduh PDF via Secure Blob */}
              <div>
                <button
                  type="button"
                  onClick={handleSecureBlobDownload}
                  disabled={isDownloadingPdf || isSubmittingValidation}
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isDownloadingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#FBC02D]" />
                      <span>Mengunduh Stream PDF Terenkripsi...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-[#FBC02D]" />
                      <span>Unduh PDF</span>
                    </>
                  )}
                </button>
              </div>

              {/* Form Textarea Alasan Penolakan (Muncul & Wajib jika tombol Tolak dipilih) */}
              {isRejectMode && (
                <div className="rounded-xl bg-red-50/70 border border-red-200 p-4 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="rejection-reason-textarea"
                      className="text-xs font-bold text-red-900 uppercase tracking-wider"
                    >
                      Alasan Penolakan (Wajib Diisi) *
                    </label>
                    <span className="text-[11px] text-red-700 font-mono">
                      {rejectionReason.length}/1000
                    </span>
                  </div>

                  <textarea
                    id="rejection-reason-textarea"
                    rows={3}
                    maxLength={1000}
                    disabled={isSubmittingValidation}
                    value={rejectionReason}
                    onChange={(e) => {
                      setRejectionReason(e.target.value);
                      if (rejectionError) setRejectionError(null);
                    }}
                    placeholder="Tuliskan catatan revisi secara jelas untuk Operator Prodi (minimal 10 karakter)..."
                    className="w-full rounded-xl bg-white border border-red-300 p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-500/20"
                  />

                  {rejectionError && (
                    <p
                      role="alert"
                      className="text-xs font-semibold text-red-700 flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{rejectionError}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Footer Aksi Validasi: Terima (Valid) & Tolak */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                {isRejectMode && (
                  <button
                    type="button"
                    disabled={isSubmittingValidation}
                    onClick={() => {
                      setIsRejectMode(false);
                      setRejectionError(null);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer"
                  >
                    Batal Tolak
                  </button>
                )}

                {/* Tombol Tolak */}
                <button
                  type="button"
                  disabled={isSubmittingValidation || isDownloadingPdf}
                  onClick={() => handleValidationDecision("Revisi")}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingValidation && isRejectMode ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan Penolakan...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>
                        {isRejectMode ? "Konfirmasi Tolak" : "Tolak"}
                      </span>
                    </>
                  )}
                </button>

                {/* Tombol Terima (Valid) */}
                {!isRejectMode && (
                  <button
                    type="button"
                    disabled={isSubmittingValidation || isDownloadingPdf}
                    onClick={() => handleValidationDecision("Selesai")}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingValidation ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Memvalidasi...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Terima (Valid)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
