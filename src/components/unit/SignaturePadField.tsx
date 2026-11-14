"use client";

import React, { useEffect, useRef, useState } from "react";
import { Eraser, ImageUp, PenTool, Trash2 } from "lucide-react";

export interface SignatureValue {
  file: File | null;
  base64: string | null;
}

export interface SignaturePadFieldProps {
  label?: string;
  helperText?: string;
  existingPath?: string | null;
  onChange: (value: SignatureValue) => void;
  required?: boolean;
}

export default function SignaturePadField({
  label = "Tanda Tangan Digital",
  helperText = "Pilih gambar langsung di layar atau unggah file gambar tanda tangan (PNG/JPG, maks. 2MB).",
  existingPath = null,
  onChange,
  required = false,
}: SignaturePadFieldProps) {
  const [activeTab, setActiveTab] = useState<"canvas" | "upload">("canvas");
  const [hasCanvasInk, setHasCanvasInk] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDrawingRef = useRef(false);

  // Inisialisasi konteks canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0f172a";
  }, [activeTab]);

  const getPointerCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }

    const mouseEvent = e as React.MouseEvent<HTMLCanvasElement>;
    return {
      x: (mouseEvent.clientX - rect.left) * scaleX,
      y: (mouseEvent.clientY - rect.top) * scaleY,
    };
  };

  const handleStartDraw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getPointerCoords(e);
    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleMoveDraw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getPointerCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasCanvasInk) {
      setHasCanvasInk(true);
    }
  };

  const handleEndDraw = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onChange({ file: null, base64: dataUrl });
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasCanvasInk(false);
    onChange({ file: null, base64: null });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      setUploadError("Format file harus PNG atau JPG.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Ukuran file maksimal 2 MB.");
      return;
    }

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedPreview(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);

    onChange({ file, base64: null });
  };

  const handleRemoveUpload = () => {
    setUploadedPreview(null);
    setUploadedFileName(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onChange({ file: null, base64: null });
  };

  const handleSwitchTab = (tab: "canvas" | "upload") => {
    setActiveTab(tab);
    if (tab === "canvas") {
      setUploadedPreview(null);
      setUploadedFileName(null);
      setUploadError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (hasCanvasInk && canvasRef.current) {
        onChange({ file: null, base64: canvasRef.current.toDataURL("image/png") });
      } else {
        onChange({ file: null, base64: null });
      }
    } else {
      handleClearCanvas();
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-bold text-slate-800">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <p className="text-xs text-slate-500 mt-0.5">{helperText}</p>
        {existingPath && !hasCanvasInk && !uploadedPreview && (
          <p className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 mt-2 inline-block">
            ✓ Tanda tangan sebelumnya sudah tersimpan. Anda dapat menggantinya di bawah jika perlu.
          </p>
        )}
      </div>

      {/* Tabs Pilihan Metode Tanda Tangan */}
      <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
        <button
          type="button"
          onClick={() => handleSwitchTab("canvas")}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === "canvas"
              ? "bg-white text-[#0D47A1] shadow-xs border border-slate-200/70"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>Gambar Langsung</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab("upload")}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === "upload"
              ? "bg-white text-[#0D47A1] shadow-xs border border-slate-200/70"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ImageUp className="w-3.5 h-3.5" />
          <span>Unggah Gambar</span>
        </button>
      </div>

      {activeTab === "canvas" ? (
        <div className="space-y-2">
          <div className="relative rounded-2xl border-2 border-dashed border-slate-300 bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              width={560}
              height={180}
              onMouseDown={handleStartDraw}
              onMouseMove={handleMoveDraw}
              onMouseUp={handleEndDraw}
              onMouseLeave={handleEndDraw}
              onTouchStart={handleStartDraw}
              onTouchMove={handleMoveDraw}
              onTouchEnd={handleEndDraw}
              className="w-full h-44 cursor-crosshair touch-none block"
            />
            {!hasCanvasInk && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                Goreskan tanda tangan Anda di area kotak ini
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {hasCanvasInk
                ? "Tanda tangan siap dikirim."
                : "Belum ada goresan tanda tangan."}
            </span>
            <button
              type="button"
              onClick={handleClearCanvas}
              disabled={!hasCanvasInk}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer disabled:opacity-40"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Hapus / Ulangi</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {uploadedPreview ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-36 h-20 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-2 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadedPreview}
                    alt="Preview Tanda Tangan"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {uploadedFileName}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    File tanda tangan siap diunggah
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveUpload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus File</span>
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 hover:bg-blue-50/40 hover:border-blue-400 transition p-6 cursor-pointer text-center">
              <ImageUp className="w-7 h-7 text-[#0D47A1] mb-2" />
              <span className="text-xs font-bold text-slate-700">
                Klik untuk memilih gambar tanda tangan
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5">
                Format PNG atau JPG (latar transparan/putih disarankan, maks. 2MB)
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}
          {uploadError && (
            <p className="text-xs font-semibold text-red-600">{uploadError}</p>
          )}
        </div>
      )}
    </div>
  );
}
