"use client";

import React from "react";
import {
  FilePlus,
  Info,
  Save,
  X,
} from "lucide-react";
import { sanitizePlainText } from "@/lib/security";

export interface UnitLaporanModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPeriode?: string;
  periodeLabel?: string;
  namaUnit?: string;
  kategoriUnit?: string;
  onSuccess?: () => void;
}

export default function UnitLaporanModal({
  isOpen,
  onClose,
  selectedPeriode,
  periodeLabel = "Periode Berjalan",
  namaUnit = "Unit Kerja",
  kategoriUnit = "Unit",
}: UnitLaporanModalProps) {
  if (!isOpen) return null;

  const safePeriode = sanitizePlainText(periodeLabel);
  const safeNamaUnit = sanitizePlainText(namaUnit);
  const safeKategoriUnit = sanitizePlainText(kategoriUnit);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handler submit akan dihubungkan dengan form field lengkap di tahap berikutnya
    onClose();
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
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Panel dari sisi kanan */}
      <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] px-6 py-5 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner">
              <FilePlus className="w-5 h-5 text-[#FBC02D]" />
            </div>
            <div>
              <h3
                id="modal-laporan-title"
                className="text-base sm:text-lg font-bold text-white tracking-tight"
              >
                Form Laporan Kegiatan
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">
                {safeNamaUnit} &bull; Periode {safePeriode}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/75 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
            aria-label="Tutup form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Konten */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col justify-between"
        >
          <div className="space-y-5">
            {/* Informasi Awal */}
            <div className="rounded-xl bg-blue-50/80 border border-blue-200 p-4 flex items-start gap-3 text-xs text-slate-700">
              <Info className="w-4 h-4 text-[#0D47A1] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-slate-900">
                  Kerangka Panel Laporan Kinerja ({safeKategoriUnit})
                </p>
                <p className="leading-relaxed text-slate-600">
                  Panel pengisian laporan kegiatan unit kerja sedang disiapkan.
                  Di tahap selanjutnya, Anda dapat mengisi nama kegiatan,
                  uraian kinerja, kendala, dukungan, dan lampiran link bukti.
                </p>
              </div>
            </div>

            {/* Placeholder Form Area */}
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center space-y-2 bg-slate-50/50">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FilePlus className="w-6 h-6 text-[#0D47A1]" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">
                Area Pengisian Form Kegiatan
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Elemen form interaktif (Nama Kegiatan, Uraian, Kendala, Dukungan,
                dan Link Bukti) akan disematkan di sini pada tahap eksekusi
                berikutnya.
              </p>
            </div>
          </div>

          {/* Footer Aksi */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-900 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-900/15 transition cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#FBC02D]" />
              <span>Simpan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
