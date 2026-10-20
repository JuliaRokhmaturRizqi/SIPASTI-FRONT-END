"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  GraduationCap,
  LogOut,
  UserCheck,
} from "lucide-react";
import { getAuthSession, logoutSession } from "@/lib/auth";
import apiClient from "@/lib/axios";
import { AuthUser } from "@/types/auth";

export default function ProdiDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const session = getAuthSession();
    if (!session.token) {
      router.replace("/login");
      return;
    }
    if (session.role === "admin") {
      router.replace("/admin/dashboard");
      return;
    }

    setUser(session.user);

    // Sinkronisasi profil terbaru dari endpoint GET /api/me
    apiClient
      .get<{ status: string; data: AuthUser }>("/me")
      .then((res) => {
        setUser(res.data.data);
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logoutSession();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar Prodi */}
      <header className="bg-[#0D47A1] text-white shadow-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FBC02D] text-[#0D47A1] flex items-center justify-center font-bold shadow">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight">
                Dashboard Program Studi
              </h1>
              <p className="text-xs text-blue-200">
                {user?.prodi?.nama_prodi ||
                  "Sistem Pelaporan Administrasi Terintegrasi"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-xs">
                <GraduationCap className="w-4 h-4 text-[#FBC02D]" />
                <span className="font-semibold">{user.username}</span>
                <span className="px-2 py-0.5 rounded bg-[#FBC02D] text-[#0D47A1] font-bold uppercase text-[10px]">
                  {user.role}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 text-[#FBC02D]" />
              <span>{isLoggingOut ? "Keluar..." : "Logout"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-6 py-10 flex-1">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold mb-4">
            <CheckCircle2 className="w-4 h-4" />
            Autentikasi Sanctum Berhasil (Role: User / Prodi)
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            Selamat Datang, {user?.username || "Operator Prodi"}!
          </h2>
          <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
            Anda telah berhasil masuk ke halaman{" "}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[#0D47A1] font-mono text-xs">
              /prodi/dashboard
            </code>
            . Akun Anda terhubung dengan Program Studi{" "}
            <strong className="text-slate-900">
              {user?.prodi?.nama_prodi ?? `ID #${user?.id_prodi ?? "-"}`}
            </strong>
            .
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-100">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-xs text-slate-500 block">Username</span>
              <span className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#0D47A1]" />
                {user?.username ?? "-"}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-xs text-slate-500 block">Hak Akses</span>
              <span className="text-sm font-bold text-[#0D47A1] uppercase mt-1 block">
                {user?.role ?? "user"}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-xs text-slate-500 block">
                Program Studi
              </span>
              <span className="text-sm font-bold text-slate-900 mt-1 block">
                {user?.prodi?.nama_prodi ?? "-"}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
