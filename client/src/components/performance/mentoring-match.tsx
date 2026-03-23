"use client";

import { useState } from "react";
import { User, Heart, Link2 } from "lucide-react";

interface MentoringPair {
  id: string;
  mentor: {
    name: string;
    expertise: string[];
  };
  mentee: {
    name: string;
    growthAreas: string[];
  };
  matchScore: number;
  status: "paired" | "available";
}

interface Person {
  id: string;
  name: string;
  role: "mentor" | "mentee";
  expertise?: string[];
  growthAreas?: string[];
  avatar?: string;
}

const DEFAULT_MENTORS: Person[] = [
  {
    id: "m1",
    name: "Alice Johnson",
    role: "mentor",
    expertise: ["React", "TypeScript", "System Design", "Leadership"],
  },
  {
    id: "m2",
    name: "Bob Chen",
    role: "mentor",
    expertise: ["Python", "Backend Architecture", "DevOps", "Cloud"],
  },
  {
    id: "m3",
    name: "Carol Davis",
    role: "mentor",
    expertise: ["Frontend", "UX Design", "CSS", "Accessibility"],
  },
];

const DEFAULT_MENTEES: Person[] = [
  {
    id: "mn1",
    name: "David Wilson",
    role: "mentee",
    growthAreas: ["React", "TypeScript", "Leadership"],
  },
  {
    id: "mn2",
    name: "Emma Brown",
    role: "mentee",
    growthAreas: ["Python", "DevOps", "Cloud"],
  },
];

const DEFAULT_PAIRS: MentoringPair[] = [
  {
    id: "p1",
    mentor: {
      name: "Alice Johnson",
      expertise: ["React", "TypeScript", "System Design", "Leadership"],
    },
    mentee: {
      name: "David Wilson",
      growthAreas: ["React", "TypeScript", "Leadership"],
    },
    matchScore: 95,
    status: "paired",
  },
  {
    id: "p2",
    mentor: {
      name: "Bob Chen",
      expertise: ["Python", "Backend Architecture", "DevOps", "Cloud"],
    },
    mentee: {
      name: "Emma Brown",
      growthAreas: ["Python", "DevOps", "Cloud"],
    },
    matchScore: 92,
    status: "paired",
  },
];

function calculateMatchScore(mentor: Person, mentee: Person): number {
  if (!mentor.expertise || !mentee.growthAreas) return 0;
  const matches = mentor.expertise.filter((skill) =>
    mentee.growthAreas?.includes(skill)
  ).length;
  const totalSkills = mentee.growthAreas.length;
  return totalSkills > 0 ? Math.round((matches / totalSkills) * 100) : 0;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "bg-green-100 text-green-800";
  if (score >= 75) return "bg-blue-100 text-blue-800";
  if (score >= 60) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

export function MentoringMatch() {
  const [pairs, setPairs] = useState<MentoringPair[]>(DEFAULT_PAIRS);
  const [mentors] = useState<Person[]>(DEFAULT_MENTORS);
  const [mentees] = useState<Person[]>(DEFAULT_MENTEES);

  const availableMentees = mentees.filter(
    (m) => !pairs.some((p) => p.mentee.name === m.name)
  );

  const availableMentorsForMatching = mentors.filter((m) =>
    availableMentees.some(
      (mentee) =>
        calculateMatchScore(m, mentee) >= 60 &&
        !pairs.some((p) => p.mentor.name === m.name && p.status === "paired")
    )
  );

  const handleCreatePair = (mentor: Person, mentee: Person) => {
    if (!mentor.expertise || !mentee.growthAreas) return;
    const matchScore = calculateMatchScore(mentor, mentee);
    const newPair: MentoringPair = {
      id: `p${pairs.length + 1}`,
      mentor: {
        name: mentor.name,
        expertise: mentor.expertise,
      },
      mentee: {
        name: mentee.name,
        growthAreas: mentee.growthAreas,
      },
      matchScore,
      status: "paired",
    };
    setPairs([...pairs, newPair]);
  };

  const handleUnpair = (pairId: string) => {
    setPairs(pairs.filter((p) => p.id !== pairId));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Heart className="w-6 h-6 text-red-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mentoring Matches</h2>
          <p className="text-gray-600">AI-powered mentor-mentee pairing system</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Active Pairs</p>
          <p className="text-3xl font-bold text-blue-900">{pairs.length}</p>
        </div>
        <div className="rounded-lg border bg-purple-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Available Mentors</p>
          <p className="text-3xl font-bold text-purple-900">
            {availableMentorsForMatching.length}
          </p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Avg Match Score</p>
          <p className="text-3xl font-bold text-green-900">
            {pairs.length > 0
              ? Math.round(
                  pairs.reduce((sum, p) => sum + p.matchScore, 0) / pairs.length
                )
              : "—"}
          </p>
        </div>
      </div>

      {/* Active Pairs */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Active Pairs</h3>
        {pairs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center bg-gray-50">
            <p className="text-gray-600">No active pairs yet</p>
          </div>
        ) : (
          pairs.map((pair) => (
            <div
              key={pair.id}
              className="rounded-lg border bg-white p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase">
                      Mentor
                    </p>
                    <p className="font-semibold text-gray-900">
                      {pair.mentor.name}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {pair.mentor.expertise.slice(0, 3).map((exp) => (
                        <span
                          key={exp}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                        >
                          {exp}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase">
                      Mentee
                    </p>
                    <p className="font-semibold text-gray-900">
                      {pair.mentee.name}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {pair.mentee.growthAreas.slice(0, 3).map((area) => (
                        <span
                          key={area}
                          className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Match Score</p>
                  <span
                    className={`inline-block text-sm font-bold px-3 py-1 rounded ${getScoreColor(pair.matchScore)}`}
                  >
                    {pair.matchScore}%
                  </span>
                </div>
                <button
                  onClick={() => handleUnpair(pair.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded px-3 py-2 text-sm font-medium"
                >
                  Unpair
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Available Matches */}
      {availableMentees.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Suggested Matches
          </h3>
          <div className="space-y-3">
            {availableMentees.map((mentee) =>
              availableMentorsForMatching.map((mentor) => {
                const matchScore = calculateMatchScore(mentor, mentee);
                return (
                  <div
                    key={`${mentor.id}-${mentee.id}`}
                    className="rounded-lg border bg-gray-50 p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          {mentor.name}
                        </span>
                        <Link2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {mentee.name}
                        </span>
                      </div>
                      <span
                        className={`inline-block text-xs font-bold px-2 py-1 rounded ${getScoreColor(matchScore)}`}
                      >
                        {matchScore}% match
                      </span>
                    </div>
                    <button
                      onClick={() => handleCreatePair(mentor, mentee)}
                      className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
                    >
                      Create Pair
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
