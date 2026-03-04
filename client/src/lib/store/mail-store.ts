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

  // UI State
  composeAiOpen: boolean;
  labelsExpanded: boolean;

  // Data Actions
  setMailList: (mails: Mail[]) => void;
  addMail: (mail: Mail) => void;
  updateMail: (id: string, updates: Partial<Mail>) => void;
  removeMail: (id: string) => void;

  // UI Actions
  setComposeAiOpen: (open: boolean) => void;
  toggleComposeAi: () => void;
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
      composeAiOpen: false,
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
        })),

      // ========================================
      // UI Actions
      // ========================================

      setComposeAiOpen: (open) => set({ composeAiOpen: open }),
      toggleComposeAi: () => set((state) => ({ composeAiOpen: !state.composeAiOpen })),

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

export const useMailUIState = () =>
  useMailStore(
    useShallow((state) => ({
      composeAiOpen: state.composeAiOpen,
      labelsExpanded: state.labelsExpanded,
    }))
  );

export const useMailUIActions = () =>
  useMailStore(
    useShallow((state) => ({
      setComposeAiOpen: state.setComposeAiOpen,
      toggleComposeAi: state.toggleComposeAi,
      setLabelsExpanded: state.setLabelsExpanded,
      toggleLabelsExpanded: state.toggleLabelsExpanded,
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
