import React from 'react';
import { Calendar, Users } from 'lucide-react';

interface AbsenceDay {
  date: string;
  dayOfWeek: string;
  predictedAbsences: number;
  coverage: number;
}

interface TeamMember {
  name: string;
  predictedAbsenceDate: string;
  riskFactor: 'low' | 'medium' | 'high';
}

export const AbsencePrediction: React.FC = () => {
  const upcomingAbsences: AbsenceDay[] = [
    { date: '2026-03-25', dayOfWeek: 'Wed', predictedAbsences: 2, coverage: 92 },
    { date: '2026-03-26', dayOfWeek: 'Thu', predictedAbsences: 1, coverage: 96 },
    { date: '2026-03-27', dayOfWeek: 'Fri', predictedAbsences: 4, coverage: 85 },
    { date: '2026-03-30', dayOfWeek: 'Mon', predictedAbsences: 3, coverage: 88 },
  ];

  const teamCoverage: TeamMember[] = [
    { name: 'Alice Johnson', predictedAbsenceDate: '2026-03-27', riskFactor: 'high' },
    { name: 'Bob Smith', predictedAbsenceDate: '2026-03-27', riskFactor: 'medium' },
    { name: 'Carol Davis', predictedAbsenceDate: '2026-03-30', riskFactor: 'low' },
  ];

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-muted text-gray-800';
    }
  };

  const getCoverageColor = (coverage: number): string => {
    if (coverage >= 90) return 'text-green-600';
    if (coverage >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6 bg-card rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-blue-500" />
        Absence Prediction
      </h2>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Upcoming Absences</h3>
        <div className="grid grid-cols-1 gap-2">
          {upcomingAbsences.map((day) => (
            <div key={day.date} className="p-3 border border-border rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{day.date}</p>
                  <p className="text-xs text-muted-foreground">{day.dayOfWeek}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{day.predictedAbsences} absence(s)</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs text-muted-foreground">Team Coverage</p>
                  <p className={`text-xs font-bold ${getCoverageColor(day.coverage)}`}>{day.coverage}%</p>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${day.coverage >= 90 ? 'bg-green-500' : day.coverage >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${day.coverage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          At-Risk Team Members
        </h3>
        <div className="space-y-2">
          {teamCoverage.map((member, idx) => (
            <div key={idx} className="p-3 bg-muted border border-border rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.predictedAbsenceDate}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getRiskColor(member.riskFactor)}`}>
                  {member.riskFactor.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
