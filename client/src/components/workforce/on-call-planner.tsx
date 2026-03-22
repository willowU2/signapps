'use client';

/**
 * On-Call Planner Component
 *
 * Weekly calendar grid with employee names as rows, days as columns.
 * Click cells to assign on-call shifts (garde or astreinte).
 * Color coding: red=garde, orange=astreinte.
 * Swap button to exchange two employees.
 */

import * as React from 'react';
import { format, addDays, startOfWeek, eachDayOfInterval } from 'date-fns';
import { ArrowRightLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EmployeeWithDetails } from '@/types/workforce';

type ShiftType = 'garde' | 'astreinte' | null;

interface OnCallAssignment {
  employeeId: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  shiftType: ShiftType;
}

interface OnCallPlannerProps {
  employees: EmployeeWithDetails[];
  assignments?: OnCallAssignment[];
  onAssignmentChange?: (assignments: OnCallAssignment[]) => void;
  startDate?: Date;
  className?: string;
}

const SHIFT_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  garde: {
    label: 'Garde',
    bgColor: 'bg-red-100 dark:bg-red-950',
    textColor: 'text-red-700 dark:text-red-200',
  },
  astreinte: {
    label: 'Astreinte',
    bgColor: 'bg-orange-100 dark:bg-orange-950',
    textColor: 'text-orange-700 dark:text-orange-200',
  },
};

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function OnCallPlanner({
  employees,
  assignments = [],
  onAssignmentChange,
  startDate = new Date(),
  className,
}: OnCallPlannerProps) {
  const [localAssignments, setLocalAssignments] = React.useState<OnCallAssignment[]>(assignments);
  const [selectedForSwap, setSelectedForSwap] = React.useState<string | null>(null);
  const [swapCandidates, setSwapCandidates] = React.useState<OnCallAssignment[]>([]);

  // Calculate week dates
  const weekStart = startOfWeek(startDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  // Get assignment for employee on specific day
  const getAssignment = (employeeId: string, dayOfWeek: number): ShiftType => {
    return (
      localAssignments.find(
        (a) => a.employeeId === employeeId && a.dayOfWeek === dayOfWeek
      )?.shiftType || null
    );
  };

  // Handle cell click to toggle shift type
  const handleCellClick = (employeeId: string, dayOfWeek: number) => {
    const current = getAssignment(employeeId, dayOfWeek);
    const next = current === 'garde' ? 'astreinte' : current === 'astreinte' ? null : 'garde';

    const updated = localAssignments.filter(
      (a) => !(a.employeeId === employeeId && a.dayOfWeek === dayOfWeek)
    );

    if (next !== null) {
      updated.push({ employeeId, dayOfWeek, shiftType: next });
    }

    setLocalAssignments(updated);
    onAssignmentChange?.(updated);
  };

  // Clear all assignments for an employee
  const clearEmployee = (employeeId: string) => {
    const updated = localAssignments.filter((a) => a.employeeId !== employeeId);
    setLocalAssignments(updated);
    onAssignmentChange?.(updated);
  };

  // Initiate swap: select first employee
  const initiateSwap = (employeeId: string) => {
    setSelectedForSwap(employeeId);
    setSwapCandidates(localAssignments.filter((a) => a.employeeId === employeeId));
  };

  // Complete swap: exchange assignments between two employees
  const completeSwap = (targetEmployeeId: string) => {
    if (!selectedForSwap || selectedForSwap === targetEmployeeId) return;

    const sourceAssignments = localAssignments.filter((a) => a.employeeId === selectedForSwap);
    const targetAssignments = localAssignments.filter((a) => a.employeeId === targetEmployeeId);

    const updated = localAssignments
      .filter((a) => a.employeeId !== selectedForSwap && a.employeeId !== targetEmployeeId)
      .concat(
        sourceAssignments.map((a) => ({ ...a, employeeId: targetEmployeeId })),
        targetAssignments.map((a) => ({ ...a, employeeId: selectedForSwap }))
      );

    setLocalAssignments(updated);
    onAssignmentChange?.(updated);
    setSelectedForSwap(null);
    setSwapCandidates([]);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with week range */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="text-lg font-semibold">Planification des gardes/astreintes</h3>
          <p className="text-sm text-muted-foreground">
            {format(weekDays[0], 'EEEE d MMM')} - {format(weekDays[6], 'EEEE d MMM yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Garde
          </Badge>
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            Astreinte
          </Badge>
        </div>
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          {/* Header row with days */}
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-48 px-4 py-3 text-left font-medium">Employé</th>
              {weekDays.map((date, idx) => (
                <th
                  key={idx}
                  className="min-w-24 px-2 py-3 text-center font-medium border-l"
                >
                  <div className="text-xs text-muted-foreground">{DAYS[date.getDay()]}</div>
                  <div className="text-sm">{format(date, 'd MMM')}</div>
                </th>
              ))}
              <th className="w-12 px-2 py-3 border-l" />
            </tr>
          </thead>

          {/* Employee rows */}
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={9} className="h-24 text-center text-muted-foreground">
                  Aucun employé
                </td>
              </tr>
            ) : (
              employees.map((employee) => (
                <tr key={employee.id} className="border-b hover:bg-muted/30 transition">
                  {/* Employee name column */}
                  <td className="px-4 py-3 font-medium">
                    <div className="flex flex-col">
                      <span>
                        {employee.first_name} {employee.last_name}
                      </span>
                      {employee.employee_number && (
                        <span className="text-xs text-muted-foreground">
                          #{employee.employee_number}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Day assignment cells */}
                  {weekDays.map((date, dayIdx) => {
                    const dayOfWeek = date.getDay();
                    const shiftType = getAssignment(employee.id, dayOfWeek);
                    const config = shiftType ? SHIFT_CONFIG[shiftType] : null;

                    return (
                      <td
                        key={dayIdx}
                        className="px-2 py-2 border-l text-center cursor-pointer"
                        onClick={() => handleCellClick(employee.id, dayOfWeek)}
                      >
                        {config && (
                          <div className={cn('rounded px-2 py-1 text-xs font-medium', config.bgColor, config.textColor)}>
                            {config.label}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* Action button column */}
                  <td className="px-2 py-2 border-l">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedForSwap === employee.id) {
                          setSelectedForSwap(null);
                        } else if (selectedForSwap) {
                          completeSwap(employee.id);
                        } else {
                          initiateSwap(employee.id);
                        }
                      }}
                      title={selectedForSwap === employee.id ? 'Annuler échange' : 'Échanger avec un collègue'}
                    >
                      <ArrowRightLeft
                        className={cn('h-4 w-4', {
                          'text-blue-600': selectedForSwap === employee.id,
                        })}
                      />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary and Clear All */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {localAssignments.length} assignation(s)
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLocalAssignments([]);
            onAssignmentChange?.([]);
          }}
          disabled={localAssignments.length === 0}
        >
          <X className="mr-1 h-4 w-4" />
          Effacer tout
        </Button>
      </div>
    </div>
  );
}

export type { OnCallAssignment, OnCallPlannerProps };
