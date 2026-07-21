import type { AuthResponse, LoginRequest, RegisterRequest } from "@/types/api.types";
import { api } from "../lib/axios";

export const authApi = {
  register: (body: RegisterRequest) => api.post<AuthResponse>("/auth/register", body).then((res) => res.data),

  login: (body: LoginRequest) => api.post<AuthResponse>("/auth/login", body).then((res) => res.data),

  logout: (refreshToken: string) =>
    api.post<{ loggedOut: true }>("/auth/logout", { refreshToken }).then((res) => res.data),

  logoutAll: () => api.post<{ loggedOutAllDevices: true }>("/auth/logout-all").then((res) => res.data),
};
