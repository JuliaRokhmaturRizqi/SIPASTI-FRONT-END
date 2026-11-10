export type UserRole = "admin" | "user" | "biro" | "pusat" | "lab";

export interface ProdiInfo {
  id: number;
  id_fakultas?: number;
  nama_prodi: string;
  periode_mulai_aktif?: string | null;
}

export interface FakultasInfo {
  id: number;
  nama_fakultas: string;
  singkatan?: string;
  prodi?: ProdiInfo[];
}

export interface UnitKerjaInfo {
  id: number;
  nama_unit: string;
  kategori_unit: string;
}

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  id_fakultas: number | null;
  id_unit_kerja?: number | null;
  is_active?: boolean;
  fakultas?: {
    id: number;
    nama_fakultas: string;
    singkatan?: string;
    prodi?: ProdiInfo[];
  } | null;
  unit_kerja?: {
    id: number;
    nama_unit: string;
    kategori_unit: string;
  } | null;
}

export interface LoginSuccessResponse {
  status: "success";
  message: string;
  data: {
    user: AuthUser;
    role: UserRole;
    access_token: string;
    token_type: "Bearer";
  };
}

export interface ApiErrorResponse {
  status?: "error";
  message: string;
  retry_after?: number;
  errors?: Record<string, string[]>;
}
