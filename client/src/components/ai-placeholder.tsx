export function AiPlaceholder({ text = "Commencez a ecrire ou demandez a l'IA de generer du contenu..." }: { text?: string }) {
  return (
    <p className="text-sm text-muted-foreground/40 italic select-none pointer-events-none">
      {text}
    </p>
  );
}
