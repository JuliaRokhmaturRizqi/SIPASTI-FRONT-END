export type LaporanKinerjaStatus = "Review" | "Revisi" | "Selesai";

export interface LaporanKinerjaItem {
  id: number;
  id_unit_kerja: number;
  id_periode: number;
  nama_kegiatan: string;
  uraian?: string | null;
  link_bukti?: string | null;
  kendala?: string | null;
  dukungan?: string | null;
  tindak_lanjut?: string | null;
  nama_penandatangan?: string | null;
  status: LaporanKinerjaStatus;
  catatan_revisi?: string | null;
  created_at?: string;
  updated_at?: string;
  unit_kerja?: {
    id: number;
    nama_unit: string;
    kategori_unit: string;
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
