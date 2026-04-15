import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Loader2, Mail, Trash2 } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
      ],
    },
    size: {
      control: "select",
      options: [
        "default",
        "xs",
        "sm",
        "lg",
        "icon",
        "icon-xs",
        "icon-sm",
        "icon-lg",
      ],
    },
    disabled: { control: "boolean" },
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Primary action button component based on Radix UI Slot with CVA variants. " +
          "Supports six visual variants and eight sizes.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    children: "Click me",
    variant: "default",
    size: "default",
  },
};

// ---------------------------------------------------------------------------
// All variants
// ---------------------------------------------------------------------------

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// All sizes
// ---------------------------------------------------------------------------

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra Small</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">
        <Mail />
      </Button>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

export const Loading: Story = {
  render: () => (
    <Button disabled>
      <Loader2 className="size-4 animate-spin" />
      Loading...
    </Button>
  ),
};

// ---------------------------------------------------------------------------
// Error / destructive state
// ---------------------------------------------------------------------------

export const Destructive: Story = {
  render: () => (
    <Button variant="destructive">
      <Trash2 />
      Delete permanently
    </Button>
  ),
};

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

export const Disabled: Story = {
  args: {
    children: "Cannot click",
    disabled: true,
  },
};

// ---------------------------------------------------------------------------
// With icon
// ---------------------------------------------------------------------------

export const WithIcon: Story = {
  render: () => (
    <Button>
      <Mail />
      Compose email
    </Button>
  ),
};
