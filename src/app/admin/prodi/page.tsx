"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import {
  Building2,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Menu,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
import { AuthUser } from "@/types/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

export interface ProdiMasterItem {
  id: number;
  kodeProdi: string;
  namaProdi: string;
  jenjang: "S1" | "S2";
  fakultas: string;
  akunOperator: string;
  statusAktif: boolean;
}

/**
 * Daftar Resmi 14 Program Studi Universitas Nurul Huda
 */
const INITIAL_PRODI_UNUHA: ProdiMasterItem[] = [
  {
    id: 1,
    kodeProdi: "PAI-S1",
    namaProdi: "S1 Pendidikan Agama Islam",
    jenjang: "S1",
    fakultas: "Fakultas Agama Islam",
    akunOperator: "prodi_pai",
    statusAktif: true,
  },
  {
    id: 2,
    kodeProdi: "PGMI-S1",
    namaProdi: "S1 Pendidikan Guru Madrasah Ibtidaiyah",
    jenjang: "S1",
    fakultas: "Fakultas Agama Islam",
    akunOperator: "prodi_pgmi",
    statusAktif: true,
  },
  {
    id: 3,
    kodeProdi: "PBA-S1",
    namaProdi: "S1 Pendidikan Bahasa Arab",
    jenjang: "S1",
    fakultas: "Fakultas Agama Islam",
    akunOperator: "prodi_pba",
    statusAktif: true,
  },
  {
    id: 4,
    kodeProdi: "PBSI-S1",
    namaProdi: "S1 Pendidikan Bahasa dan Sastra Indonesia",
    jenjang: "S1",
    fakultas: "Fakultas Ilmu Pendidikan",
    akunOperator: "prodi_pbsi",
    statusAktif: true,
  },
  {
    id: 5,
    kodeProdi: "PBI-S1",
    namaProdi: "S1 Pendidikan Bahasa Inggris",
    jenjang: "S1",
    fakultas: "Fakultas Ilmu Pendidikan",
    akunOperator: "prodi_pbi",
    statusAktif: true,
  },
  {
    id: 6,
    kodeProdi: "PFIS-S1",
    namaProdi: "S1 Pendidikan Fisika",
    jenjang: "S1",
    fakultas: "Fakultas Ilmu Pendidikan",
    akunOperator: "prodi_pfis",
    statusAktif: true,
  },
  {
    id: 7,
    kodeProdi: "PEKO-S1",
    namaProdi: "S1 Pendidikan Ekonomi",
    jenjang: "S1",
    fakultas: "Fakultas Ilmu Pendidikan",
    akunOperator: "prodi_peko",
    statusAktif: true,
  },
  {
    id: 8,
    kodeProdi: "PTI-S1",
    namaProdi: "S1 Pendidikan Teknologi Informasi",
    jenjang: "S1",
    fakultas: "Fakultas Ilmu Pendidikan",
    akunOperator: "prodi_pti",
    statusAktif: true,
  },
  {
    id: 9,
    kodeProdi: "PKO-S1",
    namaProdi: "S1 Pelatihan Olahraga",
    jenjang: "S1",
    fakultas: "Fakultas Ilmu Pendidikan",
    akunOperator: "prodi_pko",
    statusAktif: true,
  },
  {
    id: 10,
    kodeProdi: "IF-S1",
    namaProdi: "S1 Informatika",
    jenjang: "S1",
    fakultas: "Fakultas Sains & Teknologi",
    akunOperator: "prodi_ti",
    statusAktif: true,
  },
  {
    id: 11,
    kodeProdi: "MAT-S1",
    namaProdi: "S1 Matematika",
    jenjang: "S1",
    fakultas: "Fakultas Sains & Teknologi",
    akunOperator: "prodi_mat",
    statusAktif: true,
  },
  {
    id: 12,
    kodeProdi: "SP-S1",
    namaProdi: "S1 Sains Pertanian",
    jenjang: "S1",
    fakultas: "Fakultas Sains & Teknologi",
    akunOperator: "prodi_sp",
    statusAktif: true,
  },
  {
    id: 13,
    kodeProdi: "PTN-S1",
    namaProdi: "S1 Peternakan",
    jenjang: "S1",
    fakultas: "Fakultas Sains & Teknologi",
    akunOperator: "prodi_ptn",
    statusAktif: true,
  },
  {
    id: 14,
    kodeProdi: "PAI-S2",
    namaProdi: "S2 Pendidikan Agama Islam",
    jenjang: "S2",
    fakultas: "Program Pascasarjana",
    akunOperator: "prodi_pais2",
    statusAktif: true,
  },
];

