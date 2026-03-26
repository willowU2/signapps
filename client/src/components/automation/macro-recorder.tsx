'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Circle, Square, Play, Trash2 } from 'lucide-react';

interface MacroAction {
  label: string;
}

interface Macro {
  id: string;
  name: string;
  actions: MacroAction[];
}

export function MacroRecorder() {
  const [macros, setMacros] = useState<Macro[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [macroName, setMacroName] = useState('');
  const [currentActions, setCurrentActions] = useState<MacroAction[]>([]);

  const startRecording = () => {
    if (macroName.trim()) {
      setIsRecording(true);
      setCurrentActions([]);
    }
  };

  const stopRecording = () => {
    if (currentActions.length > 0) {
      setMacros([
        ...macros,
        { id: `m${Date.now()}`, name: macroName, actions: currentActions },
      ]);
      setMacroName('');
      setCurrentActions([]);
      setIsRecording(false);
    }
  };

  const recordAction = (label: string) => {
    if (isRecording) setCurrentActions([...currentActions, { label }]);
  };

  const playMacro = (macro: Macro) => {
    macro.actions.forEach((_a, _i) => {
      // Macro playback is a UI-only simulation; no-op without a real executor
    });
  };

  const deleteMacro = (id: string) => {
    setMacros(macros.filter((m) => m.id !== id));
  };

  return (
    <div className="space-y-4 p-4">
      <div className="rounded border p-4">
        <h2 className="mb-3 font-semibold">Record Macro</h2>
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="Name"
            value={macroName}
            onChange={(e) => setMacroName(e.target.value)}
            disabled={isRecording}
          />
          <Button onClick={isRecording ? stopRecording : startRecording} size="sm">
            {isRecording ? (
              <><Square className="w-4 h-4 mr-1" />Stop</>
            ) : (
              <><Circle className="w-4 h-4 mr-1 text-red-500 fill-red-500" />Start</>
            )}
          </Button>
        </div>
        {isRecording && (
          <div className="flex gap-1 mb-2">
            {['Click', 'Type', 'Scroll', 'Wait'].map((a) => (
              <Button
                key={a}
                size="xs"
                variant="outline"
                onClick={() => recordAction(a)}
              >
                {a}
              </Button>
            ))}
          </div>
        )}
        {isRecording && (
          <p className="text-xs text-gray-600">{currentActions.length} action(s)</p>
        )}
      </div>

      <div className="rounded border p-4">
        <h2 className="mb-3 font-semibold">Saved ({macros.length})</h2>
        {macros.length === 0 ? (
          <p className="text-xs text-gray-500">Empty</p>
        ) : (
          <div className="space-y-2">
            {macros.map((m) => (
              <div key={m.id} className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-gray-500">{m.actions.length} action(s)</p>
                </div>
                <div className="flex gap-1">
                  <Button size="xs" variant="outline" onClick={() => playMacro(m)}>
                    <Play className="w-3 h-3" />
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => deleteMacro(m.id)}>
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
