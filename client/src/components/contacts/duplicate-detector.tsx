"use client";

interface Contact {
  id: string;
  name: string;
  email: string;
}

interface DuplicateDetectorProps {
  contact: Contact;
  possibleDuplicates: Contact[];
  onMerge?: (sourceId: string, targetId: string) => void;
  onDismiss?: () => void;
}

export function DuplicateDetector({ contact, possibleDuplicates, onMerge, onDismiss }: DuplicateDetectorProps) {
  if (possibleDuplicates.length === 0) return null;

  return (
    <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-yellow-500 text-sm">&#9888;</span>
        <span className="text-sm font-medium">{possibleDuplicates.length} doublon{possibleDuplicates.length > 1 ? "s" : ""} possible{possibleDuplicates.length > 1 ? "s" : ""}</span>
        {onDismiss && <button onClick={onDismiss} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Ignorer</button>}
      </div>
      <div className="space-y-1">
        {possibleDuplicates.map(dup => (
          <div key={dup.id} className="flex items-center justify-between text-sm">
            <div>
              <span className="font-medium">{dup.name}</span>
              <span className="text-muted-foreground ml-2">{dup.email}</span>
            </div>
            {onMerge && (
              <button onClick={() => onMerge(contact.id, dup.id)} className="text-xs px-2 py-0.5 rounded border hover:bg-accent transition-colors">
                Fusionner
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
