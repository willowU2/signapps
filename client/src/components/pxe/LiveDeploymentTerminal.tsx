"use client";

/**
 * LiveDeploymentTerminal
 *
 * Renders a progress bar plus a green-on-black pseudo-terminal that
 * logs every deployment update received from the SSE stream.
 *
 * Stateless with respect to the SSE connection — the hook
 * [`usePxeDeploymentStream`] owns that.
 */

import { usePxeDeploymentStream } from "@/hooks/usePxeDeploymentStream";

type Props = {
  mac: string;
};

export function LiveDeploymentTerminal({ mac }: Props) {
  const { updates, error } = usePxeDeploymentStream(mac);
  const latest = updates[updates.length - 1];

  return (
    <div className="space-y-4" data-testid="pxe-live-terminal">
      {latest && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {latest.status} — {latest.step ?? "…"}
            </span>
            <span className="font-mono" data-testid="pxe-progress-percent">
              {latest.progress}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${latest.progress}%` }}
            />
          </div>
        </div>
      )}

      <div
        className="max-h-96 overflow-auto rounded bg-black p-4 font-mono text-xs text-green-400"
        data-testid="pxe-terminal-log"
      >
        {error && (
          <div className="text-yellow-400">Connexion interrompue : {error}</div>
        )}
        {updates.length === 0 && !error && (
          <div className="text-muted-foreground">
            En attente du premier événement…
          </div>
        )}
        {updates.map((u, i) => (
          <div key={`${u.progress}-${i}`}>
            <span className="text-muted-foreground">
              [{new Date().toISOString().slice(11, 19)}]
            </span>{" "}
            {u.status} → {u.progress}% {u.step ? `(${u.step})` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
