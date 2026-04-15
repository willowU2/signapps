"use client";

import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Connector {
  id: string;
  fromService: string;
  toService: string;
  eventType: string;
  enabled: boolean;
}

export interface InternalConnectorsProps {
  onToggle?: (connector: Connector) => void;
}

export function InternalConnectors({ onToggle }: InternalConnectorsProps) {
  const [connectors, setConnectors] = useState<Connector[]>([
    {
      id: "1",
      fromService: "Storage",
      toService: "Chat",
      eventType: "File Upload",
      enabled: true,
    },
    {
      id: "2",
      fromService: "Calendar",
      toService: "Email",
      eventType: "Event Created",
      enabled: true,
    },
    {
      id: "3",
      fromService: "Form",
      toService: "Task",
      eventType: "Submission",
      enabled: false,
    },
    {
      id: "4",
      fromService: "Chat",
      toService: "Storage",
      eventType: "Archive Message",
      enabled: true,
    },
    {
      id: "5",
      fromService: "Email",
      toService: "Calendar",
      eventType: "Meeting Request",
      enabled: true,
    },
    {
      id: "6",
      fromService: "Task",
      toService: "Email",
      eventType: "Task Assigned",
      enabled: false,
    },
  ]);

  const handleToggle = (id: string) => {
    setConnectors(
      connectors.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)),
    );

    const connector = connectors.find((c) => c.id === id);
    if (connector) {
      const newConnector = { ...connector, enabled: !connector.enabled };
      onToggle?.(newConnector);
      toast.success(
        `Connector ${newConnector.enabled ? "enabled" : "disabled"}`,
      );
    }
  };

  const getServiceColor = (service: string) => {
    const colors: { [key: string]: string } = {
      Storage: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      Chat: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      Calendar:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      Email:
        "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      Form: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
      Task: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    };
    return (
      colors[service] ||
      "bg-muted text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    );
  };

  return (
    <div className="w-full space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Service Connectors</CardTitle>
          <p className="text-sm text-muted-foreground dark:text-gray-400 mt-2">
            Configure automated workflows between services
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectors.map((connector) => (
              <div
                key={connector.id}
                className={`border-2 rounded-lg p-4 transition-all ${
                  connector.enabled
                    ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950"
                    : "border-border bg-muted dark:border-gray-700 dark:bg-gray-900"
                }`}
              >
                <div className="space-y-3">
                  {/* From Service */}
                  <div className="flex items-center justify-between">
                    <Badge className={getServiceColor(connector.fromService)}>
                      {connector.fromService}
                    </Badge>
                  </div>

                  {/* Arrow and Event Type */}
                  <div className="flex items-center gap-2 justify-center">
                    <ArrowRight className="h-5 w-5 text-gray-400" />
                    <span className="text-xs font-medium text-muted-foreground dark:text-gray-400">
                      {connector.eventType}
                    </span>
                  </div>

                  {/* To Service */}
                  <div className="flex items-center justify-between">
                    <Badge className={getServiceColor(connector.toService)}>
                      {connector.toService}
                    </Badge>
                  </div>

                  {/* Toggle Button */}
                  <button
                    onClick={() => handleToggle(connector.id)}
                    className={`w-full py-2 px-3 rounded-md font-medium text-sm transition-colors ${
                      connector.enabled
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-300 text-muted-foreground dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-400"
                    }`}
                  >
                    {connector.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {connectors.filter((c) => c.enabled).length}
              </p>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Active Connectors
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground dark:text-gray-400">
                {connectors.filter((c) => !c.enabled).length}
              </p>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Disabled
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default InternalConnectors;
