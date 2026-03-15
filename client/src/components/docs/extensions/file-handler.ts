// Custom FileHandler extension for Tiptap v3
// Handles file drops and pastes (images, documents, etc.)

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface FileHandlerOptions {
    /**
     * Allowed MIME types for file handling
     * @default ['image/*', 'application/pdf', 'text/*']
     */
    allowedMimeTypes: string[];
    /**
     * Maximum file size in bytes
     * @default 10 * 1024 * 1024 (10MB)
     */
    maxFileSize: number;
    /**
     * Handler for dropped files
     */
    onDrop: (editor: any, files: File[], pos?: number) => void;
    /**
     * Handler for pasted files
     */
    onPaste: (editor: any, files: File[]) => void;
    /**
     * Error handler
     */
    onError?: (error: FileHandlerError) => void;
}

export interface FileHandlerError {
    type: 'invalid-mime-type' | 'file-too-large' | 'upload-failed';
    file: File;
    message: string;
}

export const fileHandlerPluginKey = new PluginKey('fileHandler');

const matchesMimeType = (fileType: string, allowedTypes: string[]): boolean => {
    return allowedTypes.some((allowed) => {
        if (allowed.endsWith('/*')) {
            const category = allowed.slice(0, -2);
            return fileType.startsWith(category + '/');
        }
        return fileType === allowed;
    });
};

export const FileHandler = Extension.create<FileHandlerOptions>({
    name: 'fileHandler',

    addOptions() {
        return {
            allowedMimeTypes: [
                'image/*',
                'application/pdf',
                'text/plain',
                'text/markdown',
                'text/html',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            ],
            maxFileSize: 10 * 1024 * 1024, // 10MB
            onDrop: () => {},
            onPaste: () => {},
            onError: undefined,
        };
    },

    addProseMirrorPlugins() {
        const { allowedMimeTypes, maxFileSize, onDrop, onPaste, onError } = this.options;
        const editor = this.editor;

        const validateFile = (file: File): FileHandlerError | null => {
            // Check MIME type
            if (!matchesMimeType(file.type, allowedMimeTypes)) {
                return {
                    type: 'invalid-mime-type',
                    file,
                    message: `File type "${file.type}" is not allowed`,
                };
            }

            // Check file size
            if (file.size > maxFileSize) {
                return {
                    type: 'file-too-large',
                    file,
                    message: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${(maxFileSize / 1024 / 1024).toFixed(2)}MB`,
                };
            }

            return null;
        };

        const handleFiles = (
            files: File[],
            handler: (editor: any, files: File[], pos?: number) => void,
            pos?: number
        ): boolean => {
            const validFiles: File[] = [];

            for (const file of files) {
                const error = validateFile(file);
                if (error) {
                    onError?.(error);
                } else {
                    validFiles.push(file);
                }
            }

            if (validFiles.length > 0) {
                if (pos !== undefined) {
                    handler(editor, validFiles, pos);
                } else {
                    handler(editor, validFiles);
                }
                return true;
            }

            return false;
        };

        return [
            new Plugin({
                key: fileHandlerPluginKey,
                props: {
                    handleDrop(view, event, slice, moved) {
                        // Ignore if moved (internal drag)
                        if (moved) return false;

                        const dataTransfer = event.dataTransfer;
                        if (!dataTransfer) return false;

                        const files = Array.from(dataTransfer.files);
                        if (files.length === 0) return false;

                        event.preventDefault();

                        // Get drop position
                        const pos = view.posAtCoords({
                            left: event.clientX,
                            top: event.clientY,
                        });

                        if (pos) {
                            return handleFiles(files, onDrop, pos.pos);
                        }

                        return false;
                    },

                    handlePaste(view, event, slice) {
                        const clipboardData = event.clipboardData;
                        if (!clipboardData) return false;

                        const files = Array.from(clipboardData.files);
                        if (files.length === 0) return false;

                        // Check if there's also text content - if so, let default paste handle it
                        const hasText = clipboardData.types.includes('text/plain')
                            || clipboardData.types.includes('text/html');

                        // Only handle pure file pastes, or if it's an image paste
                        const hasImages = files.some(f => f.type.startsWith('image/'));
                        if (hasText && !hasImages) return false;

                        event.preventDefault();
                        return handleFiles(files, onPaste);
                    },
                },
            }),
        ];
    },
});

// Utility: Convert file to base64 data URL
export const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
};

// Utility: Insert image from file
export const insertImageFromFile = async (
    editor: any,
    file: File,
    pos?: number
): Promise<void> => {
    const dataUrl = await fileToDataURL(file);

    const imageAttrs = {
        src: dataUrl,
        alt: file.name,
        title: file.name,
    };

    if (pos !== undefined) {
        editor.chain().focus().insertContentAt(pos, {
            type: 'image',
            attrs: imageAttrs,
        }).run();
    } else {
        editor.chain().focus().setImage(imageAttrs).run();
    }
};

export default FileHandler;
