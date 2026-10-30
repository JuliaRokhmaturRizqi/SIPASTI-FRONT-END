"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertCircle,
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
  ShieldCheck,
  Sparkles,
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
 * Interface Master 14 Program Studi Universitas Nurul Huda (UNUHA)
 */
export interface UnuhaProdiMasterItem {
  id_prodi: number;
  nama_prodi: string;
  fakultas: string;
  fakultas_singkatan: string;
}

/**
 * Daftar Resmi 14 Program Studi Universitas Nurul Huda (UNUHA)
 */
export const MASTER_14_PRODI_UNUHA: UnuhaProdiMasterItem[] = [
  {
    id_prodi: 1,
    nama_prodi: "S1 Pendidikan Agama Islam",
    fakultas: "Fakultas Agama Islam",
    fakultas_singkatan: "FAI",
  },
  {
    id_prodi: 2,
    nama_prodi: "S1 Pendidikan Guru Madrasah Ibtidaiyah",
    fakultas: "Fakultas Agama Islam",
    fakultas_singkatan: "FAI",
  },
  {
    id_prodi: 3,
    nama_prodi: "S1 Pendidikan Bahasa Arab",
    fakultas: "Fakultas Agama Islam",
    fakultas_singkatan: "FAI",
  },
  {
    id_prodi: 4,
    nama_prodi: "S1 Pendidikan Bahasa dan Sastra Indonesia",
    fakultas: "Fakultas Ilmu Pendidikan",
    fakultas_singkatan: "FIP",
  },
  {
    id_prodi: 5,
    nama_prodi: "S1 Pendidikan Bahasa Inggris",
    fakultas: "Fakultas Ilmu Pendidikan",
    fakultas_singkatan: "FIP",
  },
  {
    id_prodi: 6,
    nama_prodi: "S1 Pendidikan Fisika",
    fakultas: "Fakultas Ilmu Pendidikan",
    fakultas_singkatan: "FIP",
  },
  {
    id_prodi: 7,
    nama_prodi: "S1 Pendidikan Ekonomi",
    fakultas: "Fakultas Ilmu Pendidikan",
    fakultas_singkatan: "FIP",
  },
  {
    id_prodi: 8,
    nama_prodi: "S1 Pendidikan Teknologi Informasi",
    fakultas: "Fakultas Ilmu Pendidikan",
    fakultas_singkatan: "FIP",
  },
  {
    id_prodi: 9,
    nama_prodi: "S1 Pelatihan Olahraga",
    fakultas: "Fakultas Ilmu Pendidikan",
    fakultas_singkatan: "FIP",
  },
  {
    id_prodi: 10,
    nama_prodi: "S1 Informatika",
    fakultas: "Fakultas Sains dan Teknologi",
    fakultas_singkatan: "FST",
  },
  {
    id_prodi: 11,
    nama_prodi: "S1 Matematika",
    fakultas: "Fakultas Sains dan Teknologi",
    fakultas_singkatan: "FST",
  },
  {
    id_prodi: 12,
    nama_prodi: "S1 Sains Pertanian",
    fakultas: "Fakultas Sains dan Teknologi",
    fakultas_singkatan: "FST",
  },
  {
    id_prodi: 13,
    nama_prodi: "S1 Peternakan",
    fakultas: "Fakultas Sains dan Teknologi",
    fakultas_singkatan: "FST",
  },
  {
    id_prodi: 14,
    nama_prodi: "S2 Pendidikan Agama Islam",
    fakultas: "Program Pascasarjana",
    fakultas_singkatan: "PPs",
  },
];

/**
 * Interface Data Akun Operator Prodi dari API GET /api/akun-prodi
 */
export interface AkunProdiItem {
  id: number;
  username: string;
  role: "user" | "admin";
  id_prodi: number;
  is_active: boolean;
  created_at?: string;
  prodi?: {
    id: number;
    nama_prodi: string;
    id_fakultas?: number | null;
    fakultas?: {
      id: number;
      singkatan: string;
      nama_fakultas: string;
    } | null;
  } | null;
}

export interface AkunProdiListResponse {
  status: "success" | "error";
  message?: string;
  data?: AkunProdiItem[];
}

export interface AkunProdiMutationResponse {
  status: "success" | "error";
  message: string;
  data?: AkunProdiItem;
}

/**
 * Logika JavaScript Auto-fill Cerdas:
 * Mengubah nama Program Studi (misal: "S1 Informatika" atau "S1 Pendidikan Bahasa Arab")
 * menjadi format username otomatis:
 * - "S1 Informatika" -> "prodi_informatika"
 * - "S1 Pendidikan Bahasa Arab" -> "prodi_pendidikan_bahasa_arab"
 * - "S2 Pendidikan Agama Islam" -> "prodi_s2_pendidikan_agama_islam"
 */
