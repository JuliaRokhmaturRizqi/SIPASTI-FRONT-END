export type DokumenStatus = "Belum Unggah" | "Review" | "Revisi" | "Selesai";

export type TahapDokumenNumber = 1 | 2 | 3 | 4;

export interface DokumenApiRecord {
  id?: number;
  id_prodi?: number;
  id_periode?: number;
  tahap_dokumen: TahapDokumenNumber;
  file_path: string | null;
  status: DokumenStatus;
  catatan_revisi: string | null;
  tanggal_upload: string | null;
}

export interface TaskCardItem {
  tahap: TahapDokumenNumber;
  judul: string;
  deskripsi: string;
  status: DokumenStatus;
  filePath: string | null;
  catatanRevisi: string | null;
  tanggalUpload: string | null;
}

/**
 * Tipe Periode untuk skema Multi-Open pada Dashboard Operator Prodi
 */
export interface ProdiPeriodeOption {
  id: string;
  nama_periode: string;
  status: "Buka" | "Tutup" | "Diarsipkan";
  is_default: boolean;
}

export interface DokumenListResponse {
  status: "success" | "error";
  id_prodi?: number;
  periode_aktif?: string;
  data?: DokumenApiRecord[];
  message?: string;
}

export interface DokumenUploadResponse {
  status: "success" | "error";
  message: string;
  data?: DokumenApiRecord;
}

/**
 * Tipe Data untuk Matriks Pemantauan Admin (/admin/dashboard)
 */
export interface AdminMatrixCell {
  id: number;
  tahap_dokumen: TahapDokumenNumber;
  status: DokumenStatus;
  catatan_revisi: string | null;
  tanggal_upload: string | null;
  has_file?: boolean;
}

export interface AdminProdiRow {
  id_prodi: number;
  nama_prodi: string;
  tahapan: Record<TahapDokumenNumber, AdminMatrixCell>;
}

export interface AdminMatrixResponse {
  status: "success" | "error";
  periode_aktif: string;
  data: AdminProdiRow[];
}

export interface AdminValidasiResponse {
  status: "success" | "error";
  message: string;
  data: {
    id: number;
    id_prodi: number;
    tahap_dokumen: TahapDokumenNumber;
    status: DokumenStatus;
    catatan_revisi: string | null;
    tanggal_upload: string | null;
  };
}
