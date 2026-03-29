import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { CommandItem } from './slash-commands';

interface CommandListProps {
    items: CommandItem[];
    command: (item: CommandItem) => void;
}

export const CommandList = forwardRef((props: CommandListProps, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
        const item = props.items[index];
        if (item) {
            props.command(item);
        }
    };

    useEffect(() => {
        setSelectedIndex(0);
    }, [props.items]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === 'ArrowUp') {
                setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
                return true;
            }

            if (event.key === 'ArrowDown') {
                setSelectedIndex((selectedIndex + 1) % props.items.length);
                return true;
            }

            if (event.key === 'Enter') {
                selectItem(selectedIndex);
                return true;
            }

            return false;
        },
    }));

    return (
        <div className="bg-background dark:bg-[#202124] rounded-lg shadow-xl border border-border dark:border-gray-800 overflow-hidden flex flex-col w-72">
            {props.items.length > 0 ? (
                props.items.map((item, index) => (
                    <button
                        className={`flex items-center gap-3 px-4 py-2 text-left w-full transition-colors ${index === selectedIndex ? 'bg-muted dark:bg-[#303134]' : 'hover:bg-muted dark:hover:bg-[#303134]/50'
                            }`}
                        key={index}
                        onClick={() => selectItem(index)}
                    >
                        <div className="flex bg-muted dark:bg-gray-800 p-2 rounded text-muted-foreground dark:text-gray-300">
                            {item.icon}
                        </div>
                        <div>
                            <div className="text-sm font-medium text-foreground dark:text-gray-100">{item.title}</div>
                            <div className="text-xs text-muted-foreground dark:text-gray-400">{item.description}</div>
                        </div>
                    </button>
                ))
            ) : (
                <div className="px-4 py-2 text-sm text-muted-foreground dark:text-gray-400">Aucun résultat trouvé</div>
            )}
        </div>
    );
});

CommandList.displayName = 'CommandList';
