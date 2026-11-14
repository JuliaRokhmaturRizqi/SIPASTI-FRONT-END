"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Filter,
  FlaskConical,
  GraduationCap,
  Landmark,
  Layers,
  Loader2,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
import { AuthUser } from "@/types/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

// --- Tipe Data ---
export interface KategoriUnitRecord {
  id: number;
  nama_kategori: string;
  unit_kerja_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UnitKerjaRecord {
  id: number;
  nama_unit: string;
  id_kategori?: number | null;
  kategori_unit: string;
  kategori?: {
    id: number;
    nama_kategori: string;
  } | null;
  users_count?: number;
  laporan_kinerja_count?: number;
  created_at?: string;
  updated_at?: string;
}

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
  kategori?: string;
  type: "unit" | "kategori" | "fakultas" | "prodi";
}

/**
 * Helper konfigurasi warna badge berbeda untuk tiap Kategori Unit
 */
function getKategoriBadgeStyle(kategori: string) {
  switch (kategori?.toLowerCase()) {
    case "biro":
      return {
        label: "Biro",
        badgeClass: "bg-blue-50 text-[#0D47A1] border-blue-200 shadow-2xs",
        dotClass: "bg-[#0D47A1]",
      };
    case "pusat":
      return {
        label: "Pusat",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200 shadow-2xs",
        dotClass: "bg-purple-600",
      };
    case "lab":
    case "laboratorium":
      return {
        label: "Laboratorium",
        badgeClass:
          "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs",
        dotClass: "bg-emerald-600",
      };
    case "fakultas":
      return {
        label: "Fakultas",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200 shadow-2xs",
        dotClass: "bg-amber-500",
      };
    default:
      return {
        label: kategori || "Unit",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
        dotClass: "bg-slate-500",
      };
  }
}

