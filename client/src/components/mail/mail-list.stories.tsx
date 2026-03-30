import type { Meta, StoryObj } from '@storybook/react';
import { MailList } from './mail-list';
import type { Mail } from '@/lib/data/mail';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const hourAgo = new Date(Date.now() - 3600_000).toISOString();
const dayAgo = new Date(Date.now() - 86400_000).toISOString();

const mockMails: Mail[] = [
  {
    id: '1',
    name: 'Alice Martin',
    email: 'alice@example.com',
    subject: 'Q1 Budget review — action required',
    text: 'Hi team, please review the attached Q1 budget report and provide your feedback by Friday.',
    date: hourAgo,
    read: false,
    labels: ['work', 'finance'],
    folder: 'inbox',
    priority: 5,
  },
  {
    id: '2',
    name: 'Bob Dupont',
    email: 'bob@example.com',
    subject: 'Weekly standup notes',
    text: 'Please find below the notes from today\'s standup meeting.',
    date: dayAgo,
    read: true,
    labels: ['work'],
    folder: 'inbox',
    priority: 2,
  },
  {
    id: '3',
    name: 'Carol Smith',
    email: 'carol@example.com',
    subject: 'Invitation: Team lunch on Friday',
    text: 'You are invited to the team lunch next Friday at noon.',
    date: dayAgo,
    read: true,
    labels: [],
    folder: 'inbox',
    priority: 1,
  },
];

const meta: Meta<typeof MailList> = {
  title: 'Mail/MailList',
  component: MailList,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Virtualized mail list with priority indicators, sentiment badges, and context-menu actions.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MailList>;

// ---------------------------------------------------------------------------
// Default — with mails
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    items: mockMails,
    // Provide no-op handlers
    onMailSelect: () => {},
    onMailAction: () => {},
  },
};

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export const Empty: Story = {
  args: {
    items: [],
    onMailSelect: () => {},
    onMailAction: () => {},
  },
};

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

export const Loading: Story = {
  render: () => (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      Loading emails…
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Single unread mail
// ---------------------------------------------------------------------------

export const SingleUnread: Story = {
  args: {
    items: [mockMails[0]],
    onMailSelect: () => {},
    onMailAction: () => {},
  },
};
