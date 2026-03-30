"use client";

/**
 * I4: User Provisioning Alert
 *
 * Shows a banner when workforce employees exist but have no identity account,
 * with a "Créer les comptes" CTA.
 */

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, UserPlus, RefreshCw, X, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { employeesApi } from "@/lib/api/workforce";
import { usersApi, type User, type CreateUserRequest } from "@/lib/api/identity";

interface ProvisioningMismatch {
  employee_id: string;
  name: string;
  email: string;
}

interface UserProvisioningAlertProps {
  /** Poll interval in ms. 0 = no polling (manual refresh only). Default: 0. */
  pollIntervalMs?: number;
  /** Optionally hide the close button */
  dismissible?: boolean;
}

export function UserProvisioningAlert({
  pollIntervalMs = 0,
  dismissible = true,
}: UserProvisioningAlertProps) {
  const [mismatches, setMismatches] = useState<ProvisioningMismatch[]>([])
  const [loading, setLoading] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const checkMismatches = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, usersRes] = await Promise.all([
        employeesApi.list({ page_size: 500 }),
        usersApi.list(0, 500),
      ])

      const employees: Array<{ id: string; name: string; email?: string }> =
        ((empRes as any).data?.employees ?? (empRes as any)?.employees ?? []).map((e: any) => ({
          id: e.id,
          name: [e.first_name, e.last_name].filter(Boolean).join(" ") || e.email || e.id,
          email: e.email || e.work_email,
        }))

      const users: User[] = (usersRes as any).data?.users ?? (usersRes as any)?.users ?? []
      const userEmails = new Set(users.map((u) => (u.email ?? "").toLowerCase()).filter(Boolean))

      const gaps = employees
        .filter((e) => e.email && !userEmails.has(e.email.toLowerCase()))
        .map((e) => ({ employee_id: e.id, name: e.name, email: e.email! }))

      setMismatches(gaps)
      setLastChecked(new Date())
      setDismissed(false)
    } catch (err) {
      // Silently ignore — component is informational
      console.warn("[UserProvisioningAlert] error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkMismatches()
    if (pollIntervalMs > 0) {
      const id = setInterval(checkMismatches, pollIntervalMs)
      return () => clearInterval(id)
    }
  }, [checkMismatches, pollIntervalMs])

  const handleProvision = async () => {
    if (mismatches.length === 0) return
    setProvisioning(true)
    let created = 0
    const failed: string[] = []

    for (const m of mismatches) {
      try {
        const req: CreateUserRequest = {
          username: m.email.split("@")[0].replace(/[^a-z0-9._-]/gi, "").toLowerCase(),
          email: m.email,
          display_name: m.name,
          password: crypto.randomUUID(), // temporary password — user must reset
          role: 1, // User
        }
        await usersApi.create(req)
        created++
      } catch {
        failed.push(m.email)
      }
    }

    setProvisioning(false)

    if (created > 0) {
      toast.success(`${created} compte(s) créé(s) avec succès.`)
    }
    if (failed.length > 0) {
      toast.error(`Échec pour : ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? " …" : ""}`)
    }

    // Refresh
    await checkMismatches()
  }

  // Nothing to show
  if (dismissed || (mismatches.length === 0 && !loading)) {
    if (mismatches.length === 0 && lastChecked) {
      return null // Clean — no banner
    }
    return null
  }

  if (loading && mismatches.length === 0) {
    return null // First load — don't flash an empty banner
  }

  return (
    <div className="relative flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 shadow-sm">
      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          Utilisateurs Workforce sans compte ({mismatches.length})
        </p>
        <ul className="mt-1 space-y-0.5 max-h-28 overflow-y-auto">
          {mismatches.map((m) => (
            <li key={m.employee_id} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <UserPlus className="h-3 w-3 shrink-0" />
              <span className="font-medium truncate">{m.name}</span>
              <span className="text-amber-600/70 dark:text-amber-500/70 truncate">&lt;{m.email}&gt;</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 gap-1"
          onClick={checkMismatches}
          disabled={loading}
          title="Actualiser"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          onClick={handleProvision}
          disabled={provisioning || loading}
        >
          {provisioning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle className="h-3 w-3" />
          )}
          Créer les comptes
        </Button>
        {dismissible && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-300"
            title="Masquer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
