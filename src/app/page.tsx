"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthSession, getDashboardPathByRole } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const { token, role } = getAuthSession();
    if (token && role) {
      router.replace(getDashboardPathByRole(role));
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D47A1] text-white">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#FBC02D]" />
        <p className="text-sm font-medium text-blue-100">
          Memuat Sistem Pelaporan Administrasi Terintegrasi...
        </p>
      </div>
    </div>
  );
}
