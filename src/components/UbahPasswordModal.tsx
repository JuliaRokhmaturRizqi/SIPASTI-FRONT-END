"use client";

import React, { useEffect, useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";

export interface UbahPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UbahPasswordModal({
  isOpen,
  onClose,
}: UbahPasswordModalProps) {
  const [passwordLama, setPasswordLama] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [passwordBaruConfirmation, setPasswordBaruConfirmation] = useState("");

  const [showLama, setShowLama] = useState(false);
  const [showBaru, setShowBaru] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetFields = () => {
    setPasswordLama("");
    setPasswordBaru("");
    setPasswordBaruConfirmation("");
    setShowLama(false);
    setShowBaru(false);
    setShowConfirm(false);
    setErrorMessage(null);
  };

  useEffect(() => {
    if (isOpen) {
      resetFields();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    if (!passwordLama || !passwordBaru || !passwordBaruConfirmation) {
      const msg = "Seluruh kolom password wajib diisi.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (passwordBaru.length < 6) {
      const msg = "Password baru minimal 6 karakter.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (passwordBaru !== passwordBaruConfirmation) {
      const msg = "Konfirmasi password baru tidak cocok.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post("/api/ubah-password", {
        password_lama: passwordLama,
        password_baru: passwordBaru,
        password_baru_confirmation: passwordBaruConfirmation,
      });

      toast.success("Password berhasil diubah");
      resetFields();
      onClose();
    } catch (err) {
      const axiosErr = err as AxiosError<{
        message?: string;
        errors?: Record<string, string[]>;
      }>;
      const firstValidationMsg = axiosErr.response?.data?.errors
        ? Object.values(axiosErr.response.data.errors)[0]?.[0]
        : null;
      const serverMsg =
        firstValidationMsg ||
        axiosErr.response?.data?.message ||
        (axiosErr.response?.status === 400
          ? "Password lama yang Anda masukkan salah."
          : "Gagal mengubah password. Silakan coba lagi.");

      setErrorMessage(serverMsg);
      toast.error(serverMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ubah-password-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white text-slate-900 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-[#0f172a] via-blue-950 to-[#0D47A1] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4 text-[#FBC02D]" />
            </div>
            <div>
              <h3 id="ubah-password-modal-title" className="font-bold text-base">
                Ubah Password Akun
              </h3>
              <p className="text-[11px] text-blue-100">
                Perbarui kata sandi Anda secara berkala untuk keamanan akun.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-red-800 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="font-semibold leading-relaxed">
                {errorMessage}
              </span>
            </div>
          )}

          {/* Password Lama */}
          <div>
            <label
              htmlFor="input-password-lama"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Password Lama <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-password-lama"
                type={showLama ? "text" : "password"}
                required
                disabled={isSubmitting}
                value={passwordLama}
                onChange={(e) => setPasswordLama(e.target.value)}
                placeholder="Masukkan password saat ini"
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowLama((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="Toggle lihat password lama"
              >
                {showLama ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Password Baru */}
          <div>
            <label
              htmlFor="input-password-baru"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Password Baru <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-password-baru"
                type={showBaru ? "text" : "password"}
                required
                minLength={6}
                disabled={isSubmitting}
                value={passwordBaru}
                onChange={(e) => setPasswordBaru(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowBaru((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="Toggle lihat password baru"
              >
                {showBaru ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Konfirmasi Password Baru */}
          <div>
            <label
              htmlFor="input-password-konfirmasi"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Konfirmasi Password Baru <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-password-konfirmasi"
                type={showConfirm ? "text" : "password"}
                required
                minLength={6}
                disabled={isSubmitting}
                value={passwordBaruConfirmation}
                onChange={(e) => setPasswordBaruConfirmation(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="Toggle lihat konfirmasi password baru"
              >
                {showConfirm ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-100">
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
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] text-white text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#FBC02D]" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#FBC02D]" />
                  <span>Simpan Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
