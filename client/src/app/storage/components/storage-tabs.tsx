'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  LayoutDashboard,
  HardDrive,
  FolderOpen,
  Usb,
  Share2,
  Database,
} from 'lucide-react';

interface StorageTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const STORAGE_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'disks', label: 'Disques', icon: HardDrive },
  { id: 'mounts', label: 'Montages', icon: FolderOpen },
  { id: 'external', label: 'Externes', icon: Usb },
  { id: 'shares', label: 'Partages', icon: Share2 },
  { id: 'raid', label: 'RAID', icon: Database },
] as const;

export type StorageTabId = typeof STORAGE_TABS[number]['id'];

export function StorageTabs({ activeTab, onTabChange, children }: StorageTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
        {STORAGE_TABS.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="flex items-center gap-2"
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

export { TabsContent };
