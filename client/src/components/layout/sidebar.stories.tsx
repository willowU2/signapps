import type { Meta, StoryObj } from '@storybook/react';
import { LayoutDashboard, Mail, CheckSquare, HardDrive, Calendar, Settings, Users, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Minimal SidebarPreview component for Storybook
// (The real Sidebar uses Next.js hooks, stores, etc. — this story shows its
//  visual appearance in isolation without runtime dependencies.)
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  badge?: number;
  active?: boolean;
}

interface SidebarPreviewProps {
  collapsed?: boolean;
  items?: NavItem[];
}

const DEFAULT_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, active: true },
  { href: '/mail',      label: 'Mail',      icon: Mail,            color: 'text-blue-500', badge: 3 },
  { href: '/cal',       label: 'Calendar',  icon: Calendar,        color: 'text-blue-400' },
  { href: '/tasks',     label: 'Tasks',     icon: CheckSquare,     color: 'text-green-500', badge: 12 },
  { href: '/storage',   label: 'Drive',     icon: HardDrive,       color: 'text-muted-foreground' },
  { href: '/users',     label: 'Users',     icon: Users,           color: 'text-purple-500' },
  { href: '/security',  label: 'Security',  icon: Shield,          color: 'text-red-500' },
  { href: '/settings',  label: 'Settings',  icon: Settings,        color: 'text-gray-500' },
];

function SidebarPreview({ collapsed = false, items = DEFAULT_ITEMS }: SidebarPreviewProps) {
  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-sidebar border-r border-border transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo area */}
      <div className={cn('flex items-center gap-3 px-4 py-4 border-b border-border', collapsed && 'justify-center px-2')}>
        <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
          S
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm truncate">SignApps</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-2 text-sm cursor-pointer transition-colors',
                item.active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                collapsed && 'justify-center px-2',
              )}
            >
              <div className="relative shrink-0">
                <Icon className={cn('size-4', item.color)} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold leading-none">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof SidebarPreview> = {
  title: 'Layout/Sidebar',
  component: SidebarPreview,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Application sidebar navigation. Supports expanded and collapsed states, ' +
          'badge notifications, and per-module color coding.',
      },
    },
  },
  argTypes: {
    collapsed: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof SidebarPreview>;

export const Expanded: Story = {
  args: { collapsed: false },
};

export const Collapsed: Story = {
  args: { collapsed: true },
};

export const WithBadges: Story = {
  args: {
    collapsed: false,
    items: DEFAULT_ITEMS,
  },
};

export const NoActiveItem: Story = {
  args: {
    collapsed: false,
    items: DEFAULT_ITEMS.map(i => ({ ...i, active: false })),
  },
};

export const Empty: Story = {
  args: {
    collapsed: false,
    items: [],
  },
};
