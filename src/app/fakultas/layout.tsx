import React from "react";

export default function ProdiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>;
}
