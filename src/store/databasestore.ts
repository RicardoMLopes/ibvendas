import { create } from 'zustand';

interface DatabaseState {
  baseAtual: string | null;
  setBaseAtual: (nome: string) => void;
  limparBase: () => void;
}

export const useDatabaseStore = create<DatabaseState>((set) => ({
  baseAtual: null,
  setBaseAtual: (nome: string) => set({ baseAtual: nome }),
  limparBase: () => set({ baseAtual: null }),
}));
