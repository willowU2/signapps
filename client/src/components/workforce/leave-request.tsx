'use client';

/**
 * Leave Request Form Component
 *
 * Form to submit leave requests with type selection (CP/RTT/Maladie/Sans solde),
 * date range, and optional reason. Integrates with react-hook-form for validation.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type LeaveType = 'CP' | 'RTT' | 'Maladie' | 'Sans solde';

export interface LeaveRequestFormData {
  leaveType: LeaveType;
  startDate: string; // ISO date
  endDate: string;
  reason?: string;
}

export interface LeaveRequestProps {
  employeeId?: string;
  onSubmit?: (data: LeaveRequestFormData) => Promise<void> | void;
  isLoading?: boolean;
  className?: string;
}

const leaveRequestSchema = z.object({
  leaveType: z.enum(['CP', 'RTT', 'Maladie', 'Sans solde']),
  startDate: z.string().date('Start date must be valid'),
  endDate: z.string().date('End date must be valid'),
  reason: z.string().optional(),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'End date must be after or equal to start date',
  path: ['endDate'],
});

type FormData = z.infer<typeof leaveRequestSchema>;

const LEAVE_TYPES: { value: LeaveType; label: string; description: string }[] = [
  {
    value: 'CP',
    label: 'Congés Payés',
    description: 'Annual paid leave',
  },
  {
    value: 'RTT',
    label: 'RTT',
    description: 'Reduction of working time',
  },
  {
    value: 'Maladie',
    label: 'Maladie',
    description: 'Sick leave',
  },
  {
    value: 'Sans solde',
    label: 'Sans solde',
    description: 'Unpaid leave',
  },
];

export function LeaveRequest({
  employeeId,
  onSubmit,
  isLoading = false,
  className,
}: LeaveRequestProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      leaveType: 'CP',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      reason: '',
    },
  });

  const leaveType = watch('leaveType');
  const startDate = watch('startDate');

  const onSubmitHandler = async (data: FormData) => {
    if (onSubmit) {
      await onSubmit(data as LeaveRequestFormData);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      <form onSubmit={handleSubmit(onSubmitHandler)} className="space-y-5">
        {/* Leave Type Selection */}
        <div className="space-y-2">
          <Label htmlFor="leaveType" className="text-base font-medium">
            Leave Type
          </Label>
          <Select
            value={leaveType}
            onValueChange={(value) => setValue('leaveType', value as LeaveType)}
          >
            <SelectTrigger id="leaveType">
              <SelectValue placeholder="Select leave type" />
            </SelectTrigger>
            <SelectContent>
              {LEAVE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{type.label}</span>
                    <span className="text-xs text-muted-foreground">{type.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.leaveType && (
            <p className="text-sm text-red-500">{errors.leaveType.message}</p>
          )}
        </div>

        {/* Start Date */}
        <div className="space-y-2">
          <Label htmlFor="startDate" className="text-base font-medium">
            Start Date
          </Label>
          <Input
            id="startDate"
            type="date"
            {...register('startDate')}
            className="max-w-xs"
          />
          {errors.startDate && (
            <p className="text-sm text-red-500">{errors.startDate.message}</p>
          )}
        </div>

        {/* End Date */}
        <div className="space-y-2">
          <Label htmlFor="endDate" className="text-base font-medium">
            End Date
          </Label>
          <Input
            id="endDate"
            type="date"
            {...register('endDate')}
            className="max-w-xs"
          />
          {errors.endDate && (
            <p className="text-sm text-red-500">{errors.endDate.message}</p>
          )}
        </div>

        {/* Reason / Comments */}
        <div className="space-y-2">
          <Label htmlFor="reason" className="text-base font-medium">
            Reason (Optional)
          </Label>
          <Textarea
            id="reason"
            placeholder={`Provide details for your ${leaveType} request...`}
            {...register('reason')}
            className="min-h-24 resize-none"
          />
          {errors.reason && (
            <p className="text-sm text-red-500">{errors.reason.message}</p>
          )}
        </div>

        {/* Summary */}
        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <span className="font-semibold">Request Summary:</span> {leaveType} from{' '}
            <span className="font-medium">{startDate}</span> to{' '}
            <span className="font-medium">{watch('endDate')}</span>
          </p>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full md:w-auto"
        >
          {isLoading ? 'Submitting...' : 'Submit Request'}
        </Button>
      </form>
    </div>
  );
}
