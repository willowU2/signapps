'use client';

import React, { useState, useRef, useEffect } from 'react';

export type MenuItem = {
    label?: string;
    action?: string;
    icon?: React.ReactNode;
    shortcut?: string;
    sep?: boolean;
    subItems?: MenuItem[];
};

export type MenuGroup = {
    id: string;
    label: string;
    items: MenuItem[];
};

interface EditorMenuProps {
    menus: MenuGroup[];
    onAction: (action: string, label?: string) => void;
    className?: string;
}

export function EditorMenu({ menus, onAction, className = '' }: EditorMenuProps) {
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenu(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const renderMenuItem = (item: MenuItem, idx: number, level: number = 0) => {
        if (item.sep) {
            return <div key={`sep-${idx}`} className="h-px bg-[#dadce0] dark:bg-[#5f6368] my-1 mx-0" />;
        }
        
        const hasSubMenu = item.subItems && item.subItems.length > 0;
        
        return (
            <div key={item.label || idx} className="relative group/sub">
                <button
                    className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] flex items-center justify-between text-[#202124] dark:text-[#e8eaed] text-[13px]"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasSubMenu) return; // Do nothing if it's a submenu parent
                        if (item.action) onAction(item.action, item.label);
                        setOpenMenu(null);
                    }}
                >
                    <div className="flex items-center gap-3">
                        {item.icon ? <div className="text-[#5f6368] dark:text-[#9aa0a6] w-4">{item.icon}</div> : <div className="w-4" />}
                        <span>{item.label}</span>
                    </div>
                    <div className="flex items-center">
                        {item.shortcut && <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] font-sans tracking-wide ml-4">{item.shortcut}</span>}
                        {hasSubMenu && <span className="ml-3 text-[10px] text-[#5f6368] dark:text-[#9aa0a6]">▶</span>}
                    </div>
                </button>
                
                {/* Submenu rendering via CSS hover */}
                {hasSubMenu && (
                    <div className="absolute top-0 left-full -mt-1 hidden group-hover/sub:block bg-background dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded shadow-lg z-50 py-1 min-w-[220px]">
                        {item.subItems!.map((subItem, sIdx) => renderMenuItem(subItem, sIdx, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div ref={menuRef} className={`flex gap-1 text-[13px] text-[#444746] dark:text-[#9aa0a6] mt-0.5 relative ${className}`}>
            {menus.map(menu => (
                <div key={menu.id} className="relative">
                    <button
                        className={`hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-2 py-0.5 rounded cursor-pointer transition-colors ${openMenu === menu.id ? 'bg-[#f1f3f4] dark:bg-[#303134] text-[#202124] dark:text-[#e8eaed]' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenu(openMenu === menu.id ? null : menu.id);
                        }}
                        onMouseEnter={() => {
                            if (openMenu && openMenu !== menu.id) setOpenMenu(menu.id);
                        }}
                    >
                        {menu.label}
                    </button>
                    {openMenu === menu.id && (
                        <div className="absolute top-full left-0 mt-1 bg-background dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded shadow-lg z-50 py-1 min-w-[220px]">
                            {menu.items.map((item, idx) => renderMenuItem(item, idx))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
