"use client";

import React, { useCallback, useEffect, useState } from "react";
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
  Trash2,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
import { AuthUser } from "@/types/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

// --- Tipe Data ---
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

export default function MasterDataKampusPage() {
  const router = useRouter();

  // State Otorisasi
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State Data Master
  const [activeTab, setActiveTab] = useState<"fakultas" | "prodi">("fakultas");
  const [fakultasList, setFakultasList] = useState<Fakultas[]>([]);
  const [prodiList, setProdiList] = useState<Prodi[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State Modal Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Modal Konfirmasi Hapus Data
  const [deleteTarget, setDeleteTarget] = useState<DeleteConfirmTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // State Form Fakultas
  const [editFakultasId, setEditFakultasId] = useState<number | null>(null);
  const [namaFakultas, setNamaFakultas] = useState("");
  const [singkatanFakultas, setSingkatanFakultas] = useState("");

  // State Form Prodi
  const [editProdiId, setEditProdiId] = useState<number | null>(null);
  const [namaProdi, setNamaProdi] = useState("");
  const [idFakultasProdi, setIdFakultasProdi] = useState<string>("");

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fakultasRes, prodiRes] = await Promise.all([
        apiClient.get("/api/fakultas"),
        apiClient.get("/api/prodi"),
      ]);
      setFakultasList(fakultasRes.data?.data || []);
      setProdiList(prodiRes.data?.data || []);
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 401 || axiosErr.response?.status === 403) {
        handleUnauthorizedExit();
      } else {
        toast.error("Gagal memuat data master dari server.");
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
      try {
        const meRes = await apiClient.get("/api/me");
        if (meRes.data?.data?.role !== "admin") {
          handleUnauthorizedExit();
          return;
        }
        if (isMounted) {
          setUser(meRes.data.data);
          setIsAuthorized(true);
          setIsCheckingAuth(false);
        }
        await fetchData();
      } catch {
        handleUnauthorizedExit();
      }
    };
    verifyAdmin();
    return () => { isMounted = false; };
  }, [handleUnauthorizedExit, fetchData]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await logoutSession(); } catch { clearAuthSession(); }
    finally { router.replace("/login"); }
  };

  // --- Handlers Modal ---
  const openModalCreate = () => {
    setModalMode("create");
    if (activeTab === "fakultas") {
      setNamaFakultas(""); setSingkatanFakultas("");
    } else {
      setNamaProdi(""); setIdFakultasProdi(fakultasList[0]?.id.toString() || "");
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

  // --- CRUD Handlers ---
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (activeTab === "fakultas") {
        const trimmedNama = namaFakultas.trim();
        const trimmedSingkatan = singkatanFakultas.trim();
        const payload = {
          nama_fakultas: trimmedNama,
          singkatan: trimmedSingkatan || null,
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

  const handleOpenDeleteConfirm = (id: number, nama: string, type: "fakultas" | "prodi") => {
    setDeleteTarget({ id, nama, type });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    const { id, type, nama } = deleteTarget;
    const typeLabel = type === "fakultas" ? "Fakultas" : "Program Studi";

    try {
      const response = await apiClient.delete(`/api/${type}/${id}`);
      const successMsg =
        response.data?.message ||
        `Data ${typeLabel} "${nama}" berhasil dihapus dari database.`;
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0D47A1]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <Toaster position="top-right" />
      <AdminSidebar
        username={user?.username || "admin"}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="lg:hidden p-2 rounded-lg border border-slate-200 bg-white">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-xl font-bold text-slate-900">Master Data Kampus</h1>
          </div>
          <button
            onClick={openModalCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0D47A1] text-white text-xs sm:text-sm font-semibold shadow-sm hover:bg-[#1565C0] transition"
          >
            <Plus className="w-4 h-4 text-[#FBC02D]" />
            <span>Tambah Data</span>
          </button>
        </header>

        <main className="p-5 sm:p-8 max-w-6xl w-full mx-auto space-y-6">
          {/* Tab Navigation */}
          <div className="flex p-1 bg-slate-200/60 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab("fakultas")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "fakultas" ? "bg-white text-[#0D47A1] shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="w-4 h-4" /> Fakultas
            </button>
            <button
              onClick={() => setActiveTab("prodi")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "prodi" ? "bg-white text-[#0D47A1] shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <GraduationCap className="w-4 h-4" /> Program Studi
            </button>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#0D47A1]" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                      {activeTab === "fakultas" ? (
                        <>
                          <th className="px-6 py-4">ID</th>
                          <th className="px-6 py-4">Nama Fakultas</th>
                          <th className="px-6 py-4">Singkatan</th>
                          <th className="px-6 py-4 text-right">Aksi</th>
                        </>
                      ) : (
                        <>
                          <th className="px-6 py-4">ID</th>
                          <th className="px-6 py-4">Nama Program Studi</th>
                          <th className="px-6 py-4">Induk Fakultas</th>
                          <th className="px-6 py-4 text-right">Aksi</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeTab === "fakultas" && fakultasList.map((fak) => (
                      <tr key={fak.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-slate-500 font-mono">#{fak.id}</td>
                        <td className="px-6 py-4 font-semibold">{sanitizePlainText(fak.nama_fakultas)}</td>
                        <td className="px-6 py-4 font-mono text-xs bg-slate-100 rounded inline-block mt-3 ml-6 px-2">{sanitizePlainText(fak.singkatan || "-")}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openModalEditFakultas(fak)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => handleOpenDeleteConfirm(fak.id, fak.nama_fakultas, "fakultas")} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                    {activeTab === "prodi" && prodiList.map((prd) => (
                      <tr key={prd.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-slate-500 font-mono">#{prd.id}</td>
                        <td className="px-6 py-4 font-semibold">{sanitizePlainText(prd.nama_prodi)}</td>
                        <td className="px-6 py-4 text-slate-600">{sanitizePlainText(prd.fakultas?.nama_fakultas || "-")}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openModalEditProdi(prd)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => handleOpenDeleteConfirm(prd.id, prd.nama_prodi, "prodi")} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="bg-[#0D47A1] px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold">
                {modalMode === "create" ? "Tambah" : "Edit"} {activeTab === "fakultas" ? "Fakultas" : "Program Studi"}
              </h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {activeTab === "fakultas" ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Nama Fakultas</label>
                    <input type="text" required value={namaFakultas} onChange={(e) => setNamaFakultas(e.target.value)} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Singkatan (Opsional)</label>
                    <input type="text" value={singkatanFakultas} onChange={(e) => setSingkatanFakultas(e.target.value)} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Nama Program Studi</label>
                    <input type="text" required value={namaProdi} onChange={(e) => setNamaProdi(e.target.value)} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Induk Fakultas</label>
                    <select required value={idFakultasProdi} onChange={(e) => setIdFakultasProdi(e.target.value)} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option value="" disabled>Pilih Fakultas</option>
                      {fakultasList.map((f) => (
                        <option key={f.id} value={f.id}>{f.nama_fakultas}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#0D47A1] text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Konfirmasi Hapus Data Master */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100/80 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Konfirmasi Hapus Data
                </h3>
                <p className="text-xs text-slate-500">
                  Apakah Anda yakin ingin menghapus data {deleteTarget.type === "fakultas" ? "Fakultas" : "Program Studi"} berikut secara permanen dari database?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {deleteTarget.type === "fakultas" ? "Nama Fakultas" : "Nama Program Studi"}
              </p>
              <p className="text-sm font-semibold text-slate-900 break-words">
                {sanitizePlainText(deleteTarget.nama)}
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Tindakan ini permanen. Data yang dihapus tidak dapat dipulihkan kembali dari database sistem.
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition disabled:opacity-50"
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