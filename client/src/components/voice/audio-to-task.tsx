'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Zap, CheckSquare, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Task {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  done: boolean;
  source: 'voice' | 'manual';
}

function detectPriority(text: string): Task['priority'] {
  if (/urgent|asap|immediately|critique|impératif/i.test(text)) return 'high';
  if (/important|bientôt|soon|today|aujourd/i.test(text)) return 'medium';
  return 'low';
}

function parseTasksFromSpeech(text: string): string[] {
  const sentences = text.split(/[.!?,]\s+/);
  return sentences
    .filter(s => s.trim().length > 4)
    .map(s => {
      const cleaned = s.replace(/^(je dois|il faut|please|doit|need to|we need to|faut)\s+/i, '').trim();
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    })
    .filter(Boolean);
}

export function AudioToTask() {
  const [recording, setRecording] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const recognitionRef = useRef<any>(null);

  const startRecording = useCallback(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) { toast.error('Speech recognition not supported'); return; }

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'fr-FR';

    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      const parsed = parseTasksFromSpeech(text);
      const newTasks: Task[] = parsed.map(title => ({
        id: Date.now().toString() + Math.random(),
        title,
        priority: detectPriority(title),
        done: false,
        source: 'voice',
      }));
      setTasks(prev => [...prev, ...newTasks]);
      toast.success(`${newTasks.length} task(s) extracted from speech`);
      setRecording(false);
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => setRecording(false);

    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  }, []);

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  const addManual = () => {
    if (!newTitle.trim()) return;
    setTasks(prev => [...prev, { id: Date.now().toString(), title: newTitle, priority: detectPriority(newTitle), done: false, source: 'manual' }]);
    setNewTitle('');
  };

  const toggle = (id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const remove = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));

  const PRIORITY_COLORS = { high: 'bg-red-100 text-red-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-green-100 text-green-700' };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-5 w-5 text-primary" />
          Audio to Task Converter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Speak your tasks or instructions — they'll be automatically extracted and added to your task list.
        </p>

        <div className="flex gap-2">
          <Button
            variant={recording ? 'destructive' : 'default'}
            onClick={recording ? stopRecording : startRecording}
            className="gap-2"
          >
            {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {recording ? 'Stop' : 'Speak Tasks'}
          </Button>
          {recording && <Badge className="bg-red-500 animate-pulse self-center">Listening...</Badge>}
        </div>

        <div className="flex gap-2">
          <Input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Or type a task..."
            className="text-sm"
            onKeyDown={e => e.key === 'Enter' && addManual()}
          />
          <Button variant="outline" size="icon" onClick={addManual}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {tasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{tasks.filter(t => !t.done).length} pending / {tasks.length} total</p>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setTasks([])}>Clear all</Button>
            </div>
            {tasks.map(task => (
              <div key={task.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${task.done ? 'opacity-50' : ''}`}>
                <button
                  onClick={() => toggle(task.id)}
                  className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${task.done ? 'bg-green-500 border-green-500' : 'border-muted-foreground'}`}
                >
                  {task.done && <CheckSquare className="h-3 w-3 text-white" />}
                </button>
                <span className={`flex-1 text-sm ${task.done ? 'line-through' : ''}`}>{task.title}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                  {task.source === 'voice' && <Mic className="h-3 w-3 text-muted-foreground" />}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => remove(task.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
