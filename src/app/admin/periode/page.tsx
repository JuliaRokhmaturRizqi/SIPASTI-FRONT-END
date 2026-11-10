"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import {
  CheckCircle2,
  Loader2,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
import { AuthUser } from "@/types/auth";
import { PeriodeListResponse } from "@/types/dokumen";
import AdminSidebar from "@/components/admin/AdminSidebar";
import PeriodeFormModal, {
  PeriodeItem,
  PeriodeStatus,
} from "@/components/admin/PeriodeFormModal";
import PeriodeArchiveModal from "@/components/admin/PeriodeArchiveModal";

interface PeriodeGridItem extends PeriodeItem {
  status_pelaporan?: string;
  is_default?: boolean;
  dokumen_count?: number;
}

interface ToastNotification {
  id: number;
  type: "success" | "info";
  title: string;
  message: string;
}

export default function ManajemenPeriodePage() {
  const router = useRouter();

  // State Otorisasi & Profil Admin
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State Daftar Periode Akademik Dinamis dari Server
  const [periodeList, setPeriodeList] = useState<PeriodeGridItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // State Modal Form (Tambah / Edit)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedPeriodeForEdit, setSelectedPeriodeForEdit] =
    useState<PeriodeItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // State Modal Konfirmasi Hapus / Arsip
  const [periodeToArchive, setPeriodeToArchive] =
    useState<PeriodeItem | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // State Toast Notification
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const pushToast = useCallback(
    (type: ToastNotification["type"], title: string, message: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [
        ...prev,
        {
          id,
          type,
          title: sanitizePlainText(title),
          message: sanitizePlainText(message),
        },
      ]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 4000);
    },
    []
  );

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  /**
   * Mengambil data seluruh periode akademik secara dinamis dari API backend
   */
  const fetchPeriodeList = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<PeriodeListResponse>("/api/periode");
      const records = res.data?.data || [];

      const mapped: PeriodeGridItem[] = records.map((p: any) => {
        const isActive = Boolean(p.status_aktif === true || p.status_aktif === 1);
        let status: PeriodeStatus = "Nonaktif";
        if (isActive) {
          status = "Aktif";
        } else if (p.status_pelaporan === "Diarsipkan") {
          status = "Diarsipkan";
        }

        return {
          id: p.id,
          namaPeriode: p.nama_periode,
          status,
          status_pelaporan: p.status_pelaporan,
          is_default: Boolean(p.is_default),
          dokumen_count: p.dokumen_pelaporan_count || 0,
        };
      });

      setPeriodeList(mapped);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      pushToast(
        "info",
        "Gagal Memuat Periode",
        axiosErr.response?.data?.message || "Gagal mengambil daftar periode dari server."
      );
    } finally {
      setIsLoading(false);
    }
  }, [pushToast]);

  /**
   * Route Protection: Pastikan hanya dapat diakses oleh role === 'admin'
   */
  useEffect(() => {
    let isMounted = true;

    const verifyAdminAccess = async () => {
      const session = getAuthSession();
      if (!session.token || session.role !== "admin") {
        handleUnauthorizedExit();
        return;
      }

      if (session.user) {
        setUser(session.user);
      }

      try {
        const meRes = await apiClient.get<{ status: string; data: AuthUser }>("/api/me");

        const verifiedUser = meRes.data?.data;
        if (!verifiedUser || verifiedUser.role !== "admin") {
          handleUnauthorizedExit();
          return;
        }

        if (isMounted) {
          setUser(verifiedUser);
          setIsAuthorized(true);
          setIsCheckingAuth(false);
        }

        await fetchPeriodeList();
      } catch (err) {
        const axiosErr = err as AxiosError;
        const status = axiosErr.response?.status;
        if (status === 401 || status === 403 || !axiosErr.response) {
          handleUnauthorizedExit();
        }
      }
    };

    verifyAdminAccess();

    return () => {
      isMounted = false;
    };
  }, [handleUnauthorizedExit, fetchPeriodeList]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutSession();
    } catch {
      clearAuthSession();
    } finally {
      router.replace("/login");
    }
  };

  /**
   * Membuka Modal Tambah Periode Baru
   */
  const handleOpenCreateModal = () => {
    setFormMode("create");
    setSelectedPeriodeForEdit(null);
    setIsFormModalOpen(true);
  };

  /**
   * Membuka Modal Edit Periode
   */
  const handleOpenEditModal = (periode: PeriodeItem) => {
    setFormMode("edit");
    setSelectedPeriodeForEdit(periode);
    setIsFormModalOpen(true);
  };

  /**
   * Membuka Modal Konfirmasi Arsip saat tombol Hapus/Arsip diklik
   */
  const handleOpenArchiveModal = (periode: PeriodeItem) => {
    setPeriodeToArchive(periode);
  };

  /**
   * Handler Simpan Periode (Tambah / Edit) ke Backend API
   */
  const handleSave = async (payload: {
    id?: number;
    namaPeriode: string;
    isActiveNow: boolean;
  }) => {
    setIsSaving(true);
    try {
      const cleanNama = sanitizePlainText(payload.namaPeriode);

      if (formMode === "edit" && payload.id !== undefined) {
        await apiClient.put(`/api/periode/${payload.id}`, {
          nama_periode: cleanNama,
          status_aktif: payload.isActiveNow,
        });

        pushToast(
          "success",
          "Periode Diperbarui",
          payload.isActiveNow
            ? `Periode "${cleanNama}" berhasil disimpan dan berstatus Buka/Aktif.`
            : `Periode "${cleanNama}" berhasil disimpan dan berstatus Tutup/Nonaktif.`
        );
      } else {
        await apiClient.post("/api/periode", {
          nama_periode: cleanNama,
          status_aktif: payload.isActiveNow,
        });

        pushToast(
          "success",
          "Periode Ditambahkan",
          payload.isActiveNow
            ? `Periode "${cleanNama}" berhasil dibuat dan berstatus Buka/Aktif.`
            : `Periode "${cleanNama}" berhasil dibuat dan berstatus Tutup/Nonaktif.`
        );
      }

      setIsFormModalOpen(false);
      await fetchPeriodeList();
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; errors?: Record<string, string[]> }>;
      const msg = axiosErr.response?.data?.message || "Gagal menyimpan data periode akademik.";
      pushToast("info", "Terjadi Kesalahan", msg);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Toggle Cepat Status Aktif/Buka Langsung dari Baris Tabel
   */
  const handleToggleActive = async (periode: PeriodeItem) => {
    setTogglingId(periode.id);
    try {
      const res = await apiClient.patch<{ status: string; message: string; data: any }>(
        `/api/periode/${periode.id}/toggle-active`
      );

      const isNowActive = res.data?.data?.status_aktif;
      pushToast(
        "success",
        isNowActive ? "Periode Diaktifkan" : "Periode Dinonaktifkan",
        `Periode "${periode.namaPeriode}" berhasil ${
          isNowActive ? "diaktifkan (pelaporan dibuka)" : "dinonaktifkan (pelaporan ditutup)"
        }.`
      );

      await fetchPeriodeList();
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      pushToast(
        "info",
        "Gagal Mengubah Status",
        axiosErr.response?.data?.message || "Gagal mengubah status aktif periode."
      );
    } finally {
      setTogglingId(null);
    }
  };

  /**
   * Handler Konfirmasi Hapus / Arsip Periode
   */
  const handleArchive = async (target: PeriodeItem) => {
    setIsArchiving(true);
    try {
      const res = await apiClient.delete<{ status: string; message: string; data?: any }>(
        `/api/periode/${target.id}`
      );

      pushToast(
        "info",
        "Periode Dihapus",
        res.data?.message || `Periode "${target.namaPeriode}" berhasil dihapus secara permanen.`
      );

      setPeriodeToArchive(null);
      await fetchPeriodeList();
    } catch (err) {
      const axiosErr = err as AxiosError<{ status?: string; message?: string; data?: any }>;
      if (axiosErr.response?.status === 400) {
        // Backend mendeteksi relasi dokumen, status diubah menjadi Tutup
        pushToast(
          "info",
          "Proteksi Integritas Data",
          axiosErr.response.data?.message || `Periode memiliki dokumen tersimpan, status diubah menjadi Tutup.`
        );
        setPeriodeToArchive(null);
        await fetchPeriodeList();
      } else {
        pushToast(
          "info",
          "Gagal Menghapus Periode",
          axiosErr.response?.data?.message || "Terjadi kesalahan saat menghapus periode."
        );
      }
    } finally {
      setIsArchiving(false);
    }
  };

  /**
   * Helper Render Indikator Status (Badges):
   * - Aktif: bg-green-100 text-green-700 (dengan efek dot hijau kecil di sebelahnya)
   * - Nonaktif: bg-slate-100 text-slate-600
   * - Diarsipkan: bg-amber-100 text-amber-700
   */
  const renderStatusBadge = (status: PeriodeStatus) => {
    if (status === "Aktif") {
      return (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>Aktif</span>
        </span>
      );
    }

    if (status === "Diarsipkan") {
      return (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Diarsipkan</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span>Nonaktif</span>
      </span>
    );
  };

  if (isCheckingAuth || !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl px-8 py-7 flex flex-col items-center gap-3 max-w-sm w-full text-center">
          <div className="w-11 h-11 rounded-xl bg-blue-950 text-white flex items-center justify-center shadow-sm">
            <Loader2 className="w-5 h-5 animate-spin text-[#FBC02D]" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Memverifikasi Otoritas Administrator...
          </p>
          <p className="text-xs text-slate-500">
            Memuat modul Manajemen Periode Akademik.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Toast Notification Container */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xl backdrop-blur-md flex items-start gap-3 transition-all"
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <Sparkles className="w-5 h-5 text-[#0D47A1] shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs">
              <p className="font-bold text-slate-900">{toast.title}</p>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((item) => item.id !== toast.id))
              }
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Komponen Sidebar Admin (Selaras dengan Dashboard Admin) */}
      <AdminSidebar
        username={user?.username || "admin"}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      {/* Area Konten Utama di Sebelah Kanan */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Header & Aksi: Judul 'Manajemen Periode Akademik' & Tombol Solid '+ Tambah Periode' */}
        <header className="h-16 bg-white/70 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200/80 bg-white/80 text-slate-700 hover:bg-slate-100"
              aria-label="Buka navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">
                Manajemen Periode Akademik
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchPeriodeList()}
              disabled={isLoading}
              title="Muat ulang daftar periode"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#0D47A1] ${
                  isLoading ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">Sinkronkan</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-900 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-blue-900/15 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Tambah Periode</span>
            </button>
          </div>
        </header>

        {/* Konten Utama */}
        <main className="p-4 sm:p-8 space-y-6 max-w-6xl w-full mx-auto flex-1">
          {/* Tabel Data (Data Grid): bg-white, rounded-xl, shadow-sm */}
          <section
            aria-label="Tabel Daftar Periode Akademik"
            className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden"
          >
            {/* Sub-header Tabel yang Lembut & Harmonis */}
            <div className="px-6 py-5 bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Daftar Siklus Periode Pelaporan
                </h2>
                <p className="text-xs text-blue-50/90 mt-0.5">
                  Kelola status masa aktif pelaporan dokumen administrasi
                  Program Studi (Mendukung Multi-Periode Aktif).
                </p>
              </div>
              <span className="inline-flex items-center self-start sm:self-center px-3 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-xs border border-white/30 text-white">
                Total: {periodeList.length} Periode
              </span>
            </div>

            {/* Tabel Data */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-3.5 px-6 w-20">No</th>
                    <th className="py-3.5 px-6">Nama Periode</th>
                    <th className="py-3.5 px-6">Status & Aktivasi</th>
                    <th className="py-3.5 px-6 text-right w-36">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-[#0D47A1]" />
                          <span>Memuat daftar periode akademik...</span>
                        </div>
                      </td>
                    </tr>
                  ) : periodeList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500">
                        Belum ada periode akademik. Silakan klik tombol &apos;Tambah Periode&apos; di atas.
                      </td>
                    </tr>
                  ) : (
                    periodeList.map((periode, index) => {
                      const safeNama = sanitizePlainText(periode.namaPeriode);
                      const isToggling = togglingId === periode.id;
                      return (
                        <tr
                          key={periode.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-4 px-6 font-semibold text-slate-500">
                            {index + 1}
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-bold text-slate-900">
                              {safeNama}
                            </span>
                            {periode.is_default && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-[#0D47A1]">
                                Utama
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {renderStatusBadge(periode.status)}

                              {/* Toggle Cepat Aktif/Nonaktif */}
                              <button
                                type="button"
                                onClick={() => handleToggleActive(periode)}
                                disabled={isToggling}
                                title={
                                  periode.status === "Aktif"
                                    ? "Klik untuk menonaktifkan/tutup periode"
                                    : "Klik untuk mengaktifkan/buka periode"
                                }
                                aria-label={`Ubah status ${safeNama}`}
                                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/40 disabled:opacity-50 ${
                                  periode.status === "Aktif"
                                    ? "bg-emerald-600"
                                    : "bg-slate-300"
                                }`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                    periode.status === "Aktif"
                                      ? "translate-x-5"
                                      : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex items-center justify-end gap-2">
                              {/* Tombol Ikon Edit (Warna Biru) */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(periode)}
                                title={`Edit ${safeNama}`}
                                aria-label={`Edit periode ${safeNama}`}
                                className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200/80 transition cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              {/* Tombol Ikon Hapus/Arsip (Warna Merah) */}
                              <button
                                type="button"
                                onClick={() => handleOpenArchiveModal(periode)}
                                title={`Hapus atau Arsipkan ${safeNama}`}
                                aria-label={`Hapus atau Arsipkan periode ${safeNama}`}
                                className="p-2 rounded-lg text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200/80 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {/* Komponen Modular 1: Modal Form (Tambah / Edit Periode) */}
      <PeriodeFormModal
        isOpen={isFormModalOpen}
        mode={formMode}
        initialData={selectedPeriodeForEdit}
        isSubmitting={isSaving}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSave}
      />

      {/* Komponen Modular 2: Modal Konfirmasi Keamanan (Hapus -> Arsipkan) */}
      <PeriodeArchiveModal
        isOpen={Boolean(periodeToArchive)}
        targetPeriode={periodeToArchive}
        isProcessing={isArchiving}
        onClose={() => setPeriodeToArchive(null)}
        onConfirmArchive={handleArchive}
      />
    </div>
  );
}
