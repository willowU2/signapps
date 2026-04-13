"use client";

import { useState, useEffect, useRef } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Key,
  FileText,
  CreditCard,
  Terminal,
  Code,
  User,
  Shield,
  Plus,
  ChevronDown,
  Search,
  Loader2,
} from "lucide-react";
import { useVaultStore } from "@/stores/vault-store";
import { VaultUnlock } from "@/components/vault/vault-unlock";
import { VaultList } from "@/components/vault/vault-list";
import { VaultItemForm } from "@/components/vault/vault-item-form";
import type { VaultItemType } from "@/types/vault";

const ITEM_TYPES: {
  type: VaultItemType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "login", label: "Identifiants", icon: Key },
  { type: "secure_note", label: "Note sécurisée", icon: FileText },
  { type: "card", label: "Carte bancaire", icon: CreditCard },
  { type: "ssh_key", label: "Clé SSH", icon: Terminal },
  { type: "api_token", label: "Jeton API", icon: Code },
  { type: "identity", label: "Identité", icon: User },
  { type: "passkey", label: "Passkey", icon: Shield },
];

/** Retrieve connected user email from auth store in localStorage. */
function useCurrentUserEmail(): string {
  if (typeof window !== "undefined") {
    try {
      const authRaw = localStorage.getItem("auth-storage");
      if (authRaw) {
        const auth = JSON.parse(authRaw);
        return auth?.state?.user?.email || auth?.state?.email || "";
      }
    } catch {
      // ignore
    }
  }
  return "";
}

export default function VaultPage() {
  usePageTitle("Coffre-fort");
  const { locked, loading, masterPasswordRequired, autoUnlock } =
    useVaultStore();
  const email = useCurrentUserEmail();
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<VaultItemType | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const autoUnlockAttempted = useRef(false);

  // Attempt auto-unlock on mount (skip master password prompt when not required)
  useEffect(() => {
    if (!autoUnlockAttempted.current && locked && email) {
      autoUnlockAttempted.current = true;
      autoUnlock(email);
    }
  }, [locked, email, autoUnlock]);

  const handleNewItem = (type: VaultItemType) => {
    setNewItemType(type);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setNewItemType(null);
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-emerald-500" />
            <h1 className="text-xl font-semibold tracking-tight">
              Coffre-fort
            </h1>
          </div>

          {!locked && (
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher…"
                  className="pl-9 w-64"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* New item dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Nouveau
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {ITEM_TYPES.map(({ type, label, icon: Icon }) => (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => handleNewItem(type)}
                      className="gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-hidden">
          {locked && loading ? (
            <div className="flex items-center justify-center h-full p-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : locked && masterPasswordRequired ? (
            <div className="flex items-center justify-center h-full p-6">
              <VaultUnlock />
            </div>
          ) : locked ? (
            <div className="flex items-center justify-center h-full p-6">
              <VaultUnlock />
            </div>
          ) : (
            <VaultList
              search={search}
              selectedFolder={selectedFolder}
              onSelectFolder={setSelectedFolder}
              onEditItem={() => {}}
            />
          )}
        </div>
      </div>

      {/* Item form */}
      {formOpen && newItemType && (
        <VaultItemForm
          open={formOpen}
          itemType={newItemType}
          onClose={handleFormClose}
        />
      )}
    </AppLayout>
  );
}
