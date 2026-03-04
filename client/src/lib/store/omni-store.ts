import { create } from 'zustand'

interface OmniState {
  isOpen: boolean
  searchQuery: string

  open: () => void
  close: () => void
  toggle: () => void
  setQuery: (query: string) => void
}

export const useOmniStore = create<OmniState>((set) => ({
  isOpen: false,
  searchQuery: '',

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setQuery: (query) => set({ searchQuery: query }),
}))
