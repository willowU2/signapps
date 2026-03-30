import { useState, useRef } from "react";
import { FileUpload, getReadableFileSize } from "@/components/application/file-upload/file-upload-base";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface UploadedFile {
    id: string;
    name: string;
    type: string;
    size: number;
    progress: number;
    failed?: boolean;
}

interface FileUploadProgressBarProps {
    bucket?: string;
    prefix?: string;
    onUploadComplete?: () => void;
    acceptedTypes?: string;
    maxFileSize?: number;
    isDisabled?: boolean;
    customUploadStrategy?: (
        id: string,
        file: File,
        onProgress: (progress: number) => void,
        onSuccess: () => void,
        onError: (error: string) => void,
        abortController?: AbortController
    ) => void | Promise<void>;
}

export const FileUploadProgressBar = ({
    bucket,
    prefix,
    onUploadComplete,
    acceptedTypes = '*',
    maxFileSize = 10 * 1024 * 1024,
    isDisabled,
    customUploadStrategy
}: FileUploadProgressBarProps) => {
    const router = useRouter();
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    
    // Store logic-specific references
    const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
    const originalFilesRef = useRef<Map<string, File>>(new Map());

    const uploadFile = (id: string, file: File, onProgress: (progress: number) => void, onSuccess: () => void, onError: (error: string) => void) => {
        if (file.size > maxFileSize) {
            onError(`File size exceeds ${Math.round(maxFileSize / 1024 / 1024)} MB limit`);
            toast.error(`File too large: ${file.name}`);
            return;
        }

        const abortController = new AbortController();
        abortControllersRef.current.set(id, abortController);

        if (customUploadStrategy) {
            Promise.resolve(customUploadStrategy(id, file, onProgress, onSuccess, onError, abortController)).catch((err) => {
                onError(err instanceof Error ? err.message : 'Unknown error');
            });
            return;
        }

        try {

            const formData = new FormData();
            formData.append('file', file);
            if (prefix) {
                formData.append('path', prefix);
            }

            const xhr = new XMLHttpRequest();
            let completed = false;

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    onProgress(percentComplete);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    completed = true;
                    onSuccess();
                    toast.success(`Fichier uploade: ${file.name}`, {
                        action: {
                            label: 'Ouvrir',
                            onClick: () => router.push('/drive'),
                        },
                    });
                } else {
                    onError(`Échec du téléversement (${xhr.status})`);
                    toast.error(`Failed to upload: ${file.name}`);
                }
            });

            xhr.addEventListener('error', () => {
                onError('Erreur réseau');
                toast.error(`Erreur réseau uploading: ${file.name}`);
            });

            xhr.addEventListener('abort', () => {
                if (!completed) {
                    onError('Upload cancelled');
                }
            });

            xhr.open('POST', `${process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:3004/api/v1'}/files/${bucket}`);

            const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            xhr.send(formData);
        } catch (error) {
            onError(error instanceof Error ? error.message : 'Unknown error');
            toast.error(`Error uploading: ${file.name}`);
        }
    };

    const handleDropFiles = (files: FileList) => {
        const newFiles = Array.from(files);
        const newFilesWithIds = newFiles.map((file) => ({
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            size: file.size,
            type: file.type,
            progress: 0,
            fileObject: file,
            failed: false,
        }));
 
        // Store the original files for retries
        newFilesWithIds.forEach(({ id, fileObject }) => {
            originalFilesRef.current.set(id, fileObject);
        });

        setUploadedFiles(prev => [
            ...newFilesWithIds.map(({ fileObject: _, ...f }) => f as UploadedFile), 
            ...prev
        ]);
 
        newFilesWithIds.forEach(({ id, fileObject }) => {
            uploadFile(
                id,
                fileObject,
                (progress) => {
                    setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress } : f)));
                },
                () => {
                    setUploadedFiles((prev) => {
                        const next = prev.map((f) => (f.id === id ? { ...f, progress: 100, failed: false } : f));
                        if (onUploadComplete && next.every(u => u.progress === 100 || u.failed)) {
                            onUploadComplete();
                        }
                        return next;
                    });
                },
                (error) => {
                    setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress: 0, failed: true } : f)));
                }
            );
        });
    };
 
    const handleDeleteFile = (id: string) => {
        const controller = abortControllersRef.current.get(id);
        if (controller) {
            controller.abort();
            abortControllersRef.current.delete(id);
        }
        originalFilesRef.current.delete(id);
        setUploadedFiles((prev) => prev.filter((file) => file.id !== id));
    };
 
    const handleRetryFile = (id: string) => {
        const fileObject = originalFilesRef.current.get(id);
        if (!fileObject) return;

        // Reset state
        setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress: 0, failed: false } : f)));
 
        uploadFile(
            id,
            fileObject,
            (progress) => {
                setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress } : f)));
            },
            () => {
                setUploadedFiles((prev) => {
                    const next = prev.map((f) => (f.id === id ? { ...f, progress: 100, failed: false } : f));
                    if (onUploadComplete && next.every(u => u.progress === 100 || u.failed)) {
                        onUploadComplete();
                    }
                    return next;
                });
            },
            (error) => {
                setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress: 0, failed: true } : f)));
            }
        );
    };
 
    return (
        <FileUpload.Root>
            <FileUpload.DropZone isDisabled={isDisabled} onDropFiles={handleDropFiles} />
 
            <FileUpload.List>
                {uploadedFiles.map((file) => (
                    <FileUpload.ListItemProgressBar
                        key={file.id}
                        {...file}
                        size={file.size}
                        onDelete={() => handleDeleteFile(file.id)}
                        onRetry={() => handleRetryFile(file.id)}
                    />
                ))}
            </FileUpload.List>
        </FileUpload.Root>
    );
};
