import { create } from 'zustand';

export interface ToastState {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface ToastStore {
  toast: ToastState | null;
  show: (message: string, action?: ToastState['action']) => void;
  dismiss: () => void;
}

let next = 0;

/** Aviso temporal no modal (por ejemplo «PDF exportado», con un enlace de acción). */
export const useToast = create<ToastStore>((set) => ({
  toast: null,
  show: (message, action) => set({ toast: { id: ++next, message, action } }),
  dismiss: () => set({ toast: null }),
}));
