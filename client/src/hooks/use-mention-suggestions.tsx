'use client';

import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { MentionList, MentionListRef, MentionUser } from '@/components/docs/extensions/mention-suggestion';
import { createServiceClient } from '@/lib/api/factory';

/**
 * Fetch users from the identity service for mention suggestions
 */
async function fetchUsers(query: string): Promise<MentionUser[]> {
  try {
    const api = createServiceClient('IDENTITY');
    const response = await api.get('/users', {
      params: {
        search: query,
        limit: 10,
      },
    });

    // Transform API response to MentionUser format
    return (response.data?.users || response.data || []).map((user: any) => ({
      id: user.id || user.user_id,
      name: user.name || user.full_name || user.username,
      username: user.username,
      avatar: user.avatar || user.avatar_url,
    }));
  } catch (error) {
    console.error('Error fetching users for mentions:', error);
    return [];
  }
}

/**
 * Create suggestion configuration for the Mention extension
 */
export function createMentionSuggestion(): Omit<SuggestionOptions<MentionUser>, 'editor'> {
  return {
    char: '@',

    items: async ({ query }) => {
      if (!query) {
        // Return recent/all users when no query
        return fetchUsers('');
      }
      return fetchUsers(query);
    },

    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: SuggestionProps<MentionUser>) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },

        onUpdate(props: SuggestionProps<MentionUser>) {
          component?.updateProps(props);

          if (!props.clientRect) {
            return;
          }

          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        },

        onKeyDown(props: SuggestionKeyDownProps) {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }

          return component?.ref?.onKeyDown(props) || false;
        },

        onExit() {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}

export default createMentionSuggestion;
