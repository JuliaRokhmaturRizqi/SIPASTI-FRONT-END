"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  X,
} from "lucide-react";
import { sanitizePlainText } from "@/lib/security";

interface ProdiSidebarProps {
  username?: string;
  prodiName?: string;
  fakultasLabel?: string;
  completedCount?: number;
  totalCount?: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}

export default function ProdiSidebar({
  username = "prodi_ti",
  prodiName = "Program Studi",
  fakultasLabel = "Universitas Nurul Huda",
  completedCount = 0,
  totalCount = 4,
  isMobileOpen,
  onCloseMobile,
  onLogout,
  isLoggingOut,
}: ProdiSidebarProps) {
  const pathname = usePathname();
  const safeUsername = sanitizePlainText(username);
  const safeProdiName = sanitizePlainText(prodiName);
  const safeFakultasLabel = sanitizePlainText(fakultasLabel);

  const isDashboardActive = pathname === "/prodi/dashboard";
  const isTahapanActive = pathname.startsWith("/prodi/tahapan");

  return (
    <>
      {/* Backdrop Sidebar Mobile */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Navigasi Kiri (Persis Gaya Admin: bg-[#0f172a] & Biru Gelap) */}
      <aside
        aria-label="Navigasi Utama Operator Program Studi"
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
                  Operator Prodi
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

          {/* Informasi Identitas Prodi */}
          <div className="px-4 pt-4">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-[#FBC02D] text-[10px] font-bold uppercase tracking-wider">
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                <span>Unit Program Studi</span>
              </div>
              <p className="text-xs font-bold text-white leading-snug">
                {safeProdiName}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {safeFakultasLabel}
              </p>
            </div>
          </div>

          {/* Menu Navigasi */}
          <nav className="p-4 space-y-1.5">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Menu Utama
            </p>

            <Link
              href="/prodi/dashboard"
              onClick={onCloseMobile}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${
                isDashboardActive
                  ? "bg-[#0D47A1] text-white shadow-md shadow-blue-950/50 border border-white/15"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <LayoutDashboard
                  className={`w-4 h-4 ${
                    isDashboardActive ? "text-[#FBC02D]" : "text-slate-400"
                  }`}
                />
                <span>Overview Pelaporan</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FBC02D] text-slate-950">
                {completedCount}/{totalCount}
              </span>
            </Link>

            <Link
              href="/prodi/tahapan"
              onClick={onCloseMobile}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${
                isTahapanActive
                  ? "bg-[#0D47A1] text-white shadow-md shadow-blue-950/50 border border-white/15"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <FileCheck2
                className={`w-4 h-4 ${
                  isTahapanActive ? "text-[#FBC02D]" : "text-slate-400"
                }`}
              />
              <span>Tahapan Surat Pernyataan</span>
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
                Otoritas Operator Prodi
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
