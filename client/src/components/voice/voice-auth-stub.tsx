'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock, Mic, Square, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Phase = 'idle' | 'enrolling' | 'enrolled' | 'verifying' | 'success' | 'failed';

const ENROLL_PHRASE = 'SignApps voix sécurisée authentification';
const ENROLL_REPEATS = 3;

/**
 * VoiceAuth — voice-based enrollment and verification using the browser
 * Web Speech API for audio capture and a fingerprint based on repeated
 * phrase recognition.
 *
 * Enrollment: user says the passphrase 3 times; the recognized transcripts
 * are stored as the voiceprint.
 * Verification: user says the phrase once; it is compared against the
 * stored transcripts using a simple similarity score.
 */
export function VoiceAuthStub() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0); // 0..ENROLL_REPEATS during enrollment
  const [message, setMessage] = useState('');
  const [voiceprint, setVoiceprint] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
      : null;

  const isSupported = !!SpeechRecognitionCtor;

  /** Normalized edit-distance similarity [0..1] between two strings. */
  const similarity = (a: string, b: string): number => {
    const s1 = a.toLowerCase().trim();
    const s2 = b.toLowerCase().trim();
    if (s1 === s2) return 1;
    const m = s1.length, n = s2.length;
    if (m === 0 || n === 0) return 0;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          s1[i - 1] === s2[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return 1 - dp[m][n] / Math.max(m, n);
  };

  const recognizeOnce = (lang = 'fr-FR'): Promise<string> =>
    new Promise((resolve, reject) => {
      if (!SpeechRecognitionCtor) return reject(new Error('Not supported'));
      const rec = new SpeechRecognitionCtor();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e: any) => {
        resolve(e.results[0][0].transcript);
      };
      rec.onerror = (e: any) => reject(new Error(e.error));
      rec.onend = () => reject(new Error('No speech detected'));
      recognitionRef.current = rec;
      rec.start();
    });

  const handleEnroll = async () => {
    setPhase('enrolling');
    setProgress(0);
    setVoiceprint([]);
    const samples: string[] = [];

    for (let i = 0; i < ENROLL_REPEATS; i++) {
      setMessage(`Dites la phrase (${i + 1}/${ENROLL_REPEATS}) : « ${ENROLL_PHRASE} »`);
      try {
        const text = await recognizeOnce();
        samples.push(text);
        setProgress(i + 1);
      } catch (err) {
        setMessage(`Erreur lors de l'enregistrement : ${(err as Error).message}`);
        setPhase('idle');
        return;
      }
    }

    setVoiceprint(samples);
    setPhase('enrolled');
    setMessage('Enrôlement réussi ! Vous pouvez maintenant vous authentifier.');
  };

  const handleVerify = async () => {
    setPhase('verifying');
    setMessage(`Dites : « ${ENROLL_PHRASE} »`);
    try {
      const spoken = await recognizeOnce();
      const avgSimilarity =
        voiceprint.reduce((sum, vp) => sum + similarity(spoken, vp), 0) /
        voiceprint.length;

      // Threshold: 60% similarity (adjustable)
      if (avgSimilarity >= 0.6) {
        setPhase('success');
        setMessage(`Authentification réussie (score : ${Math.round(avgSimilarity * 100)}%)`);
      } else {
        setPhase('failed');
        setMessage(`Authentification échouée (score : ${Math.round(avgSimilarity * 100)}%). Réessayez.`);
      }
    } catch (err) {
      setPhase('failed');
      setMessage(`Erreur : ${(err as Error).message}`);
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setProgress(0);
    setMessage('');
    setVoiceprint([]);
    recognitionRef.current?.stop();
  };

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-card border border-input rounded-lg shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Authentification Vocale</h2>
      </div>

      {!isSupported ? (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
          La reconnaissance vocale n&apos;est pas disponible dans ce navigateur.
          Utilisez Chrome ou Edge pour activer cette fonctionnalité.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {phase === 'idle' &&
              "Enrôlez votre voix en répétant la phrase d'authentification 3 fois, puis vérifiez votre identité."}
            {phase === 'enrolling' && (
              <span>
                Enrôlement en cours ({progress}/{ENROLL_REPEATS})…
              </span>
            )}
            {message && phase !== 'idle' && message}
          </p>

          {/* Progress bar during enrollment */}
          {phase === 'enrolling' && (
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(progress / ENROLL_REPEATS) * 100}%` }}
              />
            </div>
          )}

          {/* Status icons */}
          {phase === 'success' && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Identité vérifiée</span>
            </div>
          )}
          {phase === 'failed' && (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Vérification échouée</span>
            </div>
          )}

          <div className="flex gap-2">
            {(phase === 'idle' || phase === 'failed') && (
              <Button onClick={handleEnroll} className="flex-1">
                <Mic className="h-4 w-4 mr-2" />
                {voiceprint.length > 0 ? 'Ré-enrôler' : 'Enrôler ma voix'}
              </Button>
            )}

            {phase === 'enrolled' && (
              <Button onClick={handleVerify} className="flex-1">
                <Mic className="h-4 w-4 mr-2" />
                Vérifier mon identité
              </Button>
            )}

            {phase === 'verifying' && (
              <Button disabled className="flex-1">
                <Square className="h-4 w-4 mr-2 animate-pulse" />
                Écoute en cours…
              </Button>
            )}

            {phase === 'success' && (
              <Button onClick={handleVerify} variant="outline" className="flex-1">
                <Mic className="h-4 w-4 mr-2" />
                Vérifier à nouveau
              </Button>
            )}

            {phase !== 'idle' && (
              <Button onClick={handleReset} variant="ghost" size="sm">
                Réinitialiser
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
