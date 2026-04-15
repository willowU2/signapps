"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Calendar,
  Users,
  Plus,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { useState } from "react";

interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  deadline: string;
  applicants: number;
}

interface JobPostingsProps {
  postings?: JobPosting[];
  onAddPosting?: (posting: Omit<JobPosting, "id" | "applicants">) => void;
  onDeletePosting?: (id: string) => void;
}

export function JobPostings({
  postings = [
    {
      id: "1",
      title: "Développeur Full-Stack",
      department: "IT",
      location: "Paris",
      deadline: "2024-04-30",
      applicants: 12,
    },
    {
      id: "2",
      title: "Gestionnaire de Projet",
      department: "Operations",
      location: "Lyon",
      deadline: "2024-05-15",
      applicants: 8,
    },
    {
      id: "3",
      title: "Responsable Commercial",
      department: "Ventes",
      location: "Toulouse",
      deadline: "2024-06-01",
      applicants: 5,
    },
  ],
  onAddPosting,
  onDeletePosting,
}: JobPostingsProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    department: "",
    location: "",
    deadline: "",
  });

  const handleAddPosting = () => {
    if (
      formData.title &&
      formData.department &&
      formData.location &&
      formData.deadline
    ) {
      onAddPosting?.(formData);
      setFormData({ title: "", department: "", location: "", deadline: "" });
      setShowForm(false);
    }
  };

  const daysUntilDeadline = (deadline: string) => {
    const end = new Date(deadline);
    const today = new Date();
    const days = Math.ceil(
      (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return days;
  };

  const getDeadlineColor = (days: number) => {
    if (days < 0) return "bg-red-100 text-red-800";
    if (days < 7) return "bg-orange-100 text-orange-800";
    return "bg-green-100 text-green-800";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Offres d'Emploi</h2>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Publier une Offre
        </Button>
      </div>

      {/* Add Posting Form */}
      {showForm && (
        <Card className="border-blue-200 bg-blue-50 p-6">
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Titre du poste"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full rounded border px-3 py-2"
            />
            <div className="grid gap-4 md:grid-cols-3">
              <input
                type="text"
                placeholder="Département"
                value={formData.department}
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
                className="rounded border px-3 py-2"
              />
              <input
                type="text"
                placeholder="Localité"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="rounded border px-3 py-2"
              />
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) =>
                  setFormData({ ...formData, deadline: e.target.value })
                }
                className="rounded border px-3 py-2"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddPosting} className="flex-1">
                Publier
              </Button>
              <Button
                onClick={() => setShowForm(false)}
                variant="outline"
                className="flex-1"
              >
                Annuler
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Job Postings List */}
      <div className="space-y-4">
        {postings.map((posting) => {
          const days = daysUntilDeadline(posting.deadline);

          return (
            <Card
              key={posting.id}
              className="p-5 transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{posting.title}</h3>
                    <Badge className="bg-blue-100 text-blue-800">
                      {posting.department}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {posting.location}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span className={getDeadlineColor(days)}>
                        {days > 0
                          ? `${days} jours restants`
                          : "Deadline atteinte"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span className="font-medium">{posting.applicants}</span>
                      candidatures
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => onDeletePosting?.(posting.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
