"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  Database,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
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

  const isDashboardActive = pathname === "/admin/dashboard";

  // Sub-menu Akademik
  const isPemantauanAkademikActive = pathname.startsWith(
    "/admin/pemantauan-akademik"
  );
  const isMasterAkademikActive = pathname.startsWith(
    "/admin/master-data-akademik"
  );
  const isAkunFakultasActive =
    pathname.startsWith("/admin/data-akun-fakultas") ||
    pathname.startsWith("/admin/data-fakultas") ||
    pathname.startsWith("/admin/prodi");
  const isAkademikGroupActive =
    isPemantauanAkademikActive ||
    isMasterAkademikActive ||
    isAkunFakultasActive;

  // Sub-menu Kinerja
  const isLaporanKinerjaActive = pathname.startsWith("/admin/laporan-kinerja");
  const isMasterKinerjaActive = pathname.startsWith(
    "/admin/master-data-kinerja"
  );
  const isAkunUnitActive = pathname.startsWith("/admin/data-akun-unit");
  const isKinerjaGroupActive =
    isLaporanKinerjaActive || isMasterKinerjaActive || isAkunUnitActive;

  // Sub-menu Pengaturan Sistem
  const isPeriodeActive =
    pathname.startsWith("/admin/manajemen-periode") ||
    pathname.startsWith("/admin/periode");
  const isSistemGroupActive = isPeriodeActive;

  const getInitialOpenMenu = () => {
    if (isKinerjaGroupActive) return "kinerja";
    if (isSistemGroupActive) return "sistem";
    if (isAkademikGroupActive) return "akademik";
    return null;
  };

  const [openMenu, setOpenMenu] = useState<string | null>(getInitialOpenMenu);

  // Buka grup akordion secara otomatis mengikuti rute aktif
  useEffect(() => {
    if (isKinerjaGroupActive) {
      setOpenMenu("kinerja");
    } else if (isSistemGroupActive) {
      setOpenMenu("sistem");
    } else if (isAkademikGroupActive) {
      setOpenMenu("akademik");
    }
  }, [isAkademikGroupActive, isKinerjaGroupActive, isSistemGroupActive]);

  const toggleMenu = (menuKey: string) => {
    setOpenMenu((prev) => (prev === menuKey ? null : menuKey));
  };

  const getSingleLinkClass = (isActive: boolean) =>
    `w-full flex items-center justify-between px-5 py-3 text-xs sm:text-sm font-medium border-l-4 transition-all duration-200 ${
      isActive
        ? "bg-white/10 text-white border-[#FBC02D] font-semibold"
        : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
    }`;

  const getGroupButtonClass = (isGroupActive: boolean, isOpen: boolean) =>
    `w-full flex items-center justify-between px-5 py-3 text-xs sm:text-sm font-semibold border-l-4 transition-all duration-200 cursor-pointer ${
      isGroupActive
        ? "bg-white/8 text-white border-[#FBC02D]"
        : isOpen
          ? "bg-white/5 text-white border-transparent"
          : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
    }`;

  const getSubLinkClass = (isActive: boolean) =>
    `w-full flex items-center justify-between pl-11 pr-5 py-2.5 text-xs font-medium rounded-lg transition-all duration-200 ${
      isActive
        ? "bg-[#0D47A1]/80 text-white font-semibold shadow-2xs border border-blue-400/25"
        : "text-slate-300/90 hover:bg-white/5 hover:text-white border border-transparent"
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

      {/* Sidebar Navigasi Kiri (Model Accordion) */}
      <aside
        aria-label="Navigasi Utama Administrator"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-68 shrink-0 bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 text-white border-r border-white/10 flex flex-col justify-between transition-all duration-200 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Bagian Atas: Brand Header & Menu Accordion */}
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

          <nav className="py-4 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-6 mb-2">
              Menu Utama
            </p>

            {/* 1. Dashboard Utama (Link Tunggal) */}
            <Link
              href="/admin/dashboard"
              onClick={onCloseMobile}
              className={getSingleLinkClass(isDashboardActive)}
            >
              <span className="flex items-center gap-3">
                <LayoutDashboard
                  className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                    isDashboardActive ? "text-[#FBC02D]" : "text-slate-400"
                  }`}
                />
                <span>Dashboard Utama</span>
              </span>
            </Link>

            {/* 2. Modul Akademik (Accordion Dropdown) */}
            <div>
              <button
                type="button"
                onClick={() => toggleMenu("akademik")}
                aria-expanded={openMenu === "akademik"}
                className={getGroupButtonClass(
                  isAkademikGroupActive,
                  openMenu === "akademik"
                )}
              >
                <span className="flex items-center gap-3">
                  <GraduationCap
                    className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                      isAkademikGroupActive || openMenu === "akademik"
                        ? "text-[#FBC02D]"
                        : "text-slate-400"
                    }`}
                  />
                  <span>Modul Akademik</span>
                </span>
                <span className="flex items-center gap-2">
                  {pendingReviewCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FBC02D] text-slate-950">
                      {pendingReviewCount}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${
                      openMenu === "akademik" ? "rotate-180 text-white" : ""
                    }`}
                  />
                </span>
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  openMenu === "akademik"
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <ul className="overflow-hidden px-2 py-1 space-y-0.5">
                  <li>
                    <Link
                      href="/admin/pemantauan-akademik"
                      onClick={onCloseMobile}
                      className={getSubLinkClass(isPemantauanAkademikActive)}
                    >
                      <span className="flex items-center gap-2.5">
                        <LayoutDashboard className="w-3.5 h-3.5 shrink-0 text-slate-400" />
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
                      href="/admin/master-data-akademik"
                      onClick={onCloseMobile}
                      className={getSubLinkClass(isMasterAkademikActive)}
                    >
                      <span className="flex items-center gap-2.5">
                        <Database className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>Master Data Akademik</span>
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/admin/data-akun-fakultas"
                      onClick={onCloseMobile}
                      className={getSubLinkClass(isAkunFakultasActive)}
                    >
                      <span className="flex items-center gap-2.5">
                        <Users className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>Data Akun Fakultas</span>
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* 3. Modul Kinerja (Accordion Dropdown) */}
            <div>
              <button
                type="button"
                onClick={() => toggleMenu("kinerja")}
                aria-expanded={openMenu === "kinerja"}
                className={getGroupButtonClass(
                  isKinerjaGroupActive,
                  openMenu === "kinerja"
                )}
              >
                <span className="flex items-center gap-3">
                  <Briefcase
                    className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                      isKinerjaGroupActive || openMenu === "kinerja"
                        ? "text-[#FBC02D]"
                        : "text-slate-400"
                    }`}
                  />
                  <span>Modul Kinerja</span>
                </span>
                <span className="flex items-center gap-2">
                  {pendingUnitReviewCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FBC02D] text-slate-950">
                      {pendingUnitReviewCount}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${
                      openMenu === "kinerja" ? "rotate-180 text-white" : ""
                    }`}
                  />
                </span>
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  openMenu === "kinerja"
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <ul className="overflow-hidden px-2 py-1 space-y-0.5">
                  <li>
                    <Link
                      href="/admin/laporan-kinerja"
                      onClick={onCloseMobile}
                      className={getSubLinkClass(isLaporanKinerjaActive)}
                    >
                      <span className="flex items-center gap-2.5">
                        <Briefcase className="w-3.5 h-3.5 shrink-0 text-slate-400" />
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
                      href="/admin/master-data-kinerja"
                      onClick={onCloseMobile}
                      className={getSubLinkClass(isMasterKinerjaActive)}
                    >
                      <span className="flex items-center gap-2.5">
                        <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>Master Data Kinerja</span>
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/admin/data-akun-unit"
                      onClick={onCloseMobile}
                      className={getSubLinkClass(isAkunUnitActive)}
                    >
                      <span className="flex items-center gap-2.5">
                        <Users className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>Data Akun Unit Kerja</span>
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* 4. Pengaturan Sistem (Accordion Dropdown) */}
            <div>
              <button
                type="button"
                onClick={() => toggleMenu("sistem")}
                aria-expanded={openMenu === "sistem"}
                className={getGroupButtonClass(
                  isSistemGroupActive,
                  openMenu === "sistem"
                )}
              >
                <span className="flex items-center gap-3">
                  <Settings
                    className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                      isSistemGroupActive || openMenu === "sistem"
                        ? "text-[#FBC02D]"
                        : "text-slate-400"
                    }`}
                  />
                  <span>Pengaturan Sistem</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${
                    openMenu === "sistem" ? "rotate-180 text-white" : ""
                  }`}
                />
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  openMenu === "sistem"
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <ul className="overflow-hidden px-2 py-1 space-y-0.5">
                  <li>
                    <Link
                      href="/admin/manajemen-periode"
                      onClick={onCloseMobile}
                      className={getSubLinkClass(isPeriodeActive)}
                    >
                      <span className="flex items-center gap-2.5">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>Manajemen Periode</span>
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
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
