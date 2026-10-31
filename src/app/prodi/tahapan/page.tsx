"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertTriangle,
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
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
import ProdiSidebar from "@/components/prodi/ProdiSidebar";
import ProdiUploadModal from "@/components/prodi/ProdiUploadModal";

interface SopTahapanDetail {
  tahap: TahapDokumenNumber;
  judul: string;
  deskripsi: string;
  poinWajib: string[];
  pejabatPenandatangan: string;
}

const SOP_TAHAPAN_LIST: SopTahapanDetail[] = [
  {
    tahap: 1,
    judul: "Tahap 1 (Kurikulum & Mata Kuliah)",
    deskripsi:
      "Unggah PDF Surat Pernyataan penginputan sajian kurikulum di SISFO yang masih berlaku dan ditandatangani oleh Kaprodi.",
    poinWajib: [
      "Mencantumkan daftar mata kuliah beserta bobot SKS yang telah diinput pada SISFO.",
      "Melampirkan bukti kesesuaian struktur kurikulum aktif periode berjalan.",
      "Ditandatangani oleh Ketua Program Studi disertai stempel resmi.",
    ],
    pejabatPenandatangan: "Ketua Program Studi (Kaprodi)",
  },
  {
    tahap: 2,
    judul: "Tahap 2 (Kelas & Jadwal)",
    deskripsi:
      "Unggah PDF Surat Pernyataan kevalidan penginputan kelas dan jadwal perkuliahan yang ada di SISFO.",
    poinWajib: [
      "Memastikan seluruh kelas paralel dan dosen pengampu telah terplot di SISFO.",
      "Tidak terdapat jadwal perkuliahan yang bentrok antar ruangan maupun dosen.",
      "Melampirkan rekap jadwal perkuliahan yang telah disahkan.",
    ],
    pejabatPenandatangan: "Ketua Program Studi (Kaprodi)",
  },
  {
    tahap: 3,
    judul: "Tahap 3 (Nilai Perkuliahan)",
    deskripsi:
      "Unggah PDF Surat Pernyataan telah selesai proses entry nilai pada periode berjalan beserta rekapan laporan akhir.",
    poinWajib: [
      "Seluruh nilai akhir mahasiswa (KHS/DPNA) pada periode berjalan telah terinput 100% di SISFO.",
      "Melampirkan rekapitulasi distribusi nilai akhir per mata kuliah.",
      "Telah diverifikasi dan ditandatangani oleh Ketua Program Studi.",
    ],
    pejabatPenandatangan: "Ketua Program Studi (Kaprodi)",
  },
  {
    tahap: 4,
    judul: "Tahap 4 (Yudisium & Transkrip)",
    deskripsi:
      "Unggah PDF Surat Pernyataan bahwa prodi telah selesai memproses kelulusan mahasiswa akhir dan mendokumentasikan transkrip nilai.",
    poinWajib: [
      "Memuat berita acara penetapan kelulusan (Yudisium) mahasiswa tingkat akhir.",
      "Memastikan seluruh arsip transkrip akademik lulusan telah terdokumentasi di SISFO.",
      "Ditandatangani oleh Ketua Program Studi dan diketahui Dekan Fakultas.",
    ],
    pejabatPenandatangan: "Ketua Program Studi & Dekan",
  },
];

const FALLBACK_PERIODE_LIST: ProdiPeriodeOption[] = [
  {
    id: "1",
    nama_periode: "2026/2027 Ganjil",
    status: "Buka",
    is_default: true,
  },
];

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

