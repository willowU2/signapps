"use client";
import { useQuery } from "@tanstack/react-query";
import { formsApi } from "@/lib/api/forms";
import type { FormField } from "@/lib/api/forms";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
];

interface Props {
  formId: string;
  fields: FormField[];
}

export function ResponseAnalytics({ formId, fields }: Props) {
  const { data: responses = [] } = useQuery({
    queryKey: ["form-responses", formId],
    queryFn: () => formsApi.responses(formId).then((r) => r.data),
    staleTime: 30000,
  });

  const choiceFields = fields.filter(
    (f) => f.field_type === "SingleChoice" || f.field_type === "MultipleChoice",
  );

  if (!responses.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">Aucune réponse pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {choiceFields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Aucun champ de choix dans ce formulaire. Les analyses sont disponibles
          pour les champs Choix unique et Choix multiple.
        </p>
      )}
      {choiceFields.map((field) => {
        const counts: Record<string, number> = {};
        responses.forEach((r: any) => {
          // Support both array-of-answers format and object format
          const ans = Array.isArray(r.answers)
            ? r.answers.find((a: any) => a.field_id === field.id)?.value
            : r.answers?.[field.id];
          const vals = Array.isArray(ans) ? ans : [ans];
          vals.forEach((v: string) => {
            if (v) counts[v] = (counts[v] ?? 0) + 1;
          });
        });
        const data = Object.entries(counts).map(([name, value]) => ({
          name,
          value,
        }));

        return (
          <Card key={field.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {field.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={data}
                  margin={{ top: 5, right: 20, bottom: 20, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
