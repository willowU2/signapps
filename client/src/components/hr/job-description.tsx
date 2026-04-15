"use client";

/**
 * Job Description Card Component
 *
 * Displays job details with title, department, skills, description, and salary range.
 */

import * as React from "react";
import { Briefcase, DollarSign, Users, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface JobDescriptionProps {
  jobTitle: string;
  department: string;
  requiredSkills: string[];
  description: string;
  salaryMin?: number;
  salaryMax?: number;
  reportsTo?: string;
  className?: string;
}

export function JobDescription({
  jobTitle,
  department,
  requiredSkills,
  description,
  salaryMin,
  salaryMax,
  reportsTo,
  className,
}: JobDescriptionProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              {jobTitle}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{department}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Description</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>

        {/* Required Skills */}
        {requiredSkills.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Compétences requises</h3>
            <div className="flex flex-wrap gap-2">
              {requiredSkills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          {/* Reports To */}
          {reportsTo && (
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Responsable</p>
                <p className="text-sm font-medium truncate">{reportsTo}</p>
              </div>
            </div>
          )}

          {/* Salary Range */}
          {(salaryMin || salaryMax) && (
            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Salaire</p>
                <p className="text-sm font-medium">
                  {salaryMin && salaryMax
                    ? `${formatCurrency(salaryMin)} - ${formatCurrency(salaryMax)}`
                    : salaryMin
                      ? `À partir de ${formatCurrency(salaryMin)}`
                      : `Jusqu'à ${formatCurrency(salaryMax || 0)}`}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
