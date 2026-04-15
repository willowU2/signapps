import type { Meta, StoryObj } from "@storybook/react";
import { DealCard } from "./deal-card";
import type { Deal } from "@/lib/api/crm";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";

// ---------------------------------------------------------------------------
// Mock deal fixtures
// ---------------------------------------------------------------------------

const mockDeal: Deal = {
  id: "deal-1",
  title: "Enterprise License — Acme Corp",
  value: 45000,
  stage: "proposal",
  probability: 65,
  closeDate: "2026-04-30",
  company: "Acme Corporation",
  tags: ["enterprise", "priority"],
  createdAt: "2026-01-15T10:00:00Z",
  updatedAt: "2026-03-20T14:00:00Z",
};

const hotDeal: Deal = {
  ...mockDeal,
  id: "deal-2",
  title: "Professional Plan Renewal",
  value: 12000,
  probability: 90,
  stage: "negotiation",
  company: "TechStart SAS",
};

const coldDeal: Deal = {
  ...mockDeal,
  id: "deal-3",
  title: "Starter Plan Upgrade",
  value: 1500,
  probability: 20,
  stage: "prospect",
  company: "Solo Freelancer",
};

// ---------------------------------------------------------------------------
// Wrapper to provide DnD context (DealCard uses useSortable)
// ---------------------------------------------------------------------------

function StorybookWrapper({ children }: { children: React.ReactNode }) {
  return (
    <DndContext>
      <SortableContext items={["deal-1", "deal-2", "deal-3"]}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

const meta: Meta<typeof DealCard> = {
  title: "CRM/DealCard",
  component: DealCard,
  tags: ["autodocs"],
  decorators: [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Story: any) => (
      <StorybookWrapper>
        <div className="w-72 p-4">
          <Story />
        </div>
      </StorybookWrapper>
    ),
  ],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Draggable deal card used in the CRM Kanban board. " +
          "Shows deal value, probability, and a computed lead score.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DealCard>;

export const Default: Story = {
  args: { deal: mockDeal },
};

export const HighScore: Story = {
  name: "Hot deal (high score)",
  args: { deal: hotDeal },
};

export const LowScore: Story = {
  name: "Cold deal (low score)",
  args: { deal: coldDeal },
};

export const Compact: Story = {
  args: { deal: mockDeal, compact: true },
};
