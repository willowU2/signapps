"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface Account {
    email: string
    name: string
    icon: string
    provider: "gmail" | "outlook" | "custom"
}

interface AccountSwitcherProps {
    isCollapsed: boolean
    accounts: Account[]
}

export function AccountSwitcher({
    isCollapsed,
    accounts,
}: AccountSwitcherProps) {
    const [selectedAccount, setSelectedAccount] = React.useState<Account>(
        accounts[0]
    )

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div
                    className={cn(
                        "flex items-center gap-2 overflow-hidden rounded-xl border border-transparent p-2 transition-all hover:bg-muted/50 cursor-pointer",
                        isCollapsed && "justify-center p-0"
                    )}
                >
                    <Avatar className="h-8 w-8 shrink-0 rounded-full border border-background shadow-sm ring-1 ring-border/10">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedAccount.email}`} />
                        <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
                            {selectedAccount.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    {!isCollapsed && (
                        <div className="flex flex-1 flex-col truncate">
                            <span className="truncate text-sm font-semibold leading-tight">
                                {selectedAccount.name}
                            </span>
                            <span className="truncate text-[11px] text-muted-foreground font-medium">
                                {selectedAccount.email}
                            </span>
                        </div>
                    )}
                    {!isCollapsed && (
                        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/50" />
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
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${account.email}`} />
                        </Avatar>
                        <div className="flex flex-col truncate text-sm flex-1">
                            <span className="font-medium">{account.name}</span>
                            <span className="text-[10px] text-muted-foreground">{account.email}</span>
                        </div>
                        {selectedAccount.email === account.email && (
                            <Check className="h-4 w-4 text-primary ml-auto" />
                        )}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex items-center gap-2 rounded-lg cursor-pointer p-2 text-primary focus:bg-primary/5 focus:text-primary">
                    <div className="flex bg-primary/10 h-6 w-6 items-center justify-center rounded-full">
                        <Plus className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium text-sm">Add another account</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
