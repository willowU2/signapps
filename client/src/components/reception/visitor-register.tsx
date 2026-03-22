'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LogIn, LogOut } from 'lucide-react';

export interface VisitorEntry {
  id: string;
  name: string;
  company: string;
  hostEmployee: string;
  purpose: string;
  badgeNumber: string;
  checkInTime: string;
  checkOutTime?: string;
  status: 'checked-in' | 'checked-out';
}

interface VisitorRegisterProps {
  visitors?: VisitorEntry[];
  onCheckIn?: (data: Omit<VisitorEntry, 'id' | 'checkInTime' | 'checkOutTime' | 'status'>) => void;
  onCheckOut?: (visitorId: string) => void;
}

const PURPOSES = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'interview', label: 'Interview' },
  { value: 'other', label: 'Other' },
];

const EMPLOYEES = [
  { value: 'emp_001', label: 'John Smith' },
  { value: 'emp_002', label: 'Sarah Johnson' },
  { value: 'emp_003', label: 'Michael Brown' },
  { value: 'emp_004', label: 'Emma Davis' },
];

const getStatusColor = (status: string) => {
  return status === 'checked-in' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
};

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export function VisitorRegister({ visitors = [], onCheckIn, onCheckOut }: VisitorRegisterProps) {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    hostEmployee: '',
    purpose: 'meeting',
    badgeNumber: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.company.trim()) newErrors.company = 'Company is required';
    if (!formData.hostEmployee) newErrors.hostEmployee = 'Host employee is required';
    if (!formData.badgeNumber.trim()) newErrors.badgeNumber = 'Badge number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    onCheckIn?.(formData);
    setFormData({ name: '', company: '', hostEmployee: '', purpose: 'meeting', badgeNumber: '' });
    setErrors({});
    setIsLoading(false);
  };

  const todayVisitors = visitors.filter(v => {
    const visitorDate = formatDate(v.checkInTime);
    const today = formatDate(new Date().toISOString());
    return visitorDate === today;
  });

  return (
    <div className="w-full space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Register Visitor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Visitor Name</Label>
                <Input
                  id="name"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={isLoading}
                  aria-invalid={!!errors.name}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="Company name"
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                  disabled={isLoading}
                  aria-invalid={!!errors.company}
                  className={errors.company ? 'border-red-500' : ''}
                />
                {errors.company && <p className="text-sm text-red-500">{errors.company}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">Host Employee</Label>
                <Select value={formData.hostEmployee} onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, hostEmployee: value }))} disabled={isLoading}>
                  <SelectTrigger id="host"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYEES.map((emp) => (<SelectItem key={emp.value} value={emp.value}>{emp.label}</SelectItem>))}
                  </SelectContent>
                </Select>
                {errors.hostEmployee && <p className="text-sm text-red-500">{errors.hostEmployee}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose</Label>
                <Select value={formData.purpose} onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, purpose: value }))} disabled={isLoading}>
                  <SelectTrigger id="purpose"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="badge">Badge Number</Label>
              <Input
                id="badge"
                placeholder="Badge #"
                value={formData.badgeNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, badgeNumber: e.target.value }))}
                disabled={isLoading}
                aria-invalid={!!errors.badgeNumber}
                className={errors.badgeNumber ? 'border-red-500' : ''}
              />
              {errors.badgeNumber && <p className="text-sm text-red-500">{errors.badgeNumber}</p>}
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              <LogIn className="w-4 h-4 mr-2" />
              {isLoading ? 'Checking In...' : 'Check In Visitor'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today's Visitors</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Badge</TableHead>
                <TableHead>Check-In</TableHead>
                <TableHead>Check-Out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todayVisitors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No visitors today
                  </TableCell>
                </TableRow>
              ) : (
                todayVisitors.map((visitor) => (
                  <TableRow key={visitor.id}>
                    <TableCell className="font-medium">{visitor.name}</TableCell>
                    <TableCell className="text-sm">{visitor.company}</TableCell>
                    <TableCell className="text-sm">{visitor.hostEmployee}</TableCell>
                    <TableCell className="text-sm capitalize">{visitor.purpose}</TableCell>
                    <TableCell className="font-mono text-sm">{visitor.badgeNumber}</TableCell>
                    <TableCell className="text-sm">{formatTime(visitor.checkInTime)}</TableCell>
                    <TableCell className="text-sm">{visitor.checkOutTime ? formatTime(visitor.checkOutTime) : '—'}</TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(visitor.status)} capitalize`}>
                        {visitor.status.replace('-', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {visitor.status === 'checked-in' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCheckOut?.(visitor.id)}
                          className="text-sm"
                        >
                          <LogOut className="w-3 h-3 mr-1" />
                          Check Out
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
