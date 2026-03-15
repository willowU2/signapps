'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function Toolbar({ className, children, ...props }: ToolbarProps) {
    return (
        <div 
            className={cn("flex flex-wrap items-center gap-0.5 px-4 py-1.5 w-full bg-[#edf2fa] dark:bg-[#3c4043] shrink-0 border-b border-transparent dark:border-[#5f6368]", className)}
            {...props}
        >
            {children}
        </div>
    );
}

interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isActive?: boolean;
}

export function ToolbarButton({ 
    className, 
    isActive = false, 
    disabled = false, 
    children, 
    title,
    ...props 
}: ToolbarButtonProps) {
    return (
        <button
            disabled={disabled}
            title={title}
            className={cn(
                "p-1.5 min-w-[32px] rounded flex items-center justify-center transition-all",
                disabled ? "opacity-50 cursor-not-allowed" : "",
                isActive 
                    ? "bg-[#e8f0fe] dark:bg-[#3c4043] text-[#1a73e8] dark:text-[#8ab4f8]" 
                    : "text-[#444746] dark:text-[#e3e3e3] hover:bg-[#f1f3f4] dark:hover:bg-[#303134]",
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}

export function ToolbarDivider({ className }: { className?: string }) {
    return <div className={cn("w-px h-5 bg-[#e3e3e3] dark:bg-[#5f6368] mx-1 self-center shrink-0", className)} />;
}

export function ToolbarGroup({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn("flex items-center mx-1 relative", className)} {...props}>
            {children}
        </div>
    );
}
