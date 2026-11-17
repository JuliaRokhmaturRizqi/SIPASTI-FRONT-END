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
  ChevronDown,
  Copy,
  Edit3,
  Filter,
  Loader2,
  Menu,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
import { AuthUser } from "@/types/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import TambahAkunModal, {
  AkunUnitEditTarget,
  UnitKerjaOption,
} from "@/components/admin/TambahAkunModal";

export interface AkunUnitItem {
  id: number;
  username: string;
  role: string;
  jabatan?: "staf" | "pimpinan" | string;
  status_akses?: "aktif" | "suspend" | string;
  id_unit_kerja: number;
  is_active: boolean;
  created_at?: string;
  unit_kerja?: {
    id: number;
    nama_unit: string;
    kategori_unit: string;
    id_kategori?: number | null;
    kategori?: {
      id: number;
      nama_kategori: string;
    } | null;
  } | null;
}

function getKategoriBadge(kategori: string) {
  switch (kategori?.toLowerCase()) {
    case "biro":
      return {
        label: "Biro",
        badgeClass: "bg-blue-50 text-[#0D47A1] border-blue-200",
        dotClass: "bg-[#0D47A1]",
      };
    case "pusat":
      return {
        label: "Pusat",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
        dotClass: "bg-purple-600",
      };
    case "lab":
    case "laboratorium":
      return {
        label: "Laboratorium",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dotClass: "bg-emerald-600",
      };
    case "fakultas":
      return {
        label: "Fakultas",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
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

export default function DataAkunUnitPage() {
  const router = useRouter();

  // State Auth & Layout
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State Data Akun & Unit Kerja
  const [akunList, setAkunList] = useState<AkunUnitItem[]>([]);
  const [unitList, setUnitList] = useState<UnitKerjaOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKategori, setFilterKategori] = useState<string>("ALL");
  const [filterJabatan, setFilterJabatan] = useState<string>("ALL");

  // State Modal Tambah / Edit Akun
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editTarget, setEditTarget] = useState<AkunUnitEditTarget | null>(null);

  // State Toggle Status & Delete
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AkunUnitItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [akunRes, unitRes] = await Promise.all([
        apiClient.get<{ status: string; data?: AkunUnitItem[] }>(
          "/api/akun-unit"
        ),
        apiClient.get<{ status: string; data?: UnitKerjaOption[] }>(
          "/api/unit-kerja"
        ),
      ]);

      setAkunList(akunRes.data?.data || []);
      setUnitList(unitRes.data?.data || []);
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
            "Gagal memuat data akun unit kerja dari server."
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

  // Daftar opsi kategori unik dari unitList
  const kategoriOptions = useMemo(() => {
    const set = new Set<string>();
    unitList.forEach((u) => {
      const kat = u.kategori?.nama_kategori || u.kategori_unit;
      if (kat) set.add(kat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [unitList]);

  // 3 Kartu Statistik: Total Akun Unit, Akun Aktif, Akun Disuspend
  const stats = useMemo(() => {
    const total = akunList.length;
    const aktif = akunList.filter(
      (a) => a.status_akses !== "suspend" && Boolean(a.is_active)
    ).length;
    const suspend = total - aktif;
    return { total, aktif, suspend };
  }, [akunList]);

  // Filter daftar akun
  const filteredAkunList = useMemo(() => {
    return akunList.filter((item) => {
      const kat = (
        item.unit_kerja?.kategori?.nama_kategori ||
        item.unit_kerja?.kategori_unit ||
        item.role ||
        ""
      ).toLowerCase();

      if (filterKategori !== "ALL" && kat !== filterKategori.toLowerCase()) {
        return false;
      }

      const jabatanVal = (item.jabatan || "staf").toLowerCase();
      if (filterJabatan !== "ALL" && jabatanVal !== filterJabatan) {
        return false;
      }

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const namaUnit = item.unit_kerja?.nama_unit?.toLowerCase() || "";
        return (
          item.username.toLowerCase().includes(q) ||
          namaUnit.includes(q) ||
          jabatanVal.includes(q)
        );
      }

      return true;
    });
  }, [akunList, filterKategori, filterJabatan, searchQuery]);

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setEditTarget(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: AkunUnitItem) => {
    setModalMode("edit");
    setEditTarget({
      id: item.id,
      username: item.username,
      id_unit_kerja: item.id_unit_kerja,
      jabatan: item.jabatan || "staf",
      status_akses: item.status_akses || (item.is_active ? "aktif" : "suspend"),
      is_active: item.is_active,
    });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (item: AkunUnitItem) => {
    if (togglingId === item.id) return;
    setTogglingId(item.id);
    try {
      const res = await apiClient.patch<{
        message?: string;
        data?: AkunUnitItem;
      }>(`/api/akun-unit/${item.id}/toggle-status`);
      toast.success(
        res.data?.message ||
          `Status akses akun "${item.username}" berhasil diperbarui.`
      );
      await fetchData();
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast.error(
        axiosErr.response?.data?.message ||
          "Gagal mengubah status akses akun unit kerja."
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await apiClient.delete(`/api/akun-unit/${deleteTarget.id}`);
      toast.success(
        res.data?.message ||
          `Akun "${deleteTarget.username}" berhasil dihapus.`
      );
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast.error(
        axiosErr.response?.data?.message ||
          "Gagal menghapus akun unit kerja dari database."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyUsername = async (username: string) => {
    try {
      await navigator.clipboard.writeText(username);
      toast.success(`Username "${username}" disalin.`);
    } catch {
      toast.error("Gagal menyalin username.");
    }
  };

  if (isCheckingAuth || !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#0D47A1] mb-3" />
        <p className="text-sm font-semibold text-slate-700">
          Memuat Data Akun Unit Kerja...
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
              <Users className="w-5 h-5 text-[#0D47A1]" />
              <span className="font-bold text-sm text-slate-900">
                Data Akun Unit Kerja
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
                  Manajemen Akses &amp; Otoritas Unit
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Data Akun Unit Kerja
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Kelola akun operator Staf dan Pimpinan untuk seluruh Biro,
                Pusat, dan Laboratorium dengan proteksi anti-pimpinan ganda dan
                kontrol suspend akses.
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
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-950 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all duration-200 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-[#FBC02D]" />
                <span>Tambah Akun Unit</span>
              </button>
            </div>
          </div>
        </section>

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* 3 Kartu Statistik: Total Akun Unit, Akun Aktif, Akun Disuspend */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Total Akun Unit */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0f172a] via-blue-950 to-[#0D47A1] text-white shadow-md shadow-blue-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Total Akun Unit
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.total}
                </p>
                <p className="text-xs text-blue-100/80 mt-1">
                  Akun staf &amp; pimpinan terdaftar
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/40 flex items-center justify-center text-white shrink-0">
                <Users className="w-6 h-6 text-[#FBC02D]" />
              </div>
            </div>

            {/* 2. Akun Aktif */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Akun Aktif
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.aktif}
                </p>
                <p className="text-xs text-white/85 mt-1">
                  Diizinkan mengakses sistem
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/50 flex items-center justify-center text-white shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>

            {/* 3. Akun Disuspend */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-rose-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Akun Disuspend
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.suspend}
                </p>
                <p className="text-xs text-white/85 mt-1">
                  Akses login dinonaktifkan
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/50 flex items-center justify-center text-white shrink-0">
                <UserX className="w-6 h-6" />
              </div>
            </div>
          </section>

          {/* Filter Pencarian: Search + Semua Kategori Unit + Filter Jabatan */}
          <section className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari username atau nama unit kerja..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1] transition-all duration-200"
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

            {/* Filter Semua Kategori Unit */}
            <div className="relative min-w-[200px] sm:w-auto w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Filter className="w-4 h-4" />
              </div>
              <select
                aria-label="Filter Kategori Unit"
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1] appearance-none cursor-pointer transition-all duration-200"
              >
                <option value="ALL">Semua Kategori Unit</option>
                {kategoriOptions.map((kat) => (
                  <option key={kat} value={kat.toLowerCase()}>
                    {kat}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {/* Filter Jabatan */}
            <div className="relative min-w-[180px] sm:w-auto w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Briefcase className="w-4 h-4" />
              </div>
              <select
                aria-label="Filter Jabatan"
                value={filterJabatan}
                onChange={(e) => setFilterJabatan(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1] appearance-none cursor-pointer transition-all duration-200"
              >
                <option value="ALL">Semua Jabatan</option>
                <option value="pimpinan">Pimpinan</option>
                <option value="staf">Staf</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </section>

          {/* Tabel Data Akun Unit Kerja */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#0D47A1]" />
                <p className="text-xs font-semibold text-slate-500">
                  Memuat daftar akun unit kerja dari server...
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-4 w-16">NO</th>
                      <th className="px-6 py-4">NAMA UNIT KERJA</th>
                      <th className="px-6 py-4">KATEGORI</th>
                      <th className="px-6 py-4">USERNAME &amp; JABATAN</th>
                      <th className="px-6 py-4 text-center">STATUS AKSES</th>
                      <th className="px-6 py-4 text-right">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAkunList.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-16 text-center text-slate-500"
                        >
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Users className="w-9 h-9 text-slate-300" />
                            <p className="font-semibold text-slate-700">
                              Tidak ada akun unit kerja yang sesuai filter
                            </p>
                            <p className="text-xs text-slate-400">
                              Klik tombol &ldquo;Tambah Akun Unit&rdquo; di kanan
                              atas untuk membuat akun baru.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredAkunList.map((item, idx) => {
                        const kategoriLabel =
                          item.unit_kerja?.kategori?.nama_kategori ||
                          item.unit_kerja?.kategori_unit ||
                          item.role ||
                          "Unit";
                        const katBadge = getKategoriBadge(kategoriLabel);
                        const isPimpinan =
                          (item.jabatan || "").toLowerCase() === "pimpinan";
                        const isAktif =
                          item.status_akses !== "suspend" &&
                          Boolean(item.is_active);
                        const isTogglingThis = togglingId === item.id;

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-blue-50/30 transition-colors duration-150"
                          >
                            <td className="px-6 py-4 text-xs font-bold text-slate-400 font-mono">
                              {idx + 1}
                            </td>

                            {/* NAMA UNIT KERJA */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-[#0D47A1] shrink-0">
                                  <Building2 className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">
                                    {sanitizePlainText(
                                      item.unit_kerja?.nama_unit ||
                                        "Unit Tidak Diketahui"
                                    )}
                                  </p>
                                  <p className="text-[11px] text-slate-400 font-mono">
                                    Role Sistem: {sanitizePlainText(item.role)}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* KATEGORI */}
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${katBadge.badgeClass}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${katBadge.dotClass}`}
                                />
                                <span>{katBadge.label}</span>
                              </span>
                            </td>

                            {/* USERNAME & JABATAN */}
                            <td className="px-6 py-4">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm">
                                    {sanitizePlainText(item.username)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyUsername(item.username)
                                    }
                                    className="p-1 rounded-md text-slate-400 hover:text-[#0D47A1] hover:bg-blue-50 transition cursor-pointer"
                                    title="Salin username"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div>
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                                      isPimpinan
                                        ? "bg-blue-50 text-[#0D47A1] border-blue-200"
                                        : "bg-slate-100 text-slate-700 border-slate-200"
                                    }`}
                                  >
                                    {isPimpinan
                                      ? "JABATAN: PIMPINAN"
                                      : "JABATAN: STAF"}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* STATUS AKSES */}
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                  isAktif
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isAktif ? "bg-emerald-500" : "bg-rose-500"
                                  }`}
                                />
                                <span>{isAktif ? "Aktif" : "Disuspend"}</span>
                              </span>
                            </td>

                            {/* AKSI */}
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(item)}
                                  disabled={isTogglingThis}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer disabled:opacity-50 ${
                                    isAktif
                                      ? "bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-white border-amber-200"
                                      : "bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border-emerald-200"
                                  }`}
                                  title={
                                    isAktif
                                      ? "Suspend akses akun"
                                      : "Aktifkan kembali akses akun"
                                  }
                                >
                                  {isTogglingThis ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Power className="w-3.5 h-3.5" />
                                  )}
                                  <span>
                                    {isAktif ? "Suspend" : "Aktifkan"}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#0D47A1] bg-blue-50/70 hover:bg-[#0D47A1] hover:text-white border border-blue-200/60 transition cursor-pointer"
                                  title="Edit akun"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50/70 hover:bg-red-600 hover:text-white border border-red-200/60 transition cursor-pointer"
                                  title="Hapus akun"
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
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Modal Tambah / Edit Akun Unit Kerja */}
      <TambahAkunModal
        isOpen={isModalOpen}
        mode={modalMode}
        unitList={unitList}
        editTarget={editTarget}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
      />

      {/* Modal Konfirmasi Hapus Akun */}
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
                  Konfirmasi Hapus Akun
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus akun unit kerja berikut
                  secara permanen?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Username Akun
              </p>
              <p className="text-sm font-bold text-slate-900 font-mono">
                {sanitizePlainText(deleteTarget.username)}
              </p>
              <p className="text-xs text-slate-600">
                {sanitizePlainText(
                  deleteTarget.unit_kerja?.nama_unit || "Unit Kerja"
                )}
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Tindakan ini permanen. Jika hanya ingin memblokir login
                sementara, gunakan tombol <strong>Suspend</strong>.
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
                    <span>Ya, Hapus Akun</span>
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
