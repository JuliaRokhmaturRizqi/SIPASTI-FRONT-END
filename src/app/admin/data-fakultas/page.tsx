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
  ChevronDown,
  Edit3,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  Menu,
  Plus,
  Power,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import apiClient from "@/lib/axios";
import { clearAuthSession, getAuthSession, logoutSession } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/security";
import { ApiErrorResponse, AuthUser } from "@/types/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

/**
 * Interface Master Fakultas dari API GET /api/fakultas
 */
export interface Fakultas {
  id: number;
  nama_fakultas: string;
  singkatan?: string | null;
  prodi_count?: number;
  users_count?: number;
  prodi?: Array<{
    id: number;
    id_fakultas: number;
    nama_prodi: string;
    periode_mulai_aktif?: string | null;
  }>;
  users?: Array<{
    id: number;
    username: string;
    role: "user" | "admin";
    id_fakultas: number;
    is_active: boolean;
    created_at?: string;
  }>;
}

/**
 * Interface Data Akun Operator Fakultas dari API GET /api/akun-fakultas
 */
export interface AkunFakultasItem {
  id: number;
  username: string;
  role: "user" | "admin";
  id_fakultas: number;
  is_active: boolean;
  created_at?: string;
  fakultas?: {
    id: number;
    singkatan?: string | null;
    nama_fakultas: string;
    prodi?: Array<{
      id: number;
      id_fakultas: number;
      nama_prodi: string;
      periode_mulai_aktif?: string | null;
    }>;
  } | null;
}

export interface AkunFakultasListResponse {
  status: "success" | "error";
  message?: string;
  data?: AkunFakultasItem[];
}

export interface AkunFakultasMutationResponse {
  status: "success" | "error";
  message: string;
  data?: AkunFakultasItem;
}

/**
 * Logika JavaScript Auto-fill Cerdas:
 * Mengubah nama Fakultas (misal: "Fakultas Sains dan Teknologi" atau "Fakultas Agama Islam")
 * menjadi format username otomatis:
 * - "Fakultas Sains dan Teknologi" -> "fakultas_sains_dan_teknologi"
 * - "Fakultas Agama Islam" -> "fakultas_agama_islam"
 * - "Pascasarjana" -> "fakultas_pascasarjana"
 */
export function generateAutoUsernameFromFakultas(namaFakultas: string): string {
  const cleaned = namaFakultas
    .trim()
    .toLowerCase()
    .replace(/^fakultas\s+/i, "") // Hapus awalan 'fakultas ' agar tidak menjadi fakultas_fakultas_...
    .replace(/[^a-z0-9\s]/g, "") // Bersihkan karakter non-alfanumerik
    .replace(/\s+/g, "_"); // Ganti spasi dengan underscore

  return cleaned ? `fakultas_${cleaned}` : "fakultas_operator";
}

/**
 * Helper mencocokkan informasi Fakultas untuk akun Operator berdasarkan relasi API atau state fakultasOptions dinamis
 */
function resolveFakultasLabel(
  item: AkunFakultasItem,
  fakultasOptions: Fakultas[] = []
): {
  nama_fakultas: string;
  singkatan: string;
  prodiCount: number;
} {
  const matchedDynamic = fakultasOptions.find(
    (f) =>
      f.id === item.id_fakultas ||
      (item.fakultas?.nama_fakultas &&
        f.nama_fakultas.trim().toLowerCase() ===
          item.fakultas.nama_fakultas.trim().toLowerCase())
  );

  if (item.fakultas?.nama_fakultas) {
    return {
      nama_fakultas: item.fakultas.nama_fakultas,
      singkatan:
        item.fakultas.singkatan || matchedDynamic?.singkatan || "UNUHA",
      prodiCount:
        item.fakultas.prodi?.length ??
        matchedDynamic?.prodi_count ??
        matchedDynamic?.prodi?.length ??
        0,
    };
  }

  if (matchedDynamic) {
    return {
      nama_fakultas: matchedDynamic.nama_fakultas,
      singkatan: matchedDynamic.singkatan || "UNUHA",
      prodiCount:
        matchedDynamic.prodi_count ?? matchedDynamic.prodi?.length ?? 0,
    };
  }

  return {
    nama_fakultas: "Universitas Nurul Huda",
    singkatan: "UNUHA",
    prodiCount: 0,
  };
}

