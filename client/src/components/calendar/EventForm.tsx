"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useEvents } from "@/hooks/use-events";
import { Event, CreateEvent, UpdateEvent } from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { ResourceSelector } from "./ResourceSelector";
import { AttendeeList } from "./AttendeeList";
import { RecurrenceEditor } from "./RecurrenceEditor";
import {
  Users,
  Package,
  CalendarDays,
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  UserX,
  Info,
  Loader2,
} from "lucide-react";
import { EntityLinks } from "@/components/crosslinks/EntityLinks";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { leaveApi, presenceApi } from "@/lib/api/calendar";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type EventType = "event" | "task" | "leave" | "shift" | "booking";

type LeaveType = "CP" | "RTT" | "Maladie" | "Sans solde" | "Autre";

interface LeaveBalance {
  leave_type: string;
  label: string;
  days_remaining: number;
  days_taken: number;
  days_total: number;
}

interface LeaveBalancePrediction {
  days_remaining_after: number;
  days_requested: number;
  leave_type: string;
  is_sufficient: boolean;
}

interface TeamConflict {
  user_id: string;
  user_name: string;
  department?: string;
  leave_start: string;
  leave_end: string;
  leave_type: string;
}

interface PresenceViolation {
  rule_id: string;
  rule_name: string;
  severity: "soft" | "hard";
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Leave Section Sub-component
// ─────────────────────────────────────────────────────────────────────────────

interface LeaveSectionProps {
  leaveType: LeaveType;
  onLeaveTypeChange: (lt: LeaveType) => void;
  startTime: string;
  endTime: string;
  onHardViolation: (hasHard: boolean) => void;
}

const LEAVE_TYPE_OPTIONS: { value: LeaveType; label: string }[] = [
  { value: "CP", label: "Congés payés (CP)" },
  { value: "RTT", label: "RTT" },
  { value: "Maladie", label: "Arrêt maladie" },
  { value: "Sans solde", label: "Congé sans solde" },
  { value: "Autre", label: "Autre" },
];

function LeaveSection({
  leaveType,
  onLeaveTypeChange,
  startTime,
  endTime,
  onHardViolation,
}: LeaveSectionProps) {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [prediction, setPrediction] = useState<LeaveBalancePrediction | null>(
    null,
  );
  const [teamConflicts, setTeamConflicts] = useState<TeamConflict[]>([]);
  const [violations, setViolations] = useState<PresenceViolation[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [loadingConflicts, setLoadingConflicts] = useState(false);
  const [loadingValidation, setLoadingValidation] = useState(false);

  // Compute business days between start and end
  const computeDays = useCallback((): number => {
    if (!startTime || !endTime) return 0;
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const diff = differenceInDays(end, start);
    return Math.max(1, diff);
  }, [startTime, endTime]);

  // Fetch balances on mount
  useEffect(() => {
    setLoadingBalances(true);
    leaveApi
      .balances()
      .then((res) => {
        const data: unknown = (res as { data?: unknown })?.data ?? res;
        if (Array.isArray(data)) {
          setBalances(data as LeaveBalance[]);
        } else {
          setBalances([]);
        }
      })
      .catch(() => setBalances([]))
      .finally(() => setLoadingBalances(false));
  }, []);

  // Fetch prediction when leaveType or dates change
  useEffect(() => {
    const days = computeDays();
    if (days <= 0 || !leaveType) return;

    setLoadingPrediction(true);
    leaveApi
      .predict(days, leaveType)
      .then((res) => {
        const data: unknown = (res as { data?: unknown })?.data ?? res;
        setPrediction((data as LeaveBalancePrediction) ?? null);
      })
      .catch(() => setPrediction(null))
      .finally(() => setLoadingPrediction(false));
  }, [leaveType, startTime, endTime, computeDays]);

  // Fetch team conflicts when dates change
  useEffect(() => {
    if (!startTime || !endTime) return;

    setLoadingConflicts(true);
    leaveApi
      .teamConflicts(startTime, endTime)
      .then((res) => {
        const data: unknown = (res as { data?: unknown })?.data ?? res;
        const dataObj = data as { conflicts?: TeamConflict[] };
        if (Array.isArray(data)) {
          setTeamConflicts(data as TeamConflict[]);
        } else if (Array.isArray(dataObj?.conflicts)) {
          setTeamConflicts(dataObj.conflicts);
        } else {
          setTeamConflicts([]);
        }
      })
      .catch(() => setTeamConflicts([]))
      .finally(() => setLoadingConflicts(false));
  }, [startTime, endTime]);

  // Validate presence rules
  useEffect(() => {
    if (!startTime || !endTime || !leaveType) return;

    setLoadingValidation(true);
    presenceApi
      .validate({
        action_type: "leave_request",
        start_time: startTime,
        end_time: endTime,
        leave_type: leaveType,
      })
      .then((res) => {
        const data: unknown = (res as { data?: unknown })?.data ?? res;
        const dataObj = data as { violations?: PresenceViolation[] };
        const viols: PresenceViolation[] = Array.isArray(dataObj?.violations)
          ? dataObj.violations
          : [];
        setViolations(viols);
        onHardViolation(viols.some((v) => v.severity === "hard"));
      })
      .catch(() => {
        setViolations([]);
        onHardViolation(false);
      })
      .finally(() => setLoadingValidation(false));
  }, [startTime, endTime, leaveType, onHardViolation]);

  // Current balance for the selected leave type
  const currentBalance = balances.find(
    (b) => b.leave_type === leaveType || b.label === leaveType,
  );

  const days = computeDays();

  const softViolations = violations.filter((v) => v.severity === "soft");
  const hardViolations = violations.filter((v) => v.severity === "hard");

  return (
    <div className="space-y-4 border-t pt-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-semibold text-foreground">
          Informations de congé
        </Label>
      </div>

      {/* Leave type picker */}
      <div className="space-y-2">
        <Label htmlFor="leave_type">Type de congé *</Label>
        <Select
          value={leaveType}
          onValueChange={(v) => onLeaveTypeChange(v as LeaveType)}
        >
          <SelectTrigger id="leave_type" className="w-full">
            <SelectValue placeholder="Sélectionner un type de congé" />
          </SelectTrigger>
          <SelectContent>
            {LEAVE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Duration summary */}
      <div className="rounded-md bg-muted/50 p-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            Durée demandée :{" "}
            <span className="font-semibold text-foreground">
              {days} jour{days > 1 ? "s" : ""}
            </span>
          </span>
        </div>
      </div>

      {/* Current balance */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Solde actuel
        </Label>
        {loadingBalances ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Chargement du solde…
          </div>
        ) : currentBalance ? (
          <div className="rounded-md border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Solde actuel
              </span>
              <Badge
                variant={
                  currentBalance.days_remaining >= days
                    ? "default"
                    : "destructive"
                }
                className="text-sm"
              >
                {currentBalance.days_remaining} jour
                {currentBalance.days_remaining > 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Posés : {currentBalance.days_taken}j</span>
              <span>Acquis : {currentBalance.days_total}j</span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (currentBalance.days_remaining /
                      currentBalance.days_total) *
                      100,
                  )}%`,
                }}
              />
            </div>
          </div>
        ) : balances.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun solde disponible pour ce type de congé.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune information de solde disponible.
          </p>
        )}
      </div>

      {/* Predicted balance after request */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Solde prévisionnel
        </Label>
        {loadingPrediction ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Calcul en cours…
          </div>
        ) : prediction ? (
          <div
            className={`rounded-md border p-3 space-y-1 ${
              prediction.is_sufficient
                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                : "border-destructive/50 bg-destructive/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingDown
                className={`h-4 w-4 ${
                  prediction.is_sufficient
                    ? "text-green-600"
                    : "text-destructive"
                }`}
              />
              <span className="text-sm font-medium">
                Après cette demande :{" "}
                <span
                  className={
                    prediction.is_sufficient
                      ? "text-green-700 dark:text-green-400"
                      : "text-destructive"
                  }
                >
                  {prediction.days_remaining_after} jour
                  {prediction.days_remaining_after !== 1 ? "s" : ""} restant
                  {prediction.days_remaining_after !== 1 ? "s" : ""}
                </span>
              </span>
            </div>
            {!prediction.is_sufficient && (
              <p className="text-xs text-destructive pl-6">
                Solde insuffisant — vous dépassez votre solde disponible.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sélectionnez un type et des dates pour voir le prévisionnel.
          </p>
        )}
      </div>

      {/* Team conflicts */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Absences simultanées dans l'équipe
        </Label>
        {loadingConflicts ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Vérification des conflits…
          </div>
        ) : teamConflicts.length > 0 ? (
          <div className="rounded-md border bg-card divide-y">
            {teamConflicts.map((conflict, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-orange-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium leading-tight">
                      {conflict.user_name}
                    </p>
                    {conflict.department && (
                      <p className="text-xs text-muted-foreground">
                        {conflict.department}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-xs">
                    {conflict.leave_type}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(parseISO(conflict.leave_start), "dd/MM", {
                      locale: fr,
                    })}
                    {" – "}
                    {format(parseISO(conflict.leave_end), "dd/MM", {
                      locale: fr,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Aucun collègue absent sur cette période.</span>
          </div>
        )}
      </div>

      {/* Presence rule violations — soft */}
      {softViolations.length > 0 && (
        <div className="space-y-2">
          {softViolations.map((v, idx) => (
            <Alert
              key={idx}
              variant="default"
              className="border-yellow-400/60 bg-yellow-50 dark:bg-yellow-950/30"
            >
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-300 text-sm">
                Avertissement — {v.rule_name}
              </AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-400 text-xs">
                {v.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Presence rule violations — hard */}
      {hardViolations.length > 0 && (
        <div className="space-y-2">
          {hardViolations.map((v, idx) => (
            <Alert key={idx} variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-sm">
                Règle bloquante — {v.rule_name}
              </AlertTitle>
              <AlertDescription className="text-xs">
                {v.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Validation loading spinner */}
      {loadingValidation && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Validation des règles de présence…
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main EventForm Component
// ─────────────────────────────────────────────────────────────────────────────

interface EventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEvent?: Event;
  calendarId: string;
  defaultStartDate?: Date;
}

const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: "event", label: "Événement" },
  { value: "task", label: "Tâche" },
  { value: "leave", label: "Demande de congé" },
  { value: "shift", label: "Horaire / shift" },
  { value: "booking", label: "Réservation" },
];

export function EventForm({
  open,
  onOpenChange,
  initialEvent,
  calendarId,
  defaultStartDate,
}: EventFormProps) {
  const { createEvent, updateEvent, deleteEvent } = useEvents(calendarId);

  type FormDataType = Omit<CreateEvent | UpdateEvent, "rrule" | "timezone"> & {
    rrule?: string;
    timezone?: string;
  };

  const [eventType, setEventType] = useState<EventType>("event");
  const [leaveType, setLeaveType] = useState<LeaveType>("CP");
  const [hasHardViolation, setHasHardViolation] = useState(false);

  const [formData, setFormData] = useState<FormDataType>(() => {
    if (initialEvent) {
      return {
        title: initialEvent.title,
        description: initialEvent.description,
        location: initialEvent.location,
        start_time: initialEvent.start_time,
        end_time: initialEvent.end_time,
        is_all_day: initialEvent.is_all_day,
        rrule: initialEvent.rrule,
        timezone: initialEvent.timezone,
      };
    }

    const start = defaultStartDate || new Date();
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    return {
      title: "",
      description: "",
      location: "",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      is_all_day: false,
      timezone: "UTC",
    };
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [resourceSelectorOpen, setResourceSelectorOpen] = useState(false);
  const [attendeeListOpen, setAttendeeListOpen] = useState(false);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleHardViolation = useCallback((hasHard: boolean) => {
    setHasHardViolation(hasHard);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (eventType === "leave" && hasHardViolation) {
      toast.error(
        "Impossible de soumettre : des règles de présence obligatoires sont violées.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (initialEvent) {
        const updateData: UpdateEvent = {
          title: formData.title || undefined,
          description: formData.description || undefined,
          location: formData.location || undefined,
          start_time: formData.start_time,
          end_time: formData.end_time,
          is_all_day: formData.is_all_day,
          rrule: formData.rrule || undefined,
        };
        await updateEvent(initialEvent.id, updateData);
        toast.success("Événement mis à jour");
      } else {
        const titleDefault =
          eventType === "leave"
            ? `Congé — ${leaveType}`
            : "Événement sans titre";
        const createData: CreateEvent = {
          title: formData.title || titleDefault,
          description: formData.description,
          location: formData.location,
          start_time: formData.start_time || new Date().toISOString(),
          end_time: formData.end_time || new Date().toISOString(),
          is_all_day: formData.is_all_day,
          timezone: formData.timezone,
          rrule: formData.rrule || undefined,
        };
        await createEvent(createData);
        toast.success(
          eventType === "leave"
            ? "Demande de congé soumise avec succès"
            : "Événement créé",
        );
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Une erreur est survenue",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!initialEvent) return;

    setIsSubmitting(true);
    try {
      await deleteEvent(initialEvent.id);
      toast.success("Événement supprimé");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Une erreur est survenue",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLeave = eventType === "leave";
  const submitDisabled = isSubmitting || (isLeave && hasHardViolation);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {initialEvent ? "Modifier l'événement" : "Créer un événement"}
            </DialogTitle>
            <DialogDescription>
              {initialEvent
                ? "Modifier les détails de l'événement"
                : "Ajouter un nouvel événement au calendrier"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Event type selector */}
            <div className="space-y-2">
              <Label htmlFor="event_type">Type</Label>
              <Select
                value={eventType}
                onValueChange={(v) => {
                  setEventType(v as EventType);
                  setHasHardViolation(false);
                }}
              >
                <SelectTrigger id="event_type" className="w-full">
                  <SelectValue placeholder="Type d'événement" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                {isLeave ? "Motif / Titre (optionnel)" : "Titre *"}
              </Label>
              <Input
                id="title"
                name="title"
                placeholder={
                  isLeave ? "Ex: Vacances d'été" : "Titre de l'événement"
                }
                value={formData.title}
                onChange={handleInputChange}
                required={!isLeave}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                {isLeave ? "Commentaire" : "Description"}
              </Label>
              <Textarea
                id="description"
                name="description"
                placeholder={
                  isLeave
                    ? "Informations complémentaires pour votre responsable…"
                    : "Ajouter des notes..."
                }
                rows={3}
                value={formData.description || ""}
                onChange={handleInputChange}
              />
            </div>

            {/* Location — hidden for leave */}
            {!isLeave && (
              <div className="space-y-2">
                <Label htmlFor="location">Lieu</Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="Salle ou adresse"
                  value={formData.location || ""}
                  onChange={handleInputChange}
                />
              </div>
            )}

            {/* Start time */}
            <div className="space-y-2">
              <Label htmlFor="start_time">
                {isLeave ? "Date de début" : "Date/Heure de début"}
              </Label>
              <Input
                id="start_time"
                name="start_time"
                type={isLeave ? "date" : "datetime-local"}
                value={
                  isLeave
                    ? formData.start_time?.slice(0, 10)
                    : formData.start_time?.slice(0, 16)
                }
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  setFormData((prev) => ({
                    ...prev,
                    start_time: date.toISOString(),
                  }));
                }}
              />
            </div>

            {/* End time */}
            <div className="space-y-2">
              <Label htmlFor="end_time">
                {isLeave ? "Date de fin" : "Date/Heure de fin"}
              </Label>
              <Input
                id="end_time"
                name="end_time"
                type={isLeave ? "date" : "datetime-local"}
                value={
                  isLeave
                    ? formData.end_time?.slice(0, 10)
                    : formData.end_time?.slice(0, 16)
                }
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  setFormData((prev) => ({
                    ...prev,
                    end_time: date.toISOString(),
                  }));
                }}
              />
            </div>

            {/* All day checkbox — hidden for leave (always all-day) */}
            {!isLeave && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_all_day"
                  checked={formData.is_all_day}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      is_all_day: e.target.checked,
                    }))
                  }
                />
                <Label
                  htmlFor="is_all_day"
                  className="font-normal cursor-pointer"
                >
                  Toute la journée
                </Label>
              </div>
            )}

            {/* ─── Leave-specific section ─── */}
            {isLeave && (
              <LeaveSection
                leaveType={leaveType}
                onLeaveTypeChange={setLeaveType}
                startTime={formData.start_time || ""}
                endTime={formData.end_time || ""}
                onHardViolation={handleHardViolation}
              />
            )}

            {/* Resources section — hidden for leave */}
            {!isLeave && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Ressources
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setResourceSelectorOpen(true)}
                  >
                    {selectedResourceIds.length > 0
                      ? `${selectedResourceIds.length} sélectionnée(s)`
                      : "Ajouter des ressources"}
                  </Button>
                </div>
                {selectedResourceIds.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {selectedResourceIds.length} ressource(s) seront réservées
                    pour cet événement
                  </div>
                )}
              </div>
            )}

            {/* Attendees section — hidden for leave */}
            {!isLeave && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Participants
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAttendeeListOpen(true)}
                  >
                    {attendees.length > 0
                      ? `${attendees.length} invité(s)`
                      : "Ajouter des participants"}
                  </Button>
                </div>
              </div>
            )}

            {/* Recurrence section — hidden for leave (leave is a one-off request) */}
            {!isLeave && (
              <div
                className="space-y-2 border-t pt-4"
                data-testid="event-recurrence-section"
              >
                <Label className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Récurrence
                </Label>
                <RecurrenceEditor
                  value={formData.rrule}
                  onChange={(rrule) =>
                    setFormData((prev) => ({ ...prev, rrule }))
                  }
                />
              </div>
            )}

            {initialEvent && (
              <div className="border-t pt-3">
                <EntityLinks
                  entityType="calendar_event"
                  entityId={initialEvent.id}
                />
              </div>
            )}

            <DialogFooter className="gap-2">
              {initialEvent && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={isSubmitting}
                >
                  Supprimer
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={submitDisabled}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement…
                  </>
                ) : isLeave ? (
                  "Soumettre la demande"
                ) : initialEvent ? (
                  "Mettre à jour"
                ) : (
                  "Créer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ResourceSelector
        open={resourceSelectorOpen}
        onOpenChange={setResourceSelectorOpen}
        selectedResourceIds={selectedResourceIds}
        onResourcesSelected={setSelectedResourceIds}
        startTime={formData.start_time}
        endTime={formData.end_time}
      />

      <AttendeeList
        eventId={initialEvent?.id || ""}
        open={attendeeListOpen}
        onOpenChange={setAttendeeListOpen}
        attendees={attendees}
        onAttendeesChange={setAttendees}
      />

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Supprimer l'événement"
        description={`Voulez-vous vraiment supprimer "${initialEvent?.title}" ? Cette action est irréversible.`}
        onConfirm={handleDeleteConfirmed}
      />
    </>
  );
}
