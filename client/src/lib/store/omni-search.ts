import { create } from 'zustand'

interface OmniSearchState {
  isOpen: boolean
  toggle: () => void
  open: () => void
  close: () => void
  searchQuery: string
  setSearchQuery: (query: string) => void
}

export const useOmniSearch = create<OmniSearchState>((set) => ({
  isOpen: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
}))
