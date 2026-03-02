export type Role = 'admin' | 'editor' | 'viewer';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  role: Role;
  expiresAt: number;
}

export interface AuthCheckResponse {
  authEnabled: boolean;
  authenticated: boolean;
  username?: string;
  role?: Role;
}

export interface AuthContextValue {
  authEnabled: boolean;
  isAuthenticated: boolean;
  username: string | null;
  role: Role | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  canWrite: boolean;   // editor + admin
  canAdmin: boolean;   // admin only
}
