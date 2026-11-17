"use client";

import React, { useEffect, useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";

export interface UnitKerjaOption {
  id: number;
  nama_unit: string;
  kategori_unit: string;
  kategori?: {
    id: number;
    nama_kategori: string;
  } | null;
}

export interface AkunUnitEditTarget {
  id: number;
  username: string;
  id_unit_kerja: number;
  jabatan?: "staf" | "pimpinan" | string;
  status_akses?: "aktif" | "suspend" | string;
  is_active: boolean;
}

export interface TambahAkunModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  unitList: UnitKerjaOption[];
  editTarget?: AkunUnitEditTarget | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TambahAkunModal({
  isOpen,
  mode,
  unitList,
  editTarget = null,
  onClose,
  onSuccess,
}: TambahAkunModalProps) {
  const [idUnitKerja, setIdUnitKerja] = useState<string>("");
  const [jabatan, setJabatan] = useState<"staf" | "pimpinan">("staf");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [statusAkses, setStatusAkses] = useState<"aktif" | "suspend">("aktif");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setShowPassword(false);

    if (mode === "edit" && editTarget) {
      setIdUnitKerja(String(editTarget.id_unit_kerja || ""));
      setJabatan(
        editTarget.jabatan === "pimpinan" ? "pimpinan" : "staf"
      );
      setUsername(editTarget.username || "");
      setPassword("");
      const isSuspended =
        editTarget.status_akses === "suspend" || !editTarget.is_active;
      setStatusAkses(isSuspended ? "suspend" : "aktif");
    } else {
      setIdUnitKerja(unitList.length > 0 ? String(unitList[0].id) : "");
      setJabatan("staf");
      setUsername("");
      setPassword("");
      setStatusAkses("aktif");
    }
  }, [isOpen, mode, editTarget, unitList]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    if (!idUnitKerja) {
      const msg = "Nama Unit Kerja wajib dipilih.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (!username.trim()) {
      const msg = "Username wajib diisi.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (mode === "create" && password.trim().length > 0 && password.trim().length < 6) {
      const msg = "Password minimal 6 karakter.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "create") {
        const payload: {
          id_unit_kerja: number;
          jabatan: "staf" | "pimpinan";
          username: string;
          password?: string;
        } = {
          id_unit_kerja: Number(idUnitKerja),
          jabatan,
          username: username.trim(),
        };

        if (password.trim()) {
          payload.password = password.trim();
        }

        const res = await apiClient.post("/api/akun-unit", payload);
        toast.success(
          res.data?.message || "Akun unit kerja berhasil dibuat!"
        );
      } else if (editTarget) {
        const payload: {
          id_unit_kerja: number;
          jabatan: "staf" | "pimpinan";
          username: string;
          status_akses: "aktif" | "suspend";
          is_active: boolean;
          password?: string;
        } = {
          id_unit_kerja: Number(idUnitKerja),
          jabatan,
          username: username.trim(),
          status_akses: statusAkses,
          is_active: statusAkses === "aktif",
        };

        if (password.trim()) {
          payload.password = password.trim();
        }

        const res = await apiClient.put(
          `/api/akun-unit/${editTarget.id}`,
          payload
        );
        toast.success(
          res.data?.message || "Data akun unit kerja berhasil diperbarui!"
        );
      }

      onSuccess();
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
        "Gagal menyimpan akun unit kerja. Periksa kembali isian Anda.";

      setErrorMessage(serverMsg);
      toast.error(serverMsg, {
        duration: 5000,
        style: {
          background: "#fef2f2",
          color: "#991b1b",
          border: "1px solid #fecaca",
          fontWeight: 600,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tambah-akun-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-[#0f172a] via-blue-950 to-[#0D47A1] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4 text-[#FBC02D]" />
            </div>
            <div>
              <h3 id="tambah-akun-modal-title" className="font-bold text-base">
                {mode === "create"
                  ? "Tambah Akun Unit Kerja"
                  : "Edit Akun Unit Kerja"}
              </h3>
              <p className="text-[11px] text-blue-100">
                Role akun ditentukan otomatis oleh sistem sesuai kategori unit.
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
              <div className="font-semibold leading-relaxed">
                {errorMessage}
              </div>
            </div>
          )}

          {/* Dropdown Unit Kerja */}
          <div>
            <label
              htmlFor="modal-unit-kerja"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Nama Unit Kerja <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="modal-unit-kerja"
                required
                disabled={isSubmitting || unitList.length === 0}
                value={idUnitKerja}
                onChange={(e) => setIdUnitKerja(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-9 py-2.5 text-sm font-semibold text-slate-800 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none appearance-none cursor-pointer transition"
              >
                <option value="" disabled>
                  -- Pilih Unit Kerja --
                </option>
                {unitList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nama_unit} (
                    {u.kategori?.nama_kategori || u.kategori_unit})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Dropdown Jabatan */}
          <div>
            <label
              htmlFor="modal-jabatan"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Jabatan <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="modal-jabatan"
                required
                disabled={isSubmitting}
                value={jabatan}
                onChange={(e) =>
                  setJabatan(e.target.value as "staf" | "pimpinan")
                }
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-9 py-2.5 text-sm font-semibold text-slate-800 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none appearance-none cursor-pointer transition"
              >
                <option value="staf">Staf</option>
                <option value="pimpinan">Pimpinan</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Setiap unit kerja hanya diperbolehkan memiliki maksimal{" "}
              <strong>1 akun Pimpinan</strong>.
            </p>
          </div>

          {/* Input Username */}
          <div>
            <label
              htmlFor="modal-username"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Username <span className="text-red-500">*</span>
            </label>
            <input
              id="modal-username"
              type="text"
              required
              disabled={isSubmitting}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: staf_bau atau pimpinan_bau"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none transition"
            />
          </div>

          {/* Input Password */}
          <div>
            <label
              htmlFor="modal-password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Password{" "}
              {mode === "edit" ? (
                <span className="font-normal normal-case text-slate-500">
                  (Kosongkan jika tidak ingin mengubah)
                </span>
              ) : (
                <span className="font-normal normal-case text-slate-500">
                  (Opsional, default: Unuha2026!)
                </span>
              )}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="modal-password"
                type={showPassword ? "text" : "password"}
                disabled={isSubmitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "edit"
                    ? "Masukkan password baru (min. 6 karakter)"
                    : "Kosongkan untuk password default Unuha2026!"
                }
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Dropdown Status Akses (Khusus Mode Edit) */}
          {mode === "edit" && (
            <div>
              <label
                htmlFor="modal-status-akses"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Status Akses
              </label>
              <div className="relative">
                <select
                  id="modal-status-akses"
                  disabled={isSubmitting}
                  value={statusAkses}
                  onChange={(e) =>
                    setStatusAkses(e.target.value as "aktif" | "suspend")
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 pr-9 py-2.5 text-sm font-semibold text-slate-800 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none appearance-none cursor-pointer transition"
                >
                  <option value="aktif">Aktif (Diizinkan Login)</option>
                  <option value="suspend">Suspend (Blokir Akses)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

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
                  <span>Simpan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
