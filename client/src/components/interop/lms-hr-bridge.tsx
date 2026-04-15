"use client";

// Idea 3: LMS course completion → update HR skills
// Idea 18: Admin user creation → trigger HR onboarding

import { useState } from "react";
import { GraduationCap, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

const workforceClient = () => getClient(ServiceName.WORKFORCE);

/** Idea 3 – Sync completed course as a skill in HR */
export function LmsCourseToHrSkill({
  userId,
  courseId,
  courseTitle,
}: {
  userId: string;
  courseId: string;
  courseTitle: string;
}) {
  const [synced, setSynced] = useState(false);
  const [loading, setLoading] = useState(false);

  const sync = async () => {
    setLoading(true);
    try {
      await workforceClient().post(`/employees/${userId}/skills`, {
        skill_name: courseTitle,
        source: "lms",
        source_id: courseId,
        acquired_at: new Date().toISOString(),
        verified: false,
      });
      setSynced(true);
      toast.success(`Compétence "${courseTitle}" ajoutée au profil RH`);
    } catch {
      // Queue for later sync
      const queue = JSON.parse(
        localStorage.getItem("interop-skill-queue") || "[]",
      );
      queue.push({
        userId,
        courseId,
        courseTitle,
        queued_at: new Date().toISOString(),
      });
      localStorage.setItem("interop-skill-queue", JSON.stringify(queue));
      setSynced(true);
      toast.info("Compétence mise en file de synchronisation RH");
    } finally {
      setLoading(false);
    }
  };

  if (synced)
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <GraduationCap className="w-3 h-3" />
        Compétence RH mise à jour
      </Badge>
    );

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={sync}
      disabled={loading}
      className="h-7 gap-1 text-xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <GraduationCap className="w-3.5 h-3.5" />
      )}
      Sync RH
    </Button>
  );
}

/** Idea 18 – Trigger HR onboarding when admin creates a user */
export async function triggerHrOnboarding(
  userId: string,
  userEmail: string,
  userName: string,
) {
  try {
    await workforceClient().post("/onboarding/trigger", {
      user_id: userId,
      email: userEmail,
      name: userName,
      trigger: "admin_user_creation",
      triggered_at: new Date().toISOString(),
    });
    toast.success(`Onboarding RH déclenché pour ${userName}`);
  } catch {
    const pending = JSON.parse(
      localStorage.getItem("interop-onboarding-queue") || "[]",
    );
    pending.push({
      userId,
      userEmail,
      userName,
      queued_at: new Date().toISOString(),
    });
    localStorage.setItem("interop-onboarding-queue", JSON.stringify(pending));
    toast.info("Onboarding RH mis en file d'attente");
  }
}

/** Idea 18 – Button to manually trigger onboarding */
export function HrOnboardingTrigger({
  userId,
  userEmail,
  userName,
}: {
  userId: string;
  userEmail: string;
  userName: string;
}) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const trigger = async () => {
    setLoading(true);
    await triggerHrOnboarding(userId, userEmail, userName);
    setDone(true);
    setLoading(false);
  };

  if (done)
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <UserCheck className="w-3 h-3" />
        Onboarding déclenché
      </Badge>
    );

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={trigger}
      disabled={loading}
      className="h-7 gap-1 text-xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <UserCheck className="w-3.5 h-3.5" />
      )}
      Onboarding RH
    </Button>
  );
}
