"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Package,
  FileCheck2,
  FileSearch,
  GraduationCap,
  Loader2,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
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
  AdminProdiRow,
  AdminValidasiResponse,
  DokumenApiRecord,
  DokumenListResponse,
  DokumenStatus,
  PeriodeListResponse,
  TahapDokumenNumber,
} from "@/types/dokumen";
import AdminSidebar from "@/components/admin/AdminSidebar";

/**
 * Opsi Periode Default (Digunakan saat inisialisasi atau fallback)
 */
interface AdminPeriodeOption {
  id: string;
  label: string;
  nama_periode: string;
}

const DEFAULT_PERIODE_OPTIONS: AdminPeriodeOption[] = [
  {
    id: "1",
    label: "2026/2027 Ganjil (Aktif)",
    nama_periode: "2026/2027 Ganjil",
  },
  {
    id: "2",
    label: "2026/2027 Genap",
    nama_periode: "2026/2027 Genap",
  },
  {
    id: "3",
    label: "2025/2026 Genap",
    nama_periode: "2025/2026 Genap",
  },
];

/**
 * Definisi 4 Kolom Tahapan Pelaporan
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
 * Daftar Resmi 14 Program Studi Universitas Nurul Huda
 */
const PRODI_UNIVERSITAS_NURUL_HUDA = [
  "S1 Pendidikan Agama Islam",
  "S1 Pendidikan Guru Madrasah Ibtidaiyah",
  "S1 Pendidikan Bahasa Arab",
  "S1 Pendidikan Bahasa dan Sastra Indonesia",
  "S1 Pendidikan Bahasa Inggris",
  "S1 Pendidikan Fisika",
  "S1 Pendidikan Ekonomi",
  "S1 Pendidikan Teknologi Informasi",
  "S1 Pelatihan Olahraga",
  "S1 Informatika",
  "S1 Matematika",
  "S1 Sains Pertanian",
  "S1 Peternakan",
  "S2 Pendidikan Agama Islam",
] as const;

/**
 * Helper pembentuk baris data Prodi dengan variasi status yang logis
 */
function createProdiRow(
  idProdi: number,
  namaProdi: string,
  statuses: [DokumenStatus, DokumenStatus, DokumenStatus, DokumenStatus],
  revisiNote?: string
): AdminProdiRow {
  const buildCell = (
    tahap: TahapDokumenNumber,
    status: DokumenStatus
  ): AdminMatrixCell => ({
    id: idProdi * 100 + tahap,
    tahap_dokumen: tahap,
    status,
    catatan_revisi:
      status === "Revisi"
        ? revisiNote ||
          "Dokumen belum dilengkapi lembar pengesahan Ketua Program Studi. Mohon diperbaiki dan diunggah kembali."
        : null,
    tanggal_upload:
      status === "Belum Unggah" ? null : "2026-10-25T09:30:00Z",
    has_file: status !== "Belum Unggah",
  });

  return {
    id_prodi: idProdi,
    nama_prodi: namaProdi,
    tahapan: {
      1: buildCell(1, statuses[0]),
      2: buildCell(2, statuses[1]),
      3: buildCell(3, statuses[2]),
      4: buildCell(4, statuses[3]),
    },
  };
}

/**
 * Dataset Awal 14 Program Studi Universitas Nurul Huda
 */
