"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { Mail } from '@/lib/data/mail';

// ============================================================================
// Store Interface
// ============================================================================

interface MailState {
  // Data
  mailList: Mail[];

  // Selection
  selectedId: Mail['id'] | null;

  // UI State
  composeAiOpen: boolean;
  composeRichOpen: boolean;
  labelsExpanded: boolean;

  // Data Actions
  setMailList: (mails: Mail[]) => void;
  addMail: (mail: Mail) => void;
  updateMail: (id: string, updates: Partial<Mail>) => void;
  removeMail: (id: string) => void;

  // Selection Actions
  setSelectedId: (id: Mail['id'] | null) => void;
  clearSelection: () => void;

  // UI Actions
  setComposeAiOpen: (open: boolean) => void;
  toggleComposeAi: () => void;
  setComposeRichOpen: (open: boolean) => void;
  toggleComposeRich: () => void;
  setLabelsExpanded: (expanded: boolean) => void;
  toggleLabelsExpanded: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useMailStore = create<MailState>()(
  persist(
    (set) => ({
      // Initial state
      mailList: [],
      selectedId: null,
      composeAiOpen: false,
      composeRichOpen: false,
      labelsExpanded: true,

      // ========================================
      // Data Actions
      // ========================================

      setMailList: (mails) => set({ mailList: mails }),

      addMail: (mail) =>
        set((state) => ({
          mailList: [mail, ...state.mailList],
        })),

      updateMail: (id, updates) =>
        set((state) => ({
          mailList: state.mailList.map((mail) =>
            mail.id === id ? { ...mail, ...updates } : mail
          ),
        })),

      removeMail: (id) =>
        set((state) => ({
          mailList: state.mailList.filter((mail) => mail.id !== id),
          selectedId: state.selectedId === id ? null : state.selectedId,
        })),

      // ========================================
      // Selection Actions
      // ========================================

      setSelectedId: (id) => set({ selectedId: id }),
      clearSelection: () => set({ selectedId: null }),

      // ========================================
      // UI Actions
      // ========================================

      setComposeAiOpen: (open) => set({ composeAiOpen: open }),
      toggleComposeAi: () => set((state) => ({ composeAiOpen: !state.composeAiOpen })),

      setComposeRichOpen: (open) => set({ composeRichOpen: open }),
      toggleComposeRich: () => set((state) => ({ composeRichOpen: !state.composeRichOpen })),

      setLabelsExpanded: (expanded) => set({ labelsExpanded: expanded }),
      toggleLabelsExpanded: () => set((state) => ({ labelsExpanded: !state.labelsExpanded })),
    }),
    {
      name: 'mail-storage',
      partialize: (state) => ({
        labelsExpanded: state.labelsExpanded,
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectMailsByFolder = (state: MailState, folder: Mail['folder']): Mail[] =>
  state.mailList.filter((mail) => mail.folder === folder);

export const selectUnreadMails = (state: MailState): Mail[] =>
  state.mailList.filter((mail) => !mail.read);

export const selectMailById = (state: MailState, id: string): Mail | undefined =>
  state.mailList.find((mail) => mail.id === id);

// ============================================================================
// Granular Selector Hooks (optimized for minimal re-renders)
// ============================================================================

export const useMailList = () => useMailStore((state) => state.mailList);

export const useSelectedMailId = () => useMailStore((state) => state.selectedId);

export const useSelectedMail = () =>
  useMailStore((state) =>
    state.selectedId ? state.mailList.find((m) => m.id === state.selectedId) ?? null : null
  );

export const useMailUIState = () =>
  useMailStore(
    useShallow((state) => ({
      composeAiOpen: state.composeAiOpen,
      composeRichOpen: state.composeRichOpen,
      labelsExpanded: state.labelsExpanded,
    }))
  );

export const useMailUIActions = () =>
  useMailStore(
    useShallow((state) => ({
      setComposeAiOpen: state.setComposeAiOpen,
      toggleComposeAi: state.toggleComposeAi,
      setComposeRichOpen: state.setComposeRichOpen,
      toggleComposeRich: state.toggleComposeRich,
      setLabelsExpanded: state.setLabelsExpanded,
      toggleLabelsExpanded: state.toggleLabelsExpanded,
    }))
  );

export const useMailSelectionActions = () =>
  useMailStore(
    useShallow((state) => ({
      setSelectedId: state.setSelectedId,
      clearSelection: state.clearSelection,
    }))
  );

export const useMailDataActions = () =>
  useMailStore(
    useShallow((state) => ({
      setMailList: state.setMailList,
      addMail: state.addMail,
      updateMail: state.updateMail,
      removeMail: state.removeMail,
    }))
  );