export default function MasterDataKampusPage() {
  const router = useRouter();

  // State Otorisasi
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State Navigasi Tab Master: Unit Kerja, Kategori Unit, Fakultas, Prodi
  const [activeTab, setActiveTab] = useState<
    "unit" | "kategori" | "fakultas" | "prodi"
  >("unit");

  // State Data Master
  const [unitList, setUnitList] = useState<UnitKerjaRecord[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriUnitRecord[]>([]);
  const [fakultasList, setFakultasList] = useState<Fakultas[]>([]);
  const [prodiList, setProdiList] = useState<Prodi[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State Pencarian & Filter Unit
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKategori, setFilterKategori] = useState<string>("ALL");

  // State Modal Form (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Form Unit Kerja
  const [editUnitId, setEditUnitId] = useState<number | null>(null);
  const [namaUnit, setNamaUnit] = useState("");
  const [selectedKategoriId, setSelectedKategoriId] = useState<number | null>(
    null
  );
  const [kategoriUnit, setKategoriUnit] = useState<string>("biro");

  // State Form Kategori Unit
  const [editKategoriId, setEditKategoriId] = useState<number | null>(null);
  const [namaKategori, setNamaKategori] = useState("");

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

  /**
   * Fetch Data Master dari Backend (termasuk GET /api/kategori-unit dan GET /api/unit-kerja)
   */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [unitRes, kategoriRes, fakultasRes, prodiRes] = await Promise.all([
        apiClient.get<{ status: string; data?: UnitKerjaRecord[] }>(
          "/api/unit-kerja"
        ),
        apiClient.get<{ status: string; data?: KategoriUnitRecord[] }>(
          "/api/kategori-unit"
        ),
        apiClient.get<{ status: string; data?: Fakultas[] }>("/api/fakultas"),
        apiClient.get<{ status: string; data?: Prodi[] }>("/api/prodi"),
      ]);

      setUnitList(unitRes.data?.data || []);
      setKategoriList(kategoriRes.data?.data || []);
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
            "Gagal memuat data master dari server."
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

  // Statistik Ringkasan Unit Kerja
  const unitStats = useMemo(() => {
    const total = unitList.length;
    const biro = unitList.filter(
      (u) =>
        u.kategori_unit?.toLowerCase() === "biro" ||
        u.kategori?.nama_kategori?.toLowerCase() === "biro"
    ).length;
    const pusat = unitList.filter(
      (u) =>
        u.kategori_unit?.toLowerCase() === "pusat" ||
        u.kategori?.nama_kategori?.toLowerCase() === "pusat"
    ).length;
    const lab = unitList.filter(
      (u) =>
        u.kategori_unit?.toLowerCase() === "lab" ||
        u.kategori_unit?.toLowerCase() === "laboratorium" ||
        u.kategori?.nama_kategori?.toLowerCase() === "lab" ||
        u.kategori?.nama_kategori?.toLowerCase() === "laboratorium"
    ).length;
    const fakultas = unitList.filter(
      (u) =>
        u.kategori_unit?.toLowerCase() === "fakultas" ||
        u.kategori?.nama_kategori?.toLowerCase() === "fakultas"
    ).length;

    return { total, biro, pusat, lab, fakultas };
  }, [unitList]);

  // Filter & Pencarian Daftar Unit Kerja
  const filteredUnitList = useMemo(() => {
    return unitList.filter((u) => {
      const kat = (
        u.kategori?.nama_kategori ||
        u.kategori_unit ||
        ""
      ).toLowerCase();
      if (filterKategori !== "ALL" && kat !== filterKategori.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        return u.nama_unit.toLowerCase().includes(q) || kat.includes(q);
      }
      return true;
    });
  }, [unitList, filterKategori, searchQuery]);

  // Filter Kategori Unit
  const filteredKategoriList = useMemo(() => {
    if (!searchQuery.trim()) return kategoriList;
    const q = searchQuery.toLowerCase().trim();
    return kategoriList.filter((k) => k.nama_kategori.toLowerCase().includes(q));
  }, [kategoriList, searchQuery]);

  // Filter Fakultas & Prodi berdasarkan searchQuery
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

  // --- Handlers Modal ---
  const openModalCreate = () => {
    setModalMode("create");
    if (activeTab === "unit") {
      setEditUnitId(null);
      setNamaUnit("");
      if (kategoriList.length > 0) {
        setSelectedKategoriId(kategoriList[0].id);
        setKategoriUnit(kategoriList[0].nama_kategori.toLowerCase());
      } else {
        setSelectedKategoriId(null);
        setKategoriUnit("biro");
      }
    } else if (activeTab === "kategori") {
      setEditKategoriId(null);
      setNamaKategori("");
    } else if (activeTab === "fakultas") {
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

  const openModalEditUnit = (unit: UnitKerjaRecord) => {
    setModalMode("edit");
    setEditUnitId(unit.id);
    setNamaUnit(unit.nama_unit);
    const match = kategoriList.find(
      (k) =>
        k.id === unit.id_kategori ||
        (unit.kategori?.id && k.id === unit.kategori.id) ||
        k.nama_kategori.toLowerCase() === unit.kategori_unit?.toLowerCase()
    );
    setSelectedKategoriId(
      match ? match.id : unit.id_kategori || (kategoriList[0]?.id ?? null)
    );
    setKategoriUnit(
      unit.kategori_unit ||
        (match ? match.nama_kategori.toLowerCase() : "biro")
    );
    setIsModalOpen(true);
  };

  const openModalEditKategori = (kategori: KategoriUnitRecord) => {
    setModalMode("edit");
    setEditKategoriId(kategori.id);
    setNamaKategori(kategori.nama_kategori);
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

  // --- CRUD Handlers (Submit Create / Update) ---
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (activeTab === "unit") {
        const trimmedNamaUnit = namaUnit.trim();
        if (!trimmedNamaUnit) {
          toast.error("Nama unit kerja wajib diisi.");
          setIsSubmitting(false);
          return;
        }

        const payload: {
          nama_unit: string;
          id_kategori?: number;
          kategori_unit?: string;
        } = {
          nama_unit: trimmedNamaUnit,
          id_kategori: selectedKategoriId || undefined,
          kategori_unit: kategoriUnit || undefined,
        };

        if (modalMode === "create") {
          const res = await apiClient.post("/api/unit-kerja", payload);
          toast.success(
            res.data?.message || "Unit kerja baru berhasil ditambahkan."
          );
        } else {
          const res = await apiClient.put(
            `/api/unit-kerja/${editUnitId}`,
            payload
          );
          toast.success(
            res.data?.message || "Data unit kerja berhasil diperbarui."
          );
        }
      } else if (activeTab === "kategori") {
        const trimmedNamaKategori = namaKategori.trim();
        if (!trimmedNamaKategori) {
          toast.error("Nama kategori unit wajib diisi.");
          setIsSubmitting(false);
          return;
        }

        const payload = {
          nama_kategori: trimmedNamaKategori,
        };

        if (modalMode === "create") {
          const res = await apiClient.post("/api/kategori-unit", payload);
          toast.success(
            res.data?.message || "Kategori unit baru berhasil ditambahkan."
          );
        } else {
          const res = await apiClient.put(
            `/api/kategori-unit/${editKategoriId}`,
            payload
          );
          toast.success(
            res.data?.message || "Kategori unit berhasil diperbarui."
          );
        }
      } else if (activeTab === "fakultas") {
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

  // --- Delete Confirmation & Execution ---
  const handleOpenDeleteConfirm = (
    id: number,
    nama: string,
    type: "unit" | "kategori" | "fakultas" | "prodi",
    kategori?: string
  ) => {
    setDeleteTarget({ id, nama, type, kategori });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    const { id, type, nama } = deleteTarget;
    const endpoint =
      type === "unit"
        ? `/api/unit-kerja/${id}`
        : type === "kategori"
        ? `/api/kategori-unit/${id}`
        : type === "fakultas"
        ? `/api/fakultas/${id}`
        : `/api/prodi/${id}`;

    const typeLabel =
      type === "unit"
        ? "Unit Kerja"
        : type === "kategori"
        ? "Kategori Unit"
        : type === "fakultas"
        ? "Fakultas"
        : "Program Studi";

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
          Memuat Master Data Kampus...
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
              <Building2 className="w-5 h-5 text-[#0D47A1]" />
              <span className="font-bold text-sm text-slate-900">
                Master Data Kampus
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
                  Manajemen Entitas Kampus
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Master Data Unit Kerja & Akademik
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Kelola entitas Master Unit Kerja, Kategori Unit, beserta struktur
                Fakultas dan Program Studi Universitas Nurul Huda.
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
                  {activeTab === "unit"
                    ? "Tambah Unit Kerja"
                    : activeTab === "kategori"
                    ? "Tambah Kategori Unit"
                    : activeTab === "fakultas"
                    ? "Tambah Fakultas"
                    : "Tambah Program Studi"}
                </span>
              </button>
            </div>
          </div>
        </section>

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* 4 Kartu Statistik Gradient (Ringkasan Unit Kerja) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1e5bb8] to-[#0D47A1] text-white shadow-md shadow-blue-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Total Unit Kerja
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {unitStats.total}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Terdaftar di database
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-700 text-white shadow-md shadow-indigo-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Kategori Biro
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {unitStats.biro}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Unit layanan administrasi
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                <Briefcase className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-md shadow-purple-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Kategori Pusat
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {unitStats.pusat}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Pusat studi & layanan
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                <Landmark className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Kategori Lainnya
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {kategoriList.length}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  {kategoriList.length} Kategori Unit Aktif
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                <Tag className="w-6 h-6" />
              </div>
            </div>
          </section>

          {/* Baris Navigasi Tab & Filter Cerdas */}
          <section className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Tab Selector */}
            <div className="flex p-1 bg-slate-100 rounded-xl w-full lg:w-fit overflow-x-auto gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("unit");
                  setSearchQuery("");
                }}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer shrink-0 ${
                  activeTab === "unit"
                    ? "bg-[#0D47A1] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Unit Kerja ({unitList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("kategori");
                  setSearchQuery("");
                }}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer shrink-0 ${
                  activeTab === "kategori"
                    ? "bg-[#0D47A1] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Tag className="w-4 h-4" />
                <span>Kategori Unit ({kategoriList.length})</span>
              </button>

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

            {/* Filter Kategori Unit & Search Bar */}
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {activeTab === "unit" && (
                <div className="relative min-w-[175px] sm:w-auto w-full">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Filter className="w-4 h-4" />
                  </div>
                  <select
                    value={filterKategori}
                    onChange={(e) => setFilterKategori(e.target.value)}
                    className="w-full pl-10 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1] appearance-none cursor-pointer transition-all duration-200"
                  >
                    <option value="ALL">Semua Kategori</option>
                    {kategoriList.map((k) => (
                      <option
                        key={k.id}
                        value={k.nama_kategori.toLowerCase()}
                      >
                        {k.nama_kategori}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              )}

              <div className="relative flex-1 min-w-[220px]">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === "unit"
                      ? "Cari nama unit kerja atau kategori..."
                      : activeTab === "kategori"
                      ? "Cari nama kategori unit..."
                      : activeTab === "fakultas"
                      ? "Cari nama atau singkatan fakultas..."
                      : "Cari nama program studi..."
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
            </div>
          </section>

          {/* Tabel Enterprise Master Data */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#0D47A1]" />
                <p className="text-xs font-semibold text-slate-500">
                  Memuat data master dari server...
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* TAB 1: TABEL MASTER UNIT KERJA */}
                {activeTab === "unit" && (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4 w-16">No</th>
                        <th className="px-6 py-4">Nama Unit Kerja</th>
                        <th className="px-6 py-4">Kategori Unit</th>
                        <th className="px-6 py-4 text-center">Total Laporan</th>
                        <th className="px-6 py-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUnitList.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-14 text-center text-slate-500"
                          >
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Briefcase className="w-8 h-8 text-slate-300" />
                              <p className="font-semibold text-slate-700">
                                Belum ada data Unit Kerja yang sesuai
                              </p>
                              <p className="text-xs text-slate-400">
                                Klik tombol &ldquo;Tambah Unit Kerja&rdquo; di
                                kanan atas untuk menambahkan data baru.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredUnitList.map((unit, idx) => {
                          const badge = getKategoriBadgeStyle(
                            unit.kategori?.nama_kategori || unit.kategori_unit
                          );
                          return (
                            <tr
                              key={unit.id}
                              className="hover:bg-blue-50/30 transition-colors duration-150"
                            >
                              <td className="px-6 py-4 text-xs font-bold text-slate-400 font-mono">
                                {idx + 1}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-[#0D47A1] font-bold text-xs shrink-0">
                                    <Building2 className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900">
                                      {sanitizePlainText(unit.nama_unit)}
                                    </p>
                                    <p className="text-[11px] text-slate-400 font-mono">
                                      ID Unit: #{unit.id}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${badge.badgeClass}`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`}
                                  />
                                  <span>{badge.label}</span>
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                                  {unit.laporan_kinerja_count ?? 0} Laporan
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openModalEditUnit(unit)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0D47A1] bg-blue-50/70 hover:bg-[#0D47A1] hover:text-white border border-blue-200/60 transition-all duration-200 cursor-pointer"
                                    title="Edit Unit Kerja"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenDeleteConfirm(
                                        unit.id,
                                        unit.nama_unit,
                                        "unit",
                                        unit.kategori?.nama_kategori ||
                                          unit.kategori_unit
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50/70 hover:bg-red-600 hover:text-white border border-red-200/60 transition-all duration-200 cursor-pointer"
                                    title="Hapus Unit Kerja"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Hapus</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

                {/* TAB 2: TABEL MASTER KATEGORI UNIT */}
                {activeTab === "kategori" && (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4 w-16">No</th>
                        <th className="px-6 py-4">Nama Kategori Unit</th>
                        <th className="px-6 py-4 text-center">
                          Jumlah Unit Kerja
                        </th>
                        <th className="px-6 py-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredKategoriList.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-14 text-center text-slate-500"
                          >
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Tag className="w-8 h-8 text-slate-300" />
                              <p className="font-semibold text-slate-700">
                                Belum ada data Kategori Unit yang sesuai
                              </p>
                              <p className="text-xs text-slate-400">
                                Klik tombol &ldquo;Tambah Kategori Unit&rdquo; di
                                kanan atas untuk menambahkan data baru.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredKategoriList.map((kat, idx) => (
                          <tr
                            key={kat.id}
                            className="hover:bg-blue-50/30 transition-colors duration-150"
                          >
                            <td className="px-6 py-4 text-xs font-bold text-slate-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-700 font-bold text-xs shrink-0">
                                  <Tag className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">
                                    {sanitizePlainText(kat.nama_kategori)}
                                  </p>
                                  <p className="text-[11px] text-slate-400 font-mono">
                                    ID Kategori: #{kat.id}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                                {kat.unit_kerja_count ?? 0} Unit
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openModalEditKategori(kat)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0D47A1] bg-blue-50/70 hover:bg-[#0D47A1] hover:text-white border border-blue-200/60 transition-all duration-200 cursor-pointer"
                                  title="Edit Kategori"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenDeleteConfirm(
                                      kat.id,
                                      kat.nama_kategori,
                                      "kategori"
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50/70 hover:bg-red-600 hover:text-white border border-red-200/60 transition-all duration-200 cursor-pointer"
                                  title="Hapus Kategori"
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

                {/* TAB 3: TABEL MASTER FAKULTAS */}
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
                      {filteredFakultasList.map((fak, idx) => (
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
                      ))}
                    </tbody>
                  </table>
                )}

                {/* TAB 4: TABEL MASTER PROGRAM STUDI */}
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
                      {filteredProdiList.map((prd, idx) => (
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
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Modal Tambah / Edit Data Master */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-[#0D47A1] to-[#1565C0] px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-[#FBC02D]" />
                <h3 className="font-bold text-base">
                  {modalMode === "create" ? "Tambah" : "Edit"}{" "}
                  {activeTab === "unit"
                    ? "Unit Kerja"
                    : activeTab === "kategori"
                    ? "Kategori Unit"
                    : activeTab === "fakultas"
                    ? "Fakultas"
                    : "Program Studi"}
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
              {/* FORM UNIT KERJA */}
              {activeTab === "unit" && (
                <>
                  <div>
                    <label
                      htmlFor="input-nama-unit"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                    >
                      Nama Unit Kerja <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="input-nama-unit"
                      type="text"
                      required
                      disabled={isSubmitting}
                      value={namaUnit}
                      onChange={(e) => setNamaUnit(e.target.value)}
                      placeholder="Contoh: Biro Administrasi Umum & Keuangan"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none transition"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="select-kategori-unit"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                    >
                      Kategori Unit <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="select-kategori-unit"
                        required
                        disabled={isSubmitting}
                        value={selectedKategoriId ?? ""}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSelectedKategoriId(val);
                          const match = kategoriList.find((k) => k.id === val);
                          if (match) {
                            setKategoriUnit(match.nama_kategori.toLowerCase());
                          }
                        }}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-9 text-sm font-semibold text-slate-800 bg-white focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none appearance-none cursor-pointer transition"
                      >
                        <option value="" disabled>
                          -- Pilih Kategori Unit --
                        </option>
                        {kategoriList.map((kat) => (
                          <option key={kat.id} value={kat.id}>
                            {kat.nama_kategori}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* FORM KATEGORI UNIT */}
              {activeTab === "kategori" && (
                <div>
                  <label
                    htmlFor="input-nama-kategori"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                  >
                    Nama Kategori Unit <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="input-nama-kategori"
                    type="text"
                    required
                    disabled={isSubmitting}
                    value={namaKategori}
                    onChange={(e) => setNamaKategori(e.target.value)}
                    placeholder="Contoh: Biro, Lembaga, Pusat Studi"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Kategori ini akan tersedia pada pilihan dropdown saat
                    menambah atau mengedit Unit Kerja.
                  </p>
                </div>
              )}

              {/* FORM FAKULTAS */}
              {activeTab === "fakultas" && (
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
              )}

              {/* FORM PRODI */}
              {activeTab === "prodi" && (
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
                  {deleteTarget.type === "unit"
                    ? "Unit Kerja"
                    : deleteTarget.type === "kategori"
                    ? "Kategori Unit"
                    : deleteTarget.type === "fakultas"
                    ? "Fakultas"
                    : "Program Studi"}{" "}
                  berikut secara permanen dari database?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {deleteTarget.type === "unit"
                  ? `Nama Unit (${deleteTarget.kategori?.toUpperCase() || "UNIT"})`
                  : deleteTarget.type === "kategori"
                  ? "Nama Kategori Unit"
                  : deleteTarget.type === "fakultas"
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
