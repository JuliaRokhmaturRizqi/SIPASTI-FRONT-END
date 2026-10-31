"use client";

import React, { useEffect, useRef, useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FileUp,
  FolderPlus,
  Info,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import apiClient from "@/lib/axios";
import {
  formatFileSize,
  MAX_LAMPIRAN_PDF_SIZE_BYTES,
  MAX_PDF_SIZE_BYTES,
  sanitizePlainText,
  validatePdfFileSync,
  verifyPdfMagicBytes,
} from "@/lib/security";
import { ApiErrorResponse } from "@/types/auth";
import {
  DokumenUploadResponse,
  LampiranDokumenRecord,
  TahapDokumenNumber,
  TaskCardItem,
} from "@/types/dokumen";

/**
 * Item dalam antrean lampiranFiles (untuk Tahap 4: Yudisium & Transkrip)
 */
export interface QueuedLampiranItem {
  uid: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "success" | "failed";
  errorMessage?: string;
}

interface ProdiUploadModalProps {
  isOpen: boolean;
  targetTask: TaskCardItem | null;
  selectedPeriode: string;
  periodeLabel: string;
  onClose: () => void;
  onUploadSuccess: (
    uploadedData?: DokumenUploadResponse["data"]
  ) => Promise<void> | void;
  onLampiranDeleted?: () => Promise<void> | void;
}

export default function ProdiUploadModal({
  isOpen,
  targetTask,
  selectedPeriode,
  periodeLabel,
  onClose,
  onUploadSuccess,
  onLampiranDeleted,
}: ProdiUploadModalProps) {
  // State File Utama (Surat Pernyataan)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // State Khusus Tahap 4 (Multiple Attachments: Drag-and-Drop Ijazah/Transkrip)
  const [lampiranFiles, setLampiranFiles] = useState<QueuedLampiranItem[]>([]);
  const [existingLampiran, setExistingLampiran] = useState<
    LampiranDokumenRecord[]
  >([]);
  const [deletingLampiranId, setDeletingLampiranId] = useState<number | null>(
    null
  );
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const lampiranInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen && targetTask) {
      setSelectedFile(null);
      setInlineError(null);
      setIsUploading(false);
      setLampiranFiles([]);
      setExistingLampiran(targetTask.lampiran || []);
      setDeletingLampiranId(null);
      setIsDragActive(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (lampiranInputRef.current) {
        lampiranInputRef.current.value = "";
      }
    }
  }, [isOpen, targetTask]);

  if (!isOpen || !targetTask) return null;

  const tahapAktif: TahapDokumenNumber = targetTask.tahap;
  const isTahapYudisium = tahapAktif === 4;
  const safeJudul = sanitizePlainText(targetTask.judul);
  const safePeriode = sanitizePlainText(periodeLabel);

  /**
   * 1. Validasi saat memilih file utama (Surat Pernyataan - Maks 2MB, Wajib PDF)
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setInlineError(null);
    const file = e.target.files?.[0] || null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

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
   * 2. Validasi & Penambahan Multiple Files ke state lampiranFiles (Khusus Tahap 4: Maks 5MB per file, Wajib .pdf)
   */
  const processIncomingLampiranFiles = async (incomingList: FileList | File[]) => {
    setInlineError(null);
    const filesArray = Array.from(incomingList);
    if (filesArray.length === 0) return;

    const validNewItems: QueuedLampiranItem[] = [];

    for (const file of filesArray) {
      // Validasi Sinkron: Wajib .pdf & maksimal 5MB (5,242,880 bytes)
      const syncCheck = validatePdfFileSync(file, MAX_LAMPIRAN_PDF_SIZE_BYTES);
      if (!syncCheck.valid) {
        const errMsg = `${sanitizePlainText(file.name)}: ${
          syncCheck.error || "Wajib format .pdf dan maksimal 5MB per file."
        }`;
        toast.error(errMsg);
        continue;
      }

      // Validasi Magic Bytes (%PDF-)
      const isGenuinePdf = await verifyPdfMagicBytes(file);
      if (!isGenuinePdf) {
        toast.error(
          `${sanitizePlainText(file.name)}: Struktur biner bukan dokumen PDF yang sah.`
        );
        continue;
      }

      validNewItems.push({
        uid: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${file.name}`,
        file,
        progress: 0,
        status: "queued",
      });
    }

    if (validNewItems.length > 0) {
      setLampiranFiles((prev) => [...prev, ...validNewItems]);
    }
  };

  /**
   * Event Handlers Drag-and-Drop Area (Kompatibel penuh dengan API Drag-and-Drop & input multiple)
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processIncomingLampiranFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleLampiranInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      await processIncomingLampiranFiles(e.target.files);
      e.target.value = "";
    }
  };

  /**
   * Menghapus file dari antrean lampiranFiles sebelum di-submit
   */
  const handleRemoveFromQueue = (uid: string) => {
    if (isUploading) return;
    setLampiranFiles((prev) => prev.filter((item) => item.uid !== uid));
  };

  /**
   * Menghapus lampiran lama yang sudah tersimpan di database:
   * DELETE /api/dokumen/lampiran/{id_lampiran}
   */
  const handleDeleteExistingLampiran = async (lampiran: LampiranDokumenRecord) => {
    if (isUploading || deletingLampiranId !== null) return;

    const safeName = sanitizePlainText(lampiran.nama_file_asli);
    const confirmed = window.confirm(
      `Hapus lampiran "${safeName}" dari server?`
    );
    if (!confirmed) return;

    setDeletingLampiranId(lampiran.id);

    try {
      await apiClient.delete(`/api/dokumen/lampiran/${lampiran.id}`);

      setExistingLampiran((prev) =>
        prev.filter((item) => item.id !== lampiran.id)
      );
      toast.success(`Lampiran "${safeName}" berhasil dihapus.`);

      if (onLampiranDeleted) {
        await onLampiranDeleted();
      }
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const msg =
        axiosErr.response?.data?.message ||
        `Gagal menghapus lampiran "${safeName}".`;
      toast.error(sanitizePlainText(msg));
    } finally {
      setDeletingLampiranId(null);
    }
  };

  /**
   * Logika Upload Sekuensial (Satu per Satu):
   * a. Pertama: Upload file Surat Pernyataan ke POST /api/dokumen/upload dan ambil id dokumen dari response
   *    (Atau jika dokumen sudah ada saat Revisi/Review dan user hanya menambah lampiran baru, gunakan id dokumen yang ada).
   * b. Kedua: Looping array lampiranFiles dan upload satu per satu ke POST /api/dokumen/{id}/lampiran
   *    dengan indikator progress persentase per file.
   * c. Jika ada file lampiran yang gagal diunggah, jangan hentikan looping, tapi berikan badge 'Gagal' merah pada file tersebut.
   */
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isUploading) return;

    setInlineError(null);

    const mainFile = fileInputRef.current?.files?.[0] || selectedFile;
    const pendingLampiran = lampiranFiles.filter(
      (item) => item.status !== "success"
    );

    // Apabila dokumen belum pernah diunggah sebelumnya, Surat Pernyataan wajib dipilih
    const hasExistingDokumenId = Boolean(targetTask.id);
    if (!mainFile && (!isTahapYudisium || !hasExistingDokumenId || pendingLampiran.length === 0)) {
      const msg =
        "Silakan pilih berkas PDF Surat Pernyataan terlebih dahulu (maksimal 2MB).";
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    // Validasi ulang file Surat Pernyataan jika dipilih
    if (mainFile) {
      const syncCheck = validatePdfFileSync(mainFile, MAX_PDF_SIZE_BYTES);
      if (!syncCheck.valid) {
        const msg =
          syncCheck.error ||
          "Silakan pilih berkas PDF Surat Pernyataan yang valid (maksimal 2MB).";
        setInlineError(msg);
        toast.error(msg);
        return;
      }

      const isGenuinePdf = await verifyPdfMagicBytes(mainFile);
      if (!isGenuinePdf) {
        const msg =
          "Berkas ditolak! Struktur biner Surat Pernyataan bukan dokumen PDF yang sah.";
        setInlineError(msg);
        toast.error(msg);
        return;
      }
    }

    setIsUploading(true);

    try {
      let dokumenId: number | null = targetTask.id ?? null;
      let uploadedMainRecord: DokumenUploadResponse["data"] = undefined;

      // LANGKAH A: Upload file Surat Pernyataan ke POST /api/dokumen/upload
      if (mainFile) {
        const formData = new FormData();
        formData.append("dokumen", mainFile);
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

        uploadedMainRecord = response.data?.data;
        if (uploadedMainRecord?.id) {
          dokumenId = uploadedMainRecord.id;
        }
      }

      // LANGKAH B: Khusus Tahap 4, looping array lampiranFiles satu per satu secara sekuensial
      let failedAttachmentCount = 0;
      let successAttachmentCount = 0;

      if (isTahapYudisium && pendingLampiran.length > 0) {
        if (!dokumenId) {
          throw new Error(
            "ID Dokumen utama tidak ditemukan untuk mengaitkan file lampiran."
          );
        }

        for (const item of lampiranFiles) {
          if (item.status === "success") {
            continue;
          }

          // Tandai item sedang diunggah (uploading)
          setLampiranFiles((prev) =>
            prev.map((q) =>
              q.uid === item.uid
                ? { ...q, status: "uploading", progress: 5, errorMessage: undefined }
                : q
            )
          );

          try {
            const attachmentForm = new FormData();
            attachmentForm.append("file", item.file);
            attachmentForm.append("jenis_lampiran", "Ijazah / Transkrip");

            await apiClient.post(
              `/api/dokumen/${dokumenId}/lampiran`,
              attachmentForm,
              {
                headers: {
                  "Content-Type": "multipart/form-data",
                },
                onUploadProgress: (progressEvent) => {
                  const total = progressEvent.total || item.file.size;
                  const percent = Math.min(
                    99,
                    Math.round((progressEvent.loaded * 100) / total)
                  );
                  setLampiranFiles((prev) =>
                    prev.map((q) =>
                      q.uid === item.uid ? { ...q, progress: percent } : q
                    )
                  );
                },
              }
            );

            successAttachmentCount++;
            setLampiranFiles((prev) =>
              prev.map((q) =>
                q.uid === item.uid
                  ? { ...q, status: "success", progress: 100 }
                  : q
              )
            );
          } catch (lampiranErr) {
            // Jangan hentikan looping jika ada file lampiran yang gagal, berikan badge 'Gagal' merah
            failedAttachmentCount++;
            const axiosLampiranErr = lampiranErr as AxiosError<
              ApiErrorResponse & { errors?: Record<string, string[]> }
            >;
            const errText =
              axiosLampiranErr.response?.data?.errors?.file?.[0] ||
              axiosLampiranErr.response?.data?.message ||
              "Gagal mengunggah lampiran.";

            setLampiranFiles((prev) =>
              prev.map((q) =>
                q.uid === item.uid
                  ? {
                      ...q,
                      status: "failed",
                      progress: 0,
                      errorMessage: sanitizePlainText(errText),
                    }
                  : q
              )
            );
          }
        }
      }

      // Sinkronkan data dashboard di parent
      await onUploadSuccess(uploadedMainRecord);

      if (failedAttachmentCount > 0) {
        toast.error(
          `${failedAttachmentCount} file lampiran gagal diunggah. Periksa badge 'Gagal' merah pada daftar file.`
        );
      } else {
        toast.success(
          isTahapYudisium && successAttachmentCount > 0
            ? `Surat Pernyataan beserta ${successAttachmentCount} file lampiran Ijazah/Transkrip berhasil diunggah!`
            : `Dokumen ${safeJudul} berhasil diunggah dan sedang direview.`
        );
        onClose();
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
        (err instanceof Error
          ? err.message
          : "Gagal mengunggah dokumen. Pastikan format PDF sesuai ketentuan.");

      const safeErr = sanitizePlainText(backendErrorMsg);
      setInlineError(safeErr);
      toast.error(safeErr);
    } finally {
      setIsUploading(false);
    }
  };

  const canSubmit =
    !isUploading &&
    (Boolean(selectedFile) ||
      (isTahapYudisium &&
        Boolean(targetTask.id) &&
        lampiranFiles.some((f) => f.status !== "success")));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prodi-upload-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
    >
      <div
        className={`bg-white rounded-2xl border border-slate-200 shadow-2xl w-full overflow-hidden flex flex-col max-h-[92vh] ${
          isTahapYudisium ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/40 flex items-center justify-center">
              <FileUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3
                id="prodi-upload-modal-title"
                className="text-sm sm:text-base font-bold text-white"
              >
                {isTahapYudisium
                  ? "Upload Dokumen & Lampiran Yudisium"
                  : "Upload Dokumen PDF"}
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

        {/* Form Upload Scrollable Body */}
        <form
          onSubmit={handleUpload}
          className="p-6 space-y-5 overflow-y-auto flex-1"
          noValidate
        >
          {/* Informasi Aturan Validasi File */}
          <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 p-3.5 flex items-start gap-3 text-xs text-slate-700">
            <Info className="w-4 h-4 text-[#0D47A1] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">
                Ketentuan Unggah Dokumen:
              </p>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                <li>
                  <strong>Surat Pernyataan Utama:</strong> Wajib format{" "}
                  <strong className="text-slate-900">.pdf</strong>, maksimal{" "}
                  <strong className="text-slate-900">
                    2 MB ({formatFileSize(MAX_PDF_SIZE_BYTES)})
                  </strong>
                  .
                </li>
                {isTahapYudisium && (
                  <li>
                    <strong>Lampiran Pendukung (Ijazah/Transkrip):</strong>{" "}
                    Mendukung <em>Multiple Attachments</em> berformat{" "}
                    <strong className="text-slate-900">.pdf</strong>, maksimal{" "}
                    <strong className="text-slate-900">
                      5 MB ({formatFileSize(MAX_LAMPIRAN_PDF_SIZE_BYTES)})
                    </strong>{" "}
                    per file.
                  </li>
                )}
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

          {/* BAGIAN 1 (ATAS): Input File Tunggal untuk Surat Pernyataan */}
          <div>
            <label
              htmlFor="prodi-pdf-input"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
            >
              1. Berkas Utama: Surat Pernyataan (.PDF &bull; Maks 2MB)
              {isTahapYudisium && targetTask.id && (
                <span className="ml-1.5 font-normal text-slate-500 normal-case">
                  (Opsional jika hanya menambah lampiran baru)
                </span>
              )}
            </label>

            <label
              htmlFor="prodi-pdf-input"
              className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed p-5 text-center transition cursor-pointer ${
                selectedFile
                  ? "border-emerald-400 bg-emerald-50/40"
                  : inlineError
                  ? "border-red-300 bg-red-50/20"
                  : "border-slate-300 bg-slate-50/70 hover:bg-slate-100/70 hover:border-[#0D47A1]"
              }`}
            >
              <FileText
                className={`w-7 h-7 mb-1.5 ${
                  selectedFile ? "text-emerald-600" : "text-slate-400"
                }`}
              />
              {selectedFile ? (
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-bold text-emerald-900 break-all">
                    {sanitizePlainText(selectedFile.name)}
                  </p>
                  <p className="text-xs text-emerald-700 font-medium">
                    Ukuran: {formatFileSize(selectedFile.size)} &bull; Siap
                    Diunggah
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-semibold text-slate-700">
                    Klik untuk memilih berkas PDF Surat Pernyataan
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {targetTask.filePath
                      ? `Tersimpan saat ini: ${sanitizePlainText(
                          targetTask.filePath.split("/").pop() ||
                            targetTask.filePath
                        )}`
                      : "Hanya menerima format .pdf (Maks. 2 MB)"}
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

          {/* BAGIAN 2 (BAWAH - KHUSUS TAHAP 4): Multiple Attachments Drag-and-Drop & Manajemen Lampiran */}
          {isTahapYudisium && (
            <div className="space-y-4 pt-2 border-t border-slate-200/80">
              {/* Daftar File Lampiran Lama dari Database (Jika status Revisi/Review atau sudah pernah upload) */}
              {existingLampiran.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Lampiran Tersimpan di Server ({existingLampiran.length})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Klik ikon sampah untuk menghapus file lama
                    </span>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {existingLampiran.map((lamp) => {
                      const isDeleting = deletingLampiranId === lamp.id;
                      return (
                        <div
                          key={lamp.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200/90 px-3.5 py-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Paperclip className="w-4 h-4 text-[#0D47A1] shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-800 truncate">
                                {sanitizePlainText(lamp.nama_file_asli)}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {sanitizePlainText(
                                  lamp.jenis_lampiran || "Ijazah / Transkrip"
                                )}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isUploading || isDeleting}
                            onClick={() => handleDeleteExistingLampiran(lamp)}
                            title="Hapus lampiran dari database"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold transition cursor-pointer disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">Hapus</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Area Drag-and-Drop Multiple Attachments */}
              <div>
                <label
                  htmlFor="prodi-lampiran-dropzone"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                >
                  2. Lampiran Ijazah / Transkrip (Multiple PDF &bull; Maks 5MB /
                  File)
                </label>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => {
                    if (!isUploading) {
                      lampiranInputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (
                      (e.key === "Enter" || e.key === " ") &&
                      !isUploading
                    ) {
                      e.preventDefault();
                      lampiranInputRef.current?.click();
                    }
                  }}
                  className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed p-6 text-center transition cursor-pointer ${
                    isDragActive
                      ? "border-[#0D47A1] bg-blue-50/70 ring-2 ring-[#0D47A1]/20"
                      : "border-blue-300/90 bg-blue-50/30 hover:bg-blue-50/60 hover:border-[#0D47A1]"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#0D47A1]/10 text-[#0D47A1] flex items-center justify-center mb-2.5">
                    <FolderPlus className="w-5 h-5" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 max-w-md leading-relaxed">
                    Seret &amp; Lepas file Ijazah/Transkrip di sini, atau klik
                    untuk memilih file (Bisa pilih banyak file sekaligus).
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Hanya menerima format <strong>.pdf</strong> &bull; Maksimal{" "}
                    <strong>5 MB</strong> per file
                  </p>

                  <input
                    ref={lampiranInputRef}
                    id="prodi-lampiran-dropzone"
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    disabled={isUploading}
                    onChange={handleLampiranInputChange}
                    className="sr-only"
                  />
                </div>
              </div>

              {/* Daftar File yang Akan Diunggah (Antrean lampiranFiles + Progress Bar per File) */}
              {lampiranFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 uppercase tracking-wider">
                      Antrean Lampiran ({lampiranFiles.length} File)
                    </span>
                    {!isUploading && (
                      <button
                        type="button"
                        onClick={() => setLampiranFiles([])}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                      >
                        Bersihkan Antrean
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {lampiranFiles.map((item) => {
                      const safeName = sanitizePlainText(item.file.name);
                      return (
                        <div
                          key={item.uid}
                          className={`rounded-xl border p-3 text-xs space-y-2 transition ${
                            item.status === "failed"
                              ? "bg-red-50/70 border-red-200"
                              : item.status === "success"
                              ? "bg-emerald-50/60 border-emerald-200"
                              : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <FileText
                                className={`w-4 h-4 shrink-0 ${
                                  item.status === "failed"
                                    ? "text-red-600"
                                    : item.status === "success"
                                    ? "text-emerald-600"
                                    : "text-[#0D47A1]"
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-900 truncate">
                                  {safeName}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {formatFileSize(item.file.size)}
                                </p>
                              </div>
                            </div>

                            {/* Status Badge / Tombol Hapus dari Antrean */}
                            <div className="flex items-center gap-2 shrink-0">
                              {item.status === "uploading" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-[#0D47A1]">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  {item.progress}%
                                </span>
                              )}

                              {item.status === "success" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Terunggah
                                </span>
                              )}

                              {item.status === "failed" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                                  <XCircle className="w-3 h-3" />
                                  Gagal
                                </span>
                              )}

                              {!isUploading && item.status !== "success" && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromQueue(item.uid)}
                                  title="Hapus dari antrean"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 font-semibold transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">
                                    Hapus dari antrean
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Progress Bar per File */}
                          {(item.status === "uploading" ||
                            item.status === "success") && (
                            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-200 ${
                                  item.status === "success"
                                    ? "bg-emerald-500"
                                    : "bg-[#0D47A1]"
                                }`}
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          )}

                          {/* Pesan Error Spesifik File jika Gagal */}
                          {item.status === "failed" && item.errorMessage && (
                            <p className="text-[11px] text-red-700 font-medium">
                              {item.errorMessage}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tombol Aksi Modal */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
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
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-900 text-xs sm:text-sm font-semibold text-white shadow-md shadow-blue-900/15 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#FBC02D]" />
                  <span>Mengunggah Berkas...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>
                    {isTahapYudisium && lampiranFiles.length > 0
                      ? `Upload Dokumen & ${lampiranFiles.filter((f) => f.status !== "success").length} Lampiran`
                      : "Upload PDF"}
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