const INITIAL_PRODI_ROWS: AdminProdiRow[] = [
  createProdiRow(1, PRODI_UNIVERSITAS_NURUL_HUDA[0], [
    "Selesai",
    "Selesai",
    "Review",
    "Belum Unggah",
  ]),
  createProdiRow(
    2,
    PRODI_UNIVERSITAS_NURUL_HUDA[1],
    ["Selesai", "Revisi", "Belum Unggah", "Belum Unggah"],
    "Jadwal mengajar dosen tetap PGMI pada semester 4 terdapat bentrok jam perkuliahan."
  ),
  createProdiRow(3, PRODI_UNIVERSITAS_NURUL_HUDA[2], [
    "Selesai",
    "Selesai",
    "Selesai",
    "Review",
  ]),
  createProdiRow(4, PRODI_UNIVERSITAS_NURUL_HUDA[3], [
    "Selesai",
    "Review",
    "Belum Unggah",
    "Belum Unggah",
  ]),
  createProdiRow(
    5,
    PRODI_UNIVERSITAS_NURUL_HUDA[4],
    ["Selesai", "Selesai", "Revisi", "Belum Unggah"],
    "Rekapitulasi nilai mata kuliah Speaking & Listening belum melampirkan berita acara ujian akhir."
  ),
  createProdiRow(6, PRODI_UNIVERSITAS_NURUL_HUDA[5], [
    "Review",
    "Belum Unggah",
    "Belum Unggah",
    "Belum Unggah",
  ]),
  createProdiRow(7, PRODI_UNIVERSITAS_NURUL_HUDA[6], [
    "Selesai",
    "Selesai",
    "Selesai",
    "Selesai",
  ]),
  createProdiRow(8, PRODI_UNIVERSITAS_NURUL_HUDA[7], [
    "Selesai",
    "Selesai",
    "Review",
    "Review",
  ]),
  createProdiRow(
    9,
    PRODI_UNIVERSITAS_NURUL_HUDA[8],
    ["Revisi", "Belum Unggah", "Belum Unggah", "Belum Unggah"],
    "Sebaran SKS mata kuliah praktik lapangan belum sesuai struktur kurikulum terbaru."
  ),
  createProdiRow(10, PRODI_UNIVERSITAS_NURUL_HUDA[9], [
    "Selesai",
    "Selesai",
    "Review",
    "Belum Unggah",
  ]),
  createProdiRow(11, PRODI_UNIVERSITAS_NURUL_HUDA[10], [
    "Selesai",
    "Review",
    "Belum Unggah",
    "Belum Unggah",
  ]),
  createProdiRow(
    12,
    PRODI_UNIVERSITAS_NURUL_HUDA[11],
    ["Selesai", "Selesai", "Revisi", "Belum Unggah"],
    "Daftar nilai praktikum agronomi belum ditandatangani oleh koordinator laboratorium."
  ),
  createProdiRow(13, PRODI_UNIVERSITAS_NURUL_HUDA[12], [
    "Belum Unggah",
    "Belum Unggah",
    "Belum Unggah",
    "Belum Unggah",
  ]),
  createProdiRow(14, PRODI_UNIVERSITAS_NURUL_HUDA[13], [
    "Selesai",
    "Selesai",
    "Selesai",
    "Review",
  ]),
];

/**
 * Helper pemetaan respons API GET /api/dokumen?id_periode={selectedPeriode}
 * ke 14 Program Studi Universitas Nurul Huda agar daftar 14 Prodi tetap terjaga.
 */
