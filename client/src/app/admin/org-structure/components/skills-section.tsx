/**
 * SO3 — Skills section for a person card.
 *
 * Shows the list of (skill, level) tuples with an inline 1-5 slider, a
 * delete button, and an "add skill" combobox that lists the catalog.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orgApi, type OrgPersonSkill, type OrgSkill } from "@/lib/api/org";

export interface SkillsSectionProps {
  personId: string;
  readOnly?: boolean;
}

/** Render level 1-5 as stars. */
function LevelStars({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={
            i <= level
              ? "fill-yellow-400 text-yellow-400 size-3"
              : "text-muted-foreground size-3"
          }
        />
      ))}
    </span>
  );
}

export function SkillsSection({
  personId,
  readOnly = false,
}: SkillsSectionProps) {
  const [personSkills, setPersonSkills] = useState<OrgPersonSkill[]>([]);
  const [catalog, setCatalog] = useState<OrgSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickedSkill, setPickedSkill] = useState<string>("");
  const [pickedLevel, setPickedLevel] = useState<number>(3);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        orgApi.skills.listPersonSkills(personId),
        orgApi.skills.list(),
      ]);
      setPersonSkills(Array.isArray(p.data) ? p.data : []);
      setCatalog(Array.isArray(c.data) ? c.data : []);
    } catch (err) {
      toast.error(`Chargement compétences: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const availableSkills = useMemo(() => {
    const taggedIds = new Set(personSkills.map((s) => s.skill_id));
    return catalog.filter((s) => !taggedIds.has(s.id));
  }, [catalog, personSkills]);

  const onAdd = useCallback(async () => {
    if (!pickedSkill) {
      toast.error("Sélectionnez une compétence");
      return;
    }
    try {
      await orgApi.skills.tagPerson(personId, {
        skill_id: pickedSkill,
        level: pickedLevel,
      });
      toast.success("Compétence ajoutée");
      setPickedSkill("");
      setPickedLevel(3);
      await load();
    } catch (err) {
      toast.error(`Erreur: ${(err as Error).message}`);
    }
  }, [pickedSkill, pickedLevel, personId, load]);

  const onRemove = useCallback(
    async (skillId: string) => {
      try {
        await orgApi.skills.untagPerson(personId, skillId);
        toast.success("Compétence retirée");
        await load();
      } catch (err) {
        toast.error(`Erreur: ${(err as Error).message}`);
      }
    },
    [personId, load],
  );

  const onLevelChange = useCallback(
    async (skillId: string, level: number) => {
      try {
        await orgApi.skills.tagPerson(personId, {
          skill_id: skillId,
          level,
        });
        await load();
      } catch (err) {
        toast.error(`Erreur: ${(err as Error).message}`);
      }
    },
    [personId, load],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          Compétences ({personSkills.length})
        </h4>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : personSkills.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Aucune compétence renseignée.
        </p>
      ) : (
        <ul className="space-y-2">
          {personSkills.map((s) => (
            <li
              key={s.skill_id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{s.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {s.category}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <LevelStars level={s.level} />
                  {!readOnly ? (
                    <Select
                      value={String(s.level)}
                      onValueChange={(v) =>
                        onLevelChange(s.skill_id, Number(v))
                      }
                    >
                      <SelectTrigger className="h-7 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <SelectItem key={i} value={String(i)}>
                            Niveau {i}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              </div>
              {!readOnly ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => onRemove(s.skill_id)}
                  aria-label={`Retirer ${s.name}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!readOnly ? (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">
              Ajouter une compétence
            </label>
            <Select value={pickedSkill} onValueChange={setPickedSkill}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {availableSkills.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <label className="text-xs text-muted-foreground mb-1 block">
              Niveau
            </label>
            <Select
              value={String(pickedLevel)}
              onValueChange={(v) => setPickedLevel(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((i) => (
                  <SelectItem key={i} value={String(i)}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={onAdd} size="sm">
            <Plus className="mr-1 size-4" /> Ajouter
          </Button>
        </div>
      ) : null}
    </div>
  );
}
