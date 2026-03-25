'use client';

import { useState, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { sttApi } from '@/lib/api/media';
import { toast } from 'sonner';

interface VoiceDictationProps {
    editor: Editor | null;
}

type DictationState = 'idle' | 'recording' | 'transcribing';

const LANGUAGES = [
    { code: 'fr', label: 'Francais' },
    { code: 'en', label: 'English' },
];

export function VoiceDictation({ editor }: VoiceDictationProps) {
    const [state, setState] = useState<DictationState>('idle');
    const [language, setLanguage] = useState('fr');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    const startRecording = useCallback(async () => {
        if (!editor) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000,
                },
            });
            streamRef.current = stream;

            // Prefer webm/opus for better compression, fallback to webm
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/mp4';

            const recorder = new MediaRecorder(stream, { mimeType });
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                // Stop all tracks
                stream.getTracks().forEach((track) => track.stop());
                streamRef.current = null;

                if (chunksRef.current.length === 0) {
                    setState('idle');
                    return;
                }

                setState('transcribing');

                const audioBlob = new Blob(chunksRef.current, { type: mimeType });
                const extension = mimeType.includes('webm') ? 'webm' : 'mp4';
                const audioFile = new File([audioBlob], `dictation.${extension}`, { type: mimeType });

                try {
                    const response = await sttApi.transcribe(audioFile, {
                        language,
                        task: 'transcribe',
                    });

                    const text = response.data?.text?.trim();
                    if (text) {
                        editor.chain().focus().insertContent(text + ' ').run();
                        toast.success('Texte insere', {
                            description: text.length > 80 ? text.substring(0, 80) + '...' : text,
                        });
                    } else {
                        toast.warning('Aucun texte detecte. Reessayez en parlant plus clairement.');
                    }
                } catch (err: any) {
                    console.error('[VoiceDictation] Transcription error:', err);
                    toast.error('Erreur de transcription. Verifiez que le service media est demarre.');
                } finally {
                    setState('idle');
                }
            };

            recorder.start(250); // Collect data every 250ms
            mediaRecorderRef.current = recorder;
            setState('recording');
        } catch (err: any) {
            console.error('[VoiceDictation] Microphone access error:', err);
            if (err.name === 'NotAllowedError') {
                toast.error('Acces au microphone refuse. Autorisez l\'acces dans les parametres du navigateur.');
            } else {
                toast.error('Impossible d\'acceder au microphone.');
            }
        }
    }, [editor, language]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }
    }, []);

    const handleToggle = useCallback(() => {
        if (state === 'recording') {
            stopRecording();
        } else if (state === 'idle') {
            startRecording();
        }
        // If transcribing, do nothing (wait for it to finish)
    }, [state, startRecording, stopRecording]);

    return (
        <div className="flex items-center gap-0.5">
            {/* Main mic button */}
            <button
                onClick={handleToggle}
                disabled={state === 'transcribing'}
                title={
                    state === 'recording'
                        ? 'Arreter la dictee'
                        : state === 'transcribing'
                        ? 'Transcription en cours...'
                        : 'Dictee vocale (whisper-rs)'
                }
                className={`
                    relative p-1.5 min-w-[32px] rounded flex items-center justify-center transition-all
                    ${state === 'recording'
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
                        : state === 'transcribing'
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'text-[#444746] dark:text-[#e3e3e3] hover:bg-[#f1f3f4] dark:hover:bg-[#303134]'
                    }
                    ${state === 'transcribing' ? 'cursor-wait' : ''}
                `}
                onMouseDown={(e) => e.preventDefault()}
            >
                {state === 'transcribing' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : state === 'recording' ? (
                    <>
                        <MicOff className="w-4 h-4" />
                        {/* Pulsing red dot indicator */}
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
                    </>
                ) : (
                    <Mic className="w-4 h-4" />
                )}
            </button>

            {/* Language picker */}
            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
                <PopoverTrigger asChild>
                    <button
                        className="text-[10px] font-medium uppercase text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded hover:bg-[#f1f3f4] dark:hover:bg-[#303134]"
                        title="Changer la langue de dictee"
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        {language.toUpperCase()}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-2" align="start">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Langue de dictee</p>
                    <Select value={language} onValueChange={(v) => { setLanguage(v); setSettingsOpen(false); }}>
                        <SelectTrigger className="h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {LANGUAGES.map((lang) => (
                                <SelectItem key={lang.code} value={lang.code}>
                                    {lang.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </PopoverContent>
            </Popover>
        </div>
    );
}
