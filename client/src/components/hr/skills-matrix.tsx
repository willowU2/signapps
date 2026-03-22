'use client';

/**
 * Skills Matrix Component
 *
 * Grid displaying employees vs skills with proficiency levels (1-5 dots).
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface EmployeeSkill {
  employeeId: string;
  employeeName: string;
  skills: Record<string, number>; // skill name -> proficiency (1-5)
}

export interface SkillsMatrixProps {
  employees: EmployeeSkill[];
  className?: string;
}

function ProficiencyDots({ level }: { level: number }) {
  const clampedLevel = Math.max(1, Math.min(5, level));

  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className={`h-2 w-2 rounded-full transition-colors ${
            index < clampedLevel ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
          }`}
          title={`Niveau ${clampedLevel}/5`}
        />
      ))}
    </div>
  );
}

export function SkillsMatrix({ employees, className }: SkillsMatrixProps) {
  // Extract all unique skills across all employees
  const allSkills = React.useMemo(() => {
    const skillSet = new Set<string>();
    employees.forEach((emp) => {
      Object.keys(emp.skills).forEach((skill) => skillSet.add(skill));
    });
    return Array.from(skillSet).sort();
  }, [employees]);

  if (employees.length === 0 || allSkills.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Matrice de Compétences</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Aucune donnée disponible</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Matrice de Compétences</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-semibold min-w-[160px] bg-muted/50">
                  Employé
                </th>
                {allSkills.map((skill) => (
                  <th
                    key={skill}
                    className="px-3 py-2 text-center font-semibold min-w-[120px] bg-muted/50"
                  >
                    <div className="flex flex-col items-center justify-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.employeeId} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3 font-medium">{employee.employeeName}</td>
                  {allSkills.map((skill) => {
                    const level = employee.skills[skill];

                    return (
                      <td key={`${employee.employeeId}-${skill}`} className="px-3 py-3 text-center">
                        {level ? (
                          <ProficiencyDots level={level} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Légende</p>
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 5 }).map((_, level) => (
              <div key={level} className="flex items-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 w-2 rounded-full ${
                        index < level + 1 ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">Niveau {level + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