export default function ManajemenDataFakultasPage() {
  const router = useRouter();

  // State Otorisasi & Profil Admin
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] =
    useState<boolean>(false);

  // State Utama Tabel Akun Fakultas & Pencarian (Dinamis dari API)
  const [akunFakultas, setAkunFakultas] = useState<AkunFakultasItem[]>([]);
  const [fakultasOptions, setFakultasOptions] = useState<Fakultas[]>([]);
  const [isLoadingTable, setIsLoadingTable] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // State Modal Form 'Hybrid' (Tambah / Edit Akun Fakultas)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingAccount, setEditingAccount] =
    useState<AkunFakultasItem | null>(null);
  const [selectedFakultasName, setSelectedFakultasName] = useState<string>("");
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState<boolean>(false);

  // State Loading Aksi Cepat (Reset Sandi & Toggle Status per baris)
  const [processingRowId, setProcessingRowId] = useState<number | null>(null);

  // State Modal Konfirmasi Hapus Akun Operator Fakultas
  const [deleteAccountTarget, setDeleteAccountTarget] =
    useState<AkunFakultasItem | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  /**
   * Fungsi Fetch Data Master Fakultas & Tabel Akun Fakultas:
   * Mengambil dari GET /api/fakultas (termasuk relasi users) dan GET /api/akun-fakultas
   */
  const fetchAkunFakultas = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) {
        setIsLoadingTable(true);
      }

      try {
        const [fakultasRes, akunRes] = await Promise.all([
          apiClient.get<{ status: string; data?: Fakultas[] }>("/api/fakultas"),
          apiClient
            .get<AkunFakultasListResponse>("/api/akun-fakultas")
            .catch(() => null),
        ]);

        const dbFakultasList = fakultasRes.data?.data || [];
        setFakultasOptions(dbFakultasList);

        const directAccounts = akunRes?.data?.data;
        if (Array.isArray(directAccounts) && directAccounts.length > 0) {
          setAkunFakultas(directAccounts);
        } else {
          // Ekstrak dari relasi users di dalam /api/fakultas jika tersedia
          const flattenedAccounts: AkunFakultasItem[] = [];
          dbFakultasList.forEach((fak) => {
            if (Array.isArray(fak.users)) {
              fak.users.forEach((usr) => {
                if (usr.role === "user") {
                  flattenedAccounts.push({
                    id: usr.id,
                    username: usr.username,
                    role: usr.role,
                    id_fakultas: usr.id_fakultas ?? fak.id,
                    is_active: Boolean(usr.is_active),
                    created_at: usr.created_at,
                    fakultas: {
                      id: fak.id,
                      singkatan: fak.singkatan,
                      nama_fakultas: fak.nama_fakultas,
                      prodi: fak.prodi,
                    },
                  });
                }
              });
            }
          });
          setAkunFakultas(flattenedAccounts);
        }
      } catch (err) {
        const axiosErr = err as AxiosError<ApiErrorResponse>;
        const status = axiosErr.response?.status;

        if (status === 401 || status === 403) {
          handleUnauthorizedExit();
          return;
        }

        toast.error(
          axiosErr.response?.data?.message ||
            "Gagal memuat daftar akun operator Fakultas dari server."
        );
      } finally {
        if (showSpinner) {
          setIsLoadingTable(false);
        }
      }
    },
    [handleUnauthorizedExit]
  );

  /**
   * Verifikasi Otorisasi Admin & Inisialisasi Data GET /api/fakultas serta GET /api/akun-fakultas
   */
  useEffect(() => {
    let isMounted = true;

    const verifyAndFetch = async () => {
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
          "/api/me"
        );
        const verifiedUser = meRes.data?.data;

        if (!verifiedUser || verifiedUser.role !== "admin") {
          handleUnauthorizedExit();
          return;
        }

        // Ambil data Master Fakultas secara dinamis dari /api/fakultas
        try {
          const fakultasRes = await apiClient.get<{
            status: string;
            data?: Fakultas[];
          }>("/api/fakultas");

          const dbFakultasList = fakultasRes.data?.data || [];
          if (isMounted) {
            setFakultasOptions(dbFakultasList);
            if (dbFakultasList.length > 0) {
              setSelectedFakultasName(dbFakultasList[0].nama_fakultas);
              setUsernameInput(
                generateAutoUsernameFromFakultas(dbFakultasList[0].nama_fakultas)
              );
            }
          }
        } catch {
          if (isMounted) {
            setFakultasOptions([]);
          }
        }

        if (isMounted) {
          setUser(verifiedUser);
          setIsAuthorized(true);
          setIsCheckingAuth(false);
        }

        await fetchAkunFakultas(true);
      } catch (err) {
        const axiosErr = err as AxiosError;
        const status = axiosErr.response?.status;
        if (status === 401 || status === 403 || !axiosErr.response) {
          handleUnauthorizedExit();
        }
      }
    };

    verifyAndFetch();

    return () => {
      isMounted = false;
    };
  }, [handleUnauthorizedExit, fetchAkunFakultas]);

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
   * Buka Modal dalam Mode Tambah Akun Baru
   */
  const openCreateModal = () => {
    const defaultFakultas = fakultasOptions[0];
    const defaultFakultasName = defaultFakultas?.nama_fakultas || "";
    setModalMode("create");
    setEditingAccount(null);
    setSelectedFakultasName(defaultFakultasName);
    setUsernameInput(
      defaultFakultasName
        ? generateAutoUsernameFromFakultas(defaultFakultasName)
        : ""
    );
    setPasswordInput("");
    setFormError(null);
    setIsModalOpen(true);
  };

  /**
   * Buka Modal dalam Mode Edit Akun
   */
  const openEditModal = (account: AkunFakultasItem) => {
    const matchedFakultas = fakultasOptions.find(
      (f) => f.id === account.id_fakultas
    );
    const fakultasName =
      account.fakultas?.nama_fakultas ||
      matchedFakultas?.nama_fakultas ||
      fakultasOptions[0]?.nama_fakultas ||
      "";
    setModalMode("edit");
    setEditingAccount(account);
    setSelectedFakultasName(fakultasName);
    setUsernameInput(account.username);
    setPasswordInput("");
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmittingForm) return;
    setIsModalOpen(false);
    setEditingAccount(null);
    setFormError(null);
  };

  /**
   * Handler saat Dropdown Fakultas di Modal dipilih:
   * Otomatis men-generate & mengisi state username (Auto-fill Cerdas)
   * Contoh:
   * - "Fakultas Sains dan Teknologi" -> "fakultas_sains_dan_teknologi"
   * - "Fakultas Agama Islam" -> "fakultas_agama_islam"
   */
  const handleSelectFakultasChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const chosenFakultasName = e.target.value;
    setSelectedFakultasName(chosenFakultasName);

    const autoGeneratedUsername =
      generateAutoUsernameFromFakultas(chosenFakultasName);
    setUsernameInput(autoGeneratedUsername);
    if (formError) setFormError(null);
  };

  /**
   * Submit Form Modal (POST untuk Tambah / PUT untuk Edit ke /api/akun-fakultas)
   */
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingForm) return;

    setFormError(null);

    const cleanUsername = sanitizePlainText(usernameInput)
      .trim()
      .toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      const msg = "Username wajib diisi (minimal 3 karakter).";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
      const msg =
        "Username hanya boleh berisi huruf kecil, angka, garis bawah (_), atau tanda hubung (-).";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    if (passwordInput.trim().length > 0 && passwordInput.trim().length < 6) {
      const msg = "Password kustom minimal terdiri dari 6 karakter.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    const chosenFakultasMeta = fakultasOptions.find(
      (f) => f.nama_fakultas === selectedFakultasName
    );

    if (modalMode === "create" && !chosenFakultasMeta) {
      const msg =
        "Silakan pilih Fakultas yang valid terlebih dahulu dari daftar.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmittingForm(true);

    try {
      if (modalMode === "create" && chosenFakultasMeta) {
        const response = await apiClient.post<AkunFakultasMutationResponse>(
          "/api/akun-fakultas",
          {
            id_fakultas: chosenFakultasMeta.id,
            username: cleanUsername,
            password: passwordInput.trim() ? passwordInput.trim() : null,
          }
        );

        toast.success(
          response.data?.message ||
            `Akun operator ${cleanUsername} berhasil ditambahkan.`
        );
      } else if (modalMode === "edit" && editingAccount) {
        const payload: {
          username: string;
          id_fakultas?: number;
          password?: string | null;
        } = {
          username: cleanUsername,
        };

        if (chosenFakultasMeta) {
          payload.id_fakultas = chosenFakultasMeta.id;
        }

        if (passwordInput.trim().length > 0) {
          payload.password = passwordInput.trim();
        }

        const response = await apiClient.put<AkunFakultasMutationResponse>(
          `/api/akun-fakultas/${editingAccount.id}`,
          payload
        );

        toast.success(
          response.data?.message ||
            `Akun operator ${cleanUsername} berhasil diperbarui.`
        );
      }

      setIsModalOpen(false);
      setEditingAccount(null);
      await fetchAkunFakultas(false);
    } catch (err) {
      const axiosErr = err as AxiosError<
        ApiErrorResponse & { errors?: Record<string, string[]> }
      >;
      const status = axiosErr.response?.status;

      if (status === 401 || status === 403) {
        handleUnauthorizedExit();
        return;
      }

      const backendError =
        axiosErr.response?.data?.errors?.id_fakultas?.[0] ||
        axiosErr.response?.data?.errors?.username?.[0] ||
        axiosErr.response?.data?.errors?.password?.[0] ||
        axiosErr.response?.data?.message ||
        "Terjadi kesalahan saat menyimpan data akun operator Fakultas.";

      const safeErr = sanitizePlainText(backendError);
      setFormError(safeErr);
      toast.error(safeErr);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  /**
   * Quick Action b: Reset Sandi
   * Mengirim PUT request ke /api/akun-fakultas/{id}
   * dengan payload password kosong & reset_password: true untuk memicu reset default (Unuha2026!) di backend.
   */
  const handleResetPassword = async (account: AkunFakultasItem) => {
    if (processingRowId !== null) return;

    const fakultasLabel =
      account.fakultas?.nama_fakultas || account.username;
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin mereset sandi akun "${account.username}" (${fakultasLabel}) ke sandi default (Unuha2026!)?`
    );

    if (!confirmed) return;

    setProcessingRowId(account.id);

    try {
      const response = await apiClient.put<AkunFakultasMutationResponse>(
        `/api/akun-fakultas/${account.id}`,
        {
          username: account.username,
          password: "",
          reset_password: true,
        }
      );

      toast.success(
        response.data?.message ||
          `Sandi untuk akun ${account.username} berhasil direset ke default (Unuha2026!).`
      );
      await fetchAkunFakultas(false);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      if (
        axiosErr.response?.status === 401 ||
        axiosErr.response?.status === 403
      ) {
        handleUnauthorizedExit();
        return;
      }

      toast.error(
        axiosErr.response?.data?.message ||
          `Gagal mereset sandi akun ${account.username}.`
      );
    } finally {
      setProcessingRowId(null);
    }
  };

  /**
   * Quick Action c: Suspend / Aktifkan Toggle
   * Mengirim request PATCH /api/akun-fakultas/{id}/toggle-status
   */
  const handleToggleStatus = async (account: AkunFakultasItem) => {
    if (processingRowId !== null) return;

    setProcessingRowId(account.id);

    try {
      const response = await apiClient.patch<AkunFakultasMutationResponse>(
        `/api/akun-fakultas/${account.id}/toggle-status`
      );

      const updatedItem = response.data?.data;
      setAkunFakultas((prevList) =>
        prevList.map((item) =>
          item.id === account.id
            ? {
                ...item,
                is_active:
                  updatedItem !== undefined
                    ? Boolean(updatedItem.is_active)
                    : !item.is_active,
              }
            : item
        )
      );

      toast.success(
        response.data?.message ||
          `Status akses akun ${account.username} berhasil diperbarui.`
      );
      await fetchAkunFakultas(false);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      if (
        axiosErr.response?.status === 401 ||
        axiosErr.response?.status === 403
      ) {
        handleUnauthorizedExit();
        return;
      }

      toast.error(
        axiosErr.response?.data?.message ||
          `Gagal mengubah status akses akun ${account.username}.`
      );
    } finally {
      setProcessingRowId(null);
    }
  };

  /**
   * Handler Konfirmasi Hapus Akun Operator Fakultas
   */
  const handleConfirmDeleteAccount = async () => {
    if (!deleteAccountTarget || isDeletingAccount) return;

    setIsDeletingAccount(true);
    const targetUsername = deleteAccountTarget.username;

    try {
      const response = await apiClient.delete(
        `/api/akun-fakultas/${deleteAccountTarget.id}`
      );
      toast.success(
        response.data?.message ||
          `Akun operator "${targetUsername}" berhasil dihapus dari database.`
      );
      setDeleteAccountTarget(null);
      await fetchAkunFakultas(false);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      if (
        axiosErr.response?.status === 401 ||
        axiosErr.response?.status === 403
      ) {
        handleUnauthorizedExit();
        return;
      }

      toast.error(
        axiosErr.response?.data?.message ||
          `Gagal menghapus akun operator ${targetUsername}.`
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  /**
   * Filter pencarian real-time berdasarkan Nama Fakultas, Singkatan, atau Username
   */
  const filteredAccounts = useMemo(() => {
    const q = sanitizePlainText(searchQuery).toLowerCase().trim();
    if (!q) return akunFakultas;

    return akunFakultas.filter((item) => {
      const fakInfo = resolveFakultasLabel(item, fakultasOptions);
      const uname = item.username.toLowerCase();

      return (
        fakInfo.nama_fakultas.toLowerCase().includes(q) ||
        fakInfo.singkatan.toLowerCase().includes(q) ||
        uname.includes(q)
      );
    });
  }, [akunFakultas, fakultasOptions, searchQuery]);

  /**
   * Statistik Ringkas Akun Fakultas
   */
  const stats = useMemo(() => {
    const total = akunFakultas.length;
    const aktif = akunFakultas.filter((a) => a.is_active).length;
    const nonaktif = total - aktif;
    return { total, aktif, nonaktif };
  }, [akunFakultas]);

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
      {/* Toast Notification (Hijau untuk Sukses, Merah untuk Error) */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: "14px",
            fontSize: "13px",
            fontWeight: 600,
            padding: "12px 16px",
          },
          success: {
            style: {
              background: "#ecfdf5",
              color: "#065f46",
              border: "1px solid #6ee7b7",
            },
            iconTheme: {
              primary: "#059669",
              secondary: "#ecfdf5",
            },
          },
          error: {
            style: {
              background: "#fef2f2",
              color: "#991b1b",
              border: "1px solid #fca5a5",
            },
            iconTheme: {
              primary: "#dc2626",
              secondary: "#fef2f2",
            },
          },
        }}
      />

      {/* Sidebar Navigasi Kiri */}
      <AdminSidebar
        username={user?.username || "admin"}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      {/* Area Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Top Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              aria-label="Buka navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                Manajemen Data Fakultas &amp; Akun Operator
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchAkunFakultas(true)}
              disabled={isLoadingTable}
              title="Muat ulang daftar akun Fakultas"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#0D47A1] ${
                  isLoadingTable ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">Sinkronkan</span>
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-950 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-blue-900/15 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#FBC02D]" />
              <span>Tambah Akun Fakultas</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-5 sm:p-8 space-y-8 max-w-7xl w-full mx-auto flex-1">
          {/* 3 Kartu Statistik Ringkas */}
          <section
            aria-label="Ringkasan Akun Operator Fakultas"
            className="grid grid-cols-1 sm:grid-cols-3 gap-5"
          >
            <div className="bg-gradient-to-br from-[#1e5bb8] to-[#0D47A1] rounded-2xl border border-blue-400/25 p-5 shadow-md shadow-blue-900/10 flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Total Akun Fakultas
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.total}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Operator Fakultas Terdaftar
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/60 text-white flex items-center justify-center shrink-0">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl border border-emerald-300/30 p-5 shadow-md shadow-emerald-900/10 flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Akses Aktif
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.aktif}
                </p>
                <p className="text-xs text-white/85 mt-1">
                  Dapat Login &amp; Mengunggah PDF
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/60 text-white flex items-center justify-center shrink-0">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-600 to-slate-800 rounded-2xl border border-slate-400/30 p-5 shadow-md shadow-slate-900/10 flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Disuspend / Nonaktif
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.nonaktif}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Akses Login Diblokir Sementara
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/60 text-white flex items-center justify-center shrink-0">
                <UserX className="w-6 h-6 text-white" />
              </div>
            </div>
          </section>

          {/* Tabel Utama Akun Otorisasi Operator Fakultas */}
          <section
            aria-label="Tabel Akun Operator Fakultas"
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
          >
            {/* Banner Header Tabel & Kolom Pencarian */}
            <div className="p-6 bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Daftar Akun Otorisasi Operator Fakultas
                </h2>
                <p className="text-xs sm:text-sm text-blue-50/90 leading-relaxed">
                  Kelola kredensial login, reset sandi default (
                  <code className="font-mono text-[#FBC02D]">Unuha2026!</code>
                  ), atau ubah status akses operator Fakultas.
                </p>
              </div>

              <div className="relative w-full sm:w-72 shrink-0">
                <Search className="w-4 h-4 text-[#1565C0] pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  aria-label="Cari Fakultas atau Username"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari Fakultas atau Username..."
                  className="w-full rounded-xl border border-white/90 bg-white pl-9 pr-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#FBC02D]/80"
                />
              </div>
            </div>

            {/* Data Grid / Tabel */}
            {isLoadingTable ? (
              <div className="py-16 px-6 flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="w-7 h-7 animate-spin text-[#0D47A1]" />
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  Memuat daftar akun operator Fakultas...
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <th className="py-4 px-6 min-w-[240px]">Nama Fakultas</th>
                      <th className="py-4 px-5 min-w-[200px]">
                        Singkatan &amp; Unit
                      </th>
                      <th className="py-4 px-5 min-w-[180px]">Username</th>
                      <th className="py-4 px-5 text-center min-w-[140px]">
                        Status Akses
                      </th>
                      <th className="py-4 px-6 text-right min-w-[230px]">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
                    {filteredAccounts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-12 text-center text-slate-500 text-xs"
                        >
                          {searchQuery.trim() ? (
                            <>
                              Tidak ada data akun Fakultas yang cocok dengan
                              kata kunci{" "}
                              <strong className="text-slate-700">
                                &ldquo;{sanitizePlainText(searchQuery)}&rdquo;
                              </strong>
                              .
                            </>
                          ) : (
                            "Belum ada akun operator Fakultas yang terdaftar di database."
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredAccounts.map((item) => {
                        const fakultasInfo = resolveFakultasLabel(
                          item,
                          fakultasOptions
                        );
                        const fakultasName = sanitizePlainText(
                          fakultasInfo.nama_fakultas ||
                            (item.id_fakultas
                              ? `Fakultas #${item.id_fakultas}`
                              : "Fakultas Belum Ditautkan")
                        );
                        const safeUsername = sanitizePlainText(item.username);
                        const isRowBusy = processingRowId === item.id;

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50/75 transition-colors"
                          >
                            {/* Kolom 1: Nama Fakultas */}
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-900">
                                {fakultasName}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {item.id_fakultas
                                  ? `ID Fakultas: #${item.id_fakultas}`
                                  : "ID Fakultas: -"}
                              </div>
                            </td>

                            {/* Kolom 2: Singkatan & Unit */}
                            <td className="py-4 px-5">
                              <div className="inline-flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-[#0D47A1] border border-blue-200/70">
                                  {sanitizePlainText(fakultasInfo.singkatan)}
                                </span>
                                <span className="text-slate-700 font-medium">
                                  {fakultasInfo.prodiCount > 0
                                    ? `${fakultasInfo.prodiCount} Program Studi`
                                    : "Universitas Nurul Huda"}
                                </span>
                              </div>
                            </td>

                            {/* Kolom 3: Username */}
                            <td className="py-4 px-5">
                              <code className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/80 font-mono text-xs font-semibold text-slate-800">
                                {safeUsername}
                              </code>
                            </td>

                            {/* Kolom 4: Status Akses Badge */}
                            <td className="py-4 px-5 text-center">
                              {item.is_active ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                                  Aktif
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                                  Nonaktif
                                </span>
                              )}
                            </td>

                            {/* Kolom 5: Quick Actions (Edit, Reset Sandi, Suspend/Aktifkan Toggle, Hapus) */}
                            <td className="py-4 px-6 text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                {/* a. Edit */}
                                <button
                                  type="button"
                                  disabled={isRowBusy}
                                  onClick={() => openEditModal(item)}
                                  title="Edit Username / Password"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 text-[#0D47A1] text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>

                                {/* b. Reset Sandi */}
                                <button
                                  type="button"
                                  disabled={isRowBusy}
                                  onClick={() => handleResetPassword(item)}
                                  title="Reset ke Sandi Default (Unuha2026!)"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                                >
                                  {isRowBusy ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <KeyRound className="w-3.5 h-3.5" />
                                  )}
                                  <span>Reset Sandi</span>
                                </button>

                                {/* c. Suspend / Aktifkan Toggle */}
                                <button
                                  type="button"
                                  disabled={isRowBusy}
                                  onClick={() => handleToggleStatus(item)}
                                  title={
                                    item.is_active
                                      ? "Nonaktifkan / Suspend Akun"
                                      : "Aktifkan Kembali Akun"
                                  }
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                                    item.is_active
                                      ? "border-red-200 bg-red-50 hover:bg-red-100 text-red-700"
                                      : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                  <span>
                                    {item.is_active ? "Suspend" : "Aktifkan"}
                                  </span>
                                </button>

                                {/* d. Hapus Akun */}
                                <button
                                  type="button"
                                  disabled={isRowBusy}
                                  onClick={() => setDeleteAccountTarget(item)}
                                  title="Hapus Akun Operator"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
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

      {/* Modal Form 'Hybrid' (Tambah / Edit Akun Operator Fakultas) */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-akun-fakultas-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/35 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-[#FBC02D]" />
                </div>
                <div>
                  <h3
                    id="modal-akun-fakultas-title"
                    className="text-sm sm:text-base font-bold text-white"
                  >
                    {modalMode === "create"
                      ? "Tambah Akun Operator Fakultas"
                      : "Edit Akun Operator Fakultas"}
                  </h3>
                  <p className="text-[11px] text-blue-100">
                    Sistem Hybrid Auto-fill Kredensial UNUHA
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmittingForm}
                className="text-white/75 hover:text-white p-1 rounded-lg transition cursor-pointer disabled:opacity-40"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Form */}
            <form
              onSubmit={handleFormSubmit}
              className="p-6 space-y-5"
              noValidate
            >
              {formError && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-xs text-red-700"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-relaxed">
                    {formError}
                  </span>
                </div>
              )}

              {/* 1. Elemen <select> Pilih Fakultas (Dinamis dari /api/fakultas) */}
              <div>
                <label
                  htmlFor="select-fakultas-unuha"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                >
                  Fakultas (UNUHA)
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#0D47A1] pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    id="select-fakultas-unuha"
                    value={selectedFakultasName}
                    onChange={handleSelectFakultasChange}
                    disabled={
                      modalMode === "edit" ||
                      isSubmittingForm ||
                      (modalMode === "create" && fakultasOptions.length === 0)
                    }
                    className="w-full appearance-none rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 shadow-2xs focus:border-[#0D47A1] focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer"
                  >
                    {fakultasOptions.length === 0 ? (
                      <option value={selectedFakultasName || ""}>
                        {selectedFakultasName ||
                          "-- Belum ada data Fakultas di database --"}
                      </option>
                    ) : (
                      <>
                        {modalMode === "edit" &&
                          selectedFakultasName &&
                          !fakultasOptions.some(
                            (f) => f.nama_fakultas === selectedFakultasName
                          ) && (
                            <option value={selectedFakultasName}>
                              {selectedFakultasName}
                            </option>
                          )}
                        {fakultasOptions.map((fakultas) => (
                          <option
                            key={fakultas.id}
                            value={fakultas.nama_fakultas}
                          >
                            {fakultas.nama_fakultas}
                            {fakultas.singkatan
                              ? ` (${fakultas.singkatan})`
                              : ""}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
                {modalMode === "create" && (
                  <p className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#0D47A1] shrink-0" />
                    <span>
                      Memilih Fakultas akan mengisi otomatis kolom Username di
                      bawah.
                    </span>
                  </p>
                )}
              </div>

              {/* 2. Input Username (Terisi otomatis namun tetap bisa diedit manual oleh Admin) */}
              <div>
                <label
                  htmlFor="input-username-fakultas"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                >
                  Username Operator
                </label>
                <input
                  id="input-username-fakultas"
                  type="text"
                  required
                  disabled={isSubmittingForm}
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Contoh: fakultas_sains_dan_teknologi"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-mono font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#0D47A1] focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Format otomatis:{" "}
                  <code className="font-mono text-[#0D47A1] font-semibold">
                    {generateAutoUsernameFromFakultas(selectedFakultasName)}
                  </code>{" "}
                  (Dapat Anda sunting secara manual).
                </p>
              </div>

              {/* 3. Input Password dengan Placeholder Sandi Default (Unuha2026!) */}
              <div>
                <label
                  htmlFor="input-password-fakultas"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                >
                  Password{" "}
                  <span className="font-normal text-slate-400 normal-case">
                    (Opsional)
                  </span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-password-fakultas"
                    type="password"
                    disabled={isSubmittingForm}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Kosongkan untuk sandi default (Unuha2026!)"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0D47A1] focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {modalMode === "create"
                    ? "Jika dikosongkan, sistem otomatis menetapkan sandi default Unuha2026!."
                    : "Biarkan kosong jika tidak ingin mengubah kata sandi saat ini."}
                </p>
              </div>

              {/* Footer Modal */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmittingForm}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] active:bg-blue-950 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-900/15 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingForm ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#FBC02D]" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#FBC02D]" />
                      <span>
                        {modalMode === "create"
                          ? "Simpan Akun"
                          : "Simpan Perubahan"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Akun Operator Fakultas */}
      {deleteAccountTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100/80 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Akun Operator Fakultas
                </h3>
                <p className="text-xs text-slate-500">
                  Apakah Anda yakin ingin menghapus akun operator Fakultas
                  berikut dari sistem?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Username
                </span>
                <code className="text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {sanitizePlainText(deleteAccountTarget.username)}
                </code>
              </div>
              <div className="text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                <span className="text-slate-400">Fakultas: </span>
                <span className="font-semibold text-slate-800">
                  {deleteAccountTarget.fakultas?.nama_fakultas ||
                    "Fakultas Belum Ditautkan"}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Akun ini tidak akan dapat login lagi ke sistem SIPASTI setelah
                dihapus.
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteAccountTarget(null)}
                disabled={isDeletingAccount}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                disabled={isDeletingAccount}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition disabled:opacity-50"
              >
                {isDeletingAccount ? (
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
