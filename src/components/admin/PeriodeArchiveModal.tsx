"use client";

import React from "react";
import { AlertTriangle, Archive, Loader2, X } from "lucide-react";
import { sanitizePlainText } from "@/lib/security";
import { PeriodeItem } from "./PeriodeFormModal";

interface PeriodeArchiveModalProps {
  isOpen: boolean;
  targetPeriode: PeriodeItem | null;
  isProcessing?: boolean;
  onClose: () => void;
  onConfirmArchive: (periode: PeriodeItem) => Promise<void> | void;
}

export default function PeriodeArchiveModal({
  isOpen,
  targetPeriode,
  isProcessing = false,
  onClose,
  onConfirmArchive,
}: PeriodeArchiveModalProps) {
  if (!isOpen || !targetPeriode) return null;

  const safeNamaPeriode = sanitizePlainText(targetPeriode.namaPeriode);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="modal-archive-title"
      aria-describedby="modal-archive-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-sm transition-opacity"
    >
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header Peringatan Elegan */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3
                id="modal-archive-title"
                className="text-sm sm:text-base font-bold text-white"
              >
                Proteksi Integritas Data
              </h3>
              <p className="text-[11px] text-white/90">
                Periode: {safeNamaPeriode}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="text-white/80 hover:text-white p-1 rounded-lg transition cursor-pointer disabled:opacity-40"
            aria-label="Tutup dialog konfirmasi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Konten Pesan Konfirmasi */}
        <div className="p-6 space-y-5">
          <div className="rounded-xl bg-amber-50/80 border border-amber-200/90 p-4 flex items-start gap-3">
            <Archive className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <p
              id="modal-archive-desc"
              className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium"
            >
              Periode ini sudah memiliki data pelaporan. Apakah Anda ingin
              mengarsipkannya saja?
            </p>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Mengarsipkan periode{" "}
            <strong className="text-slate-700">{safeNamaPeriode}</strong> akan
            mengunci perubahan dokumen baru sekaligus menjaga seluruh riwayat
            berkas PDF Program Studi tetap aman dan tersimpan di database.
          </p>

          {/* Tombol Aksi: Batal & Ya, Arsipkan */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onConfirmArchive(targetPeriode)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-xs sm:text-sm font-semibold text-white shadow-md shadow-amber-900/15 transition cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengarsipkan...</span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  <span>Ya, Arsipkan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
