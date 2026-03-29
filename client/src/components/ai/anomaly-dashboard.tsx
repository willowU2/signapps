'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Shield,
  AlertTriangle,
  Activity,
  HardDrive,
  Bug,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import { aiApi } from '@/lib/api';
import { metricsApi, alertsApi, type AlertEvent, type SystemMetrics } from '@/lib/api';

type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
type AnomalyCategory = 'security' | 'storage' | 'performance' | 'error_rate';

interface Anomaly {
  id: string;
  category: AnomalyCategory;
  severity: AnomalySeverity;
  title: string;
  description: string;
  timestamp: string;
  suggestedAction: string;
  metric_value?: number;
  threshold?: number;
}

export function AnomalyDashboard() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAnomalies = useCallback(async () => {
    setIsLoading(true);

    try {
      // Fetch real data from metrics and alerts APIs in parallel
      const [metricsResult, alertsResult] = await Promise.allSettled([
        metricsApi.summary(),
        alertsApi.listActive(),
      ]);

      const detectedAnomalies: Anomaly[] = [];

      // Convert active alerts to anomalies
      if (alertsResult.status === 'fulfilled') {
        const alerts: AlertEvent[] = alertsResult.value.data;
        for (const alert of alerts) {
          detectedAnomalies.push({
            id: alert.id,
            category: mapAlertCategory(alert.metric_type),
            severity: mapAlertSeverity(alert.severity),
            title: alert.config_name,
            description: alert.message,
            timestamp: alert.triggered_at,
            suggestedAction: getSuggestedAction(alert),
            metric_value: alert.metric_value,
            threshold: alert.threshold,
          });
        }
      }

      // Analyze metrics for anomalies that alerts might not catch
      if (metricsResult.status === 'fulfilled') {
        const metrics: SystemMetrics = metricsResult.value.data;
        const metricAnomalies = detectMetricAnomalies(metrics);
        detectedAnomalies.push(...metricAnomalies);
      }

      setAnomalies(detectedAnomalies);
      setLastRefresh(new Date());
    } catch (error) {
      toast.error('Impossible de charger les données d\'anomalies');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnomalies();

    // Refresh every 60 seconds
    const interval = setInterval(fetchAnomalies, 60000);
    return () => clearInterval(interval);
  }, [fetchAnomalies]);

  const handleAIAnalysis = async () => {
    if (anomalies.length === 0) {
      toast.info('No anomalies to analyze');
      return;
    }

    setIsAnalyzing(true);

    try {
      const anomalyContext = anomalies.map((a) => ({
        category: a.category,
        severity: a.severity,
        title: a.title,
        description: a.description,
        metric_value: a.metric_value,
        threshold: a.threshold,
      }));

      const response = await aiApi.chat(
        `Analyze these system anomalies and provide a prioritized action plan:

${JSON.stringify(anomalyContext, null, 2)}

For each anomaly, provide:
1. Root cause analysis
2. Immediate action to take
3. Long-term prevention strategy

Format as a clear, actionable report.`,
        {
          systemPrompt:
            'You are a DevOps and security expert. Analyze system anomalies and provide actionable recommendations.',
        }
      );

      toast.success('AI analysis complete');

      // Update anomalies with AI-enhanced suggestions
      const enhancedAnomalies = anomalies.map((anomaly) => ({
        ...anomaly,
        suggestedAction: `${anomaly.suggestedAction}\n\n--- AI Analysis ---\n${response.data.answer}`,
      }));
      setAnomalies(enhancedAnomalies);
    } catch {
      toast.error('AI analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getCategoryIcon = (category: AnomalyCategory) => {
    switch (category) {
      case 'security':
        return <Shield className="h-5 w-5" />;
      case 'storage':
        return <HardDrive className="h-5 w-5" />;
      case 'performance':
        return <Activity className="h-5 w-5" />;
      case 'error_rate':
        return <Bug className="h-5 w-5" />;
    }
  };

  const getSeverityColor = (severity: AnomalySeverity) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-950/20';
      case 'high':
        return 'border-orange-500 bg-orange-50 dark:bg-orange-950/20';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
      case 'low':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20';
    }
  };

  const getSeverityBadgeColor = (severity: AnomalySeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-foreground';
      case 'low':
        return 'bg-blue-500 text-white';
    }
  };

  const getCategoryColor = (category: AnomalyCategory) => {
    switch (category) {
      case 'security':
        return 'text-red-600 dark:text-red-400';
      case 'storage':
        return 'text-purple-600 dark:text-purple-400';
      case 'performance':
        return 'text-amber-600 dark:text-amber-400';
      case 'error_rate':
        return 'text-rose-600 dark:text-rose-400';
    }
  };

  const categoryCount = (category: AnomalyCategory) =>
    anomalies.filter((a) => a.category === category).length;

  const severityCounts = {
    critical: anomalies.filter((a) => a.severity === 'critical').length,
    high: anomalies.filter((a) => a.severity === 'high').length,
    medium: anomalies.filter((a) => a.severity === 'medium').length,
    low: anomalies.filter((a) => a.severity === 'low').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            AI Anomaly Detection
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Automated monitoring of unusual patterns across services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleAIAnalysis}
            variant="outline"
            disabled={isAnalyzing || anomalies.length === 0}
            className="gap-2"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4" />
            )}
            AI Analysis
          </Button>
          <Button
            onClick={fetchAnomalies}
            variant="outline"
            disabled={isLoading}
            size="icon"
            title="Refresh anomalies"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(
          [
            { cat: 'security' as const, label: 'Security', icon: Shield },
            { cat: 'storage' as const, label: 'Storage', icon: HardDrive },
            { cat: 'performance' as const, label: 'Performance', icon: Activity },
            { cat: 'error_rate' as const, label: 'Error Rate', icon: Bug },
          ] as const
        ).map(({ cat, label, icon: Icon }) => (
          <Card key={cat}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className={`${getCategoryColor(cat)}`}>
                  <Icon className="h-8 w-8" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{categoryCount(cat)}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Severity summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Severity:</span>
        {severityCounts.critical > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {severityCounts.critical} Critical
          </span>
        )}
        {severityCounts.high > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            {severityCounts.high} High
          </span>
        )}
        {severityCounts.medium > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            {severityCounts.medium} Medium
          </span>
        )}
        {severityCounts.low > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            {severityCounts.low} Low
          </span>
        )}
        {anomalies.length === 0 && !isLoading && (
          <span className="text-green-600 dark:text-green-400 font-medium">
            No anomalies detected
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Last refresh: {lastRefresh.toLocaleTimeString()}
        </span>
      </div>

      {/* Loading state */}
      {isLoading && anomalies.length === 0 && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-3" />
          <span>Scanning for anomalies...</span>
        </div>
      )}

      {/* Anomaly list */}
      <div className="space-y-3">
        {anomalies
          .sort((a, b) => {
            const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return sevOrder[a.severity] - sevOrder[b.severity];
          })
          .map((anomaly) => (
            <Card
              key={anomaly.id}
              className={`border-l-4 ${getSeverityColor(anomaly.severity)} transition-all`}
            >
              <CardContent className="p-4">
                <div
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() =>
                    setExpandedId(
                      expandedId === anomaly.id ? null : anomaly.id
                    )
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className={getCategoryColor(anomaly.category)}>
                      {getCategoryIcon(anomaly.category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold">
                          {anomaly.title}
                        </h4>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSeverityBadgeColor(anomaly.severity)}`}
                        >
                          {anomaly.severity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {anomaly.description}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(anomaly.timestamp).toLocaleString()}
                        </span>
                        {anomaly.metric_value !== undefined && (
                          <span className="text-xs font-mono text-muted-foreground">
                            Value: {anomaly.metric_value.toFixed(1)}
                            {anomaly.threshold
                              ? ` / Threshold: ${anomaly.threshold}`
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-xs">
                    {expandedId === anomaly.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Expanded details */}
                {expandedId === anomaly.id && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium mb-1">
                          Suggested Action
                        </p>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {anomaly.suggestedAction}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Empty state */}
      {!isLoading && anomalies.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
            <h3 className="text-lg font-medium text-green-600 dark:text-green-400">
              All Systems Normal
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              No anomalies detected across your services. The system is
              operating within normal parameters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper functions

function mapAlertCategory(metricType: string): AnomalyCategory {
  switch (metricType) {
    case 'cpu_usage':
    case 'memory_usage':
      return 'performance';
    case 'disk_usage':
    case 'disk_io':
      return 'storage';
    case 'network_in':
    case 'network_out':
      return 'security';
    default:
      return 'error_rate';
  }
}

function mapAlertSeverity(severity: string): AnomalySeverity {
  switch (severity) {
    case 'critical':
      return 'critical';
    case 'warning':
      return 'high';
    case 'info':
      return 'medium';
    default:
      return 'low';
  }
}

function getSuggestedAction(alert: AlertEvent): string {
  switch (alert.metric_type) {
    case 'cpu_usage':
      return 'Check for runaway processes. Consider scaling compute resources or optimizing heavy workloads.';
    case 'memory_usage':
      return 'Identify memory-intensive processes. Check for memory leaks in long-running services.';
    case 'disk_usage':
      return 'Clean up temporary files, old logs, and unused Docker images. Consider expanding storage.';
    case 'disk_io':
      return 'Check for intensive disk operations. Consider moving to SSD or optimizing database queries.';
    case 'network_in':
    case 'network_out':
      return 'Review network traffic patterns. Check for unusual connections or data exfiltration.';
    default:
      return 'Investigate the root cause and take appropriate remediation action.';
  }
}

function detectMetricAnomalies(metrics: SystemMetrics): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const now = new Date().toISOString();

  // CPU anomaly
  const cpuUsage = metrics.cpu_usage_percent ?? metrics.cpu ?? 0;
  if (cpuUsage > 90) {
    anomalies.push({
      id: `metric_cpu_${Date.now()}`,
      category: 'performance',
      severity: cpuUsage > 95 ? 'critical' : 'high',
      title: 'High CPU Usage',
      description: `CPU usage at ${cpuUsage.toFixed(1)}%, which exceeds safe operating threshold.`,
      timestamp: now,
      suggestedAction:
        'Identify CPU-intensive processes and consider scaling or load balancing.',
      metric_value: cpuUsage,
      threshold: 90,
    });
  }

  // Memory anomaly
  const memUsage = metrics.memory_usage_percent ?? metrics.memory ?? 0;
  if (memUsage > 85) {
    anomalies.push({
      id: `metric_mem_${Date.now()}`,
      category: 'performance',
      severity: memUsage > 95 ? 'critical' : 'high',
      title: 'High Memory Usage',
      description: `Memory usage at ${memUsage.toFixed(1)}%, risk of OOM conditions.`,
      timestamp: now,
      suggestedAction:
        'Check for memory leaks. Restart memory-intensive services if needed.',
      metric_value: memUsage,
      threshold: 85,
    });
  }

  // Disk anomaly
  const diskUsage = metrics.disk_usage_percent ?? metrics.disk ?? 0;
  if (diskUsage > 80) {
    anomalies.push({
      id: `metric_disk_${Date.now()}`,
      category: 'storage',
      severity: diskUsage > 95 ? 'critical' : diskUsage > 90 ? 'high' : 'medium',
      title: 'Disk Space Running Low',
      description: `Disk usage at ${diskUsage.toFixed(1)}%. Services may fail if disk becomes full.`,
      timestamp: now,
      suggestedAction:
        'Clean up logs, temporary files, old Docker images. Consider expanding storage volume.',
      metric_value: diskUsage,
      threshold: 80,
    });
  }

  return anomalies;
}
