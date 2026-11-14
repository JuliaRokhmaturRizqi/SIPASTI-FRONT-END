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
  Copy,
  Edit3,
  KeyRound,
  Loader2,
  Lock,
  Menu,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
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

// --- Tipe Data ---
export interface AkunUnitItem {
  id: number;
  username: string;
  role: "biro" | "pusat" | "lab" | "admin" | "user";
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

export interface UnitKerjaOption {
  id: number;
  nama_unit: string;
  kategori_unit: string;
  kategori?: {
    id: number;
    nama_kategori: string;
  } | null;
}

/**
 * Generator username otomatis dari nama Unit Kerja:
 * "Biro Administrasi Umum" -> "unit_biro_administrasi_umum"
 * "Pusat Bahasa dan Kebudayaan" -> "unit_pusat_bahasa_dan_kebudayaan"
 */
export function generateAutoUsernameFromUnit(namaUnit: string): string {
  const cleaned = namaUnit
    .trim()
    .toLowerCase()
    .replace(/^unit\s+/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");

  return cleaned ? `unit_${cleaned}` : "unit_operator";
}

/**
 * Helper konfigurasi warna badge Kategori Unit
 */
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

  // State Auth & Profil Admin
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State Data
  const [akunList, setAkunList] = useState<AkunUnitItem[]>([]);
  const [unitOptions, setUnitOptions] = useState<UnitKerjaOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [filterKategori, setFilterKategori] = useState<string>("ALL");

  // State Modal Create / Edit Akun
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields State
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // State Modal Reset Password Cepat
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<AkunUnitItem | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("Unuha2026!");
  const [isResetting, setIsResetting] = useState(false);

  // State Modal Konfirmasi Hapus Akun
  const [deleteTarget, setDeleteTarget] = useState<AkunUnitItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // State Loading Toggle Status
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  /**
   * Fetch seluruh data akun unit dan daftar master unit kerja
   */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [akunRes, unitRes] = await Promise.all([
        apiClient.get<{ status: string; data?: AkunUnitItem[] }>("/api/akun-unit"),
        apiClient.get<{ status: string; data?: UnitKerjaOption[] }>("/api/unit-kerja"),
      ]);

      setAkunList(akunRes.data?.data || []);
      setUnitOptions(unitRes.data?.data || []);
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
            "Gagal mengambil data akun unit dari server."
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

  // Statistik Ringkasan Akun
  const stats = useMemo(() => {
    const total = akunList.length;
    const active = akunList.filter((a) => a.is_active).length;
    const suspended = total - active;
    return { total, active, suspended };
  }, [akunList]);

  // Daftar Kategori Unik untuk Filter
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    akunList.forEach((a) => {
      const kat = a.unit_kerja?.kategori?.nama_kategori || a.unit_kerja?.kategori_unit;
      if (kat) set.add(kat);
    });
    return Array.from(set);
  }, [akunList]);

  // Filter Data Akun
  const filteredList = useMemo(() => {
    return akunList.filter((item) => {
      // Filter Status
      if (filterStatus === "ACTIVE" && !item.is_active) return false;
      if (filterStatus === "SUSPENDED" && item.is_active) return false;

      // Filter Kategori
      const itemKat =
        item.unit_kerja?.kategori?.nama_kategori ||
        item.unit_kerja?.kategori_unit ||
        "";
      if (
        filterKategori !== "ALL" &&
        itemKat.toLowerCase() !== filterKategori.toLowerCase()
      ) {
        return false;
      }

      // Filter Pencarian
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const namaUnit = (item.unit_kerja?.nama_unit || "").toLowerCase();
        const username = item.username.toLowerCase();
        const kat = itemKat.toLowerCase();
        return namaUnit.includes(q) || username.includes(q) || kat.includes(q);
      }

      return true;
    });
  }, [akunList, filterStatus, filterKategori, searchQuery]);

  // Handle Pilih Unit saat Tambah Akun (Auto-Generate Username)
  const handleUnitSelectChange = (unitIdStr: string) => {
    setSelectedUnitId(unitIdStr);
    const selected = unitOptions.find((u) => u.id === Number(unitIdStr));
    if (selected && modalMode === "create") {
      setFormUsername(generateAutoUsernameFromUnit(selected.nama_unit));
    }
  };

  // Buka Modal Tambah Akun
  const handleOpenCreateModal = () => {
    setModalMode("create");
    setEditId(null);

    // Cari unit kerja pertama yang belum memiliki akun
    const existingUnitIds = new Set(akunList.map((a) => a.id_unit_kerja));
    const availableUnit = unitOptions.find((u) => !existingUnitIds.has(u.id));

    if (availableUnit) {
      setSelectedUnitId(availableUnit.id.toString());
      setFormUsername(generateAutoUsernameFromUnit(availableUnit.nama_unit));
    } else if (unitOptions.length > 0) {
      setSelectedUnitId(unitOptions[0].id.toString());
      setFormUsername(generateAutoUsernameFromUnit(unitOptions[0].nama_unit));
    } else {
      setSelectedUnitId("");
      setFormUsername("");
    }

    setFormPassword("Unuha2026!");
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  // Buka Modal Edit Akun
  const handleOpenEditModal = (item: AkunUnitItem) => {
    setModalMode("edit");
    setEditId(item.id);
    setSelectedUnitId(item.id_unit_kerja.toString());
    setFormUsername(item.username);
    setFormPassword(""); // Kosongkan agar tidak mengubah password jika tidak diisi
    setFormIsActive(item.is_active);
    setIsModalOpen(true);
  };

  // Submit Simpan Akun (Create / Edit)
  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedUnitId) {
      toast.error("Silakan pilih unit kerja terlebih dahulu.");
      return;
    }

    if (!formUsername.trim()) {
      toast.error("Username wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === "create") {
        const payload: {
          id_unit_kerja: number;
          username: string;
          password?: string;
          is_active: boolean;
        } = {
          id_unit_kerja: Number(selectedUnitId),
          username: formUsername.trim(),
          is_active: formIsActive,
        };

        if (formPassword.trim()) {
          payload.password = formPassword.trim();
        }

        const res = await apiClient.post("/api/akun-unit", payload);
        toast.success(res.data?.message || "Akun operator unit berhasil dibuat.");
      } else {
        const payload: {
          id_unit_kerja: number;
          username: string;
          password?: string;
          is_active: boolean;
        } = {
          id_unit_kerja: Number(selectedUnitId),
          username: formUsername.trim(),
          is_active: formIsActive,
        };

        if (formPassword.trim()) {
          payload.password = formPassword.trim();
        }

        const res = await apiClient.put(`/api/akun-unit/${editId}`, payload);
        toast.success(res.data?.message || "Akun operator unit berhasil diperbarui.");
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
          "Terjadi kesalahan saat menyimpan akun."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Status Akses (Aktif / Suspend)
  const handleToggleStatus = async (item: AkunUnitItem) => {
    if (togglingId) return;
    setTogglingId(item.id);

    try {
      const res = await apiClient.patch(`/api/akun-unit/${item.id}/toggle-status`);
      toast.success(
        res.data?.message ||
          `Status akun "${item.username}" berhasil diubah.`
      );
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast.error(
        axiosErr.response?.data?.message || "Gagal mengubah status akun operator."
      );
    } finally {
      setTogglingId(null);
    }
  };

  // Buka Modal Reset Password Cepat
  const handleOpenResetModal = (item: AkunUnitItem) => {
    setResetTargetUser(item);
    setResetNewPassword("Unuha2026!");
    setIsResetModalOpen(true);
  };

  // Eksekusi Reset Password
  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || isResetting) return;

    if (!resetNewPassword.trim()) {
      toast.error("Kata sandi baru tidak boleh kosong.");
      return;
    }

    setIsResetting(true);
    try {
      const res = await apiClient.put(`/api/akun-unit/${resetTargetUser.id}`, {
        password: resetNewPassword.trim(),
      });
      toast.success(
        res.data?.message ||
          `Kata sandi akun "${resetTargetUser.username}" berhasil direset.`
      );
      setIsResetModalOpen(false);
      setResetTargetUser(null);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast.error(
        axiosErr.response?.data?.message || "Gagal mereset kata sandi akun."
      );
    } finally {
      setIsResetting(false);
    }
  };

  // Eksekusi Hapus Akun
  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await apiClient.delete(`/api/akun-unit/${deleteTarget.id}`);
      toast.success(
        res.data?.message ||
          `Akun "${deleteTarget.username}" berhasil dihapus dari sistem.`
      );
      setDeleteTarget(null);
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast.error(
        axiosErr.response?.data?.message || "Gagal menghapus akun operator."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Salin username ke clipboard
  const handleCopyUsername = (username: string) => {
    navigator.clipboard.writeText(username);
    toast.success(`Username "${username}" disalin ke clipboard!`);
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
                  Otoritas Unit Kerja
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Manajemen Akun Operator Unit Kerja
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Kelola kredensial akses dan hak otorisasi untuk operator Unit
                Kerja (Biro, Pusat, Laboratorium, dan Lembaga) di Universitas
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
          {/* 3 Kartu Statistik Gradient */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1e5bb8] to-[#0D47A1] text-white shadow-md shadow-blue-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Total Akun Unit
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.total}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Akun operator terdaftar
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Akun Aktif
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.active}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Dapat login & input kinerja
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-red-900/15 flex items-center justify-between transition-transform duration-200 hover:-translate-y-0.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Akun Disuspend
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.suspended}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Akses login dinonaktifkan
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                <UserX className="w-6 h-6" />
              </div>
            </div>
          </section>

          {/* Baris Filter & Pencarian */}
          <section className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {/* Filter Status */}
              <div className="relative min-w-[150px]">
                <select
                  value={filterStatus}
                  onChange={(e) =>
                    setFilterStatus(
                      e.target.value as "ALL" | "ACTIVE" | "SUSPENDED"
                    )
                  }
                  className="w-full pl-3.5 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1] appearance-none cursor-pointer transition-all duration-200"
                >
                  <option value="ALL">Semua Status ({stats.total})</option>
                  <option value="ACTIVE">Aktif ({stats.active})</option>
                  <option value="SUSPENDED">
                    Disuspend ({stats.suspended})
                  </option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {/* Filter Kategori */}
              {uniqueCategories.length > 0 && (
                <div className="relative min-w-[160px]">
                  <select
                    value={filterKategori}
                    onChange={(e) => setFilterKategori(e.target.value)}
                    className="w-full pl-3.5 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 focus:border-[#0D47A1] appearance-none cursor-pointer transition-all duration-200"
                  >
                    <option value="ALL">Semua Kategori</option>
                    {uniqueCategories.map((kat) => (
                      <option key={kat} value={kat}>
                        {kat}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              )}

              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama unit, username, atau kategori..."
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

          {/* Tabel Daftar Akun Otorisasi Unit Kerja */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Daftar Akun Otorisasi Unit Kerja
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Menampilkan {filteredList.length} dari {akunList.length} total
                  akun operator
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#0D47A1]" />
                <p className="text-xs font-semibold text-slate-500">
                  Memuat data akun operator dari server...
                </p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                  <Users className="w-10 h-10 text-slate-300" />
                  <p className="font-semibold text-slate-700">
                    Tidak ada akun unit kerja yang sesuai
                  </p>
                  <p className="text-xs text-slate-400">
                    Klik tombol &ldquo;Tambah Akun Unit&rdquo; di kanan atas
                    untuk membuat akun operator baru.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-4 w-16">No</th>
                      <th className="px-6 py-4">Nama Unit Kerja</th>
                      <th className="px-6 py-4">Kategori</th>
                      <th className="px-6 py-4">Username & Role</th>
                      <th className="px-6 py-4 text-center">Status Akses</th>
                      <th className="px-6 py-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredList.map((item, idx) => {
                      const kat =
                        item.unit_kerja?.kategori?.nama_kategori ||
                        item.unit_kerja?.kategori_unit ||
                        "Unit";
                      const badge = getKategoriBadge(kat);

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-blue-50/30 transition-colors duration-150"
                        >
                          <td className="px-6 py-4 text-xs font-bold text-slate-400 font-mono">
                            {idx + 1}
                          </td>

                          {/* Unit Kerja */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-[#0D47A1] font-bold text-xs shrink-0">
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">
                                  {sanitizePlainText(
                                    item.unit_kerja?.nama_unit || "Unit Kerja"
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-400 font-mono">
                                  ID Unit: #{item.id_unit_kerja}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Kategori Badge */}
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

                          {/* Username & Role */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                {sanitizePlainText(item.username)}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyUsername(item.username)
                                }
                                title="Salin username"
                                className="text-slate-400 hover:text-[#0D47A1] p-1 rounded transition"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">
                              Role: {item.role}
                            </p>
                          </td>

                          {/* Status Akses */}
                          <td className="px-6 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(item)}
                              disabled={togglingId === item.id}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                                item.is_active
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                              } ${
                                togglingId === item.id ? "opacity-50" : ""
                              }`}
                              title="Klik untuk ubah status akses"
                            >
                              {togglingId === item.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Power className="w-3 h-3" />
                              )}
                              <span>
                                {item.is_active ? "Aktif" : "Disuspend"}
                              </span>
                            </button>
                          </td>

                          {/* Aksi */}
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {/* Tombol Edit */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0D47A1] bg-blue-50/70 hover:bg-[#0D47A1] hover:text-white border border-blue-200/60 transition-all duration-200 cursor-pointer"
                                title="Edit Akun"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              {/* Tombol Reset Sandi */}
                              <button
                                type="button"
                                onClick={() => handleOpenResetModal(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50/70 hover:bg-amber-600 hover:text-white border border-amber-200/60 transition-all duration-200 cursor-pointer"
                                title="Reset Sandi"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>Sandi</span>
                              </button>

                              {/* Tombol Hapus */}
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50/70 hover:bg-red-600 hover:text-white border border-red-200/60 transition-all duration-200 cursor-pointer"
                                title="Hapus Akun"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Modal Tambah / Edit Akun */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-[#0D47A1] to-[#1565C0] px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-[#FBC02D]" />
                <h3 className="font-bold text-base">
                  {modalMode === "create" ? "Tambah Akun" : "Edit Akun"}{" "}
                  Operator Unit
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

            <form onSubmit={handleSubmitAccount} className="p-6 space-y-4">
              {/* Dropdown Unit Kerja */}
              <div>
                <label
                  htmlFor="select-unit-kerja"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                >
                  Unit Kerja <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="select-unit-kerja"
                    required
                    disabled={isSubmitting}
                    value={selectedUnitId}
                    onChange={(e) => handleUnitSelectChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-9 text-sm font-semibold text-slate-800 bg-white focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none appearance-none cursor-pointer transition"
                  >
                    <option value="" disabled>
                      -- Pilih Unit Kerja --
                    </option>
                    {unitOptions.map((u) => {
                      const kat =
                        u.kategori?.nama_kategori || u.kategori_unit;
                      return (
                        <option key={u.id} value={u.id}>
                          {u.nama_unit} ({kat})
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Username Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="input-username"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    Username <span className="text-red-500">*</span>
                  </label>
                  {modalMode === "create" && selectedUnitId && (
                    <button
                      type="button"
                      onClick={() => {
                        const sel = unitOptions.find(
                          (u) => u.id === Number(selectedUnitId)
                        );
                        if (sel) {
                          setFormUsername(
                            generateAutoUsernameFromUnit(sel.nama_unit)
                          );
                        }
                      }}
                      className="text-[11px] font-semibold text-[#0D47A1] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-[#FBC02D]" />
                      Auto-generate
                    </button>
                  )}
                </div>
                <input
                  id="input-username"
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="Contoh: unit_biro_akademik"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none transition"
                />
              </div>

              {/* Password Input */}
              <div>
                <label
                  htmlFor="input-password"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                >
                  Kata Sandi{" "}
                  {modalMode === "create" ? (
                    <span className="text-slate-400 font-normal lowercase">
                      (default: Unuha2026!)
                    </span>
                  ) : (
                    <span className="text-slate-400 font-normal lowercase">
                      (kosongkan jika tidak diubah)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="input-password"
                    type="text"
                    disabled={isSubmitting}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={
                      modalMode === "create"
                        ? "Unuha2026!"
                        : "Isi sandi baru jika ingin mengubah"
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#0D47A1] focus:ring-2 focus:ring-[#0D47A1]/20 outline-none transition"
                  />
                </div>
              </div>

              {/* Status Akses */}
              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    disabled={isSubmitting}
                    className="w-4 h-4 text-[#0D47A1] rounded border-slate-300 focus:ring-[#0D47A1]"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Aktifkan Hak Akses Login
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Operator dapat langsung login menggunakan kredensial ini.
                    </p>
                  </div>
                </label>
              </div>

              {/* Tombol Submit */}
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
                      <span>Simpan Akun</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Sandi Cepat */}
      {isResetModalOpen && resetTargetUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">Reset Kata Sandi</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteResetPassword} className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Akun Target
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {resetTargetUser.unit_kerja?.nama_unit}
                </p>
                <p className="text-xs font-mono text-slate-600">
                  @{resetTargetUser.username}
                </p>
              </div>

              <div>
                <label
                  htmlFor="input-reset-password"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                >
                  Kata Sandi Baru <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="input-reset-password"
                    type="text"
                    required
                    disabled={isResetting}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Contoh: Unuha2026!"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 outline-none transition"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={isResetting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Reset Kata Sandi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  Hapus Akun Operator
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus akun operator berikut dari
                  sistem?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Unit Kerja
              </p>
              <p className="text-sm font-bold text-slate-900">
                {deleteTarget.unit_kerja?.nama_unit}
              </p>
              <p className="text-xs font-mono text-slate-600">
                Username: @{deleteTarget.username}
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Tindakan ini permanen. Operator dari unit kerja ini tidak akan
                bisa login lagi sampai akun baru dibuatkan.
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
