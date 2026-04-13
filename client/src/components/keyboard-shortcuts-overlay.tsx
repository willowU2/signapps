"use client";

import { usePathname } from "next/navigation";
import {
  useKeyboardShortcuts,
  getShortcutsList,
} from "@/hooks/use-keyboard-shortcuts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md border border-border bg-muted text-xs font-mono font-medium text-muted-foreground shadow-sm">
      {children}
    </kbd>
  );
}

function ShortcutRow({
  keys,
  description,
}: {
  keys: string;
  description: string;
}) {
  const parts = keys.split(/(\+|→)/).filter(Boolean);
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-foreground">{description}</span>
      <div className="flex items-center gap-1 ml-4 shrink-0">
        {parts.map((part, i) => {
          const trimmed = part.trim();
          if (trimmed === "+" || trimmed === "→") {
            return (
              <span key={i} className="text-xs text-muted-foreground mx-0.5">
                {trimmed}
              </span>
            );
          }
          return <Kbd key={i}>{trimmed}</Kbd>;
        })}
      </div>
    </div>
  );
}

export function KeyboardShortcutsOverlay() {
  const pathname = usePathname();
  const { overlayOpen, setOverlayOpen, moduleName } = useKeyboardShortcuts();
  const shortcuts = getShortcutsList(pathname);

  const global = shortcuts.filter((s) => s.category === "global");
  const gNavigation = shortcuts.filter(
    (s) => s.category === "navigation" && s.keys.startsWith("G"),
  );
  const altNavigation = shortcuts.filter(
    (s) => s.category === "navigation" && s.keys.startsWith("Alt+"),
  );
  const module = shortcuts.filter((s) => s.category === "module");

  return (
    <Dialog open={overlayOpen} onOpenChange={setOverlayOpen}>
      <DialogContent className="sm:max-w-[480px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Raccourcis clavier
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Global */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Général
            </h3>
            <div className="space-y-0.5">
              {global.map((s) => (
                <ShortcutRow
                  key={s.keys}
                  keys={s.keys}
                  description={s.description}
                />
              ))}
            </div>
          </section>

          {/* Quick Navigation (Alt+number) */}
          {altNavigation.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Navigation rapide (Alt+chiffre)
              </h3>
              <div className="space-y-0.5">
                {altNavigation.map((s) => (
                  <ShortcutRow
                    key={s.keys}
                    keys={s.keys}
                    description={s.description}
                  />
                ))}
              </div>
            </section>
          )}

          {/* G-sequence Navigation */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Navigation (G puis...)
            </h3>
            <div className="space-y-0.5">
              {gNavigation.map((s) => (
                <ShortcutRow
                  key={s.keys}
                  keys={s.keys}
                  description={s.description}
                />
              ))}
            </div>
          </section>

          {/* Module */}
          {module.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {moduleName || "Module actuel"}
              </h3>
              <div className="space-y-0.5">
                {module.map((s) => (
                  <ShortcutRow
                    key={s.keys}
                    keys={s.keys}
                    description={s.description}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Appuyez <Kbd>Ctrl</Kbd>
          <span className="mx-0.5">+</span>
          <Kbd>/</Kbd> ou <Kbd>?</Kbd> pour ouvrir/fermer
        </p>
      </DialogContent>
    </Dialog>
  );
}
