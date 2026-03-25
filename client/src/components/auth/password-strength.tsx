"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";

interface Requirement {
  label: string;
  met: boolean;
}

interface PasswordStrengthProps {
  password: string;
  showRequirements?: boolean;
}

function computeStrength(password: string): {
  score: number;
  label: string;
  color: string;
  width: string;
  requirements: Requirement[];
} {
  const reqs: Requirement[] = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter (a-z)", met: /[a-z]/.test(password) },
    { label: "Number (0-9)", met: /[0-9]/.test(password) },
    { label: "Special character (!@#…)", met: /[^a-zA-Z0-9]/.test(password) },
  ];

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const levels: Array<{ label: string; color: string; width: string }> = [
    { label: "Too weak", color: "bg-red-500", width: "w-1/5" },
    { label: "Weak", color: "bg-orange-500", width: "w-2/5" },
    { label: "Fair", color: "bg-yellow-500", width: "w-3/5" },
    { label: "Good", color: "bg-blue-500", width: "w-4/5" },
    { label: "Strong", color: "bg-green-500", width: "w-full" },
  ];

  const level = levels[Math.min(score, 4)];

  return { score, label: level.label, color: level.color, width: level.width, requirements: reqs };
}

export function PasswordStrength({ password, showRequirements = true }: PasswordStrengthProps) {
  const { score, label, color, width, requirements } = useMemo(
    () => computeStrength(password),
    [password]
  );

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="relative h-2 flex-1 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${color} ${width}`}
          />
        </div>
        <span
          className={`min-w-[72px] text-right text-xs font-medium ${
            score <= 1 ? "text-red-600"
            : score === 2 ? "text-orange-600"
            : score === 3 ? "text-yellow-600"
            : score === 4 ? "text-blue-600"
            : "text-green-600"
          }`}
        >
          {label}
        </span>
      </div>

      {/* Requirements list */}
      {showRequirements && (
        <ul className="space-y-1">
          {requirements.map((req) => (
            <li key={req.label} className="flex items-center gap-1.5">
              {req.met ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              )}
              <span
                className={`text-xs ${req.met ? "text-gray-700" : "text-gray-400"}`}
              >
                {req.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
