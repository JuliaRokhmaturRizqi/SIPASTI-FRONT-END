"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Building2,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { sanitizePlainText } from "@/lib/security";

interface AdminSidebarProps {
  username?: string;
  pendingReviewCount?: number;
  pendingUnitReviewCount?: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}

export default function AdminSidebar({
  username = "admin",
  pendingReviewCount = 0,
  pendingUnitReviewCount = 0,
  isMobileOpen,
  onCloseMobile,
  onLogout,
  isLoggingOut,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const safeUsername = sanitizePlainText(username);

  // Deteksi Modul Awal berdasarkan rute aktif
  const isKinerjaRoute =
    pathname.startsWith("/admin/laporan-kinerja") ||
    pathname.startsWith("/admin/master-data") ||
    pathname.startsWith("/admin/data-akun-unit");

  const [activeModule, setActiveModule] = useState<"akademik" | "kinerja">(
    isKinerjaRoute ? "kinerja" : "akademik"
  );

  // Sinkronisasi tab modul saat user berpindah halaman
  useEffect(() => {
    if (isKinerjaRoute) {
      setActiveModule("kinerja");
    } else if (
      pathname.startsWith("/admin/dashboard") ||
      pathname.startsWith("/admin/periode") ||
      pathname.startsWith("/admin/data-fakultas") ||
      pathname.startsWith("/admin/prodi")
    ) {
      setActiveModule("akademik");
    }
  }, [pathname, isKinerjaRoute]);

  const isDashboardActive = pathname === "/admin/dashboard";
  const isPeriodeActive = pathname.startsWith("/admin/periode");
  const isFakultasActive =
    pathname.startsWith("/admin/data-fakultas") ||
    pathname.startsWith("/admin/prodi");

  const isLaporanKinerjaActive = pathname.startsWith("/admin/laporan-kinerja");
  const isMasterDataActive = pathname.startsWith("/admin/master-data");
  const isAkunUnitActive = pathname.startsWith("/admin/data-akun-unit");

  const getMenuLinkClass = (isActive: boolean) =>
    `w-full flex items-center justify-between px-6 py-3 text-xs sm:text-sm font-medium border-l-4 transition-all duration-200 ${
      isActive
        ? "bg-white/10 text-white border-[#FBC02D] font-semibold"
        : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <>
      {/* Backdrop Sidebar Mobile */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity duration-200"
        />
      )}

      {/* Sidebar Navigasi Kiri (ERP Full-Width Style) */}
      <aside
        aria-label="Navigasi Utama Administrator"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 text-white border-r border-white/10 flex flex-col justify-between transition-all duration-200 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Bagian Atas: Brand Header, App Switcher & Navigation */}
        <div className="flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
                <Building2 className="w-5 h-5 text-[#FBC02D]" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-white block leading-none">
                  SIPASTI
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#FBC02D] mt-0.5 block">
                  Admin Panel
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden text-white/70 hover:text-white p-1 transition-all duration-200"
              aria-label="Tutup menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* App Switcher Segmented Control */}
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-2">
              Modul Pelaporan
            </p>
            <div className="p-1 rounded-xl bg-slate-950/40 border border-white/10 flex items-center gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveModule("akademik")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeModule === "akademik"
                    ? "bg-[#0D47A1] text-white shadow-sm border border-blue-400/30 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-[#FBC02D]" />
                <span>Akademik</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModule("kinerja")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeModule === "kinerja"
                    ? "bg-[#0D47A1] text-white shadow-sm border border-blue-400/30 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-[#FBC02D]" />
                <span>Kinerja</span>
              </button>
            </div>
          </div>

          {/* Menu Navigasi Berdasarkan Modul Aktif */}
          <nav className="py-2">
            {activeModule === "akademik" ? (
              /* MODUL 1: PORTAL AKADEMIK */
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-6 mb-2 mt-3">
                  Portal Akademik
                </p>
                <ul className="space-y-0.5">
                  <li>
                    <Link
                      href="/admin/dashboard"
                      onClick={onCloseMobile}
                      className={getMenuLinkClass(isDashboardActive)}
                    >
                      <span className="flex items-center gap-3">
                        <LayoutDashboard
                          className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                            isDashboardActive
                              ? "text-[#FBC02D]"
                              : "text-slate-400"
                          }`}
                        />
                        <span>Pemantauan Akademik</span>
                      </span>
                      {pendingReviewCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FBC02D] text-slate-950">
                          {pendingReviewCount}
                        </span>
                      )}
                    </Link>
                  </li>

                  <li>
                    <Link
                      href="/admin/periode"
                      onClick={onCloseMobile}
                      className={getMenuLinkClass(isPeriodeActive)}
                    >
                      <span className="flex items-center gap-3">
                        <Calendar
                          className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                            isPeriodeActive
                              ? "text-[#FBC02D]"
                              : "text-slate-400"
                          }`}
                        />
                        <span>Manajemen Periode</span>
                      </span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      href="/admin/data-fakultas"
                      onClick={onCloseMobile}
                      className={getMenuLinkClass(isFakultasActive)}
                    >
                      <span className="flex items-center gap-3">
                        <GraduationCap
                          className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                            isFakultasActive
                              ? "text-[#FBC02D]"
                              : "text-slate-400"
                          }`}
                        />
                        <span>Data Akun Fakultas</span>
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            ) : (
              /* MODUL 2: PORTAL KINERJA UNIT */
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-6 mb-2 mt-3">
                  Portal Kinerja Unit
                </p>
                <ul className="space-y-0.5">
                  <li>
                    <Link
                      href="/admin/laporan-kinerja"
                      onClick={onCloseMobile}
                      className={getMenuLinkClass(isLaporanKinerjaActive)}
                    >
                      <span className="flex items-center gap-3">
                        <Briefcase
                          className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                            isLaporanKinerjaActive
                              ? "text-[#FBC02D]"
                              : "text-slate-400"
                          }`}
                        />
                        <span>Pemantauan Kinerja</span>
                      </span>
                      {pendingUnitReviewCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FBC02D] text-slate-950">
                          {pendingUnitReviewCount}
                        </span>
                      )}
                    </Link>
                  </li>

                  <li>
                    <Link
                      href="/admin/master-data"
                      onClick={onCloseMobile}
                      className={getMenuLinkClass(isMasterDataActive)}
                    >
                      <span className="flex items-center gap-3">
                        <Building2
                          className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                            isMasterDataActive
                              ? "text-[#FBC02D]"
                              : "text-slate-400"
                          }`}
                        />
                        <span>Master Data Kampus</span>
                      </span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      href="/admin/data-akun-unit"
                      onClick={onCloseMobile}
                      className={getMenuLinkClass(isAkunUnitActive)}
                    >
                      <span className="flex items-center gap-3">
                        <Users
                          className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                            isAkunUnitActive
                              ? "text-[#FBC02D]"
                              : "text-slate-400"
                          }`}
                        />
                        <span>Data Akun Unit Kerja</span>
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            )}
          </nav>
        </div>

        {/* Bagian Bawah: Profil Admin & Tombol Logout */}
        <div className="border-t border-white/10 bg-slate-950/30 p-4 space-y-3">
          <div className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FBC02D]/15 border border-[#FBC02D]/40 flex items-center justify-center text-[#FBC02D] shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {safeUsername}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                Otoritas Administrator
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-red-500/20 hover:border-red-400/30 border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4 text-[#FBC02D]" />
            <span>{isLoggingOut ? "Keluar..." : "Keluar Sesi"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
