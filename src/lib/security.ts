/**
 * Konstanta batas ukuran maksimal file upload: 2 MB (2,097,152 bytes) untuk Operator Prodi.
 */
export const MAX_PDF_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Sanitasi teks secara ketat untuk mencegah Cross-Site Scripting (XSS) dan Injection.
 * Menghapus seluruh tag HTML/script, event handler inline, protokol berbahaya,
 * dan karakter kontrol sebelum dirender sebagai plain text atau dikirim ke API.
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
    // Hapus pola event handler inline (misal: onload=, onerror=)
    .replace(/\bon\w+\s*=/gi, "")
    // Hapus karakter kontrol non-printable kecuali newline dan tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

export interface RejectionSanitizeResult {
  valid: boolean;
  sanitized: string;
  error?: string;
}

/**
 * Validasi dan sanitasi ketat input "Alasan Penolakan" (Catatan Revisi) dari Admin
 * sebelum dikirim via API untuk mencegah XSS dan SQL/Command Injection.
 */
export function validateAndSanitizeRejectionReason(
  rawInput: string
): RejectionSanitizeResult {
  const sanitized = sanitizePlainText(rawInput)
    // Reduksi spasi/baris berlebih
    .replace(/\s{3,}/g, "  ");

  if (!sanitized) {
    return {
      valid: false,
      sanitized: "",
      error: "Alasan penolakan wajib diisi sebelum menolak dokumen.",
    };
  }

  if (sanitized.length < 10) {
    return {
      valid: false,
      sanitized,
      error:
        "Alasan penolakan terlalu singkat (minimal 10 karakter agar jelas bagi Operator Prodi).",
    };
  }

  if (sanitized.length > 1000) {
    return {
      valid: false,
      sanitized: sanitized.slice(0, 1000),
      error: "Alasan penolakan maksimal 1000 karakter.",
    };
  }

  // Deteksi pola SQL Injection mencurigakan
  const sqlInjectionPattern =
    /(\b(UNION\s+SELECT|DROP\s+TABLE|ALTER\s+TABLE|INSERT\s+INTO|DELETE\s+FROM)\b|--\s|;\s*DROP)/i;
  if (sqlInjectionPattern.test(sanitized)) {
    return {
      valid: false,
      sanitized: "",
      error:
        "Input mengandung pola karakter atau instruksi yang dilarang oleh kebijakan keamanan sistem.",
    };
  }

  return {
    valid: true,
    sanitized,
  };
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validasi ketat file upload di sisi klien (Sinkron):
 * 1. Hanya menerima ekstensi .pdf dan MIME type application/pdf
 * 2. Menolak nama file dengan ekstensi ganda mencurigakan (misal: .php.pdf, .exe.pdf)
 * 3. Ukuran file wajib > 0 byte dan <= maxBytes (default 2 MB)
 */
export function validatePdfFileSync(
  file: File | null | undefined,
  maxBytes: number = MAX_PDF_SIZE_BYTES
): FileValidationResult {
  if (!file) {
    return {
      valid: false,
      error: "Silakan pilih berkas dokumen PDF terlebih dahulu.",
    };
  }

  const fileName = file.name.trim();
  const lowerName = fileName.toLowerCase();

  // Validasi ekstensi wajib .pdf
  if (!lowerName.endsWith(".pdf")) {
    return {
      valid: false,
      error:
        "Format berkas ditolak! Sistem hanya menerima berkas dokumen berformat .pdf.",
    };
  }

  // Cegah double-extension berbahaya (contoh: shell.php.pdf atau script.js.pdf)
  const dangerousDoubleExt =
    /\.(php|phtml|exe|sh|bat|cmd|js|jsp|asp|aspx|py|pl|cgi|html|htm)\.pdf$/i;
  if (dangerousDoubleExt.test(lowerName)) {
    return {
      valid: false,
      error:
        "Nama berkas mengandung ekstensi ganda yang dilarang demi keamanan sistem.",
    };
  }

  // Validasi MIME type browser
  if (file.type !== "application/pdf") {
    return {
      valid: false,
      error:
        "Tipe berkas bukan PDF yang sah (wajib application/pdf).",
    };
  }

  // Validasi file kosong
  if (file.size <= 0) {
    return {
      valid: false,
      error: "Berkas PDF yang dipilih kosong (0 KB) atau rusak.",
    };
  }

  // Validasi batas ukuran maksimal (default 2 MB)
  if (file.size > maxBytes) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    const maxInMb = Math.round(maxBytes / (1024 * 1024));
    return {
      valid: false,
      error: `Ukuran berkas (${sizeInMb} MB) melebihi batas maksimal ${maxInMb} MB.`,
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
      bytes[3] === 0x46 // F
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
