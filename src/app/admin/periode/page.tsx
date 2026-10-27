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
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
import { AuthUser } from "@/types/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import PeriodeFormModal, {
  PeriodeItem,
  PeriodeStatus,
} from "@/components/admin/PeriodeFormModal";
import PeriodeArchiveModal from "@/components/admin/PeriodeArchiveModal";

/**
 * State Dummy Data Awal Periode Akademik:
 * 1 Aktif, 1 Nonaktif, dan 1 Diarsipkan sesuai spesifikasi simulasi UX.
 */
const INITIAL_PERIODE_DATA: PeriodeItem[] = [
  {
    id: 1,
    namaPeriode: "2026/2027 Ganjil",
    status: "Aktif",
  },
  {
    id: 2,
    namaPeriode: "2026/2027 Genap",
    status: "Nonaktif",
  },
  {
    id: 3,
    namaPeriode: "2025/2026 Genap",
    status: "Diarsipkan",
  },
];

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

  // State Daftar Periode Akademik (Dummy + Client-side Interactive State)
  const [periodeList, setPeriodeList] =
    useState<PeriodeItem[]>(INITIAL_PERIODE_DATA);

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
        const meRes = await apiClient.get<{ status: string; data: AuthUser }>(
          "/me",
          {
            headers: {
              Authorization: `Bearer ${session.token}`,
            },
          }
        );

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
  }, [handleUnauthorizedExit]);

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
   * Handler Simpan Periode (Tambah / Edit)
   * Disiapkan untuk integrasi API (POST / PATCH /api/admin/periode-akademik)
   */
  const handleSave = async (payload: {
    id?: number;
    namaPeriode: string;
    isActiveNow: boolean;
  }) => {
    setIsSaving(true);
    try {
      // TODO: Integrasi API Backend nantinya:
      // await apiClient.post("/admin/periode-akademik", {
      //   nama_periode: payload.namaPeriode,
      //   status_aktif: payload.isActiveNow,
      // });

      const cleanNama = sanitizePlainText(payload.namaPeriode);

      setPeriodeList((prevList) => {
        // Jika toggle 'Jadikan Periode Aktif Sekarang' dinyalakan,
        // otomatis nonaktifkan periode lain yang sedang berstatus 'Aktif'
        const updatedBase = prevList.map((item) => {
          if (payload.isActiveNow && item.status === "Aktif") {
            return { ...item, status: "Nonaktif" as PeriodeStatus };
          }
          return item;
        });

        if (formMode === "edit" && payload.id !== undefined) {
          return updatedBase.map((item) => {
            if (item.id !== payload.id) return item;
            const nextStatus: PeriodeStatus = payload.isActiveNow
              ? "Aktif"
              : item.status === "Aktif"
              ? "Nonaktif"
              : item.status;

            return {
              ...item,
              namaPeriode: cleanNama,
              status: nextStatus,
            };
          });
        }

        // Mode Create (Tambah Periode Baru)
        const nextId =
          updatedBase.length > 0
            ? Math.max(...updatedBase.map((p) => p.id)) + 1
            : 1;

        const newItem: PeriodeItem = {
          id: nextId,
          namaPeriode: cleanNama,
          status: payload.isActiveNow ? "Aktif" : "Nonaktif",
        };

        return [newItem, ...updatedBase];
      });

      setIsFormModalOpen(false);
      pushToast(
        "success",
        formMode === "edit" ? "Periode Diperbarui" : "Periode Ditambahkan",
        payload.isActiveNow
          ? `Periode "${cleanNama}" disimpan sebagai Periode Aktif.`
          : `Periode "${cleanNama}" berhasil disimpan.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handler Konfirmasi Arsip Periode
   * Disiapkan untuk integrasi API (PATCH /api/admin/periode-akademik/{id}/archive)
   */
  const handleArchive = async (target: PeriodeItem) => {
    setIsArchiving(true);
    try {
      // TODO: Integrasi API Backend nantinya:
      // await apiClient.patch(`/admin/periode-akademik/${target.id}/archive`);

      setPeriodeList((prevList) =>
        prevList.map((item) =>
          item.id === target.id
            ? { ...item, status: "Diarsipkan" as PeriodeStatus }
            : item
        )
      );

      setPeriodeToArchive(null);
      pushToast(
        "info",
        "Periode Diarsipkan",
        `Periode "${target.namaPeriode}" telah dipindahkan ke status Diarsipkan demi menjaga integritas data pelaporan.`
      );
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

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-900 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-blue-900/15 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Tambah Periode</span>
          </button>
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
                  Program Studi.
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
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right w-36">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
                  {periodeList.map((periode, index) => {
                    const safeNama = sanitizePlainText(periode.namaPeriode);
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
                        </td>
                        <td className="py-4 px-6">
                          {renderStatusBadge(periode.status)}
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
                  })}
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
