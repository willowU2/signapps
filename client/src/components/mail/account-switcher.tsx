"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { accountApi, type MailProvider } from "@/lib/api-mail";
import { toast } from "sonner";

interface Account {
  email: string;
  name: string;
  icon: string;
  provider: "gmail" | "outlook" | "custom";
}

interface AccountSwitcherProps {
  isCollapsed: boolean;
  accounts: Account[];
}

export function AccountSwitcher({
  isCollapsed,
  accounts,
}: AccountSwitcherProps) {
  const [selectedAccount, setSelectedAccount] = React.useState<Account>(
    accounts[0] || { name: "", email: "", icon: "", provider: "gmail" },
  );
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleAddAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const provider = formData.get("provider") as string;
    const imap = formData.get("imap") as string;

    try {
      await accountApi.create({
        email_address: email,
        provider: provider as MailProvider,
        app_password: password,
        imap_server: imap,
        imap_port: 993,
      });
      toast.success("Compte connecté avec succès !");
      setOpen(false);
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast.error("Impossible de connecter le compte.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-3 overflow-hidden rounded-xl border border-border/40 bg-card/50 p-2.5 transition-all hover:bg-muted/60 cursor-pointer shadow-sm",
            isCollapsed &&
              "justify-center p-1 border-transparent bg-transparent shadow-none",
          )}
        >
          <Avatar className="h-9 w-9 shrink-0 rounded-full border-2 border-primary/20 shadow-sm">
            {selectedAccount.icon && <AvatarImage src={selectedAccount.icon} />}
            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
              {selectedAccount.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-1 flex-col min-w-0">
              <span className="truncate text-sm font-semibold text-foreground">
                {selectedAccount.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {selectedAccount.email}
              </span>
            </div>
          )}
          {!isCollapsed && (
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/60" />
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 rounded-xl shadow-lg border-border/50 p-1"
        align={isCollapsed ? "start" : "center"}
        side={isCollapsed ? "right" : "bottom"}
        alignOffset={isCollapsed ? -8 : 0}
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wider">
          Switch Account
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accounts.map((account) => (
          <DropdownMenuItem
            key={account.email}
            onClick={() => setSelectedAccount(account)}
            className="flex items-center gap-2 rounded-lg cursor-pointer p-2"
          >
            <Avatar className="h-6 w-6 rounded-full border">
              {account.icon && <AvatarImage src={account.icon} />}
              <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">
                {account.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col truncate text-sm flex-1">
              <span className="font-medium">{account.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {account.email}
              </span>
            </div>
            {selectedAccount.email === account.email && (
              <Check className="h-4 w-4 text-primary ml-auto" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="flex items-center gap-2 rounded-lg cursor-pointer p-2 text-primary focus:bg-primary/5 focus:text-primary"
            >
              <div className="flex bg-primary/10 h-6 w-6 items-center justify-center rounded-full">
                <Plus className="h-3.5 w-3.5" />
              </div>
              <span className="font-medium text-sm">Add another account</span>
            </DropdownMenuItem>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddAccount}>
              <DialogHeader>
                <DialogTitle>Add Email Account</DialogTitle>
                <DialogDescription>
                  Connect an external IMAP account to sync your emails
                  perfectly.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="provider">Provider Name</Label>
                  <Input id="provider" name="provider" defaultValue="local" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue="test@signapps.local"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">App Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="imap">IMAP Server</Label>
                  <Input
                    id="imap"
                    name="imap"
                    defaultValue="127.0.0.1"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? "Connecting..." : "Connect Account"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
