export type LaporanKinerjaStatus = "Review" | "Revisi" | "Selesai";

export type LaporanKinerjaWorkflowStatus =
  | "menunggu_pimpinan"
  | "revisi_pimpinan"
  | "menunggu_admin"
  | "revisi_admin"
  | "selesai";

export interface IdentitasLaporan {
  penanggung_jawab?: string;
  penyusun?: string;
  nama_unit?: string;
  [key: string]: string | undefined;
}

export interface PembahasanRow {
  aspek: string;
  realisasi: string;
  analisis: string;
  link: string;
}

export interface KendalaRow {
  kendala: string;
  penyebab: string;
  dampak: string;
  upaya: string;
}

export interface DukunganRow {
  jenis: string;
  bentuk: string;
  pihak: string;
}

export interface TindakLanjutRow {
  solusi: string;
  pic: string;
  target: string;
  indikator: string;
}

export interface LaporanKinerjaItem {
  id: number;
  id_unit_kerja: number;
  id_periode: number;
  bulan_laporan?: string | null;
  status_laporan?: LaporanKinerjaWorkflowStatus | null;
  identitas_laporan?: IdentitasLaporan | null;
  pembahasan_json?: PembahasanRow[] | null;
  kendala_json?: KendalaRow[] | null;
  dukungan_json?: DukunganRow[] | null;
  tindak_lanjut_json?: TindakLanjutRow[] | null;
  kesimpulan?: string | null;
  rekomendasi?: string | null;
  ttd_penyusun_path?: string | null;
  ttd_pimpinan_path?: string | null;
  nama_kegiatan?: string | null;
  uraian?: string | null;
  link_bukti?: string | null;
  kendala?: string | null;
  dukungan?: string | null;
  tindak_lanjut?: string | null;
  nama_penandatangan?: string | null;
  ttd_image_path?: string | null;
  status: LaporanKinerjaStatus;
  catatan_revisi?: string | null;
  created_at?: string;
  updated_at?: string;
  unit_kerja?: {
    id: number;
    nama_unit: string;
    id_kategori?: number | null;
    kategori_unit?: string | { id?: number; nama_kategori?: string } | null;
    kategori?: { id?: number; nama_kategori?: string } | null;
    kategoriUnit?: { id?: number; nama_kategori?: string } | null;
  } | null;
  periode_akademik?: {
    id: number;
    nama_periode: string;
    status_aktif: boolean | number;
    status_pelaporan: string;
  } | null;
}

export interface LaporanKinerjaListResponse {
  status: "success" | "error";
  message?: string;
  data?: LaporanKinerjaItem[];
}

export interface LaporanKinerjaValidasiPayload {
  status: "Selesai" | "Revisi";
  catatan_revisi?: string | null;
}

export interface LaporanKinerjaValidasiResponse {
  status: "success" | "error";
  message: string;
  data?: LaporanKinerjaItem;
}
