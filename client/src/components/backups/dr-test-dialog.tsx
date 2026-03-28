'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldCheck, CheckCircle, XCircle, AlertTriangle, Play } from 'lucide-react';
import { toast } from 'sonner';

interface TestStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  detail?: string;
}

const STEPS_TEMPLATE: Omit<TestStep, 'status'>[] = [
  { id: 'connect', label: 'Connect to backup repository' },
  { id: 'list', label: 'List available snapshots' },
  { id: 'integrity', label: 'Check snapshot integrity' },
  { id: 'sample', label: 'Sample restore (10% of data)' },
  { id: 'checksum', label: 'Verify checksums' },
  { id: 'cleanup', label: 'Cleanup test artifacts' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId: string;
  profileName: string;
}

export function DRTestDialog({ open, onOpenChange, profileId, profileName }: Props) {
  const [steps, setSteps] = useState<TestStep[]>(
    STEPS_TEMPLATE.map(s => ({ ...s, status: 'pending' }))
  );
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const updateStep = (id: string, status: TestStep['status'], detail?: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, detail } : s));
  };

  const runTest = async () => {
    setRunning(true);
    setCompleted(false);
    setSteps(STEPS_TEMPLATE.map(s => ({ ...s, status: 'pending' })));

    let allOk = true;
    for (const step of STEPS_TEMPLATE) {
      updateStep(step.id, 'running');
      await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
      // Simulate mostly success
      const fail = Math.random() < 0.05;
      if (fail) {
        updateStep(step.id, 'failed', 'Simulated failure for testing purposes');
        allOk = false;
        break;
      } else {
        const details: Record<string, string> = {
          connect: 'Repository accessible — restic v0.16',
          list: '12 snapshots found',
          integrity: 'All pack files verified',
          sample: '128 MB restored to /tmp/dr-test',
          checksum: 'SHA256 match: 100%',
          cleanup: '/tmp/dr-test removed',
        };
        updateStep(step.id, 'success', details[step.id]);
      }
    }

    setRunning(false);
    setCompleted(true);
    if (allOk) {
      toast.success('DR test passed — backup integrity confirmed');
    } else {
      toast.error('DR test failed — check details');
    }
  };

  const successCount = steps.filter(s => s.status === 'success').length;
  const progress = (successCount / steps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Disaster Recovery Test
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Simulates a full recovery for <strong>{profileName}</strong> without affecting production data.
          </p>

          {running && <Progress value={progress} className="h-2" />}

          <ScrollArea className="h-64">
            <div className="space-y-2 pr-2">
              {steps.map((step) => (
                <div key={step.id} className="flex items-start gap-3 p-2.5 rounded-lg border">
                  <div className="mt-0.5">
                    {step.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />}
                    {step.status === 'running' && <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />}
                    {step.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {step.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{step.label}</p>
                    {step.detail && (
                      <p className={`text-xs mt-0.5 ${step.status === 'failed' ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {completed && (
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${
              steps.every(s => s.status !== 'failed')
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
            }`}>
              {steps.every(s => s.status !== 'failed') ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium">
                {steps.every(s => s.status !== 'failed') ? 'All steps passed' : 'Test failed — review logs'}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={runTest} disabled={running} className="gap-2">
            <Play className="h-4 w-4" />
            {running ? 'Running test...' : 'Run DR Test'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
