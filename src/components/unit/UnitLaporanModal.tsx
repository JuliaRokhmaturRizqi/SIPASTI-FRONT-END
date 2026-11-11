"use client";

import React, { useEffect, useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import {
  AlertCircle,
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  FileEdit,
  FilePlus,
  Link as LinkIcon,
  Loader2,
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
  const [namaKegiatan, setNamaKegiatan] = useState("");
  const [uraian, setUraian] = useState("");
  const [kendala, setKendala] = useState("");
  const [dukungan, setDukungan] = useState("");
  const [tindakLanjut, setTindakLanjut] = useState("");
  const [linkBukti, setLinkBukti] = useState("");
  const [namaPenandatangan, setNamaPenandatangan] = useState("");

  // Validation & Loading State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inisialisasi data form saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      if (activeData) {
        setNamaKegiatan(activeData.nama_kegiatan || "");
        setUraian(activeData.uraian || "");
        setKendala(activeData.kendala || "");
        setDukungan(activeData.dukungan || "");
        setTindakLanjut(activeData.tindak_lanjut || "");
        setLinkBukti(activeData.link_bukti || "");
        setNamaPenandatangan(activeData.nama_penandatangan || "");
      } else {
        setNamaKegiatan("");
        setUraian("");
        setKendala("");
        setDukungan("");
        setTindakLanjut("");
        setLinkBukti("");
        setNamaPenandatangan("");
      }
      setFieldErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, activeData]);

  if (!isOpen) return null;

  const safePeriode = sanitizePlainText(periodeLabel);
  const safeNamaUnit = sanitizePlainText(namaUnit);
  const safeKategoriUnit = sanitizePlainText(kategoriUnit);

  /**
   * Submit Handler (Create POST & Edit PUT)
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Client-side Validation Sederhana
    const errors: Record<string, string> = {};
    const trimmedNama = namaKegiatan.trim();
    const trimmedUraian = uraian.trim();
    const trimmedPenandatangan = namaPenandatangan.trim();
    const trimmedLink = linkBukti.trim();

    if (!trimmedNama) {
      errors.nama_kegiatan = "Nama kegiatan wajib diisi.";
    }
    if (!trimmedUraian) {
      errors.uraian = "Uraian rincian kegiatan wajib diisi.";
    }
    if (!trimmedPenandatangan) {
      errors.nama_penandatangan = "Nama penandatangan / pimpinan unit wajib diisi.";
    }
    if (trimmedLink) {
      if (!/^https?:\/\//i.test(trimmedLink)) {
        errors.link_bukti = "Format URL bukti harus diawali http:// atau https://";
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

    const payload = {
      id_periode: Number(targetPeriodeId),
      nama_kegiatan: trimmedNama,
      uraian: trimmedUraian,
      kendala: kendala.trim() || null,
      dukungan: dukungan.trim() || null,
      tindak_lanjut: tindakLanjut.trim() || null,
      link_bukti: trimmedLink || null,
      nama_penandatangan: trimmedPenandatangan,
    };

    try {
      if (isEditMode && activeData?.id) {
        // Mode EDIT: PUT /api/laporan-kinerja/{id}
        const response = await apiClient.put(
          `/api/laporan-kinerja/${activeData.id}`,
          payload
        );
        toast.success(
          response.data?.message || "Laporan kegiatan berhasil diperbarui."
        );
      } else {
        // Mode CREATE: POST /api/laporan-kinerja
        const response = await apiClient.post("/api/laporan-kinerja", payload);
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

      if (httpStatus === 422 && data?.errors) {
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
                {isEditMode ? "Edit Laporan Kegiatan" : "Form Laporan Kegiatan Baru"}
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">
                {safeNamaUnit} &bull; Periode {safePeriode}
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
          {isEditMode && activeData?.status === "Revisi" && activeData.catatan_revisi && (
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

          {/* 1. Nama Kegiatan (Wajib) */}
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

          {/* 2. Uraian Rincian Kegiatan (Wajib, min 4 baris) */}
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

          {/* 3. Kendala yang Dihadapi (Opsional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="form-kendala"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Kendala yang Dihadapi
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Opsional</span>
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

          {/* 4. Dukungan yang Diperlukan (Opsional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="form-dukungan"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Dukungan yang Diperlukan
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Opsional</span>
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

          {/* 5. Tindak Lanjut (Opsional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="form-tindak-lanjut"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Rencana Tindak Lanjut
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Opsional</span>
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

          {/* 6. Link Bukti Dukung (URL - Opsional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="form-link-bukti"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Link Bukti Kegiatan
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Opsional (URL)</span>
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

          {/* 7. Nama Penandatangan / Pimpinan Unit (Wajib) */}
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
                    setFieldErrors((prev) => ({ ...prev, nama_penandatangan: "" }));
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
                  <span>{isEditMode ? "Perbarui Laporan" : "Simpan Laporan"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
