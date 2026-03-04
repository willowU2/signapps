import React from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Editor } from '@tiptap/react';
import { DynamicMenuCategory, DynamicMenuItem } from '../docs/editor/editor-menu-config';

export interface DynamicMenuBarProps {
    categories: DynamicMenuCategory[];
    editor: Editor | null;
}

export function DynamicMenuBar({ categories, editor }: DynamicMenuBarProps) {
    const renderMenuItem = (item: DynamicMenuItem) => {
        if (item.type === 'separator') {
            return <DropdownMenuSeparator key={item.id} />;
        }
        
        if (item.type === 'link') {
            const Icon = item.icon;
            return (
                <DropdownMenuItem key={item.id} asChild>
                    <a href={item.href}>
                        {Icon && <Icon className={`mr-2 h-4 w-4 ${item.iconOpacity ? `opacity-${item.iconOpacity}` : ''}`} />}
                        <span>{item.label}</span>
                    </a>
                </DropdownMenuItem>
            );
        }

        if (item.type === 'submenu') {
            const Icon = item.icon;
            return (
                <DropdownMenuSub key={item.id}>
                    <DropdownMenuSubTrigger>
                        {Icon && <Icon className={`mr-2 h-4 w-4 ${item.iconOpacity ? `opacity-${item.iconOpacity}` : ''}`} />}
                        <span>{item.label}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className={item.contentClassName}>
                        {item.items.map(renderMenuItem)}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            );
        }

        const Icon = item.icon;
        const disabled = item.isDisabled ? item.isDisabled(editor) : false;
        
        // Handling active states explicitly like bold, italic, underline
        let textClass = "";
        if (item.isActive && item.isActive(editor)) {
           if (item.id === 'bold') textClass = "font-bold";
           else if (item.id === 'italic') textClass = "italic";
           else if (item.id === 'underline') textClass = "underline";
           else if (item.id === 'strike') textClass = "line-through";
           else textClass = "font-semibold text-primary";
        }
        
        return (
            <DropdownMenuItem 
               key={item.id}
               onClick={() => item.action && item.action(editor)}
               disabled={disabled}
            >
               {Icon && <Icon className={`mr-2 h-4 w-4 ${item.iconOpacity ? `opacity-${item.iconOpacity}` : ''}`} />}
               <span className={textClass}>{item.label}</span>
               {item.shortcut && (
                   <span className="ml-auto text-xs tracking-widest text-muted-foreground">{item.shortcut}</span>
               )}
            </DropdownMenuItem>
        );
    }
    
    return (
        <div className="flex items-center gap-0.5 px-0 py-0 bg-transparent text-[13px] text-[#444746] dark:text-[#9aa0a6]">
            {categories.map(category => (
                <DropdownMenu key={category.id}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-[26px] px-2 font-normal rounded-sm hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-inherit transition-colors">
                            {category.label}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className={category.contentClassName || "w-[300px]"}>
                        {category.items.map(renderMenuItem)}
                    </DropdownMenuContent>
                </DropdownMenu>
            ))}
        </div>
    );
}

