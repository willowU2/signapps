import { create } from 'zustand'

interface BreadcrumbStore {
  customLabels: Record<string, string>;
  setCustomLabel: (segment: string, label: string) => void;
  removeCustomLabel: (segment: string) => void;
}

export const useBreadcrumbStore = create<BreadcrumbStore>((set) => ({
  customLabels: {},
  setCustomLabel: (segment, label) => set((state) => ({ 
    customLabels: { ...state.customLabels, [segment]: label } 
  })),
  removeCustomLabel: (segment) => set((state) => {
    const newLabels = { ...state.customLabels };
    delete newLabels[segment];
    return { customLabels: newLabels };
  })
}));