function mapApiDokumenToTaskCards(
  records: DokumenApiRecord[] = []
): TaskCardItem[] {
  return SOP_TAHAPAN_LIST.map((bp) => {
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

export default function ProdiTahapanSuratPernyataanPage() {
  const router = useRouter();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [periodeList, setPeriodeList] = useState<ProdiPeriodeOption[]>(
    FALLBACK_PERIODE_LIST
  );
  const [selectedPeriode, setSelectedPeriode] = useState<string>("1");
  const [taskCards, setTaskCards] = useState<TaskCardItem[]>(() =>
    mapApiDokumenToTaskCards([])
  );
  const [isFetching, setIsFetching] = useState<boolean>(false);

  const [activeUploadTask, setActiveUploadTask] =
    useState<TaskCardItem | null>(null);
  const [activePreviewTask, setActivePreviewTask] =
    useState<TaskCardItem | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  const openPeriodeOptions = useMemo(() => {
    const filtered = periodeList.filter((p) => p.status === "Buka");
    return filtered.length > 0 ? filtered : FALLBACK_PERIODE_LIST;
  }, [periodeList]);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  const fetchDataTahapan = useCallback(
    async (periodeIdParam?: string, showSpinner = true) => {
      const targetPeriode = periodeIdParam || selectedPeriode;
      if (!targetPeriode) return;

      if (showSpinner) {
        setIsFetching(true);
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
            "Gagal memuat data tahapan surat pernyataan."
        );
      } finally {
        if (showSpinner) {
          setIsFetching(false);
        }
      }
    },
    [selectedPeriode, handleUnauthorizedExit]
  );

  useEffect(() => {
    let isMounted = true;

    const initializePage = async () => {
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
          // Fallback periode
        }

        if (isMounted) {
          setUser(verifiedUser);
          setIsAuthorized(true);
          setIsCheckingAuth(false);
        }

        await fetchDataTahapan(initialPeriodeId, true);
      } catch (err) {
        const axiosErr = err as AxiosError;
        const status = axiosErr.response?.status;
        if (status === 401 || status === 403 || !axiosErr.response) {
          handleUnauthorizedExit();
        }
      }
    };

    initializePage();

    return () => {
      isMounted = false;
    };
  }, [handleUnauthorizedExit, fetchDataTahapan]);

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

  const totalDokumen = taskCards.length || 4;
  const selesaiCount = taskCards.filter((t) => t.status === "Selesai").length;

  const handlePeriodeSelectChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newPeriodeId = e.target.value;
    setSelectedPeriode(newPeriodeId);
    await fetchDataTahapan(newPeriodeId, true);
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

    await fetchDataTahapan(selectedPeriode, false);
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
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
      <ProdiSidebar
        username={safeUsername}
        prodiName={safeProdiName}
        fakultasLabel="Universitas Nurul Huda"
        completedCount={selesaiCount}
        totalCount={totalDokumen}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      {/* Area Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Top Header */}
        <header className="h-16 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
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
                Tahapan Surat Pernyataan
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchDataTahapan(selectedPeriode, true)}
              disabled={isFetching}
              title="Muat ulang status dokumen"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#0D47A1] ${
                  isFetching ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">Sinkronkan</span>
            </button>

            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200/80 text-xs text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{safeUsername}</span>
            </div>

            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 text-[#0D47A1] pointer-events-none absolute left-3.5" />
              <select
                aria-label="Pilih Periode Pelaporan"
                value={selectedPeriode}
                onChange={handlePeriodeSelectChange}
                disabled={isFetching}
                className="appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-9 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 focus:border-[#0D47A1] focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/15 transition cursor-pointer disabled:opacity-60"
              >
                {openPeriodeOptions.map((periode) => (
                  <option key={periode.id} value={periode.id}>
                    {periode.nama_periode}{" "}
                    {periode.is_default ? "(Default)" : "(Buka)"}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-5 sm:p-8 space-y-6 max-w-6xl w-full mx-auto flex-1">
          {/* Banner Panduan SOP Surat Pernyataan */}
          <section className="rounded-2xl bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] text-white p-6 sm:p-7 shadow-sm border border-blue-800/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#FBC02D]">
                  <BookOpenCheck className="w-4 h-4" />
                  SOP Pelaporan Akademik ({safeProdiName})
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Rincian 4 Tahapan Surat Pernyataan Program Studi
                </h2>
                <p className="text-xs sm:text-sm text-blue-50/90 leading-relaxed">
                  Pastikan setiap berkas PDF Surat Pernyataan memenuhi rincian
                  kelengkapan di bawah ini sebelum diunggah ke sistem.
                </p>
              </div>

              <div className="shrink-0">
                <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 text-xs font-semibold text-white">
                  <span>Periode:</span>
                  <strong className="text-[#FBC02D]">
                    {sanitizePlainText(currentPeriodeObj?.nama_periode || "")}
                  </strong>
                </span>
              </div>
            </div>
          </section>

          {/* Daftar Detail 4 Tahapan Surat Pernyataan */}
          <section
            className={`space-y-5 transition-opacity duration-200 ${
              isFetching ? "opacity-60" : "opacity-100"
            }`}
          >
            {taskCards.map((task) => {
              const sopDetail =
                SOP_TAHAPAN_LIST.find((s) => s.tahap === task.tahap) ||
                SOP_TAHAPAN_LIST[0];
              const badgeCfg = getStatusBadgeConfig(task.status);
              const isNeedUpload =
                task.status === "Belum Unggah" || task.status === "Revisi";

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
                  key={`${selectedPeriode}-sop-tahap-${task.tahap}`}
                  className="bg-white rounded-xl border border-slate-200/85 shadow-sm hover:shadow-md transition-all duration-200 p-5 sm:p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
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

                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                          {safeDeskripsi}
                        </p>
                      </div>
                    </div>

                    {/* Tombol Aksi */}
                    <div className="shrink-0 flex flex-wrap items-center gap-2">
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
                        <>
                          {task.tahap === 4 && task.status === "Review" && (
                            <button
                              type="button"
                              onClick={() => setActiveUploadTask(task)}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0D47A1] border border-blue-200 text-xs sm:text-sm font-semibold transition cursor-pointer"
                            >
                              <Paperclip className="w-4 h-4" />
                              <span>Kelola Lampiran</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setActivePreviewTask(task)}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50/50 text-[#0D47A1] border border-[#0D47A1]/35 hover:border-[#0D47A1] text-xs sm:text-sm font-semibold transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Lihat Dokumen</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Checklist Ketentuan SOP Surat Pernyataan */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200/75 p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Info className="w-3.5 h-3.5 text-[#0D47A1]" />
                        Ketentuan Wajib Surat Pernyataan:
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Pengesahan:{" "}
                        <strong className="text-slate-800">
                          {sopDetail.pejabatPenandatangan}
                        </strong>
                      </span>
                    </div>

                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {sopDetail.poinWajib.map((poin, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{poin}</span>
                        </li>
                      ))}
                    </ul>

                    {safeFileName && (
                      <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                          <FileText className="w-3.5 h-3.5 text-[#0D47A1]" />
                          Berkas Terunggah: {safeFileName}
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

                  {/* Alert Box Revisi */}
                  {task.status === "Revisi" && (
                    <div
                      role="alert"
                      className="rounded-xl bg-red-50 text-red-700 border border-red-200 p-4 flex items-start gap-3"
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
      </div>

      {/* Modal Upload PDF */}
      <ProdiUploadModal
        isOpen={Boolean(activeUploadTask)}
        targetTask={activeUploadTask}
        selectedPeriode={selectedPeriode}
        periodeLabel={currentPeriodeObj?.nama_periode || ""}
        onClose={() => setActiveUploadTask(null)}
        onUploadSuccess={handleUploadSuccess}
        onLampiranDeleted={() => fetchDataTahapan(selectedPeriode, false)}
      />

      {/* Modal Lihat Dokumen */}
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
