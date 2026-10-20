export type UserRole = "admin" | "user";

export interface ProdiInfo {
  id: number;
  nama_prodi: string;
}

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  id_prodi: number | null;
  prodi?: ProdiInfo | null;
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
