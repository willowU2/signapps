"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StarredItem {
  id: string;
  type: 'document' | 'file' | 'contact' | 'task' | 'email' | 'event' | 'note';
  title: string;
  href: string;
  starredAt: string;
}

interface StarredState {
  items: StarredItem[];
  toggle: (item: Omit<StarredItem, 'starredAt'>) => void;
  isStarred: (id: string) => boolean;
  remove: (id: string) => void;
  clear: () => void;
}

export const useStarredStore = create<StarredState>()(
  persist(
    (set, get) => ({
      items: [],

      toggle: (item) => {
        const existing = get().items.find(i => i.id === item.id);
        if (existing) {
          set({ items: get().items.filter(i => i.id !== item.id) });
        } else {
          set({ items: [...get().items, { ...item, starredAt: new Date().toISOString() }] });
        }
      },

      isStarred: (id) => get().items.some(i => i.id === id),

      remove: (id) => set({ items: get().items.filter(i => i.id !== id) }),

      clear: () => set({ items: [] }),
    }),
    { name: 'signapps-starred' }
  )
);
