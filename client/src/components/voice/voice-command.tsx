'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VoiceCommand() {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const handleMicrophoneClick = () => {
    setIsListening(!isListening);
    if (!isListening) {
      setRecognizedText('');
      setFeedbackMessage('');
      // Simulate listening
      setTimeout(() => {
        setRecognizedText('Create new project');
        setIsListening(false);
      }, 2000);
    }
  };

  const handleExecuteCommand = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setFeedbackMessage('Command executed: Project created successfully');
      setIsExecuting(false);
    }, 1500);
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-card border border-input rounded-lg shadow-sm space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Voice Command</h2>

      {/* Microphone Button with Animation */}
      <div className="flex justify-center">
        <Button
          onClick={handleMicrophoneClick}
          size="lg"
          className={cn(
            'h-16 w-16 rounded-full transition-all duration-300',
            isListening
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-primary hover:bg-primary/90'
          )}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          <Mic className="h-6 w-6 text-white" />
        </Button>
      </div>

      {/* Listening Indicator */}
      {isListening && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-bounce" />
            <div className="h-2 w-2 rounded-full bg-red-500 animate-bounce delay-100" />
            <div className="h-2 w-2 rounded-full bg-red-500 animate-bounce delay-200" />
          </div>
          <span>Listening...</span>
        </div>
      )}

      {/* Recognized Command Display */}
      {recognizedText && (
        <div className="p-3 bg-muted rounded-md border border-input">
          <p className="text-sm text-muted-foreground mb-1">Recognized Command:</p>
          <p className="text-foreground font-medium">{recognizedText}</p>
        </div>
      )}

      {/* Execute Button */}
      {recognizedText && !isExecuting && (
        <Button
          onClick={handleExecuteCommand}
          className="w-full"
          disabled={isExecuting}
          aria-label="Execute command"
        >
          Execute
        </Button>
      )}

      {/* Executing Feedback */}
      {isExecuting && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Executing command...</span>
        </div>
      )}

      {/* Action Executed Feedback */}
      {feedbackMessage && (
        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md flex items-start gap-2">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800 dark:text-green-200">{feedbackMessage}</p>
        </div>
      )}
    </div>
  );
}
