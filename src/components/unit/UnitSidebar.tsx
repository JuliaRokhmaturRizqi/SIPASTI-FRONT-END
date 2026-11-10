"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Building2,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  X,
} from "lucide-react";
import { sanitizePlainText } from "@/lib/security";

export interface UnitSidebarProps {
  username?: string;
  namaUnit?: string;
  kategoriUnit?: string;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}

export default function UnitSidebar({
  username = "operator_unit",
  namaUnit = "Unit Kerja",
  kategoriUnit = "Unit Kerja",
  isMobileOpen,
  onCloseMobile,
  onLogout,
  isLoggingOut,
}: UnitSidebarProps) {
  const pathname = usePathname();
  const safeUsername = sanitizePlainText(username);
  const safeNamaUnit = sanitizePlainText(namaUnit);
  const safeKategoriUnit = sanitizePlainText(kategoriUnit);

  const isDashboardActive = pathname === "/unit/dashboard";

  return (
    <>
      {/* Backdrop Sidebar Mobile */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Navigasi Kiri (Konsisten dengan FakultasSidebar: bg-gradient-to-b from-[#0f172a] via-blue-950 to-[#0f172a]) */}
      <aside
        aria-label="Navigasi Utama Operator Unit Kerja"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-gradient-to-b from-[#0f172a] via-blue-950 to-[#0f172a] text-white border-r border-white/10 flex flex-col justify-between transition-transform duration-200 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div>
          <div className="h-16 px-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
                <Building2 className="w-5 h-5 text-[#FBC02D]" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-white block leading-none">
                  SIPASTI
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#FBC02D]">
                  Operator Unit Kerja
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden text-white/70 hover:text-white p-1"
              aria-label="Tutup menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Informasi Identitas Unit Kerja */}
          <div className="px-4 pt-4">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-[#FBC02D] text-[10px] font-bold uppercase tracking-wider">
                <Briefcase className="w-3.5 h-3.5 shrink-0" />
                <span>{safeKategoriUnit}</span>
              </div>
              <p className="text-xs font-bold text-white leading-snug">
                {safeNamaUnit}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                Universitas Nurul Huda
              </p>
            </div>
          </div>

          {/* Menu Navigasi */}
          <nav className="p-4 space-y-1.5">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Menu Utama
            </p>

            <Link
              href="/unit/dashboard"
              onClick={onCloseMobile}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${
                isDashboardActive
                  ? "bg-[#0D47A1] text-white shadow-md shadow-blue-950/50 border border-white/15"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <LayoutDashboard
                className={`w-4 h-4 ${
                  isDashboardActive ? "text-[#FBC02D]" : "text-slate-400"
                }`}
              />
              <span>Dashboard Pelaporan</span>
            </Link>
          </nav>
        </div>

        {/* Profil Operator & Tombol Logout */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FBC02D]/20 border border-[#FBC02D]/40 flex items-center justify-center text-[#FBC02D] font-bold text-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {safeUsername}
              </p>
              <p className="text-[10px] text-slate-400">
                Otoritas {safeKategoriUnit}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-red-500/20 hover:border-red-400/30 border border-white/10 text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4 text-[#FBC02D]" />
            <span>{isLoggingOut ? "Keluar..." : "Keluar Sesi"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
