"use client";

import React, { useEffect, useRef, useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  FileText,
  FileUp,
  Info,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import {
  formatFileSize,
  MAX_PDF_SIZE_BYTES,
  sanitizePlainText,
  validatePdfFileSync,
  verifyPdfMagicBytes,
} from "@/lib/security";
import { ApiErrorResponse } from "@/types/auth";
import {
  DokumenUploadResponse,
  TahapDokumenNumber,
  TaskCardItem,
} from "@/types/dokumen";

interface ProdiUploadModalProps {
  isOpen: boolean;
  targetTask: TaskCardItem | null;
  selectedPeriode: string;
  periodeLabel: string;
  onClose: () => void;
  onUploadSuccess: (uploadedData?: DokumenUploadResponse["data"]) => Promise<void> | void;
}

export default function ProdiUploadModal({
  isOpen,
  targetTask,
  selectedPeriode,
  periodeLabel,
  onClose,
  onUploadSuccess,
}: ProdiUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setInlineError(null);
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen, targetTask]);

  if (!isOpen || !targetTask) return null;

  const tahapAktif: TahapDokumenNumber = targetTask.tahap;
  const safeJudul = sanitizePlainText(targetTask.judul);
  const safePeriode = sanitizePlainText(periodeLabel);

  /**
   * Validasi saat memilih file dari <input type="file">
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setInlineError(null);
    const file = e.target.files?.[0] || null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    // 1. Validasi Sinkron: Ekstensi .pdf, MIME application/pdf, dan Ukuran <= 2MB
    const syncCheck = validatePdfFileSync(file, MAX_PDF_SIZE_BYTES);
    if (!syncCheck.valid) {
      const msg =
        syncCheck.error ||
        "Berkas ditolak! Hanya menerima file PDF dengan ukuran maksimal 2MB.";
      setSelectedFile(null);
      setInlineError(msg);
      toast.error(msg);
      e.target.value = "";
      return;
    }

    // 2. Validasi Magic Bytes (%PDF-) untuk mencegah file palsu yang diganti ekstensi
    const isGenuinePdf = await verifyPdfMagicBytes(file);
    if (!isGenuinePdf) {
      const msg =
        "Berkas ditolak! Struktur biner berkas bukan dokumen PDF yang sah.";
      setSelectedFile(null);
      setInlineError(msg);
      toast.error(msg);
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  /**
   * Fungsi handleUpload(e):
   * - Tangkap file dari <input type="file">
   * - Lakukan validasi ulang di sisi klien (wajib PDF, max 2MB)
   * - Masukkan ke FormData: dokumen, id_periode, tahap_dokumen
   * - POST request via Axios ke /api/dokumen/upload dengan multipart/form-data
   */
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isUploading) return;

    setInlineError(null);

    // Tangkap file dari input ref atau state
    const file = fileInputRef.current?.files?.[0] || selectedFile;

    // Validasi ulang di sisi klien (wajib PDF, maksimal 2MB)
    const syncCheck = validatePdfFileSync(file, MAX_PDF_SIZE_BYTES);
    if (!syncCheck.valid || !file) {
      const msg =
        syncCheck.error ||
        "Silakan pilih berkas PDF yang valid (maksimal 2MB).";
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    const isGenuinePdf = await verifyPdfMagicBytes(file);
    if (!isGenuinePdf) {
      const msg =
        "Berkas ditolak! Struktur biner berkas bukan dokumen PDF yang sah.";
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("dokumen", file);
      formData.append("id_periode", String(selectedPeriode));
      formData.append("tahap_dokumen", String(tahapAktif));

      const response = await apiClient.post<DokumenUploadResponse>(
        "/api/dokumen/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.status === 200 || response.data?.status === "success") {
        toast.success(
          response.data?.message ||
            `Dokumen ${safeJudul} berhasil diunggah dan sedang direview.`
        );
        onClose();
        await onUploadSuccess(response.data?.data);
      }
    } catch (err) {
      const axiosErr = err as AxiosError<
        ApiErrorResponse & {
          errors?: Record<string, string[]>;
        }
      >;

      const backendErrorMsg =
        axiosErr.response?.data?.errors?.dokumen?.[0] ||
        axiosErr.response?.data?.errors?.file?.[0] ||
        axiosErr.response?.data?.errors?.id_periode?.[0] ||
        axiosErr.response?.data?.errors?.tahap_dokumen?.[0] ||
        axiosErr.response?.data?.message ||
        "Gagal mengunggah dokumen. Pastikan format PDF dan ukuran maksimal 2MB.";

      const safeErr = sanitizePlainText(backendErrorMsg);
      setInlineError(safeErr);
      toast.error(safeErr);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prodi-upload-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/40 flex items-center justify-center">
              <FileUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3
                id="prodi-upload-modal-title"
                className="text-sm sm:text-base font-bold text-white"
              >
                Upload Dokumen PDF
              </h3>
              <p className="text-[11px] text-blue-100">
                {safeJudul} &bull; Periode {safePeriode}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="text-white/75 hover:text-white p-1 rounded-lg transition cursor-pointer disabled:opacity-40"
            aria-label="Tutup modal upload"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Upload */}
        <form onSubmit={handleUpload} className="p-6 space-y-5" noValidate>
          {/* Informasi Aturan Validasi File */}
          <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 p-3.5 flex items-start gap-3 text-xs text-slate-700">
            <Info className="w-4 h-4 text-[#0D47A1] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">
                Ketentuan Unggah Dokumen:
              </p>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                <li>
                  Wajib berformat <strong className="text-slate-900">.pdf</strong>{" "}
                  (<code>application/pdf</code>).
                </li>
                <li>
                  Ukuran berkas maksimal{" "}
                  <strong className="text-slate-900">
                    2 MB ({formatFileSize(MAX_PDF_SIZE_BYTES)})
                  </strong>
                  .
                </li>
              </ul>
            </div>
          </div>

          {/* Inline Error Alert */}
          {inlineError && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-xs text-red-700"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{inlineError}</span>
            </div>
          )}

          {/* Area Pilih File PDF */}
          <div>
            <label
              htmlFor="prodi-pdf-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2"
            >
              Berkas Dokumen (.PDF)
            </label>

            <label
              htmlFor="prodi-pdf-input"
              className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed p-6 text-center transition cursor-pointer ${
                selectedFile
                  ? "border-emerald-400 bg-emerald-50/40"
                  : inlineError
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
                    Ukuran: {formatFileSize(selectedFile.size)} &bull; Siap
                    Diunggah
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-semibold text-slate-700">
                    Klik untuk memilih berkas PDF
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Hanya menerima format .pdf (Maks. 2 MB)
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                id="prodi-pdf-input"
                name="dokumen"
                type="file"
                accept="application/pdf,.pdf"
                disabled={isUploading}
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          </div>

          {/* Tombol Aksi Modal */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-900 text-xs sm:text-sm font-semibold text-white shadow-md shadow-blue-900/15 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#FBC02D]" />
                  <span>Mengunggah...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload PDF</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
