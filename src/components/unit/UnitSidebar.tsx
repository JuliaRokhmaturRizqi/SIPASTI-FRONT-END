"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Building2,
  ChevronUp,
  KeyRound,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  X,
} from "lucide-react";
import { sanitizePlainText } from "@/lib/security";
import UbahPasswordModal from "@/components/UbahPasswordModal";

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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isUbahPasswordOpen, setIsUbahPasswordOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {/* Backdrop Sidebar Mobile */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Navigasi Kiri (Tema UNUHA Authentic) */}
      <aside
        aria-label="Navigasi Utama Operator Unit Kerja"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-unuha-green-dark text-white border-r border-white/10 flex flex-col justify-between transition-transform duration-200 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div>
          <div className="h-16 px-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-unuha-green/60 border border-unuha-gold/30 flex items-center justify-center shadow-inner">
                <Building2 className="w-5 h-5 text-unuha-gold" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-white block leading-none">
                  SIPASTI
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-unuha-gold">
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
              <div className="flex items-center gap-2 text-unuha-gold text-[10px] font-bold uppercase tracking-wider">
                <Briefcase className="w-3.5 h-3.5 shrink-0" />
                <span>{safeKategoriUnit}</span>
              </div>
              <p className="text-xs font-bold text-white leading-snug">
                {safeNamaUnit}
              </p>
              <p className="text-[11px] text-slate-300/80 truncate">
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
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-l-4 text-xs sm:text-sm transition-all duration-200 ${
                isDashboardActive
                  ? "bg-unuha-green/80 text-unuha-gold border-unuha-gold font-semibold shadow-md"
                  : "border-transparent text-slate-300 hover:bg-unuha-green/60 hover:text-white font-medium"
              }`}
            >
              <LayoutDashboard
                className={`w-4 h-4 ${
                  isDashboardActive ? "text-unuha-gold" : "text-slate-400"
                }`}
              />
              <span>Dashboard Pelaporan</span>
            </Link>
          </nav>
        </div>

        {/* Profil Operator (Dropdown Ubah Password & Logout) */}
        <div
          ref={profileMenuRef}
          className="relative p-4 border-t border-white/10 bg-black/20"
        >
          {isProfileMenuOpen && (
            <div className="absolute left-4 right-4 bottom-full mb-2 rounded-xl bg-unuha-green-dark border border-white/15 shadow-2xl p-1.5 space-y-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setIsUbahPasswordOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-200 hover:bg-unuha-green hover:text-white transition cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-unuha-gold shrink-0" />
                <span>Ubah Password</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onLogout();
                }}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-red-300 hover:bg-red-500/20 hover:text-red-200 transition cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>{isLoggingOut ? "Keluar..." : "Keluar Sesi"}</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            aria-expanded={isProfileMenuOpen}
            className="w-full p-3 rounded-xl bg-white/5 hover:bg-unuha-green/60 border border-white/10 flex items-center gap-3 text-left transition cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-unuha-gold/15 border border-unuha-gold/40 flex items-center justify-center text-unuha-gold font-bold text-xs shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-unuha-gold truncate">
                {safeUsername}
              </p>
              <p className="text-[10px] text-slate-300 truncate">
                Otoritas {safeKategoriUnit}
              </p>
            </div>
            <ChevronUp
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                isProfileMenuOpen ? "rotate-180 text-unuha-gold" : ""
              }`}
            />
          </button>
        </div>
      </aside>

      <UbahPasswordModal
        isOpen={isUbahPasswordOpen}
        onClose={() => setIsUbahPasswordOpen(false)}
      />
    </>
  );
}