export function generateAutoUsernameFromProdi(namaProdi: string): string {
  const cleaned = namaProdi
    .trim()
    .toLowerCase()
    .replace(/^s1\s+/i, "") // Hapus awalan 's1 '
    .replace(/[^a-z0-9\s]/g, "") // Bersihkan karakter non-alfanumerik
    .replace(/\s+/g, "_"); // Ganti spasi dengan underscore

  return cleaned ? `prodi_${cleaned}` : "prodi_operator";
}

/**
 * Helper mencocokkan Fakultas untuk Nama Prodi UNUHA apabila relasi fakultas di DB bernilai null
 */
function resolveFakultasLabel(item: AkunProdiItem): {
  nama_fakultas: string;
  singkatan: string;
} {
  if (item.prodi?.fakultas?.nama_fakultas) {
    return {
      nama_fakultas: item.prodi.fakultas.nama_fakultas,
      singkatan: item.prodi.fakultas.singkatan || "UNUHA",
    };
  }

  const prodiName = (item.prodi?.nama_prodi || "").trim().toLowerCase();
  const matchedMaster = MASTER_14_PRODI_UNUHA.find(
    (m) =>
      m.nama_prodi.toLowerCase() === prodiName ||
      (prodiName === "s1 teknik informatika" &&
        m.nama_prodi.toLowerCase() === "s1 informatika")
  );

  if (matchedMaster) {
    return {
      nama_fakultas: matchedMaster.fakultas,
      singkatan: matchedMaster.fakultas_singkatan,
    };
  }

  return {
    nama_fakultas: "Universitas Nurul Huda",
    singkatan: "UNUHA",
  };
}

/**
 * Fallback Data Awal 14 Akun Operator Prodi UNUHA apabila tabel database masih kosong
 */
const INITIAL_FALLBACK_AKUN_PRODI: AkunProdiItem[] = MASTER_14_PRODI_UNUHA.map(
  (master, index) => ({
    id: index + 1,
    username: generateAutoUsernameFromProdi(master.nama_prodi),
    role: "user",
    id_prodi: master.id_prodi,
    is_active: true,
    prodi: {
      id: master.id_prodi,
      nama_prodi: master.nama_prodi,
      fakultas: {
        id: index + 1,
        singkatan: master.fakultas_singkatan,
        nama_fakultas: master.fakultas,
      },
    },
  })
);

