"use client";

function getStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: "Faible", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Moyen", color: "bg-yellow-500" };
  if (score <= 3) return { score, label: "Bon", color: "bg-blue-500" };
  return { score, label: "Fort", color: "bg-green-500" };
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { score, label, color } = getStrength(password);
  return (
    <div className="space-y-1 mt-1">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${Math.min((score / 5) * 100, 100)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
