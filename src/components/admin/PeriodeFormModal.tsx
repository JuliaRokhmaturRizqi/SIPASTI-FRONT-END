"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Calendar, Info, Loader2, X } from "lucide-react";
import { sanitizePlainText } from "@/lib/security";

export type PeriodeStatus = "Aktif" | "Nonaktif" | "Diarsipkan";

export interface PeriodeItem {
  id: number;
  namaPeriode: string;
  status: PeriodeStatus;
}

interface PeriodeFormModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  initialData: PeriodeItem | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSave: (payload: {
    id?: number;
    namaPeriode: string;
    isActiveNow: boolean;
  }) => Promise<void> | void;
}

export default function PeriodeFormModal({
  isOpen,
  mode,
  initialData,
  isSubmitting = false,
  onClose,
  onSave,
}: PeriodeFormModalProps) {
  const [namaPeriode, setNamaPeriode] = useState("");
  const [isActiveNow, setIsActiveNow] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && initialData) {
        setNamaPeriode(initialData.namaPeriode);
        setIsActiveNow(initialData.status === "Aktif");
      } else {
        setNamaPeriode("");
        setIsActiveNow(true);
      }
      setErrorMessage(null);
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanNama = sanitizePlainText(namaPeriode);
    if (!cleanNama) {
      setErrorMessage("Nama Periode wajib diisi.");
      return;
    }

    if (cleanNama.length < 4 || cleanNama.length > 50) {
      setErrorMessage("Nama Periode harus terdiri dari 4 hingga 50 karakter.");
      return;
    }

    setErrorMessage(null);
    await onSave({
      id: initialData?.id,
      namaPeriode: cleanNama,
      isActiveNow,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-periode-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-sm transition-opacity"
    >
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/40 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3
                id="modal-periode-title"
                className="text-sm sm:text-base font-bold text-white"
              >
                {mode === "edit"
                  ? "Edit Periode Akademik"
                  : "Tambah Periode Akademik"}
              </h3>
              <p className="text-[11px] text-blue-100">
                Konfigurasi siklus pelaporan administrasi SIPASTI
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/75 hover:text-white p-1 rounded-lg transition cursor-pointer disabled:opacity-40"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-xs text-red-700"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Input Text: Nama Periode */}
          <div>
            <label
              htmlFor="nama-periode-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2"
            >
              Nama Periode <span className="text-red-500">*</span>
            </label>
            <input
              id="nama-periode-input"
              type="text"
              required
              maxLength={50}
              disabled={isSubmitting}
              value={namaPeriode}
              onChange={(e) => {
                setNamaPeriode(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Contoh: 2026/2027 Ganjil"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:bg-white focus:border-[#0D47A1] focus:outline-none focus:ring-3 focus:ring-[#0D47A1]/15 disabled:opacity-60"
            />
          </div>

          {/* Toggle Switch UI: Jadikan Periode Aktif Sekarang */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-4">
              <label
                htmlFor="toggle-periode-aktif"
                className="text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer select-none"
              >
                Jadikan Periode Aktif Sekarang
              </label>

              <button
                id="toggle-periode-aktif"
                type="button"
                role="switch"
                aria-checked={isActiveNow}
                disabled={isSubmitting}
                onClick={() => setIsActiveNow((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/40 disabled:opacity-50 ${
                  isActiveNow ? "bg-[#0D47A1]" : "bg-slate-300"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isActiveNow ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Pesan Informasi Otomatis Saat Toggle Aktif */}
            {isActiveNow && (
              <div className="flex items-start gap-2 pt-1 text-[11px] text-amber-800 bg-amber-50/90 border border-amber-200/80 rounded-lg p-2.5">
                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Sistem akan otomatis menonaktifkan periode lain yang sedang
                  aktif
                </span>
              </div>
            )}
          </div>

          {/* Tombol Aksi Modal: Batal & Simpan */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-900 text-xs sm:text-sm font-semibold text-white shadow-md shadow-blue-900/15 transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#FBC02D]" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
