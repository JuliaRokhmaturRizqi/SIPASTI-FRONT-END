"use client";

import React, { useEffect, useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Lightbulb,
  Loader2,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { sanitizePlainText } from "@/lib/security";
import { LaporanKinerjaItem } from "@/types/laporan";
import SignaturePadField, { SignatureValue } from "./SignaturePadField";

export interface ApprovalPimpinanModalProps {
  isOpen: boolean;
  laporan: LaporanKinerjaItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ApprovalPimpinanModal({
  isOpen,
  laporan,
  onClose,
  onSuccess,
}: ApprovalPimpinanModalProps) {
  const [signature, setSignature] = useState<SignatureValue>({
    file: null,
    base64: null,
  });
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [catatanRevisi, setCatatanRevisi] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSignature({ file: null, base64: null });
      setShowRejectBox(false);
      setCatatanRevisi("");
      setIsSubmitting(false);
    }
  }, [isOpen, laporan?.id]);

  if (!isOpen || !laporan) return null;

  const pembahasanList = Array.isArray(laporan.pembahasan_json)
    ? laporan.pembahasan_json
    : [];
  const kendalaList = Array.isArray(laporan.kendala_json)
    ? laporan.kendala_json
    : [];
  const dukunganList = Array.isArray(laporan.dukungan_json)
    ? laporan.dukungan_json
    : [];
  const tindakLanjutList = Array.isArray(laporan.tindak_lanjut_json)
    ? laporan.tindak_lanjut_json
    : [];

  const handleApprove = async () => {
    if (!signature.file && !signature.base64) {
      toast.error(
        "Tanda tangan pimpinan wajib diisi atau diunggah sebelum menyetujui dokumen."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("aksi", "setuju");

      if (signature.file) {
        formData.append("ttd_pimpinan", signature.file);
      } else if (signature.base64) {
        formData.append("ttd_pimpinan", signature.base64);
      }

      await apiClient.post(
        `/api/laporan-kinerja/${laporan.id}/approve`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      toast.success(
        "Dokumen disetujui! Laporan diteruskan ke Admin untuk validasi akhir."
      );
      onSuccess();
      onClose();
    } catch (err) {
      const axiosErr = err as AxiosError<{
        message?: string;
        errors?: Record<string, string[]>;
      }>;
      const firstErr = axiosErr.response?.data?.errors
        ? Object.values(axiosErr.response.data.errors)[0]?.[0]
        : null;
      toast.error(
        firstErr ||
          axiosErr.response?.data?.message ||
          "Gagal menyetujui laporan kinerja."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!showRejectBox) {
      setShowRejectBox(true);
      return;
    }

    if (!catatanRevisi.trim()) {
      toast.error("Catatan revisi wajib diisi apabila dokumen ditolak.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post(`/api/laporan-kinerja/${laporan.id}/approve`, {
        aksi: "tolak",
        catatan_revisi: catatanRevisi.trim(),
      });

      toast.success("Laporan dikembalikan ke staf untuk diperbaiki.");
      onSuccess();
      onClose();
    } catch (err) {
      const axiosErr = err as AxiosError<{
        message?: string;
        errors?: Record<string, string[]>;
      }>;
      const firstErr = axiosErr.response?.data?.errors
        ? Object.values(axiosErr.response.data.errors)[0]?.[0]
        : null;
      toast.error(
        firstErr ||
          axiosErr.response?.data?.message ||
          "Gagal mengembalikan laporan untuk revisi."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-pimpinan-title"
    >
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0f172a] via-blue-950 to-[#0D47A1] text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#FBC02D]" />
            </div>
            <div className="min-w-0">
              <h2
                id="approval-pimpinan-title"
                className="text-sm sm:text-base font-bold truncate"
              >
                Review &amp; Persetujuan Pimpinan
              </h2>
              <p className="text-[11px] text-blue-100 truncate">
                Periksa rincian laporan staf (Read-Only) lalu bubuhkan tanda tangan persetujuan.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Read-Only */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-50/70">
          {/* 1. Identitas Laporan */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-[#0D47A1]">
              <ClipboardList className="w-4 h-4" />
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                Identitas Laporan
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
                <span className="text-[11px] text-slate-500 block">
                  Unit Kerja
                </span>
                <strong className="text-slate-900 flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-[#0D47A1]" />
                  {sanitizePlainText(
                    laporan.unit_kerja?.nama_unit ||
                      laporan.identitas_laporan?.nama_unit ||
                      "Unit Kerja"
                  )}
                </strong>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
                <span className="text-[11px] text-slate-500 block">
                  Periode &amp; Bulan
                </span>
                <strong className="text-slate-900 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-[#FBC02D]" />
                  {sanitizePlainText(
                    laporan.periode_akademik?.nama_periode || "-"
                  )}
                  {laporan.bulan_laporan
                    ? ` • Bulan ${sanitizePlainText(laporan.bulan_laporan)}`
                    : ""}
                </strong>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
                <span className="text-[11px] text-slate-500 block">
                  Penanggung Jawab
                </span>
                <strong className="text-slate-900 block mt-0.5">
                  {sanitizePlainText(
                    laporan.identitas_laporan?.penanggung_jawab ||
                      laporan.nama_penandatangan ||
                      "-"
                  )}
                </strong>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
                <span className="text-[11px] text-slate-500 block">
                  Penyusun (Staf)
                </span>
                <strong className="text-slate-900 block mt-0.5">
                  {sanitizePlainText(
                    laporan.identitas_laporan?.penyusun || "-"
                  )}
                </strong>
              </div>
            </div>

            {(laporan.ttd_penyusun_path || laporan.ttd_image_path) && (
              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Tanda tangan penyusun (staf) sudah terlampir</span>
                </span>
              </div>
            )}
          </section>

          {/* 2. Tabel Pembahasan */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-slate-800">
              <FileText className="w-4 h-4 text-[#0D47A1]" />
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                Pembahasan &amp; Realisasi Kinerja
              </h3>
            </div>

            {pembahasanList.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <th className="py-2.5 px-3 font-bold w-10">No</th>
                      <th className="py-2.5 px-3 font-bold">Aspek</th>
                      <th className="py-2.5 px-3 font-bold">Realisasi</th>
                      <th className="py-2.5 px-3 font-bold">Analisis</th>
                      <th className="py-2.5 px-3 font-bold">Bukti</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pembahasanList.map((row, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="py-2.5 px-3 font-semibold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {sanitizePlainText(row.aspek || "-")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 whitespace-pre-line">
                          {sanitizePlainText(row.realisasi || "-")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-pre-line">
                          {sanitizePlainText(row.analisis || "-")}
                        </td>
                        <td className="py-2.5 px-3">
                          {row.link ? (
                            <a
                              href={row.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#0D47A1] hover:underline font-semibold"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Link</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-700 space-y-1">
                <p className="font-bold text-slate-900">
                  {sanitizePlainText(laporan.nama_kegiatan || "-")}
                </p>
                <p className="whitespace-pre-line">
                  {sanitizePlainText(laporan.uraian || "Tidak ada uraian.")}
                </p>
              </div>
            )}
          </section>

          {/* 3. Tabel Kendala */}
          {kendalaList.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                  Kendala / Hambatan
                </h3>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-rose-50/80 text-rose-900 border-b border-slate-200">
                      <th className="py-2.5 px-3 font-bold w-10">No</th>
                      <th className="py-2.5 px-3 font-bold">Kendala</th>
                      <th className="py-2.5 px-3 font-bold">Penyebab</th>
                      <th className="py-2.5 px-3 font-bold">Dampak</th>
                      <th className="py-2.5 px-3 font-bold">Upaya</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kendalaList.map((row, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="py-2.5 px-3 font-semibold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {sanitizePlainText(row.kendala || "-")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {sanitizePlainText(row.penyebab || "-")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {sanitizePlainText(row.dampak || "-")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {sanitizePlainText(row.upaya || "-")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 4. Tabel Dukungan */}
          {dukunganList.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-800">
                Dukungan yang Dibutuhkan
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-amber-50/80 text-amber-900 border-b border-slate-200">
                      <th className="py-2.5 px-3 font-bold w-10">No</th>
                      <th className="py-2.5 px-3 font-bold">Jenis</th>
                      <th className="py-2.5 px-3 font-bold">Bentuk</th>
                      <th className="py-2.5 px-3 font-bold">Pihak Terkait</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dukunganList.map((row, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="py-2.5 px-3 font-semibold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {sanitizePlainText(row.jenis || "-")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {sanitizePlainText(row.bentuk || "-")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {sanitizePlainText(row.pihak || "-")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 5. Tabel Tindak Lanjut */}
          {tindakLanjutList.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-800">
                Rencana Tindak Lanjut
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-emerald-50/80 text-emerald-900 border-b border-slate-200">
                      <th className="py-2.5 px-3 font-bold w-10">No</th>
                      <th className="py-2.5 px-3 font-bold">Solusi</th>
                      <th className="py-2.5 px-3 font-bold">PIC</th>
                      <th className="py-2.5 px-3 font-bold">Target</th>
                      <th className="py-2.5 px-3 font-bold">Indikator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tindakLanjutList.map((row, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="py-2.5 px-3 font-semibold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {sanitizePlainText(row.solusi || "-")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {sanitizePlainText(row.pic || "-")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {sanitizePlainText(row.target || "-")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {sanitizePlainText(row.indikator || "-")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 6. Kesimpulan & Rekomendasi */}
          {(laporan.kesimpulan || laporan.rekomendasi) && (
            <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 text-indigo-700">
                <Lightbulb className="w-4 h-4" />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                  Kesimpulan &amp; Rekomendasi
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <p className="font-bold text-slate-800 mb-1">Kesimpulan</p>
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                    {sanitizePlainText(laporan.kesimpulan || "-")}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <p className="font-bold text-slate-800 mb-1">Rekomendasi</p>
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                    {sanitizePlainText(laporan.rekomendasi || "-")}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* 7. Tanda Tangan Pimpinan */}
          <section className="bg-white rounded-2xl border border-blue-200 p-5 shadow-2xs">
            <SignaturePadField
              label="Tanda Tangan Pimpinan Unit Kerja"
              helperText="Wajib diisi apabila Anda menyetujui dokumen ini untuk diteruskan ke Admin."
              onChange={setSignature}
              required
            />
          </section>

          {/* 8. Kotak Catatan Revisi (jika Tolak/Revisi ditekan) */}
          {showRejectBox && (
            <section className="bg-red-50 rounded-2xl border border-red-200 p-5 space-y-2">
              <label className="block text-xs font-bold text-red-900">
                Catatan Revisi untuk Staf <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={3}
                value={catatanRevisi}
                onChange={(e) => setCatatanRevisi(e.target.value)}
                placeholder="Jelaskan bagian mana yang perlu diperbaiki oleh staf penyusun..."
                className="w-full rounded-xl border border-red-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/25 focus:border-red-500"
              />
            </section>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            Tutup
          </button>

          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              onClick={handleReject}
              disabled={isSubmitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-60"
            >
              {isSubmitting && showRejectBox ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              <span>
                {showRejectBox ? "Kirim Revisi ke Staf" : "Tolak / Revisi"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleApprove}
              disabled={isSubmitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer disabled:opacity-60"
            >
              {isSubmitting && !showRejectBox ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Setujui Dokumen</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
