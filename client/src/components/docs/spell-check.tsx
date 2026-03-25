'use client';

import { useState, useCallback, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Languages } from 'lucide-react';

interface SpellCheckProps {
    editor: Editor | null;
}

const SPELL_LANGUAGES = [
    { code: 'fr', label: 'Francais', htmlLang: 'fr-FR' },
    { code: 'en', label: 'English', htmlLang: 'en-US' },
    { code: 'es', label: 'Espanol', htmlLang: 'es-ES' },
    { code: 'de', label: 'Deutsch', htmlLang: 'de-DE' },
];

/**
 * SpellCheck component: controls the browser's native spellcheck for the TipTap editor.
 *
 * Sets the `lang` attribute and `spellcheck="true"` on the editor's contentEditable element
 * to leverage the browser's built-in dictionary-based spell checking.
 */
export function SpellCheck({ editor }: SpellCheckProps) {
    const [language, setLanguage] = useState('fr');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [spellcheckEnabled, setSpellcheckEnabled] = useState(true);

    // Apply spellcheck and lang attribute to the editor's DOM element
    const applyLanguage = useCallback(
        (langCode: string) => {
            if (!editor || editor.isDestroyed) return;
            try {
                const editorEl = editor.view.dom as HTMLElement;
                if (!editorEl) return;

                const langConfig = SPELL_LANGUAGES.find((l) => l.code === langCode);
                const htmlLang = langConfig?.htmlLang || 'fr-FR';

                editorEl.setAttribute('lang', htmlLang);
                editorEl.setAttribute('spellcheck', spellcheckEnabled ? 'true' : 'false');
            } catch (e) {
                // Return safely if the Tiptap view cannot be accessed
                return;
            }
        },
        [editor, spellcheckEnabled]
    );

    // Apply on mount and when language changes
    useEffect(() => {
        applyLanguage(language);
    }, [language, applyLanguage]);

    // Apply when spellcheck toggle changes
    useEffect(() => {
        if (!editor || editor.isDestroyed) return;
        try {
            const editorEl = editor.view.dom as HTMLElement;
            if (editorEl) {
                editorEl.setAttribute('spellcheck', spellcheckEnabled ? 'true' : 'false');
            }
        } catch (e) {
            // Return safely if the Tiptap view cannot be accessed
            return;
        }
    }, [editor, spellcheckEnabled]);

    // Also apply language when editor first becomes available
    useEffect(() => {
        if (editor) {
            // Small delay to ensure DOM is ready
            const timer = setTimeout(() => applyLanguage(language), 100);
            return () => clearTimeout(timer);
        }
    }, [editor, language, applyLanguage]);

    const handleLanguageChange = (langCode: string) => {
        setLanguage(langCode);
        setSettingsOpen(false);
    };

    const toggleSpellcheck = () => {
        setSpellcheckEnabled((prev) => !prev);
    };

    const currentLang = SPELL_LANGUAGES.find((l) => l.code === language);

    return (
        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <PopoverTrigger asChild>
                <button
                    className={`
                        p-1.5 min-w-[32px] rounded flex items-center justify-center gap-1 transition-all
                        ${spellcheckEnabled
                            ? 'text-[#444746] dark:text-[#e3e3e3] hover:bg-[#f1f3f4] dark:hover:bg-[#303134]'
                            : 'text-muted-foreground/50 hover:bg-[#f1f3f4] dark:hover:bg-[#303134]'
                        }
                    `}
                    title={`Langue: ${currentLang?.label || 'Francais'} - Cliquez pour changer`}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <Languages className="w-4 h-4" />
                    <span className="text-[10px] font-medium uppercase">{language}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Langue du document</p>
                        <p className="text-xs text-muted-foreground">
                            Le correcteur orthographique du navigateur utilisera cette langue.
                        </p>
                    </div>

                    <Select value={language} onValueChange={handleLanguageChange}>
                        <SelectTrigger className="h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SPELL_LANGUAGES.map((lang) => (
                                <SelectItem key={lang.code} value={lang.code}>
                                    <span className="flex items-center gap-2">
                                        <span className="text-xs font-mono uppercase w-5">{lang.code}</span>
                                        {lang.label}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-muted-foreground">Correcteur orthographique</span>
                        <button
                            onClick={toggleSpellcheck}
                            className={`
                                relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full
                                border-2 border-transparent transition-colors
                                ${spellcheckEnabled ? 'bg-primary' : 'bg-muted'}
                            `}
                        >
                            <span
                                className={`
                                    pointer-events-none inline-block h-4 w-4 rounded-full
                                    bg-background shadow-lg ring-0 transition-transform
                                    ${spellcheckEnabled ? 'translate-x-4' : 'translate-x-0'}
                                `}
                            />
                        </button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
