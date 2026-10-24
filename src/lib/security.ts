/**
 * Konstanta batas ukuran maksimal file upload: 5 MB (dalam satuan bytes).
 */
export const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024; // 5,242,880 bytes

/**
 * Sanitasi teks secara ketat untuk mencegah Cross-Site Scripting (XSS).
 * Menghapus seluruh tag HTML/script, protokol berbahaya, dan karakter kontrol
 * sebelum dirender sebagai plain text di JSX (tanpa dangerouslySetInnerHTML).
 */
export function sanitizePlainText(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }

  return input
    // Hapus seluruh tag HTML atau XML (misal: <script>, <img onerror=...>, dll.)
    .replace(/<[^>]*>?/gm, "")
    // Hapus pola skema URI berbahaya
    .replace(/(javascript|data|vbscript)\s*:/gi, "")
    // Hapus karakter kontrol non-printable kecuali newline dan tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validasi ketat file upload di sisi klien (Sinkron):
 * 1. Hanya menerima ekstensi .pdf dan MIME type application/pdf
 * 2. Menolak nama file dengan ekstensi ganda mencurigakan (misal: .php.pdf, .exe.pdf)
 * 3. Ukuran file wajib > 0 byte dan <= 5 MB
 */
export function validatePdfFileSync(
  file: File | null | undefined
): FileValidationResult {
  if (!file) {
    return {
      valid: false,
      error: "Silakan pilih berkas dokumen terlebih dahulu.",
    };
  }

  const fileName = file.name.trim();
  const lowerName = fileName.toLowerCase();

  // Validasi ekstensi wajib .pdf
  if (!lowerName.endsWith(".pdf")) {
    return {
      valid: false,
      error:
        "Format berkas ditolak. Sistem hanya menerima berkas dengan ekstensi .pdf.",
    };
  }

  // Cegah double-extension berbahaya (contoh: shell.php.pdf atau script.js.pdf)
  const dangerousDoubleExt = /\.(php|phtml|exe|sh|bat|cmd|js|jsp|asp|aspx|py|pl|cgi|html|htm)\.pdf$/i;
  if (dangerousDoubleExt.test(lowerName)) {
    return {
      valid: false,
      error:
        "Nama berkas mengandung ekstensi ganda yang tidak diizinkan demi keamanan sistem.",
    };
  }

  // Validasi MIME type browser
  if (file.type !== "application/pdf") {
    return {
      valid: false,
      error:
        "Tipe MIME berkas tidak valid. Pastikan berkas Anda adalah dokumen PDF asli (application/pdf).",
    };
  }

  // Validasi file kosong
  if (file.size <= 0) {
    return {
      valid: false,
      error: "Berkas PDF yang dipilih kosong (0 KB) atau rusak.",
    };
  }

  // Validasi batas ukuran maksimal 5 MB
  if (file.size > MAX_PDF_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Ukuran berkas (${sizeInMb} MB) melebihi batas maksimal 5 MB.`,
    };
  }

  return { valid: true };
}

/**
 * Validasi header biner (Magic Bytes "%PDF-") untuk memastikan file
 * benar-benar dokumen PDF dan bukan file lain yang sekadar diubah namanya menjadi .pdf.
 */
export async function verifyPdfMagicBytes(file: File): Promise<boolean> {
  try {
    const buffer = await file.slice(0, 5).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // "%PDF-" dalam ASCII: 0x25, 0x50, 0x44, 0x46, 0x2D
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x25 && // %
      bytes[1] === 0x50 && // P
      bytes[2] === 0x44 && // D
      bytes[3] === 0x46    // F
    );
  } catch {
    return false;
  }
}

/**
 * Format ukuran byte menjadi teks yang mudah dibaca (KB / MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}