export default function ManajemenDataProdiPage() {
  const router = useRouter();

  // State Otorisasi & Profil Admin
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] =
    useState<boolean>(false);

  // State Utama Tabel Akun Prodi & Pencarian
  const [akunProdi, setAkunProdi] = useState<AkunProdiItem[]>([]);
  const [prodiOptions, setProdiOptions] = useState<UnuhaProdiMasterItem[]>(
    MASTER_14_PRODI_UNUHA
  );
  const [isLoadingTable, setIsLoadingTable] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // State Modal Form 'Hybrid' (Tambah / Edit Akun)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingAccount, setEditingAccount] = useState<AkunProdiItem | null>(
    null
  );
  const [selectedProdiName, setSelectedProdiName] = useState<string>(
    MASTER_14_PRODI_UNUHA[0].nama_prodi
  );
  const [usernameInput, setUsernameInput] = useState<string>(
    generateAutoUsernameFromProdi(MASTER_14_PRODI_UNUHA[0].nama_prodi)
  );
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState<boolean>(false);

  // State Loading Aksi Cepat (Reset Sandi & Toggle Status per baris)
  const [processingRowId, setProcessingRowId] = useState<number | null>(null);

  const handleUnauthorizedExit = useCallback(() => {
    clearAuthSession();
    setIsAuthorized(false);
    router.replace("/login");
  }, [router]);

  /**
   * Fungsi Fetch Data Tabel Akun Prodi:
   * GET /api/akun-prodi menggunakan instance Axios (dengan Bearer token)
   */
  const fetchAkunProdi = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) {
        setIsLoadingTable(true);
      }

      try {
        const response =
          await apiClient.get<AkunProdiListResponse>("/api/akun-prodi");
        const apiData = response.data?.data || [];

        if (apiData.length > 0) {
          setAkunProdi(apiData);
        } else {
          setAkunProdi(INITIAL_FALLBACK_AKUN_PRODI);
        }
      } catch (err) {
        const axiosErr = err as AxiosError<ApiErrorResponse>;
        const status = axiosErr.response?.status;

        if (status === 401 || status === 403) {
          handleUnauthorizedExit();
          return;
        }

        // Gunakan fallback data 14 prodi UNUHA apabila gagal memuat dari server
        setAkunProdi((prev) =>
          prev.length > 0 ? prev : INITIAL_FALLBACK_AKUN_PRODI
        );
        toast.error(
          axiosErr.response?.data?.message ||
            "Gagal memuat daftar akun operator Prodi dari server."
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
   * Verifikasi Otorisasi Admin & Inisialisasi Data GET /api/akun-prodi
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

        // Ambil juga daftar Prodi dari /api/prodi untuk sinkronisasi ID database
        try {
          const prodiRes = await apiClient.get<{
            status: string;
            data?: Array<{
              id: number;
              nama_prodi: string;
              fakultas?: { singkatan: string; nama_fakultas: string } | null;
            }>;
          }>("/api/prodi");

          const dbProdiList = prodiRes.data?.data || [];
          if (dbProdiList.length > 0 && isMounted) {
            setProdiOptions((prevMaster) =>
              prevMaster.map((m) => {
                const foundDb = dbProdiList.find(
                  (db) =>
                    db.nama_prodi.trim().toLowerCase() ===
                    m.nama_prodi.trim().toLowerCase()
                );
                return foundDb
                  ? {
                      ...m,
                      id_prodi: foundDb.id,
                      fakultas:
                        foundDb.fakultas?.nama_fakultas || m.fakultas,
                      fakultas_singkatan:
                        foundDb.fakultas?.singkatan || m.fakultas_singkatan,
                    }
                  : m;
              })
            );
          }
        } catch {
          // Tetap gunakan daftar 14 Prodi UNUHA statis jika /api/prodi gagal
        }

        if (isMounted) {
          setUser(verifiedUser);
          setIsAuthorized(true);
          setIsCheckingAuth(false);
        }

        await fetchAkunProdi(true);
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
  }, [handleUnauthorizedExit, fetchAkunProdi]);

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
    const defaultProdi = prodiOptions[0] || MASTER_14_PRODI_UNUHA[0];
    setModalMode("create");
    setEditingAccount(null);
    setSelectedProdiName(defaultProdi.nama_prodi);
    setUsernameInput(generateAutoUsernameFromProdi(defaultProdi.nama_prodi));
    setPasswordInput("");
    setFormError(null);
    setIsModalOpen(true);
  };

  /**
   * Buka Modal dalam Mode Edit Akun
   */
  const openEditModal = (account: AkunProdiItem) => {
    const prodiName =
      account.prodi?.nama_prodi || MASTER_14_PRODI_UNUHA[0].nama_prodi;
    setModalMode("edit");
    setEditingAccount(account);
    setSelectedProdiName(prodiName);
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
   * Handler saat Dropdown Program Studi di Modal dipilih:
   * Otomatis men-generate & mengisi state username (Auto-fill Cerdas)
   * Contoh:
   * - "S1 Informatika" -> "prodi_informatika"
   * - "S1 Pendidikan Bahasa Arab" -> "prodi_pendidikan_bahasa_arab"
   */
  const handleSelectProdiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chosenProdiName = e.target.value;
    setSelectedProdiName(chosenProdiName);

    const autoGeneratedUsername =
      generateAutoUsernameFromProdi(chosenProdiName);
    setUsernameInput(autoGeneratedUsername);
    if (formError) setFormError(null);
  };

  /**
   * Submit Form Modal (POST untuk Tambah / PUT untuk Edit ke /api/akun-prodi)
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

    const chosenProdiMeta =
      prodiOptions.find((p) => p.nama_prodi === selectedProdiName) ||
      MASTER_14_PRODI_UNUHA[0];

    setIsSubmittingForm(true);

    try {
      if (modalMode === "create") {
        const response = await apiClient.post<AkunProdiMutationResponse>(
          "/api/akun-prodi",
          {
            id_prodi: chosenProdiMeta.id_prodi,
            nama_prodi: chosenProdiMeta.nama_prodi,
            fakultas_nama: chosenProdiMeta.fakultas,
            fakultas_singkatan: chosenProdiMeta.fakultas_singkatan,
            username: cleanUsername,
            password: passwordInput.trim() ? passwordInput.trim() : null,
          }
        );

        toast.success(
          response.data?.message ||
            `Akun operator ${cleanUsername} berhasil ditambahkan.`
        );
      } else if (modalMode === "edit" && editingAccount) {
        const payload: { username: string; password?: string | null } = {
          username: cleanUsername,
        };

        if (passwordInput.trim().length > 0) {
          payload.password = passwordInput.trim();
        }

        const response = await apiClient.put<AkunProdiMutationResponse>(
          `/api/akun-prodi/${editingAccount.id}`,
          payload
        );

        toast.success(
          response.data?.message ||
            `Akun operator ${cleanUsername} berhasil diperbarui.`
        );
      }

      setIsModalOpen(false);
      setEditingAccount(null);
      await fetchAkunProdi(false);
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
        axiosErr.response?.data?.errors?.id_prodi?.[0] ||
        axiosErr.response?.data?.errors?.username?.[0] ||
        axiosErr.response?.data?.errors?.password?.[0] ||
        axiosErr.response?.data?.message ||
        "Terjadi kesalahan saat menyimpan data akun operator Prodi.";

      const safeErr = sanitizePlainText(backendError);
      setFormError(safeErr);
      toast.error(safeErr);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  /**
   * Quick Action b: Reset Sandi
   * Menggunakan window.confirm. Jika OK, kirim PUT request ke /api/akun-prodi/{id}
   * dengan payload password kosong untuk memicu reset default (Unuha2026!) di backend.
   */
  const handleResetPassword = async (account: AkunProdiItem) => {
    if (processingRowId !== null) return;

    const prodiLabel = account.prodi?.nama_prodi || account.username;
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin mereset sandi akun "${account.username}" (${prodiLabel}) ke sandi default (Unuha2026!)?`
    );

    if (!confirmed) return;

    setProcessingRowId(account.id);

    try {
      const response = await apiClient.put<AkunProdiMutationResponse>(
        `/api/akun-prodi/${account.id}`,
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
      await fetchAkunProdi(false);
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
   * Mengirim request PATCH /api/akun-prodi/{id}/toggle-status
   */
  const handleToggleStatus = async (account: AkunProdiItem) => {
    if (processingRowId !== null) return;

    setProcessingRowId(account.id);

    try {
      const response = await apiClient.patch<AkunProdiMutationResponse>(
        `/api/akun-prodi/${account.id}/toggle-status`
      );

      const updatedItem = response.data?.data;
      setAkunProdi((prevList) =>
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
      await fetchAkunProdi(false);
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
   * Filter pencarian real-time berdasarkan Nama Prodi, Fakultas, atau Username
   */
  const filteredAccounts = useMemo(() => {
    const q = sanitizePlainText(searchQuery).toLowerCase().trim();
    if (!q) return akunProdi;

    return akunProdi.filter((item) => {
      const prodiName = (item.prodi?.nama_prodi || "").toLowerCase();
      const fakInfo = resolveFakultasLabel(item);
      const uname = item.username.toLowerCase();

      return (
        prodiName.includes(q) ||
        fakInfo.nama_fakultas.toLowerCase().includes(q) ||
        fakInfo.singkatan.toLowerCase().includes(q) ||
        uname.includes(q)
      );
    });
  }, [akunProdi, searchQuery]);

  /**
   * Statistik Ringkas Akun Prodi
   */
  const stats = useMemo(() => {
    const total = akunProdi.length;
    const aktif = akunProdi.filter((a) => a.is_active).length;
    const nonaktif = total - aktif;
    return { total, aktif, nonaktif };
  }, [akunProdi]);

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
                Manajemen Data Prodi &amp; Akun Operator
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchAkunProdi(true)}
              disabled={isLoadingTable}
              title="Muat ulang daftar akun Prodi"
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
              <span>Tambah Akun Prodi</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-5 sm:p-8 space-y-8 max-w-7xl w-full mx-auto flex-1">
          {/* 3 Kartu Statistik Ringkas */}
          <section
            aria-label="Ringkasan Akun Operator Prodi"
            className="grid grid-cols-1 sm:grid-cols-3 gap-5"
          >
            <div className="bg-gradient-to-br from-[#1e5bb8] to-[#0D47A1] rounded-2xl border border-blue-400/25 p-5 shadow-md shadow-blue-900/10 flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Total Akun Prodi
                </p>
                <p className="text-3xl font-bold text-white mt-1.5">
                  {stats.total}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Operator Program Studi Terdaftar
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

          {/* Tabel Utama Akun Otorisasi Operator Program Studi */}
          <section
            aria-label="Tabel Akun Operator Program Studi"
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
          >
            {/* Banner Header Tabel & Kolom Pencarian */}
            <div className="p-6 bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1e68c8] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Daftar Akun Otorisasi Operator Program Studi
                </h2>
                <p className="text-xs sm:text-sm text-blue-50/90 leading-relaxed">
                  Kelola kredensial login, reset sandi default (
                  <code className="font-mono text-[#FBC02D]">Unuha2026!</code>
                  ), atau ubah status akses operator Prodi.
                </p>
              </div>

              <div className="relative w-full sm:w-72 shrink-0">
                <Search className="w-4 h-4 text-[#1565C0] pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  aria-label="Cari Prodi, Fakultas, atau Username"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari Prodi atau Username..."
                  className="w-full rounded-xl border border-white/90 bg-white pl-9 pr-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#FBC02D]/80"
                />
              </div>
            </div>

            {/* Data Grid / Tabel */}
            {isLoadingTable ? (
              <div className="py-16 px-6 flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="w-7 h-7 animate-spin text-[#0D47A1]" />
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  Memuat daftar akun operator Program Studi...
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <th className="py-4 px-6 min-w-[240px]">Nama Prodi</th>
                      <th className="py-4 px-5 min-w-[200px]">Fakultas</th>
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
                          Tidak ada data akun Program Studi yang cocok dengan
                          kata kunci{" "}
                          <strong className="text-slate-700">
                            &ldquo;{sanitizePlainText(searchQuery)}&rdquo;
                          </strong>
                          .
                        </td>
                      </tr>
                    ) : (
                      filteredAccounts.map((item) => {
                        const prodiName = sanitizePlainText(
                          item.prodi?.nama_prodi || `Prodi #${item.id_prodi}`
                        );
                        const fakultasInfo = resolveFakultasLabel(item);
                        const safeUsername = sanitizePlainText(item.username);
                        const isRowBusy = processingRowId === item.id;

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50/75 transition-colors"
                          >
                            {/* Kolom 1: Nama Prodi */}
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-900">
                                {prodiName}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                ID Prodi: #{item.id_prodi}
                              </div>
                            </td>

                            {/* Kolom 2: Fakultas */}
                            <td className="py-4 px-5">
                              <div className="inline-flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-[#0D47A1] border border-blue-200/70">
                                  {sanitizePlainText(fakultasInfo.singkatan)}
                                </span>
                                <span className="text-slate-700 font-medium">
                                  {sanitizePlainText(
                                    fakultasInfo.nama_fakultas
                                  )}
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

                            {/* Kolom 5: Quick Actions (Edit, Reset Sandi, Suspend/Aktifkan Toggle) */}
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

      {/* Modal Form 'Hybrid' (Tambah / Edit Akun Operator Prodi) */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-akun-prodi-title"
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
                    id="modal-akun-prodi-title"
                    className="text-sm sm:text-base font-bold text-white"
                  >
                    {modalMode === "create"
                      ? "Tambah Akun Operator Prodi"
                      : "Edit Akun Operator Prodi"}
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

              {/* 1. Elemen <select> Pilih Program Studi (14 Prodi UNUHA) */}
              <div>
                <label
                  htmlFor="select-prodi-unuha"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                >
                  Program Studi (UNUHA)
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#0D47A1] pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    id="select-prodi-unuha"
                    value={selectedProdiName}
                    onChange={handleSelectProdiChange}
                    disabled={modalMode === "edit" || isSubmittingForm}
                    className="w-full appearance-none rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 shadow-2xs focus:border-[#0D47A1] focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20 disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer"
                  >
                    {prodiOptions.map((prodi) => (
                      <option key={prodi.nama_prodi} value={prodi.nama_prodi}>
                        {prodi.nama_prodi} ({prodi.fakultas_singkatan})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
                {modalMode === "create" && (
                  <p className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#0D47A1] shrink-0" />
                    <span>
                      Memilih Prodi akan mengisi otomatis kolom Username di
                      bawah.
                    </span>
                  </p>
                )}
              </div>

              {/* 2. Input Username (Terisi otomatis namun tetap bisa diedit manual oleh Admin) */}
              <div>
                <label
                  htmlFor="input-username-prodi"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                >
                  Username Operator
                </label>
                <input
                  id="input-username-prodi"
                  type="text"
                  required
                  disabled={isSubmittingForm}
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Contoh: prodi_informatika"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-mono font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#0D47A1] focus:outline-none focus:ring-2 focus:ring-[#0D47A1]/20"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Format otomatis:{" "}
                  <code className="font-mono text-[#0D47A1] font-semibold">
                    {generateAutoUsernameFromProdi(selectedProdiName)}
                  </code>{" "}
                  (Dapat Anda sunting secara manual).
                </p>
              </div>

              {/* 3. Input Password dengan Placeholder Sandi Default (Unuha2026!) */}
              <div>
                <label
                  htmlFor="input-password-prodi"
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
                    id="input-password-prodi"
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
    </div>
  );
}
