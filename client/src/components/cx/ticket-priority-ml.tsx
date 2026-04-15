"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Zap } from "lucide-react";

type PriorityLevel = "Urgent" | "Normal" | "Low";

interface Ticket {
  id: string;
  subject: string;
  customer: string;
  mlPriority: PriorityLevel;
  confidence: number;
  userPriority?: PriorityLevel;
}

interface TicketPriorityMLProps {
  tickets?: Ticket[];
  onOverridePriority?: (ticketId: string, newPriority: PriorityLevel) => void;
}

export function TicketPriorityML({
  tickets = [
    {
      id: "T001",
      subject: "Système critique hors ligne",
      customer: "Acme Corp",
      mlPriority: "Urgent",
      confidence: 0.98,
    },
    {
      id: "T002",
      subject: "Question sur la facturation",
      customer: "Tech Solutions",
      mlPriority: "Normal",
      confidence: 0.85,
    },
    {
      id: "T003",
      subject: "Demande de documentation",
      customer: "StartUp Inc",
      mlPriority: "Low",
      confidence: 0.92,
    },
    {
      id: "T004",
      subject: "Erreur 503 lors du login",
      customer: "Global Ltd",
      mlPriority: "Urgent",
      confidence: 0.96,
    },
    {
      id: "T005",
      subject: "Optimisation performance demandée",
      customer: "Digital Team",
      mlPriority: "Normal",
      confidence: 0.78,
    },
  ],
  onOverridePriority,
}: TicketPriorityMLProps) {
  const [overrides, setOverrides] = useState<Record<string, PriorityLevel>>({});

  const getPriorityBadge = (priority: PriorityLevel, confidence: number) => {
    const confStyle =
      confidence > 0.9
        ? "bg-opacity-100"
        : confidence > 0.75
          ? "bg-opacity-75"
          : "bg-opacity-60";

    const colorMap = {
      Urgent: `bg-red-100 text-red-800 ${confStyle} border border-red-200`,
      Normal: `bg-blue-100 text-blue-800 ${confStyle} border border-blue-200`,
      Low: `bg-muted text-gray-800 ${confStyle} border border-border`,
    };

    return (
      <div className="flex items-center gap-2">
        <Badge className={colorMap[priority]}>
          {priority === "Urgent" && <AlertCircle className="mr-1 h-3 w-3" />}
          {priority === "Normal" && <CheckCircle className="mr-1 h-3 w-3" />}
          {priority === "Low" && <Zap className="mr-1 h-3 w-3" />}
          {priority}
        </Badge>
        <span className="text-xs font-semibold text-muted-foreground">
          {(confidence * 100).toFixed(0)}%
        </span>
      </div>
    );
  };

  const handleOverride = (ticketId: string, newPriority: PriorityLevel) => {
    setOverrides({ ...overrides, [ticketId]: newPriority });
    onOverridePriority?.(ticketId, newPriority);
  };

  const displayPriority = (ticket: Ticket) =>
    overrides[ticket.id] || ticket.mlPriority;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Zap className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Priorisation ML des Tickets</h2>
      </div>

      <Card className="p-6">
        <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-semibold">Intelligence Artificielle</p>
          <p>
            Les priorités sont prédites par ML. Les pourcentages indiquent le
            niveau de confiance.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID Ticket</TableHead>
              <TableHead>Sujet</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Priorité ML</TableHead>
              <TableHead>Votre Priorité</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell className="font-mono text-sm font-semibold">
                  {ticket.id}
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {ticket.subject}
                </TableCell>
                <TableCell>{ticket.customer}</TableCell>
                <TableCell>
                  {getPriorityBadge(ticket.mlPriority, ticket.confidence)}
                </TableCell>
                <TableCell>
                  {overrides[ticket.id] ? (
                    <Badge className="bg-purple-100 text-purple-800">
                      {overrides[ticket.id]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {(["Urgent", "Normal", "Low"] as PriorityLevel[]).map(
                      (p) => (
                        <Button
                          key={p}
                          size="sm"
                          variant={
                            displayPriority(ticket) === p
                              ? "default"
                              : "outline"
                          }
                          onClick={() => handleOverride(ticket.id, p)}
                          className="text-xs"
                        >
                          {p}
                        </Button>
                      ),
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>
            💡 Cliquez sur les boutons de priorité pour surcharger la prédiction
            ML.
          </p>
        </div>
      </Card>
    </div>
  );
}
