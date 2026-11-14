"use client";

import React, { useEffect, useRef, useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileEdit,
  FilePlus,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  PenTool,
  RotateCcw,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { sanitizePlainText } from "@/lib/security";
import { LaporanKinerjaItem } from "@/types/laporan";

export interface UnitLaporanModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeData?: LaporanKinerjaItem | null;
  selectedPeriode?: string;
  periodeLabel?: string;
  namaUnit?: string;
  kategoriUnit?: string;
  onSuccess?: () => void;
}

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
] as const;

export default function UnitLaporanModal({
  isOpen,
  onClose,
  activeData = null,
  selectedPeriode,
  periodeLabel = "Periode Berjalan",
  namaUnit = "Unit Kerja",
  kategoriUnit = "Unit",
  onSuccess,
}: UnitLaporanModalProps) {
  const isEditMode = Boolean(activeData);

  // Form Fields State
  const [bulanLaporan, setBulanLaporan] = useState("");
  const [namaKegiatan, setNamaKegiatan] = useState("");
  const [uraian, setUraian] = useState("");
  const [kendala, setKendala] = useState("");
  const [dukungan, setDukungan] = useState("");
  const [tindakLanjut, setTindakLanjut] = useState("");
  const [linkBukti, setLinkBukti] = useState("");
  const [namaPenandatangan, setNamaPenandatangan] = useState("");

  // Signature (Tanda Tangan) State
  const [signatureTab, setSignatureTab] = useState<"upload" | "draw">("upload");
  const [ttdFile, setTtdFile] = useState<File | null>(null);
  const [ttdPreviewUrl, setTtdPreviewUrl] = useState<string | null>(null);
  const [canvasHasDrawing, setCanvasHasDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Validation & Loading State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inisialisasi data form saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      if (activeData) {
        setBulanLaporan(activeData.bulan_laporan || "");
        setNamaKegiatan(activeData.nama_kegiatan || "");
        setUraian(activeData.uraian || "");
        setKendala(activeData.kendala || "");
        setDukungan(activeData.dukungan || "");
        setTindakLanjut(activeData.tindak_lanjut || "");
        setLinkBukti(activeData.link_bukti || "");
        setNamaPenandatangan(activeData.nama_penandatangan || "");
        if (activeData.ttd_image_path) {
          // Format storage url jika ttd sebelumnya ada
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          setTtdPreviewUrl(`${baseUrl}/storage/${activeData.ttd_image_path}`);
        } else {
          setTtdPreviewUrl(null);
        }
      } else {
        // Default bulan ke bulan saat ini
        const currentMonthIdx = new Date().getMonth();
        setBulanLaporan(BULAN_OPTIONS[currentMonthIdx]);
        setNamaKegiatan("");
        setUraian("");
        setKendala("");
        setDukungan("");
        setTindakLanjut("");
        setLinkBukti("");
        setNamaPenandatangan("");
        setTtdPreviewUrl(null);
      }
      setTtdFile(null);
      setCanvasHasDrawing(false);
      setSignatureTab("upload");
      setFieldErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, activeData]);

  // Setup Canvas saat tab "draw" aktif
  useEffect(() => {
    if (signatureTab === "draw" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#0D47A1";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, [signatureTab]);

  // Handler Canvas Gambar Langsung
  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isDrawingRef.current = true;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setCanvasHasDrawing(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setCanvasHasDrawing(false);
  };

  // Handler Unggah File Gambar TTD
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Ukuran file gambar TTD maksimal 2MB.");
        return;
      }
      setTtdFile(file);
      setTtdPreviewUrl(URL.createObjectURL(file));
      setFieldErrors((prev) => ({ ...prev, ttd: "" }));
    }
  };

  if (!isOpen) return null;

  const safePeriode = sanitizePlainText(periodeLabel);
  const safeNamaUnit = sanitizePlainText(namaUnit);
  const safeKategoriUnit = sanitizePlainText(kategoriUnit);

  /**
   * Submit Handler (Create POST & Edit POST/PUT)
   * Menggunakan FormData untuk mendukung pengiriman file / gambar TTD
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Client-side Validation
    const errors: Record<string, string> = {};
    const trimmedBulan = bulanLaporan.trim();
    const trimmedNama = namaKegiatan.trim();
    const trimmedUraian = uraian.trim();
    const trimmedPenandatangan = namaPenandatangan.trim();
    const trimmedLink = linkBukti.trim();

    if (!trimmedBulan) {
      errors.bulan_laporan = "Bulan laporan kegiatan wajib dipilih.";
    }
    if (!trimmedNama) {
      errors.nama_kegiatan = "Nama kegiatan wajib diisi.";
    }
    if (!trimmedUraian) {
      errors.uraian = "Uraian rincian kegiatan wajib diisi.";
    }
    if (!trimmedPenandatangan) {
      errors.nama_penandatangan =
        "Nama penandatangan / pimpinan unit wajib diisi.";
    }
    if (trimmedLink) {
      if (!/^https?:\/\//i.test(trimmedLink)) {
        errors.link_bukti =
          "Format URL bukti harus diawali http:// atau https://";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Mohon lengkapi seluruh field wajib dengan benar.");
      return;
    }

    const targetPeriodeId = selectedPeriode || activeData?.id_periode;
    if (!targetPeriodeId) {
      toast.error("Periode pelaporan belum dipilih.");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    // Buat objek FormData
    const formData = new FormData();
    formData.append("id_periode", String(targetPeriodeId));
    formData.append("bulan_laporan", trimmedBulan);
    formData.append("nama_kegiatan", trimmedNama);
    formData.append("uraian", trimmedUraian);
    if (kendala.trim()) formData.append("kendala", kendala.trim());
    if (dukungan.trim()) formData.append("dukungan", dukungan.trim());
    if (tindakLanjut.trim()) formData.append("tindak_lanjut", tindakLanjut.trim());
    if (trimmedLink) formData.append("link_bukti", trimmedLink);
    formData.append("nama_penandatangan", trimmedPenandatangan);

    // Lampirkan Tanda Tangan (File atau Base64 Canvas)
    if (signatureTab === "upload" && ttdFile) {
      formData.append("ttd_image", ttdFile);
    } else if (signatureTab === "draw" && canvasHasDrawing && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      formData.append("ttd_base64", dataUrl);
    }

    try {
      if (isEditMode && activeData?.id) {
        // Mode EDIT via multipart form-data
        formData.append("_method", "PUT");
        const response = await apiClient.post(
          `/api/laporan-kinerja/${activeData.id}`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
        toast.success(
          response.data?.message || "Laporan kegiatan berhasil diperbarui."
        );
      } else {
        // Mode CREATE via multipart form-data
        const response = await apiClient.post(
          "/api/laporan-kinerja",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
        toast.success(
          response.data?.message || "Laporan kegiatan baru berhasil disimpan."
        );
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{
        message?: string;
        errors?: Record<string, string[]>;
      }>;

      const httpStatus = axiosErr.response?.status;
      const data = axiosErr.response?.data;
      const errorMessage = data?.message || "";

      // Validasi 1 Bulan 1 Laporan per Unit Kerja
      if (
        httpStatus === 422 &&
        (errorMessage.toLowerCase().includes("sudah mengunggah laporan") ||
          errorMessage.toLowerCase().includes("bulan") ||
          data?.errors?.bulan_laporan)
      ) {
        const errorText =
          errorMessage ||
          `Gagal: Laporan untuk bulan ${trimmedBulan} sudah pernah dibuat pada periode aktif ini!`;
        setFieldErrors((prev) => ({
          ...prev,
          bulan_laporan: errorText,
        }));
        toast.error(errorText, {
          duration: 6000,
          icon: "⚠️",
        });
      } else if (httpStatus === 422 && data?.errors) {
        const mappedErrors: Record<string, string> = {};
        for (const [key, messages] of Object.entries(data.errors)) {
          if (Array.isArray(messages) && messages.length > 0) {
            mappedErrors[key] = messages[0];
          }
        }
        setFieldErrors(mappedErrors);
        toast.error(
          data.message || "Terdapat data yang belum memenuhi validasi sistem."
        );
      } else {
        toast.error(
          data?.message ||
            "Terjadi kesalahan saat menyimpan laporan kegiatan ke server."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-laporan-title"
      className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-xs transition-opacity"
    >
      {/* Backdrop Click */}
      <div
        className="fixed inset-0 -z-10"
        onClick={!isSubmitting ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Slide-over Panel dari sisi kanan */}
      <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] px-6 py-5 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner">
              {isEditMode ? (
                <FileEdit className="w-5 h-5 text-[#FBC02D]" />
              ) : (
                <FilePlus className="w-5 h-5 text-[#FBC02D]" />
              )}
            </div>
            <div>
              <h3
                id="modal-laporan-title"
                className="text-base sm:text-lg font-bold text-white tracking-tight"
              >
                {isEditMode
                  ? "Edit Laporan Kegiatan"
                  : "Form Laporan Kegiatan Baru"}
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">
                {safeNamaUnit}{" "}
                {safeKategoriUnit ? `(${safeKategoriUnit.toUpperCase()})` : ""}{" "}
                &bull; Periode {safePeriode}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/75 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer disabled:opacity-40"
            aria-label="Tutup form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body Scrollable */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5"
          noValidate
        >
          {/* Box Catatan Revisi jika dalam mode Edit dan sebelumnya Revisi */}
          {isEditMode &&
            activeData?.status === "Revisi" &&
            activeData.catatan_revisi && (
              <div className="rounded-xl bg-red-50 text-red-800 border border-red-200 p-4 space-y-1 text-xs">
                <div className="flex items-center gap-2 font-bold text-red-900">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Catatan Revisi dari Administrator:</span>
                </div>
                <p className="leading-relaxed pl-6 text-red-700">
                  {sanitizePlainText(activeData.catatan_revisi)}
                </p>
              </div>
            )}

          {/* 1. Dropdown Bulan Laporan (Wajib - Paling Atas) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="form-bulan-laporan"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Bulan Pelaporan
                <span className="text-red-500 font-bold ml-1">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Maksimal 1 laporan per bulan
              </span>
            </div>
            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3.5" />
              <select
                id="form-bulan-laporan"
                required
                disabled={isSubmitting}
                value={bulanLaporan}
                onChange={(e) => {
                  setBulanLaporan(e.target.value);
                  if (fieldErrors.bulan_laporan) {
                    setFieldErrors((prev) => ({ ...prev, bulan_laporan: "" }));
                  }
                }}
                className={`w-full rounded-xl border pl-10 pr-9 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50 focus:bg-white transition outline-none appearance-none cursor-pointer ${
                  fieldErrors.bulan_laporan
                    ? "border-red-400 ring-2 ring-red-400/20 focus:border-red-500"
                    : "border-slate-300/80 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20"
                }`}
              >
                <option value="" disabled>
                  -- Pilih Bulan Laporan --
                </option>
                {BULAN_OPTIONS.map((bulan) => (
                  <option key={bulan} value={bulan}>
                    Bulan {bulan}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4 opacity-50" />
              </div>
            </div>
            {fieldErrors.bulan_laporan && (
              <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.bulan_laporan}</span>
              </p>
            )}
          </div>

          {/* 2. Nama Kegiatan (Wajib) */}
          <div className="space-y-1.5">
            <label
              htmlFor="form-nama-kegiatan"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Nama Kegiatan
              <span className="text-red-500 font-bold ml-1">*</span>
            </label>
            <input
              id="form-nama-kegiatan"
              type="text"
              disabled={isSubmitting}
              value={namaKegiatan}
              onChange={(e) => {
                setNamaKegiatan(e.target.value);
                if (fieldErrors.nama_kegiatan) {
                  setFieldErrors((prev) => ({ ...prev, nama_kegiatan: "" }));
                }
              }}
              placeholder="Contoh: Pelaksanaan Workshop Peningkatan Layanan Sistem Informasi"
              className={`w-full rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/60 hover:bg-white focus:bg-white transition outline-none ${
                fieldErrors.nama_kegiatan
                  ? "border-red-400 ring-2 ring-red-400/20 focus:border-red-500"
                  : "border-slate-300/80 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20"
              }`}
            />
            {fieldErrors.nama_kegiatan && (
              <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.nama_kegiatan}</span>
              </p>
            )}
          </div>

          {/* 3. Uraian Rincian Kegiatan (Wajib, min 4 baris) */}
          <div className="space-y-1.5">
            <label
              htmlFor="form-uraian"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Uraian Realisasi Kegiatan
              <span className="text-red-500 font-bold ml-1">*</span>
            </label>
            <textarea
              id="form-uraian"
              rows={4}
              disabled={isSubmitting}
              value={uraian}
              onChange={(e) => {
                setUraian(e.target.value);
                if (fieldErrors.uraian) {
                  setFieldErrors((prev) => ({ ...prev, uraian: "" }));
                }
              }}
              placeholder="Jelaskan latar belakang, waktu/tempat pelaksanaan, rincian realisasi kegiatan, dan capaian target yang berhasil diselesaikan..."
              className={`w-full rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/60 hover:bg-white focus:bg-white transition outline-none leading-relaxed ${
                fieldErrors.uraian
                  ? "border-red-400 ring-2 ring-red-400/20 focus:border-red-500"
                  : "border-slate-300/80 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20"
              }`}
            />
            {fieldErrors.uraian && (
              <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.uraian}</span>
              </p>
            )}
          </div>

          {/* 4. Kendala yang Dihadapi (Opsional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="form-kendala"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Kendala yang Dihadapi
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Opsional
              </span>
            </div>
            <textarea
              id="form-kendala"
              rows={3}
              disabled={isSubmitting}
              value={kendala}
              onChange={(e) => setKendala(e.target.value)}
              placeholder="Tuliskan kendala teknis atau non-teknis yang dihadapi selama pelaksanaan kegiatan (jika ada)..."
              className="w-full rounded-xl border border-slate-300/80 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/60 hover:bg-white focus:bg-white focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 transition outline-none leading-relaxed"
            />
          </div>

          {/* 5. Dukungan yang Diperlukan (Opsional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="form-dukungan"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Dukungan yang Diperlukan
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Opsional
              </span>
            </div>
            <textarea
              id="form-dukungan"
              rows={3}
              disabled={isSubmitting}
              value={dukungan}
              onChange={(e) => setDukungan(e.target.value)}
              placeholder="Tuliskan kebutuhan sarana, anggaran, fasilitas, atau koordinasi antar unit yang diharapkan..."
              className="w-full rounded-xl border border-slate-300/80 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/60 hover:bg-white focus:bg-white focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 transition outline-none leading-relaxed"
            />
          </div>

          {/* 6. Tindak Lanjut (Opsional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="form-tindak-lanjut"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Rencana Tindak Lanjut
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Opsional
              </span>
            </div>
            <textarea
              id="form-tindak-lanjut"
              rows={3}
              disabled={isSubmitting}
              value={tindakLanjut}
              onChange={(e) => setTindakLanjut(e.target.value)}
              placeholder="Rencana langkah tindak lanjut atau perbaikan operasional ke depan setelah kegiatan selesai..."
              className="w-full rounded-xl border border-slate-300/80 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/60 hover:bg-white focus:bg-white focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 transition outline-none leading-relaxed"
            />
          </div>

          {/* 7. Link Bukti Dukung (URL - Opsional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="form-link-bukti"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Link Bukti Kegiatan
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Opsional (URL)
              </span>
            </div>
            <div className="relative flex items-center">
              <LinkIcon className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3.5" />
              <input
                id="form-link-bukti"
                type="url"
                disabled={isSubmitting}
                value={linkBukti}
                onChange={(e) => {
                  setLinkBukti(e.target.value);
                  if (fieldErrors.link_bukti) {
                    setFieldErrors((prev) => ({ ...prev, link_bukti: "" }));
                  }
                }}
                placeholder="https://drive.google.com/... atau tautan dokumen bukti"
                className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/60 hover:bg-white focus:bg-white transition outline-none ${
                  fieldErrors.link_bukti
                    ? "border-red-400 ring-2 ring-red-400/20 focus:border-red-500"
                    : "border-slate-300/80 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20"
                }`}
              />
            </div>
            {fieldErrors.link_bukti && (
              <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.link_bukti}</span>
              </p>
            )}
          </div>

          {/* 8. Nama Penandatangan / Pimpinan Unit (Wajib) */}
          <div className="space-y-1.5 pt-1">
            <label
              htmlFor="form-nama-penandatangan"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Nama Penandatangan / Pimpinan Unit
              <span className="text-red-500 font-bold ml-1">*</span>
            </label>
            <div className="relative flex items-center">
              <UserCheck className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3.5" />
              <input
                id="form-nama-penandatangan"
                type="text"
                disabled={isSubmitting}
                value={namaPenandatangan}
                onChange={(e) => {
                  setNamaPenandatangan(e.target.value);
                  if (fieldErrors.nama_penandatangan) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      nama_penandatangan: "",
                    }));
                  }
                }}
                placeholder="Contoh: Dr. H. Ahmad Fauzi, M.Kom (Kepala Pusat IT)"
                className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/60 hover:bg-white focus:bg-white transition outline-none ${
                  fieldErrors.nama_penandatangan
                    ? "border-red-400 ring-2 ring-red-400/20 focus:border-red-500"
                    : "border-slate-300/80 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20"
                }`}
              />
            </div>
            {fieldErrors.nama_penandatangan && (
              <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.nama_penandatangan}</span>
              </p>
            )}
          </div>

          {/* 9. Panel Tanda Tangan Digital (Tabs: Unggah vs Gambar Langsung) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Tanda Tangan Digital (TTD)
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Digunakan untuk cetak lembar PDF
              </span>
            </div>

            {/* Tab Selector TTD */}
            <div className="p-1 rounded-xl bg-slate-100 flex items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setSignatureTab("upload")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  signatureTab === "upload"
                    ? "bg-white text-[#0D47A1] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah TTD (Gambar)</span>
              </button>
              <button
                type="button"
                onClick={() => setSignatureTab("draw")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  signatureTab === "draw"
                    ? "bg-white text-[#0D47A1] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Gambar Langsung (Canvas)</span>
              </button>
            </div>

            {/* TAB 1: Unggah Gambar TTD */}
            {signatureTab === "upload" && (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 space-y-3 text-center">
                {ttdPreviewUrl ? (
                  <div className="space-y-2">
                    <div className="w-48 h-24 mx-auto bg-white rounded-lg border border-slate-200 p-2 flex items-center justify-center shadow-xs overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ttdPreviewUrl}
                        alt="Preview Tanda Tangan"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <label
                        htmlFor="file-ttd-replace"
                        className="text-xs font-semibold text-[#0D47A1] hover:underline cursor-pointer"
                      >
                        Ganti Gambar
                      </label>
                      <input
                        id="file-ttd-replace"
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <span className="text-slate-300">&bull;</span>
                      <button
                        type="button"
                        onClick={() => {
                          setTtdFile(null);
                          setTtdPreviewUrl(null);
                        }}
                        className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="file-ttd-upload"
                    className="block cursor-pointer space-y-1.5 py-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0D47A1] border border-blue-100 flex items-center justify-center mx-auto">
                      <ImageIcon className="w-5 h-5 text-[#0D47A1]" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">
                      Pilih berkas gambar TTD
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Format PNG atau JPG dengan latar belakang transparan/putih (Maks. 2MB)
                    </p>
                    <input
                      id="file-ttd-upload"
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            )}

            {/* TAB 2: Gambar Langsung di Canvas */}
            {signatureTab === "draw" && (
              <div className="space-y-2">
                <div className="relative border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white shadow-inner">
                  <canvas
                    ref={canvasRef}
                    width={480}
                    height={160}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-36 touch-none cursor-crosshair bg-white"
                  />
                  {!canvasHasDrawing && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 text-xs font-semibold select-none">
                      Goreskan tanda tangan Anda di sini menggunakan mouse atau touch
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500">
                    {canvasHasDrawing
                      ? "✓ Tanda tangan tergores di canvas"
                      : "Kanvas kosong"}
                  </span>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    disabled={!canvasHasDrawing}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-40"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Hapus Goresan</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Tombol Aksi */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-900 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-900/15 transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#FBC02D]" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#FBC02D]" />
                  <span>
                    {isEditMode ? "Perbarui Laporan" : "Simpan Laporan"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
