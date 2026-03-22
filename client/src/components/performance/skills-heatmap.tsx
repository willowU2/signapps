"use client";

import { useState } from "react";

interface EmployeeSkills {
  name: string;
  skills: {
    [skill: string]: number; // 1-5 proficiency
  };
}

const SKILLS = [
  "React",
  "TypeScript",
  "Node.js",
  "Python",
  "SQL",
  "AWS",
  "Docker",
  "Kubernetes",
  "System Design",
  "Leadership",
];

const EMPLOYEES: EmployeeSkills[] = [
  {
    name: "Alice Johnson",
    skills: {
      React: 5,
      TypeScript: 5,
      "Node.js": 4,
      Python: 3,
      SQL: 4,
      AWS: 5,
      Docker: 4,
      Kubernetes: 3,
      "System Design": 5,
      Leadership: 5,
    },
  },
  {
    name: "Bob Chen",
    skills: {
      React: 4,
      TypeScript: 4,
      "Node.js": 5,
      Python: 5,
      SQL: 5,
      AWS: 3,
      Docker: 5,
      Kubernetes: 4,
      "System Design": 4,
      Leadership: 3,
    },
  },
  {
    name: "Carol Davis",
    skills: {
      React: 5,
      TypeScript: 5,
      "Node.js": 3,
      Python: 2,
      SQL: 3,
      AWS: 4,
      Docker: 3,
      Kubernetes: 2,
      "System Design": 4,
      Leadership: 4,
    },
  },
  {
    name: "David Wilson",
    skills: {
      React: 3,
      TypeScript: 3,
      "Node.js": 4,
      Python: 4,
      SQL: 4,
      AWS: 2,
      Docker: 2,
      Kubernetes: 1,
      "System Design": 3,
      Leadership: 4,
    },
  },
  {
    name: "Emma Brown",
    skills: {
      React: 2,
      TypeScript: 2,
      "Node.js": 3,
      Python: 5,
      SQL: 5,
      AWS: 3,
      Docker: 3,
      Kubernetes: 2,
      "System Design": 3,
      Leadership: 3,
    },
  },
];

function getProficiencyColor(level: number): string {
  switch (level) {
    case 5:
      return "bg-green-600";
    case 4:
      return "bg-green-400";
    case 3:
      return "bg-yellow-400";
    case 2:
      return "bg-orange-400";
    case 1:
      return "bg-red-400";
    default:
      return "bg-gray-200";
  }
}

function getProficiencyLabel(level: number): string {
  switch (level) {
    case 5:
      return "Expert";
    case 4:
      return "Advanced";
    case 3:
      return "Intermediate";
    case 2:
      return "Beginner";
    case 1:
      return "Novice";
    default:
      return "No data";
  }
}

export function SkillsHeatmap() {
  const [hoveredCell, setHoveredCell] = useState<{ emp: number; skill: string } | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Skills Heatmap</h2>
        <p className="text-gray-600">Team proficiency across key competencies</p>
      </div>

      <div className="border rounded-lg overflow-x-auto bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-4 text-left font-semibold text-gray-900 border-r w-32">
                Employee
              </th>
              {SKILLS.map((skill) => (
                <th
                  key={skill}
                  className="p-4 text-center font-semibold text-gray-900 border-r min-w-[100px]"
                >
                  <div className="text-sm">{skill}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EMPLOYEES.map((employee, empIdx) => (
              <tr key={employee.name} className="border-b hover:bg-gray-50">
                <td className="p-4 font-medium text-gray-900 border-r bg-gray-50">
                  {employee.name}
                </td>
                {SKILLS.map((skill) => {
                  const level = employee.skills[skill] || 0;
                  const isHovered =
                    hoveredCell?.emp === empIdx && hoveredCell?.skill === skill;
                  return (
                    <td
                      key={skill}
                      className="p-4 text-center border-r relative"
                      onMouseEnter={() =>
                        setHoveredCell({ emp: empIdx, skill })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div
                        className={`w-full h-12 rounded-lg flex items-center justify-center text-white font-semibold text-sm transition-all ${getProficiencyColor(level)} ${
                          isHovered ? "ring-2 ring-offset-2 ring-gray-400" : ""
                        }`}
                      >
                        {level > 0 ? level : "—"}
                      </div>
                      {isHovered && level > 0 && (
                        <div className="absolute top-full mt-2 bg-gray-900 text-white px-3 py-2 rounded text-xs whitespace-nowrap z-10 left-1/2 -translate-x-1/2">
                          {getProficiencyLabel(level)}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="border rounded-lg p-6 bg-white">
          <h3 className="font-semibold text-gray-900 mb-4">Proficiency Legend</h3>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((level) => (
              <div key={level} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded ${getProficiencyColor(level)}`} />
                <div>
                  <p className="font-medium text-gray-900">{level}</p>
                  <p className="text-sm text-gray-600">{getProficiencyLabel(level)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-6 bg-white">
          <h3 className="font-semibold text-gray-900 mb-4">Team Statistics</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Employees</span>
              <span className="font-bold text-gray-900">{EMPLOYEES.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Skills Tracked</span>
              <span className="font-bold text-gray-900">{SKILLS.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Expert Count</span>
              <span className="font-bold text-gray-900">
                {EMPLOYEES.reduce((sum, emp) => {
                  return (
                    sum +
                    Object.values(emp.skills).filter((v) => v === 5).length
                  );
                }, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Average Proficiency</span>
              <span className="font-bold text-gray-900">
                {(
                  EMPLOYEES.reduce((sum, emp) => {
                    return (
                      sum +
                      Object.values(emp.skills).reduce((a, b) => a + b, 0) /
                        SKILLS.length
                    );
                  }, 0) / EMPLOYEES.length
                ).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