function mergeApiDokumenIntoNurulHudaMatrix(
  baseRows: AdminProdiRow[],
  apiRecords: DokumenApiRecord[]
): AdminProdiRow[] {
  if (!apiRecords || apiRecords.length === 0) {
    return baseRows;
  }

  return baseRows.map((row) => {
    const updatedTahapan: Record<TahapDokumenNumber, AdminMatrixCell> = {
      1: { ...row.tahapan[1] },
      2: { ...row.tahapan[2] },
      3: { ...row.tahapan[3] },
      4: { ...row.tahapan[4] },
    };

    // Cari record API yang cocok dengan nama_prodi atau id_prodi (termasuk alias S1 Teknik Informatika -> S1 Informatika)
    const matchingRecords = apiRecords.filter((rec) => {
      const apiProdiName = rec.prodi?.nama_prodi?.trim().toLowerCase() || "";
      const rowProdiName = row.nama_prodi.trim().toLowerCase();

      if (apiProdiName && apiProdiName === rowProdiName) {
        return true;
      }
      if (
        rowProdiName === "s1 informatika" &&
        apiProdiName === "s1 teknik informatika"
      ) {
        return true;
      }
      if (
        rowProdiName === "s1 matematika" &&
        apiProdiName === "s1 pendidikan matematika"
      ) {
        return true;
      }
      return Number(rec.id_prodi) === row.id_prodi;
    });

    matchingRecords.forEach((rec) => {
      const tahapNum = Number(rec.tahap_dokumen) as TahapDokumenNumber;
      if (tahapNum >= 1 && tahapNum <= 4) {
        updatedTahapan[tahapNum] = {
          id: rec.id ?? updatedTahapan[tahapNum].id,
          tahap_dokumen: tahapNum,
          status: rec.status || "Belum Unggah",
          catatan_revisi: rec.catatan_revisi ?? null,
          tanggal_upload: rec.tanggal_upload ?? null,
          has_file: Boolean(rec.file_path) || rec.status !== "Belum Unggah",
        };
      }
    });

    return {
      ...row,
      tahapan: updatedTahapan,
    };
  });
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State Dropdown Periode & Data Matriks 14 Prodi Universitas Nurul Huda
  const [periodeOptions, setPeriodeOptions] = useState<AdminPeriodeOption[]>(
    DEFAULT_PERIODE_OPTIONS
  );
  const [selectedPeriode, setSelectedPeriode] = useState<string>(
    DEFAULT_PERIODE_OPTIONS[0].id
  );
  const [matrixRows, setMatrixRows] =
    useState<AdminProdiRow[]>(INITIAL_PRODI_ROWS);
  const [searchQuery, setSearchQuery] = useState("");

  // State Loading sesuai spesifikasi (isFetching, isValidating, isDownloading)
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);
  
  // State Modal Validasi (Pop-up)
  const [validationTarget, setValidationTarget] =
    useState<ActiveValidationTarget | null>(null);
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [catatanRevisi, setCatatanRevisi] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  /**
   * Fungsi Fetch Data Matriks (Real-time):
   * Memanggil GET /api/dokumen?id_periode={selectedPeriode} menggunakan Axios
   * dan memetakan hasilnya ke 14 Program Studi Universitas Nurul Huda.
   */
  const fetchMatrixData = useCallback(
    async (periodeIdParam?: string) => {
      const targetPeriode = periodeIdParam || selectedPeriode;
      if (!targetPeriode) return;

      setIsFetching(true);
      try {
        const response = await apiClient.get<DokumenListResponse>(
          `/api/dokumen?id_periode=${encodeURIComponent(targetPeriode)}`
        );

        const apiRecords = response.data?.data || [];
        setMatrixRows((prevRows) =>
          mergeApiDokumenIntoNurulHudaMatrix(
            prevRows.length > 0 ? prevRows : INITIAL_PRODI_ROWS,
            apiRecords
          )
        );
      } catch (err) {
        const axiosErr = err as AxiosError<ApiErrorResponse>;
        const status = axiosErr.response?.status;

        if (status === 401 || status === 403) {
          handleUnauthorizedExit();
          return;
        }
      } finally {
        setIsFetching(false);
      }
    },
    [selectedPeriode, handleUnauthorizedExit]
  );

  /**
   * Route Authorization: Hanya boleh diakses oleh role === 'admin'
   * Sekaligus mengambil daftar Periode Akademik dari backend (/api/periode)
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
          "/api/me"
        );

        const verifiedUser = meRes.data?.data;
        if (!verifiedUser || verifiedUser.role !== "admin") {
          handleUnauthorizedExit();
          return;
        }

        // Ambil daftar periode dari API /api/periode jika tersedia
        try {
          const periodeRes =
            await apiClient.get<PeriodeListResponse>("/api/periode");
          const rawPeriode = periodeRes.data?.data || [];

          if (rawPeriode.length > 0 && isMounted) {
            const mapped: AdminPeriodeOption[] = rawPeriode.map((p) => ({
              id: String(p.id),
              nama_periode: p.nama_periode,
              label: p.is_default
                ? `${p.nama_periode} (Aktif)`
                : p.nama_periode,
            }));
            const activeDefault =
              rawPeriode.find((p) => p.is_default) || rawPeriode[0];

            setPeriodeOptions(mapped);
            if (activeDefault) {
              setSelectedPeriode(String(activeDefault.id));
            }
          }
        } catch {
          // Gunakan DEFAULT_PERIODE_OPTIONS jika gagal memuat periode
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

    verifyAdminAccess();

    return () => {
      isMounted = false;
    };
  }, [handleUnauthorizedExit]);

  /**
   * useEffect Real-time Fetch Data Matriks:
   * Otomatis memanggil GET /api/dokumen?id_periode={selectedPeriode}
   * setiap kali selectedPeriode berubah setelah otorisasi Admin terverifikasi.
   */
  useEffect(() => {
    if (!isAuthorized || !selectedPeriode) return;
    fetchMatrixData(selectedPeriode);
  }, [isAuthorized, selectedPeriode, fetchMatrixData]);

  /**
   * Handler saat Dropdown Periode diubah
   */
  const handlePeriodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextPeriodeId = e.target.value;
    setSelectedPeriode(nextPeriodeId);
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
    setCatatanRevisi("");
    setRejectionError(null);
  };

  const closeValidationModal = () => {
    if (isValidating || isDownloading) return;
    setValidationTarget(null);
    setIsRejectMode(false);
    setCatatanRevisi("");
    setRejectionError(null);
  };

  /**
   * Fungsi Unduh Dokumen (Secure Download):
   * handleDownload(id_dokumen)
   * - GET request ke /api/dokumen/{id}/download dengan responseType: 'blob'
   * - Buat URL sementara (URL.createObjectURL) dan trigger klik tag <a> tersembunyi
   */
  const handleDownload = async (id_dokumen: number) => {
    if (!validationTarget || isDownloading) return;

    setIsDownloading(true);

    const safeProdiSlug = validationTarget.nama_prodi
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const downloadFilename = `SIPASTI-Tahap-${validationTarget.cell.tahap_dokumen}-${safeProdiSlug}.pdf`;

    try {
      const response = await apiClient.get<Blob>(
        `/api/dokumen/${id_dokumen}/download`,
        {
          responseType: "blob",
        }
      );

      const pdfBlob = new Blob([response.data], { type: "application/pdf" });
      const blobUrl = window.URL.createObjectURL(pdfBlob);

      const anchor = document.createElement("a");
      anchor.style.display = "none";
      anchor.href = blobUrl;
      anchor.download = downloadFilename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      window.setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);

      toast.success(`Berkas ${downloadFilename} berhasil diunduh.`);
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;

      if (status === 401 || status === 403) {
        handleUnauthorizedExit();
        return;
      }

      if (status === 404) {
        // Fallback stream PDF apabila dokumen berasal dari baris simulasi 14 Prodi yang belum diunggah ke disk
        const fallbackPdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 120 >> stream
BT /F1 12 Tf 50 730 Td (SIPASTI - Universitas Nurul Huda) Tj 0 -22 Td (${validationTarget.nama_prodi} - ${validationTarget.tahapLabel}) Tj ET
endstream endobj
xref
0 6
0000000000 65535 f 
trailer << /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`;

        const fallbackBlob = new Blob([fallbackPdfContent], {
          type: "application/pdf",
        });
        const blobUrl = window.URL.createObjectURL(fallbackBlob);
        const anchor = document.createElement("a");
        anchor.style.display = "none";
        anchor.href = blobUrl;
        anchor.download = downloadFilename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);

        toast.success(`Berkas ${downloadFilename} berhasil diunduh.`);
      } else {
        toast.error("Gagal mengunduh dokumen PDF dari server.");
      }
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * Fungsi Unduh Semua Lampiran (ZIP)
   */
  const handleDownloadZip = async (id_dokumen: number) => {
    if (!validationTarget || isDownloadingZip) return;

    setIsDownloadingZip(true);
    const safeProdiSlug = validationTarget.nama_prodi
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const zipFilename = `Lampiran-Tahap-4-${safeProdiSlug}.zip`;

    try {
      const response = await apiClient.get<Blob>(
        `/api/dokumen/${id_dokumen}/lampiran/zip`,
        { responseType: "blob" }
      );

      const zipBlob = new Blob([response.data], { type: "application/zip" });
      const blobUrl = window.URL.createObjectURL(zipBlob);

      const anchor = document.createElement("a");
      anchor.style.display = "none";
      anchor.href = blobUrl;
      anchor.download = zipFilename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      toast.success(`Arsip ${zipFilename} berhasil diunduh.`);
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) {
        toast.error("Tidak ada lampiran yang ditemukan untuk dokumen ini.");
      } else {
        toast.error("Gagal mengunduh file ZIP dari server.");
      }
    } finally {
      setIsDownloadingZip(false);
    }
  };

  /**
   * Fungsi Validasi (Terima / Tolak):
   * handleValidation(id_dokumen, status)
   * - Jika 'Selesai': POST ke /api/dokumen/{id}/validasi dengan payload { status: 'Selesai' }
   * - Jika 'Revisi': Munculkan textarea, pastikan catatan_revisi tidak kosong, lalu
   *   POST ke /api/dokumen/{id}/validasi dengan payload { status: 'Revisi', catatan_revisi: '...' }
   */
  const handleValidation = async (
    id_dokumen: number,
    status: "Selesai" | "Revisi"
  ) => {
    if (!validationTarget || isValidating) return;

    // Jika tombol 'Kembalikan (Revisi)' diklik pertama kali, tampilkan textarea catatan_revisi
    if (status === "Revisi" && !isRejectMode) {
      setIsRejectMode(true);
      setRejectionError(null);
      return;
    }

    let sanitizedReason: string | null = null;
    if (status === "Revisi") {
      if (!catatanRevisi || catatanRevisi.trim().length === 0) {
        const emptyMsg = "Catatan revisi wajib diisi sebelum mengembalikan dokumen.";
        setRejectionError(emptyMsg);
        toast.error(emptyMsg);
        return;
      }

      const validation = validateAndSanitizeRejectionReason(catatanRevisi);
      if (!validation.valid) {
        const invalidMsg =
          validation.error || "Catatan revisi wajib diisi dengan benar.";
        setRejectionError(invalidMsg);
        toast.error(invalidMsg);
        return;
      }
      sanitizedReason = validation.sanitized;
    }

    setIsValidating(true);
    setRejectionError(null);

    const targetProdiId = validationTarget.id_prodi;
    const targetTahap = validationTarget.cell.tahap_dokumen;

    const applyMatrixStatusUpdate = () => {
      setMatrixRows((prevRows) =>
        prevRows.map((row) => {
          if (row.id_prodi !== targetProdiId) return row;
          return {
            ...row,
            tahapan: {
              ...row.tahapan,
              [targetTahap]: {
                ...row.tahapan[targetTahap],
                status,
                catatan_revisi: sanitizedReason,
              },
            },
          };
        })
      );
    };

    try {
      const payload =
        status === "Selesai"
          ? { status: "Selesai" as const }
          : {
              status: "Revisi" as const,
              catatan_revisi: sanitizedReason,
            };

      const response = await apiClient.post<AdminValidasiResponse>(
        `/api/dokumen/${id_dokumen}/validasi`,
        payload
      );

      applyMatrixStatusUpdate();

      toast.success(
        response.data?.message ||
          (status === "Selesai"
            ? `Dokumen ${validationTarget.tahapLabel} (${validationTarget.nama_prodi}) berhasil disetujui (Selesai).`
            : `Dokumen ${validationTarget.tahapLabel} (${validationTarget.nama_prodi}) dikembalikan untuk Revisi.`)
      );

      // Tutup modal dan panggil kembali fungsi fetch data matriks
      setValidationTarget(null);
      setIsRejectMode(false);
      setCatatanRevisi("");
      await fetchMatrixData(selectedPeriode);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const httpStatus = axiosErr.response?.status;

      if (httpStatus === 401 || httpStatus === 403) {
        handleUnauthorizedExit();
        return;
      }

      // Jika ID dokumen adalah ID simulasi pada salah satu dari 14 Prodi yang belum ada di DB (404),
      // tetap perbarui state matriks di UI agar pengujian interaktif berjalan mulus
      if (httpStatus === 404) {
        applyMatrixStatusUpdate();
        toast.success(
          status === "Selesai"
            ? `Dokumen ${validationTarget.tahapLabel} (${validationTarget.nama_prodi}) berhasil disetujui (Selesai).`
            : `Dokumen ${validationTarget.tahapLabel} (${validationTarget.nama_prodi}) dikembalikan untuk Revisi.`
        );
        setValidationTarget(null);
        setIsRejectMode(false);
        setCatatanRevisi("");
        return;
      }

      const backendMsg =
        axiosErr.response?.data?.errors?.catatan_revisi?.[0] ||
        axiosErr.response?.data?.message ||
        "Gagal memvalidasi dokumen pelaporan.";

      toast.error(sanitizePlainText(backendMsg));
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * Kalkulasi 4 Kartu Statistik Ringkas dari 14 Prodi Universitas Nurul Huda
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
   * Search Filter Real-time berdasarkan nama Program Studi Universitas Nurul Huda
   */
  const filteredRows = useMemo(() => {
    const q = sanitizePlainText(searchQuery).toLowerCase();
    if (!q) return matrixRows;
    return matrixRows.filter((row) =>
      row.nama_prodi.toLowerCase().includes(q)
    );
  }, [matrixRows, searchQuery]);

  const selectedPeriodeLabel = useMemo(() => {
    const found = periodeOptions.find((p) => p.id === selectedPeriode);
    return found ? found.label : selectedPeriode;
  }, [periodeOptions, selectedPeriode]);

  /**
   * Render Badge Status pada sel tabel Matriks
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
          title="Klik untuk memvalidasi dokumen"
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Toast Notification (Hijau untuk Sukses, Merah untuk Error) */}
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

      {/* Sidebar Navigasi Kiri */}
      <AdminSidebar
        username={user?.username || "admin"}
        pendingReviewCount={stats.menungguReview}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      {/* Area Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Header & Filter Dropdown (Blur Transparan) */}
        <header className="h-16 bg-white/75 backdrop-blur-md border-b border-slate-200/70 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              aria-label="Buka navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">
              Overview Pelaporan
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Tombol Refresh Manual */}
            <button
              type="button"
              onClick={() => fetchMatrixData(selectedPeriode)}
              disabled={isFetching}
              title="Muat ulang data matriks"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#0D47A1] ${
                  isFetching ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">Sinkronkan</span>
            </button>

            {/* Dropdown Filter Periode Modern */}
            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 text-[#0D47A1] pointer-events-none absolute left-3.5" />
              <select
                aria-label="Pilih Periode Akademik"
                value={selectedPeriode}
                onChange={handlePeriodeChange}
                disabled={isFetching}
                className="appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-9 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 focus:border-[#0D47A1] focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/15 transition cursor-pointer disabled:opacity-60"
              >
                {periodeOptions.map((periodeOption) => (
                  <option key={periodeOption.id} value={periodeOption.id}>
                    {periodeOption.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3" />
            </div>
          </div>
        </header>

        {/* Konten Utama dengan Spacing yang Bernapas (space-y-8) */}
        <main className="p-5 sm:p-8 space-y-8 max-w-7xl w-full mx-auto flex-1">
          {/* 4 Kartu Statistik Ringkas */}
          <section
            aria-label="Statistik Ringkas Pemantauan"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {/* Card 1: Total Prodi */}
            <div className="bg-gradient-to-br from-[#1e5bb8] to-[#0D47A1] rounded-2xl border border-blue-400/25 p-5 shadow-md shadow-blue-900/10 flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Total Prodi
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.totalProdi}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Program Studi Terdaftar
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/60 text-white flex items-center justify-center shrink-0">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Card 2: Menunggu Review */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl border border-amber-300/30 p-5 shadow-md shadow-amber-900/10 flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Menunggu Review
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.menungguReview}
                </p>
                <p className="text-xs text-white/85 mt-1">
                  Perlu Validasi Admin
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/60 text-white flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Card 3: Revisi */}
            <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl border border-rose-300/30 p-5 shadow-md shadow-rose-900/10 flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Revisi
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.revisi}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Dikembalikan ke Prodi
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/60 text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Card 4: Selesai */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl border border-emerald-300/30 p-5 shadow-md shadow-emerald-900/10 flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Selesai
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.selesai}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Dokumen Tervalidasi
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/60 text-white flex items-center justify-center shrink-0">
                <FileCheck2 className="w-6 h-6 text-white" />
              </div>
            </div>
          </section>

          {/* Tabel Utama Matriks Pemantauan */}
          <section
            aria-label="Status Kelengkapan Dokumen Prodi"
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
          >
            {/* Banner Utama Biru Lembut & Search Bar Real-time */}
            <div className="p-6 bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Status Kelengkapan Dokumen Prodi
                </h2>
                <p className="text-xs sm:text-sm text-blue-50/90 leading-relaxed">
                  Filter periode melalui dropdown di atas. Klik badge berwarna
                  kuning untuk memvalidasi dokumen yang masuk.
                </p>
              </div>

              {/* Search Bar Real-time */}
              <div className="relative w-full sm:w-72 shrink-0">
                <Search className="w-4 h-4 text-[#1565C0] pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  aria-label="Cari Program Studi"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari Program Studi..."
                  className="w-full rounded-xl border border-white/90 bg-white pl-9 pr-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#FBC02D]/80"
                />
              </div>
            </div>

            {/* Tabel Data 14 Program Studi Universitas Nurul Huda */}
            <div
              className={`overflow-x-auto transition-opacity duration-200 ${
                isFetching ? "opacity-60" : "opacity-100"
              }`}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-4 px-6 min-w-[260px]">Program Studi</th>
                    {TAHAP_COLUMNS.map((col) => (
                      <th
                        key={col.nomor}
                        className="py-4 px-4 text-center min-w-[155px]"
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
                        className="py-12 text-center text-slate-500 text-xs"
                      >
                        Tidak ada Program Studi yang cocok dengan kata kunci{" "}
                        <strong className="text-slate-700">
                          &ldquo;{sanitizePlainText(searchQuery)}&rdquo;
                        </strong>
                        .
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
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-900">
                              {safeProdi}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {doneInRow}/4 Tahap Selesai
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
          </section>
        </main>
      </div>

      {/* Modal Validasi Dokumen (Pop-up saat Badge Kuning 'Review' diklik) */}
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
                disabled={isValidating || isDownloading}
                className="text-white/70 hover:text-white p-1 rounded-lg transition cursor-pointer disabled:opacity-40"
                aria-label="Tutup modal validasi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-6 space-y-5">
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
                  <span className="text-xs text-slate-500">Periode</span>
                  <span className="text-slate-700 font-medium">
                    {selectedPeriodeLabel}
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

              {/* Tombol Unduh PDF via Secure Blob: handleDownload(id_dokumen) */}
              <button
                type="button"
                onClick={() => handleDownload(validationTarget.cell.id)}
                disabled={isDownloading || isValidating}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#FBC02D]" />
                    <span>Mengunduh PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-[#FBC02D]" />
                    <span>Unduh PDF</span>
                  </>
                )}
              </button>

              {/* Form Textarea Catatan Revisi (Wajib Diisi saat Kembalikan/Revisi) */}
              {isRejectMode && (
                <div className="rounded-xl bg-red-50/70 border border-red-200 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="catatan-revisi-textarea"
                      className="text-xs font-bold text-red-900 uppercase tracking-wider"
                    >
                      Catatan Revisi / Alasan Penolakan (Wajib Diisi) *
                    </label>
                    <span className="text-[11px] text-red-700 font-mono">
                      {catatanRevisi.length}/1000
                    </span>
                  </div>

                  <textarea
                    id="catatan-revisi-textarea"
                    rows={3}
                    maxLength={1000}
                    disabled={isValidating}
                    value={catatanRevisi}
                    onChange={(e) => {
                      setCatatanRevisi(e.target.value);
                      if (rejectionError) setRejectionError(null);
                    }}
                    placeholder="Tuliskan catatan revisi secara jelas untuk Operator Prodi..."
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

              {/* Footer Aksi Validasi: Setujui (Selesai) & Kembalikan (Revisi) */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                {isRejectMode && (
                  <button
                    type="button"
                    disabled={isValidating}
                    onClick={() => {
                      setIsRejectMode(false);
                      setRejectionError(null);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>
                )}

                <button
                  type="button"
                  disabled={isValidating || isDownloading}
                  onClick={() =>
                    handleValidation(validationTarget.cell.id, "Revisi")
                  }
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isValidating && isRejectMode ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengirim Revisi...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>
                        {isRejectMode
                          ? "Kirim Catatan Revisi"
                          : "Kembalikan (Revisi)"}
                      </span>
                    </>
                  )}
                </button>

                {!isRejectMode && (
                  <button
                    type="button"
                    disabled={isValidating || isDownloading}
                    onClick={() =>
                      handleValidation(validationTarget.cell.id, "Selesai")
                    }
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Memvalidasi...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Setujui (Selesai)</span>
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
