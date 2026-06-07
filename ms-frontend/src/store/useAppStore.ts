import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserProfile {
  id: number;
  nombre: string;
  email: string;
  ci: string;
  titulo: string;
  rol: 'docente' | 'admin';
  creditos: number;
  activo: boolean;
}

interface AppState {
  user: UserProfile | null;
  token: string | null;
  setAuth: (user: UserProfile, token: string) => void;
  updateCreditos: (creditos: number) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  // persist guarda el estado en localStorage para sobrevivir refrescos
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      // Llamado después de generar un PDC con el valor creditos_restantes del backend
      updateCreditos: (creditos) =>
        set((state) => ({
          user: state.user ? { ...state.user, creditos } : null,
        })),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'pdc-auth' },
  ),
);
