"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Edit3,
  GraduationCap,
  Loader2,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
import { AuthUser } from "@/types/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

interface Fakultas {
  id: number;
  nama_fakultas: string;
  singkatan: string | null;
}

interface Prodi {
  id: number;
  id_fakultas: number;
  nama_prodi: string;
  periode_mulai_aktif: string | null;
  fakultas?: {
    id: number;
    singkatan: string;
    nama_fakultas: string;
  };
}

interface DeleteConfirmTarget {
  id: number;
  nama: string;
  type: "fakultas" | "prodi";
}

export default function MasterDataAkademikPage() {
  const router = useRouter();

  // State Otorisasi
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State Navigasi Tab Master Akademik
  const [activeTab, setActiveTab] = useState<"fakultas" | "prodi">("fakultas");

  // State Data Master
  const [fakultasList, setFakultasList] = useState<Fakultas[]>([]);
  const [prodiList, setProdiList] = useState<Prodi[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State Pencarian
  const [searchQuery, setSearchQuery] = useState("");

  // State Modal Form (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Form Fakultas
  const [editFakultasId, setEditFakultasId] = useState<number | null>(null);
  const [namaFakultas, setNamaFakultas] = useState("");
  const [singkatanFakultas, setSingkatanFakultas] = useState("");

  // State Form Prodi
  const [editProdiId, setEditProdiId] = useState<number | null>(null);
  const [namaProdi, setNamaProdi] = useState("");
  const [idFakultasProdi, setIdFakultasProdi] = useState<string>("");

  // State Modal Konfirmasi Hapus Data
  const [deleteTarget, setDeleteTarget] =
    useState<DeleteConfirmTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fakultasRes, prodiRes] = await Promise.all([
        apiClient.get<{ status: string; data?: Fakultas[] }>("/api/fakultas"),
        apiClient.get<{ status: string; data?: Prodi[] }>("/api/prodi"),
      ]);

      setFakultasList(fakultasRes.data?.data || []);
      setProdiList(prodiRes.data?.data || []);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      if (
        axiosErr.response?.status === 401 ||
        axiosErr.response?.status === 403
      ) {
        handleUnauthorizedExit();
      } else {
        toast.error(
          axiosErr.response?.data?.message ||
            "Gagal memuat master data akademik dari server."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleUnauthorizedExit]);

  useEffect(() => {
    let isMounted = true;
    const verifyAdmin = async () => {
      const session = getAuthSession();
      if (!session.token || session.role !== "admin") {
        handleUnauthorizedExit();
        return;
      }

      if (session.user && isMounted) {
        setUser(session.user);
      }

      try {
        const meRes = await apiClient.get("/api/me");
        const meUser = meRes.data?.data || meRes.data?.user;
        if (meUser && meUser.role !== "admin") {
          handleUnauthorizedExit();
          return;
        }
        if (isMounted) {
          if (meUser) setUser(meUser);
          setIsAuthorized(true);
          setIsCheckingAuth(false);
        }
        await fetchData();
      } catch {
        handleUnauthorizedExit();
      }
    };
    verifyAdmin();
    return () => {
      isMounted = false;
    };
  }, [handleUnauthorizedExit, fetchData]);

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

  const filteredFakultasList = useMemo(() => {
    if (!searchQuery.trim()) return fakultasList;
    const q = searchQuery.toLowerCase().trim();
    return fakultasList.filter(
      (f) =>
        f.nama_fakultas.toLowerCase().includes(q) ||
        (f.singkatan && f.singkatan.toLowerCase().includes(q))
    );
  }, [fakultasList, searchQuery]);

  const filteredProdiList = useMemo(() => {
    if (!searchQuery.trim()) return prodiList;
    const q = searchQuery.toLowerCase().trim();
    return prodiList.filter(
      (p) =>
        p.nama_prodi.toLowerCase().includes(q) ||
        (p.fakultas?.nama_fakultas &&
          p.fakultas.nama_fakultas.toLowerCase().includes(q))
    );
  }, [prodiList, searchQuery]);

  const openModalCreate = () => {
    setModalMode("create");
    if (activeTab === "fakultas") {
      setEditFakultasId(null);
      setNamaFakultas("");
      setSingkatanFakultas("");
    } else {
      setEditProdiId(null);
      setNamaProdi("");
      setIdFakultasProdi(fakultasList[0]?.id.toString() || "");
    }
    setIsModalOpen(true);
  };

  const openModalEditFakultas = (fakultas: Fakultas) => {
    setModalMode("edit");
    setEditFakultasId(fakultas.id);
    setNamaFakultas(fakultas.nama_fakultas);
    setSingkatanFakultas(fakultas.singkatan || "");
    setIsModalOpen(true);
  };

  const openModalEditProdi = (prodi: Prodi) => {
    setModalMode("edit");
    setEditProdiId(prodi.id);
    setNamaProdi(prodi.nama_prodi);
    setIdFakultasProdi(prodi.id_fakultas.toString());
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (activeTab === "fakultas") {
        const payload = {
          nama_fakultas: namaFakultas.trim(),
          singkatan: singkatanFakultas.trim() || null,
        };
        if (modalMode === "create") {
          await apiClient.post("/api/fakultas", payload);
          toast.success("Fakultas berhasil ditambahkan.");
        } else {
          await apiClient.put(`/api/fakultas/${editFakultasId}`, payload);
          toast.success("Fakultas berhasil diperbarui.");
        }
      } else {
        const payload = {
          nama_prodi: namaProdi.trim(),
          id_fakultas: Number(idFakultasProdi),
          periode_mulai_aktif: null,
        };
        if (modalMode === "create") {
          await apiClient.post("/api/prodi", payload);
          toast.success("Program Studi berhasil ditambahkan.");
        } else {
          await apiClient.put(`/api/prodi/${editProdiId}`, payload);
          toast.success("Program Studi berhasil diperbarui.");
        }
      }

      setIsModalOpen(false);
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{
        message?: string;
        errors?: Record<string, string[]>;
      }>;
      const firstValidationError = axiosErr.response?.data?.errors
        ? Object.values(axiosErr.response.data.errors)[0]?.[0]
        : undefined;
      toast.error(
        firstValidationError ||
          axiosErr.response?.data?.message ||
          "Terjadi kesalahan saat menyimpan data."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteConfirm = (
    id: number,
    nama: string,
    type: "fakultas" | "prodi"
  ) => {
    setDeleteTarget({ id, nama, type });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    const { id, type, nama } = deleteTarget;
    const endpoint =
      type === "fakultas" ? `/api/fakultas/${id}` : `/api/prodi/${id}`;
    const typeLabel = type === "fakultas" ? "Fakultas" : "Program Studi";

    try {
      const response = await apiClient.delete(endpoint);
      const successMsg =
        response.data?.message ||
        `Data ${typeLabel} "${nama}" berhasil dihapus dari sistem.`;
      toast.success(successMsg);
      setDeleteTarget(null);
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast.error(
        axiosErr.response?.data?.message ||
          `Gagal menghapus data ${typeLabel} dari database.`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isCheckingAuth || !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#0D47A1] mb-3" />
        <p className="text-sm font-semibold text-slate-700">
          Memuat Master Data Akademik...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row antialiased font-sans">
      <Toaster position="top-right" />

      <AdminSidebar
        username={user?.username || "admin"}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header Mobile */}
        <header className="lg:hidden h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#0D47A1]" />
              <span className="font-bold text-sm text-slate-900">
                Master Data Akademik
              </span>
            </div>
          </div>
        </header>

        {/* Banner Header Section */}
        <section className="bg-blue-50/50 border-b border-blue-100/80 px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0D47A1]/10 text-[#0D47A1] border border-[#0D47A1]/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Modul Akademik
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Master Data Akademik
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Kelola struktur Master Fakultas dan Program Studi Universitas
                Nurul Huda.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              <button
                type="button"
                onClick={fetchData}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 text-slate-500 ${
                    isLoading ? "animate-spin text-[#0D47A1]" : ""
                  }`}
                />
                <span>Segarkan</span>
              </button>

              <button
                type="button"
                onClick={openModalCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-950 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all duration-200 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#FBC02D]" />
                <span>
                  {activeTab === "fakultas"
                    ? "Tambah Fakultas"
                    : "Tambah Program Studi"}
                </span>
              </button>
            </div>
          </div>
        </section>

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* 2 Kartu Statistik Gradient Akademik */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1e5bb8] to-[#0D47A1] text-white shadow-md shadow-blue-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Total Fakultas
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {fakultasList.length}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Terdaftar di database akademik
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                <Building2 className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-700 text-white shadow-md shadow-indigo-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Total Program Studi
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {prodiList.length}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Ternaungi di seluruh fakultas
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                <GraduationCap className="w-6 h-6" />
              </div>
            </div>
          </section>

          {/* Baris Navigasi Tab & Search Bar */}
          <section className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex p-1 bg-slate-100 rounded-xl w-full lg:w-fit overflow-x-auto gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("fakultas");
                  setSearchQuery("");
                }}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer shrink-0 ${
                  activeTab === "fakultas"
                    ? "bg-[#0D47A1] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Master Fakultas ({fakultasList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("prodi");
                  setSearchQuery("");
                }}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer shrink-0 ${
                  activeTab === "prodi"
                    ? "bg-[#0D47A1] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Program Studi ({prodiList.length})</span>
              </button>
            </div>

            <div className="relative flex-1 min-w-[220px]">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "fakultas"
                    ? "Cari nama atau singkatan fakultas..."
                    : "Cari nama program studi atau fakultas..."
                }
                className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1] transition-all duration-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </section>

          {/* Tabel Master Data Akademik */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#0D47A1]" />
                <p className="text-xs font-semibold text-slate-500">
                  Memuat data master akademik dari server...
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {activeTab === "fakultas" && (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4 w-16">No</th>
                        <th className="px-6 py-4">Nama Fakultas</th>
                        <th className="px-6 py-4">Singkatan</th>
                        <th className="px-6 py-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredFakultasList.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-14 text-center text-slate-500"
                          >
                            Belum ada data Fakultas yang sesuai.
                          </td>
                        </tr>
                      ) : (
                        filteredFakultasList.map((fak, idx) => (
                          <tr
                            key={fak.id}
                            className="hover:bg-blue-50/30 transition-colors"
                          >
                            <td className="px-6 py-4 text-xs font-bold text-slate-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-900">
                              {sanitizePlainText(fak.nama_fakultas)}
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-[#0D47A1] border border-blue-200 font-mono text-xs font-bold">
                                {sanitizePlainText(fak.singkatan || "-")}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openModalEditFakultas(fak)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0D47A1] bg-blue-50/70 hover:bg-[#0D47A1] hover:text-white border border-blue-200/60 transition-all cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenDeleteConfirm(
                                      fak.id,
                                      fak.nama_fakultas,
                                      "fakultas"
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50/70 hover:bg-red-600 hover:text-white border border-red-200/60 transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Hapus</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === "prodi" && (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4 w-16">No</th>
                        <th className="px-6 py-4">Nama Program Studi</th>
                        <th className="px-6 py-4">Induk Fakultas</th>
                        <th className="px-6 py-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProdiList.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-14 text-center text-slate-500"
                          >
                            Belum ada data Program Studi yang sesuai.
                          </td>
                        </tr>
                      ) : (
                        filteredProdiList.map((prd, idx) => (
                          <tr
                            key={prd.id}
                            className="hover:bg-blue-50/30 transition-colors"
                          >
                            <td className="px-6 py-4 text-xs font-bold text-slate-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-900">
                              {sanitizePlainText(prd.nama_prodi)}
                            </td>
                            <td className="px-6 py-4 text-slate-600 font-medium">
                              {sanitizePlainText(
                                prd.fakultas?.nama_fakultas || "-"
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openModalEditProdi(prd)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0D47A1] bg-blue-50/70 hover:bg-[#0D47A1] hover:text-white border border-blue-200/60 transition-all cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenDeleteConfirm(
                                      prd.id,
                                      prd.nama_prodi,
                                      "prodi"
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50/70 hover:bg-red-600 hover:text-white border border-red-200/60 transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Hapus</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Modal Tambah / Edit Data Master Akademik */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-[#0D47A1] to-[#1565C0] px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-5 h-5 text-[#FBC02D]" />
                <h3 className="font-bold text-base">
                  {modalMode === "create" ? "Tambah" : "Edit"}{" "}
                  {activeTab === "fakultas" ? "Fakultas" : "Program Studi"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {activeTab === "fakultas" ? (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Nama Fakultas <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isSubmitting}
                      value={namaFakultas}
                      onChange={(e) => setNamaFakultas(e.target.value)}
                      placeholder="Contoh: Fakultas Sains dan Teknologi"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Singkatan (Opsional)
                    </label>
                    <input
                      type="text"
                      disabled={isSubmitting}
                      value={singkatanFakultas}
                      onChange={(e) => setSingkatanFakultas(e.target.value)}
                      placeholder="Contoh: FST"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Nama Program Studi <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isSubmitting}
                      value={namaProdi}
                      onChange={(e) => setNamaProdi(e.target.value)}
                      placeholder="Contoh: S1 Informatika"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Induk Fakultas <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      disabled={isSubmitting}
                      value={idFakultasProdi}
                      onChange={(e) => setIdFakultasProdi(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none"
                    >
                      <option value="" disabled>
                        Pilih Fakultas
                      </option>
                      {fakultasList.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nama_fakultas}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer"
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
                      <span>Simpan Data</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pop-up Konfirmasi Hapus Data */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100/80 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Konfirmasi Hapus Data
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus data{" "}
                  {deleteTarget.type === "fakultas"
                    ? "Fakultas"
                    : "Program Studi"}{" "}
                  berikut secara permanen dari database?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {deleteTarget.type === "fakultas"
                  ? "Nama Fakultas"
                  : "Nama Program Studi"}
              </p>
              <p className="text-sm font-bold text-slate-900 break-words">
                {sanitizePlainText(deleteTarget.nama)}
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Tindakan ini bersifat permanen dan akan menghapus data langsung
                dari server database.
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ya, Hapus Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