interface ToastNotification {
  id: number;
  type: "success" | "info";
  title: string;
  message: string;
}

export default function DataProdiAdminPage() {
  const router = useRouter();

  // State Otorisasi
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State Data Prodi & Pencarian
  const [prodiList, setProdiList] =
    useState<ProdiMasterItem[]>(INITIAL_PRODI_UNUHA);
  const [searchQuery, setSearchQuery] = useState("");

  // State Modal Tambah/Edit Prodi
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<ProdiMasterItem | null>(null);
  const [namaProdiInput, setNamaProdiInput] = useState("");
  const [kodeProdiInput, setKodeProdiInput] = useState("");
  const [jenjangInput, setJenjangInput] = useState<"S1" | "S2">("S1");
  const [fakultasInput, setFakultasInput] = useState("Fakultas Sains & Teknologi");
  const [operatorInput, setOperatorInput] = useState("");

  // State Toast
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

  const filteredProdi = useMemo(() => {
    const q = sanitizePlainText(searchQuery).toLowerCase();
    if (!q) return prodiList;
    return prodiList.filter(
      (item) =>
        item.namaProdi.toLowerCase().includes(q) ||
        item.kodeProdi.toLowerCase().includes(q) ||
        item.fakultas.toLowerCase().includes(q) ||
        item.akunOperator.toLowerCase().includes(q)
    );
  }, [prodiList, searchQuery]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingItem(null);
    setNamaProdiInput("");
    setKodeProdiInput("");
    setJenjangInput("S1");
    setFakultasInput("Fakultas Sains & Teknologi");
    setOperatorInput("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: ProdiMasterItem) => {
    setModalMode("edit");
    setEditingItem(item);
    setNamaProdiInput(item.namaProdi);
    setKodeProdiInput(item.kodeProdi);
    setJenjangInput(item.jenjang);
    setFakultasInput(item.fakultas);
    setOperatorInput(item.akunOperator);
    setIsModalOpen(true);
  };

  const handleSaveProdi = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanNama = sanitizePlainText(namaProdiInput);
    const cleanKode = sanitizePlainText(kodeProdiInput).toUpperCase();
    const cleanFakultas = sanitizePlainText(fakultasInput);
    const cleanOperator = sanitizePlainText(operatorInput).toLowerCase();

    if (!cleanNama || !cleanKode) return;

    if (modalMode === "edit" && editingItem) {
      setProdiList((prev) =>
        prev.map((p) =>
          p.id === editingItem.id
            ? {
                ...p,
                namaProdi: cleanNama,
                kodeProdi: cleanKode,
                jenjang: jenjangInput,
                fakultas: cleanFakultas,
                akunOperator: cleanOperator || p.akunOperator,
              }
            : p
        )
      );
      pushToast(
        "success",
        "Data Prodi Diperbarui",
        `Program Studi "${cleanNama}" berhasil diperbarui.`
      );
    } else {
      const nextId =
        prodiList.length > 0 ? Math.max(...prodiList.map((p) => p.id)) + 1 : 1;
      setProdiList((prev) => [
        ...prev,
        {
          id: nextId,
          kodeProdi: cleanKode,
          namaProdi: cleanNama,
          jenjang: jenjangInput,
          fakultas: cleanFakultas,
          akunOperator: cleanOperator || `prodi_${nextId}`,
          statusAktif: true,
        },
      ]);
      pushToast(
        "success",
        "Program Studi Ditambahkan",
        `Program Studi "${cleanNama}" berhasil ditambahkan.`
      );
    }

    setIsModalOpen(false);
  };

  const handleToggleStatus = (item: ProdiMasterItem) => {
    setProdiList((prev) =>
      prev.map((p) =>
        p.id === item.id ? { ...p, statusAktif: !p.statusAktif } : p
      )
    );
    pushToast(
      "info",
      "Status Prodi Diubah",
      `Status "${item.namaProdi}" diubah menjadi ${
        !item.statusAktif ? "Aktif" : "Nonaktif"
      }.`
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

      {/* Sidebar Navigasi Admin */}
      <AdminSidebar
        username={user?.username || "admin"}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      {/* Area Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Header Blur Transparan */}
        <header className="h-16 bg-white/75 backdrop-blur-md border-b border-slate-200/70 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              aria-label="Buka navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">
              Data Program Studi
            </h1>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-900 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-blue-900/15 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Tambah Prodi</span>
          </button>
        </header>

        {/* Konten Utama */}
        <main className="p-5 sm:p-8 space-y-6 max-w-7xl w-full mx-auto flex-1">
          <section
            aria-label="Tabel Master Data Program Studi Universitas Nurul Huda"
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
          >
            {/* Banner Header Biru Lembut & Search Bar */}
            <div className="p-6 bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#FBC02D]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                    Universitas Nurul Huda
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Daftar Master Program Studi ({prodiList.length} Prodi)
                </h2>
              </div>

              <div className="relative w-full sm:w-72 shrink-0">
                <Search className="w-4 h-4 text-[#1565C0] pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama prodi, fakultas, kode..."
                  className="w-full rounded-xl border border-white/90 bg-white pl-9 pr-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#FBC02D]/80"
                />
              </div>
            </div>

            {/* Tabel Data Prodi */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-3.5 px-6 w-16">No</th>
                    <th className="py-3.5 px-6">Program Studi</th>
                    <th className="py-3.5 px-6">Jenjang</th>
                    <th className="py-3.5 px-6">Fakultas / Unit</th>
                    <th className="py-3.5 px-6">Akun Operator</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
                  {filteredProdi.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-4 px-6 font-semibold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">
                          {sanitizePlainText(item.namaProdi)}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Kode: {sanitizePlainText(item.kodeProdi)}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${
                            item.jenjang === "S2"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-[#0D47A1] border border-blue-200"
                          }`}
                        >
                          {item.jenjang}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        {sanitizePlainText(item.fakultas)}
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          <UserCheck className="w-3.5 h-3.5 text-[#0D47A1]" />
                          {sanitizePlainText(item.akunOperator)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {item.statusAktif ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            title="Edit Prodi"
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item)}
                            title="Ubah Status Aktif/Nonaktif"
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {/* Modal Tambah / Edit Data Prodi */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-[#FBC02D]" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {modalMode === "edit"
                    ? "Edit Program Studi"
                    : "Tambah Program Studi"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProdi} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Nama Program Studi *
                </label>
                <input
                  type="text"
                  required
                  value={namaProdiInput}
                  onChange={(e) => setNamaProdiInput(e.target.value)}
                  placeholder="Contoh: S1 Informatika"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-[#0D47A1] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Kode Prodi *
                  </label>
                  <input
                    type="text"
                    required
                    value={kodeProdiInput}
                    onChange={(e) => setKodeProdiInput(e.target.value)}
                    placeholder="Contoh: IF-S1"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-[#0D47A1] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Jenjang
                  </label>
                  <select
                    value={jenjangInput}
                    onChange={(e) =>
                      setJenjangInput(e.target.value as "S1" | "S2")
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-[#0D47A1] focus:outline-none"
                  >
                    <option value="S1">S1 (Sarjana)</option>
                    <option value="S2">S2 (Magister)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Fakultas / Unit
                </label>
                <input
                  type="text"
                  value={fakultasInput}
                  onChange={(e) => setFakultasInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-[#0D47A1] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Username Akun Operator
                </label>
                <input
                  type="text"
                  value={operatorInput}
                  onChange={(e) => setOperatorInput(e.target.value)}
                  placeholder="Contoh: prodi_ti"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-[#0D47A1] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] text-xs font-semibold text-white cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
