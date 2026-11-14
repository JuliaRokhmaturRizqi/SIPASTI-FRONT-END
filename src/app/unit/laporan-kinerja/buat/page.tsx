"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AxiosError } from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  Info,
  Lightbulb,
  Link2,
  Loader2,
  Menu,
  Plus,
  Send,
  Trash2,
  UserCheck,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
import { AuthUser } from "@/types/auth";
import { PeriodeApiRecord, PeriodeListResponse } from "@/types/dokumen";
import {
  DukunganRow,
  KendalaRow,
  LaporanKinerjaItem,
  PembahasanRow,
  TindakLanjutRow,
} from "@/types/laporan";
import UnitSidebar from "@/components/unit/UnitSidebar";
import SignaturePadField, {
  SignatureValue,
} from "@/components/unit/SignaturePadField";

const ALLOWED_ROLES = ["biro", "pusat", "lab"] as const;

const BULAN_OPTIONS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

interface PeriodeOption {
  id: string;
  nama_periode: string;
}

const emptyPembahasan = (): PembahasanRow => ({
  aspek: "",
  realisasi: "",
  analisis: "",
  link: "",
});

const emptyKendala = (): KendalaRow => ({
  kendala: "",
  penyebab: "",
  dampak: "",
  upaya: "",
});

const emptyDukungan = (): DukunganRow => ({
  jenis: "",
  bentuk: "",
  pihak: "",
});

const emptyTindakLanjut = (): TindakLanjutRow => ({
  solusi: "",
  pic: "",
  target: "",
  indikator: "",
});

function BuatLaporanKinerjaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const initialPeriodeParam = searchParams.get("periode");

  // State Auth & Layout
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Periode & Identitas Laporan
  const [periodeList, setPeriodeList] = useState<PeriodeOption[]>([]);
  const [idPeriode, setIdPeriode] = useState<string>("");
  const [bulanLaporan, setBulanLaporan] = useState<string>("");
  const [penanggungJawab, setPenanggungJawab] = useState<string>("");
  const [penyusun, setPenyusun] = useState<string>("");

  // State Tabel Dinamis (Array of Objects)
  const [pembahasan, setPembahasan] = useState<PembahasanRow[]>([
    emptyPembahasan(),
  ]);
  const [kendala, setKendala] = useState<KendalaRow[]>([emptyKendala()]);
  const [dukungan, setDukungan] = useState<DukunganRow[]>([emptyDukungan()]);
  const [tindakLanjut, setTindakLanjut] = useState<TindakLanjutRow[]>([
    emptyTindakLanjut(),
  ]);

  // State Kesimpulan, Rekomendasi & TTD Penyusun
  const [kesimpulan, setKesimpulan] = useState<string>("");
  const [rekomendasi, setRekomendasi] = useState<string>("");
  const [signature, setSignature] = useState<SignatureValue>({
    file: null,
    base64: null,
  });
  const [existingTtdPath, setExistingTtdPath] = useState<string | null>(null);
  const [catatanRevisi, setCatatanRevisi] = useState<string | null>(null);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  // Guard Sesi & Load Periode + Data Edit (jika ada)
  useEffect(() => {
    let isMounted = true;

    const initPage = async () => {
      const { token, role, user: sessionUser } = getAuthSession();
      if (
        !token ||
        !role ||
        !(ALLOWED_ROLES as readonly string[]).includes(role)
      ) {
        handleUnauthorizedExit();
        return;
      }

      if (sessionUser?.jabatan === "pimpinan") {
        toast.error("Hanya staf unit kerja yang dapat membuat laporan.");
        router.replace("/unit/dashboard");
        return;
      }

      if (!isMounted) return;
      setUser(sessionUser);
      setIsAuthorized(true);
      setIsCheckingAuth(false);
      setIsLoadingInitial(true);

      try {
        const periodeRes = await apiClient.get<PeriodeListResponse>(
          "/api/periode-akademik"
        );
        const rawPeriodes: PeriodeApiRecord[] = periodeRes.data?.data || [];
        const mapped: PeriodeOption[] = rawPeriodes.map((p) => ({
          id: String(p.id),
          nama_periode: p.nama_periode,
        }));

        if (!isMounted) return;
        setPeriodeList(mapped);

        if (initialPeriodeParam && mapped.some((p) => p.id === initialPeriodeParam)) {
          setIdPeriode(initialPeriodeParam);
        } else {
          const defaultObj =
            rawPeriodes.find((p) => Boolean(p.is_default)) ||
            rawPeriodes.find((p) => Boolean(p.status_aktif)) ||
            rawPeriodes[0];
          if (defaultObj) {
            setIdPeriode(String(defaultObj.id));
          }
        }

        // Jika mode edit (perbaikan revisi), ambil detail laporan
        if (editId) {
          const detailRes = await apiClient.get<{ data?: LaporanKinerjaItem }>(
            `/api/laporan-kinerja/${editId}`
          );
          const item = detailRes.data?.data;
          if (item && isMounted) {
            setIdPeriode(String(item.id_periode));
            setBulanLaporan(item.bulan_laporan || "");
            setPenanggungJawab(
              item.identitas_laporan?.penanggung_jawab ||
                item.nama_penandatangan ||
                ""
            );
            setPenyusun(item.identitas_laporan?.penyusun || "");
            if (
              Array.isArray(item.pembahasan_json) &&
              item.pembahasan_json.length > 0
            ) {
              setPembahasan(
                item.pembahasan_json.map((row) => ({
                  aspek: row.aspek || "",
                  realisasi: row.realisasi || "",
                  analisis: row.analisis || "",
                  link: row.link || "",
                }))
              );
            }
            if (Array.isArray(item.kendala_json)) {
              setKendala(
                item.kendala_json.length > 0
                  ? item.kendala_json.map((row) => ({
                      kendala: row.kendala || "",
                      penyebab: row.penyebab || "",
                      dampak: row.dampak || "",
                      upaya: row.upaya || "",
                    }))
                  : []
              );
            }
            if (Array.isArray(item.dukungan_json)) {
              setDukungan(
                item.dukungan_json.length > 0
                  ? item.dukungan_json.map((row) => ({
                      jenis: row.jenis || "",
                      bentuk: row.bentuk || "",
                      pihak: row.pihak || "",
                    }))
                  : []
              );
            }
            if (Array.isArray(item.tindak_lanjut_json)) {
              setTindakLanjut(
                item.tindak_lanjut_json.length > 0
                  ? item.tindak_lanjut_json.map((row) => ({
                      solusi: row.solusi || "",
                      pic: row.pic || "",
                      target: row.target || "",
                      indikator: row.indikator || "",
                    }))
                  : []
              );
            }
            setKesimpulan(item.kesimpulan || "");
            setRekomendasi(item.rekomendasi || "");
            setExistingTtdPath(
              item.ttd_penyusun_path || item.ttd_image_path || null
            );
            setCatatanRevisi(item.catatan_revisi || null);
          }
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
        toast.error(
          axiosErr.response?.data?.message ||
            "Gagal memuat data awal formulir laporan."
        );
      } finally {
        if (isMounted) setIsLoadingInitial(false);
      }
    };

    initPage();

    return () => {
      isMounted = false;
    };
  }, [editId, initialPeriodeParam, handleUnauthorizedExit, router]);

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

  // Helper generic update baris tabel dinamis
  const updatePembahasan = (
    index: number,
    field: keyof PembahasanRow,
    value: string
  ) => {
    setPembahasan((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row))
    );
  };

  const updateKendala = (
    index: number,
    field: keyof KendalaRow,
    value: string
  ) => {
    setKendala((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row))
    );
  };

  const updateDukungan = (
    index: number,
    field: keyof DukunganRow,
    value: string
  ) => {
    setDukungan((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row))
    );
  };

  const updateTindakLanjut = (
    index: number,
    field: keyof TindakLanjutRow,
    value: string
  ) => {
    setTindakLanjut((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!idPeriode) {
      toast.error("Periode pelaporan wajib dipilih.");
      return;
    }
    if (!bulanLaporan) {
      toast.error("Bulan laporan wajib dipilih.");
      return;
    }
    if (!penanggungJawab.trim() || !penyusun.trim()) {
      toast.error("Nama Penanggung Jawab dan Penyusun wajib diisi.");
      return;
    }

    const validPembahasan = pembahasan.filter(
      (row) => row.aspek.trim() !== "" || row.realisasi.trim() !== ""
    );
    if (validPembahasan.length === 0) {
      toast.error(
        "Minimal satu baris pada Tabel Pembahasan harus diisi (Aspek & Realisasi)."
      );
      return;
    }

    if (!editId && !signature.file && !signature.base64 && !existingTtdPath) {
      toast.error("Tanda tangan penyusun wajib diisi atau diunggah.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("id_periode", idPeriode);
      formData.append("bulan_laporan", bulanLaporan);

      const safeNamaUnit = user?.unit_kerja?.nama_unit || "Unit Kerja";
      formData.append(
        "identitas_laporan",
        JSON.stringify({
          penanggung_jawab: penanggungJawab.trim(),
          penyusun: penyusun.trim(),
          nama_unit: safeNamaUnit,
        })
      );

      formData.append("pembahasan_json", JSON.stringify(validPembahasan));
      formData.append(
        "kendala_json",
        JSON.stringify(
          kendala.filter(
            (r) =>
              r.kendala.trim() ||
              r.penyebab.trim() ||
              r.dampak.trim() ||
              r.upaya.trim()
          )
        )
      );
      formData.append(
        "dukungan_json",
        JSON.stringify(
          dukungan.filter(
            (r) => r.jenis.trim() || r.bentuk.trim() || r.pihak.trim()
          )
        )
      );
      formData.append(
        "tindak_lanjut_json",
        JSON.stringify(
          tindakLanjut.filter(
            (r) =>
              r.solusi.trim() ||
              r.pic.trim() ||
              r.target.trim() ||
              r.indikator.trim()
          )
        )
      );

      formData.append("kesimpulan", kesimpulan.trim());
      formData.append("rekomendasi", rekomendasi.trim());

      // Kompatibilitas ringkasan kartu
      formData.append(
        "nama_kegiatan",
        `Laporan Kinerja Bulan ${bulanLaporan}`
      );
      formData.append("nama_penandatangan", penanggungJawab.trim());

      if (signature.file) {
        formData.append("ttd_penyusun", signature.file);
      } else if (signature.base64) {
        formData.append("ttd_penyusun", signature.base64);
      }

      const endpoint = editId
        ? `/api/laporan-kinerja/${editId}`
        : "/api/laporan-kinerja";

      await apiClient.post(endpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success(
        editId
          ? "Perbaikan laporan berhasil dikirim ke Pimpinan!"
          : "Laporan kinerja berhasil dikirim untuk persetujuan Pimpinan!"
      );
      router.push("/unit/dashboard");
    } catch (err) {
      const axiosErr = err as AxiosError<{
        message?: string;
        errors?: Record<string, string[]>;
      }>;
      if (axiosErr.response?.status === 401) {
        handleUnauthorizedExit();
        return;
      }

      const firstValidationMsg = axiosErr.response?.data?.errors
        ? Object.values(axiosErr.response.data.errors)[0]?.[0]
        : null;

      toast.error(
        firstValidationMsg ||
          axiosErr.response?.data?.message ||
          "Gagal menyimpan laporan kinerja. Silakan periksa kembali isian Anda."
      );
    } finally {
      setIsSubmitting(false);
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
            Memverifikasi Sesi Staf Unit Kerja...
          </p>
        </div>
      </div>
    );
  }

  const safeUsername = sanitizePlainText(user?.username || "staf_unit");
  const safeNamaUnit = sanitizePlainText(
    user?.unit_kerja?.nama_unit || "Unit Kerja"
  );
  const rawKategori =
    typeof user?.unit_kerja?.kategori_unit === "string"
      ? user.unit_kerja.kategori_unit
      : (user?.unit_kerja?.kategori_unit as { nama_kategori?: string } | undefined)
          ?.nama_kategori ||
        user?.role ||
        "Unit Kerja";
  const safeKategoriUnit = sanitizePlainText(rawKategori.toUpperCase());

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <Toaster position="top-right" />

      <UnitSidebar
        username={safeUsername}
        namaUnit={safeNamaUnit}
        kategoriUnit={safeKategoriUnit}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link
              href="/unit/dashboard"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </Link>

            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {editId
                  ? "Perbaiki Laporan Kinerja Unit"
                  : "Buat Laporan Kinerja Bulanan"}
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block truncate">
                {safeNamaUnit} • Formulir Kinerja Terstruktur
              </p>
            </div>
          </div>

          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#0D47A1] border border-blue-200 text-xs font-semibold">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Mode Staf Penyusun</span>
          </span>
        </header>

        {/* Main Form Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto">
          {isLoadingInitial ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-[#0D47A1]" />
              <p className="text-sm font-medium text-slate-600">
                Menyiapkan formulir laporan...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 pb-16">
              {/* Banner Catatan Revisi jika mode edit */}
              {catatanRevisi && (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3 text-red-800">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm space-y-1">
                    <p className="font-bold">Catatan Revisi Sebelumnya:</p>
                    <p className="leading-relaxed">
                      {sanitizePlainText(catatanRevisi)}
                    </p>
                  </div>
                </div>
              )}

              {/* Bagian 1: Identitas Laporan */}
              <section className="bg-white rounded-2xl border border-slate-200/85 shadow-xs overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-[#0D47A1] to-[#1565C0] text-white flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                    <ClipboardList className="w-4 h-4 text-[#FBC02D]" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold">
                      1. Identitas Laporan Kinerja
                    </h2>
                    <p className="text-[11px] text-blue-100">
                      Tentukan periode, bulan pelaporan, dan penanggung jawab unit.
                    </p>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Periode Pelaporan <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={idPeriode}
                      onChange={(e) => setIdPeriode(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/25 focus:border-[#0D47A1]"
                    >
                      <option value="">-- Pilih Periode --</option>
                      {periodeList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama_periode}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Bulan Laporan <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={bulanLaporan}
                        onChange={(e) => setBulanLaporan(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/25 focus:border-[#0D47A1]"
                      >
                        <option value="">-- Pilih Bulan --</option>
                        {BULAN_OPTIONS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Penanggung Jawab (Kepala Unit){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={penanggungJawab}
                      onChange={(e) => setPenanggungJawab(e.target.value)}
                      placeholder="Contoh: Dr. Ahmad Fauzi, M.Pd."
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/25 focus:border-[#0D47A1]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Penyusun Laporan (Staf){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={penyusun}
                      onChange={(e) => setPenyusun(e.target.value)}
                      placeholder="Contoh: Siti Rahmawati, S.Kom."
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/25 focus:border-[#0D47A1]"
                    />
                  </div>
                </div>
              </section>

              {/* Bagian 2: Tabel Dinamis Pembahasan */}
              <section className="bg-white rounded-2xl border border-slate-200/85 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0D47A1] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900">
                        2. Pembahasan &amp; Realisasi Kinerja{" "}
                        <span className="text-red-500">*</span>
                      </h2>
                      <p className="text-xs text-slate-500">
                        Catat aspek/program kerja, realisasi pencapaian, analisis, dan tautan bukti dukung.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPembahasan((prev) => [...prev, emptyPembahasan()])
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] text-white text-xs font-bold transition cursor-pointer shrink-0 self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4 text-[#FBC02D]" />
                    <span>+ Tambah Baris</span>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {pembahasan.map((row, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0D47A1] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                          Baris #{idx + 1}
                        </span>
                        {pembahasan.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setPembahasan((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer"
                            title="Hapus baris ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Aspek / Program Kerja
                          </label>
                          <input
                            type="text"
                            value={row.aspek}
                            onChange={(e) =>
                              updatePembahasan(idx, "aspek", e.target.value)
                            }
                            placeholder="Misal: Pengelolaan Keuangan & Anggaran"
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Link Bukti Dukung (Opsional)
                          </label>
                          <div className="relative">
                            <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="url"
                              value={row.link}
                              onChange={(e) =>
                                updatePembahasan(idx, "link", e.target.value)
                              }
                              placeholder="https://drive.google.com/..."
                              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Realisasi / Capaian
                          </label>
                          <textarea
                            rows={2}
                            value={row.realisasi}
                            onChange={(e) =>
                              updatePembahasan(idx, "realisasi", e.target.value)
                            }
                            placeholder="Jelaskan hasil nyata atau persentase capaian..."
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Analisis / Keterangan
                          </label>
                          <textarea
                            rows={2}
                            value={row.analisis}
                            onChange={(e) =>
                              updatePembahasan(idx, "analisis", e.target.value)
                            }
                            placeholder="Evaluasi singkat atas capaian tersebut..."
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Bagian 3: Tabel Dinamis Kendala */}
              <section className="bg-white rounded-2xl border border-slate-200/85 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900">
                        3. Kendala / Hambatan (Opsional)
                      </h2>
                      <p className="text-xs text-slate-500">
                        Uraikan kendala yang dihadapi beserta penyebab, dampak, dan upaya penanganan.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setKendala((prev) => [...prev, emptyKendala()])
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition cursor-pointer shrink-0 self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4 text-[#0D47A1]" />
                    <span>+ Tambah Baris</span>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {kendala.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">
                      Tidak ada baris kendala. Klik <strong>+ Tambah Baris</strong> jika ingin menambahkan.
                    </p>
                  ) : (
                    kendala.map((row, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                            Kendala #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setKendala((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Kendala yang Dihadapi
                            </label>
                            <input
                              type="text"
                              value={row.kendala}
                              onChange={(e) =>
                                updateKendala(idx, "kendala", e.target.value)
                              }
                              placeholder="Misal: Keterlambatan pengumpulan berkas"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Penyebab Utama
                            </label>
                            <input
                              type="text"
                              value={row.penyebab}
                              onChange={(e) =>
                                updateKendala(idx, "penyebab", e.target.value)
                              }
                              placeholder="Misal: Jadwal kegiatan berbenturan"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Dampak yang Ditimbulkan
                            </label>
                            <input
                              type="text"
                              value={row.dampak}
                              onChange={(e) =>
                                updateKendala(idx, "dampak", e.target.value)
                              }
                              placeholder="Misal: Proses rekap mundur 3 hari"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Upaya Penanganan Sementara
                            </label>
                            <input
                              type="text"
                              value={row.upaya}
                              onChange={(e) =>
                                updateKendala(idx, "upaya", e.target.value)
                              }
                              placeholder="Misal: Mengirim pengingat berkala"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Bagian 4: Tabel Dinamis Dukungan */}
              <section className="bg-white rounded-2xl border border-slate-200/85 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Info className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900">
                        4. Dukungan yang Dibutuhkan (Opsional)
                      </h2>
                      <p className="text-xs text-slate-500">
                        Sebutkan kebutuhan dukungan sarana, kebijakan, atau koordinasi dari pihak terkait.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDukungan((prev) => [...prev, emptyDukungan()])
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition cursor-pointer shrink-0 self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4 text-[#0D47A1]" />
                    <span>+ Tambah Baris</span>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {dukungan.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">
                      Tidak ada baris dukungan. Klik <strong>+ Tambah Baris</strong> jika ingin menambahkan.
                    </p>
                  ) : (
                    dukungan.map((row, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                            Dukungan #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setDukungan((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Jenis Dukungan
                            </label>
                            <input
                              type="text"
                              value={row.jenis}
                              onChange={(e) =>
                                updateDukungan(idx, "jenis", e.target.value)
                              }
                              placeholder="Misal: Sarana Prasarana / Kebijakan"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Bentuk Dukungan
                            </label>
                            <input
                              type="text"
                              value={row.bentuk}
                              onChange={(e) =>
                                updateDukungan(idx, "bentuk", e.target.value)
                              }
                              placeholder="Misal: Penambahan perangkat scanner"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Pihak yang Diharapkan
                            </label>
                            <input
                              type="text"
                              value={row.pihak}
                              onChange={(e) =>
                                updateDukungan(idx, "pihak", e.target.value)
                              }
                              placeholder="Misal: Wakil Rektor II / Biro Umum"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Bagian 5: Tabel Dinamis Tindak Lanjut */}
              <section className="bg-white rounded-2xl border border-slate-200/85 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900">
                        5. Rencana Tindak Lanjut (Opsional)
                      </h2>
                      <p className="text-xs text-slate-500">
                        Langkah perbaikan untuk periode berikutnya beserta penanggung jawab (PIC) dan target waktu.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setTindakLanjut((prev) => [...prev, emptyTindakLanjut()])
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition cursor-pointer shrink-0 self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4 text-[#0D47A1]" />
                    <span>+ Tambah Baris</span>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {tindakLanjut.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">
                      Tidak ada baris tindak lanjut. Klik <strong>+ Tambah Baris</strong> jika ingin menambahkan.
                    </p>
                  ) : (
                    tindakLanjut.map((row, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                            Tindak Lanjut #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setTindakLanjut((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Solusi / Rencana Aksi
                            </label>
                            <input
                              type="text"
                              value={row.solusi}
                              onChange={(e) =>
                                updateTindakLanjut(idx, "solusi", e.target.value)
                              }
                              placeholder="Misal: Digitalisasi arsip surat masuk"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              PIC (Penanggung Jawab)
                            </label>
                            <input
                              type="text"
                              value={row.pic}
                              onChange={(e) =>
                                updateTindakLanjut(idx, "pic", e.target.value)
                              }
                              placeholder="Misal: Staf Administrasi"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Target Waktu
                            </label>
                            <input
                              type="text"
                              value={row.target}
                              onChange={(e) =>
                                updateTindakLanjut(idx, "target", e.target.value)
                              }
                              placeholder="Misal: Minggu ke-2 Bulan Depan"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Indikator Keberhasilan
                            </label>
                            <input
                              type="text"
                              value={row.indikator}
                              onChange={(e) =>
                                updateTindakLanjut(
                                  idx,
                                  "indikator",
                                  e.target.value
                                )
                              }
                              placeholder="Misal: 100% dokumen terarsip digital"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1]"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Bagian 6: Kesimpulan & Rekomendasi */}
              <section className="bg-white rounded-2xl border border-slate-200/85 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/70">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Lightbulb className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      6. Kesimpulan &amp; Rekomendasi
                    </h2>
                    <p className="text-xs text-slate-500">
                      Ringkasan menyeluruh dan saran strategis untuk pimpinan.
                    </p>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Kesimpulan
                    </label>
                    <textarea
                      rows={4}
                      value={kesimpulan}
                      onChange={(e) => setKesimpulan(e.target.value)}
                      placeholder="Tuliskan kesimpulan umum pelaksanaan kinerja bulan ini..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/25 focus:border-[#0D47A1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Rekomendasi
                    </label>
                    <textarea
                      rows={4}
                      value={rekomendasi}
                      onChange={(e) => setRekomendasi(e.target.value)}
                      placeholder="Tuliskan rekomendasi perbaikan atau kebijakan ke depan..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/25 focus:border-[#0D47A1]"
                    />
                  </div>
                </div>
              </section>

              {/* Bagian 7: Tanda Tangan Penyusun */}
              <section className="bg-white rounded-2xl border border-slate-200/85 shadow-xs p-6">
                <SignaturePadField
                  label="7. Tanda Tangan Penyusun (Staf)"
                  helperText="Tanda tangan ini akan dicetak pada dokumen PDF sebagai penyusun laporan sebelum disetujui Pimpinan."
                  existingPath={existingTtdPath}
                  onChange={setSignature}
                  required={!editId && !existingTtdPath}
                />
              </section>

              {/* Action Footer */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
                <Link
                  href="/unit/dashboard"
                  className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold text-center transition"
                >
                  Batal
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] text-white text-sm font-bold shadow-md shadow-blue-900/15 transition cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengirim Laporan...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-[#FBC02D]" />
                      <span>
                        {editId
                          ? "Simpan & Kirim Ulang ke Pimpinan"
                          : "Kirim Laporan ke Pimpinan"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}

export default function BuatLaporanKinerjaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#0D47A1]" />
        </div>
      }
    >
      <BuatLaporanKinerjaContent />
    </Suspense>
  );
}
