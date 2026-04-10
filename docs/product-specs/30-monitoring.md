# Module Monitoring -- Functional Specification

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Grafana** | Dashboards composables (graph, stat, gauge, table, heatmap, logs, traces), templating variables, alerting rules multi-canal, annotations, dashboard-as-code JSON, 150+ data source plugins, Loki pour les logs, Tempo pour les traces |
| **Prometheus** | Pull-based metrics collection, PromQL (puissant langage de requete), alerting rules avec Alertmanager, service discovery, multi-dimensional data model (labels), recording rules, federation |
| **Datadog** | APM + Infrastructure + Logs + Synthetics + RUM unified, anomaly detection ML, SLO tracking, live process monitoring, network performance monitoring, security monitoring, 700+ integrations |
| **Uptime Robot** | Monitoring HTTP/ping/port/keyword ultra-simple, status pages publiques, alertes multi-canal (email, SMS, Slack, webhook), 5-min check interval gratuit, maintenance windows |
| **Netdata** | Monitoring temps reel per-second, 2000+ metrics auto-detected, zero configuration, anomaly detection ML, composite charts, system overview dashboard, Netdata Cloud pour multi-node |
| **Zabbix** | Monitoring reseau/serveur enterprise, templates par OS/device, auto-discovery, trigger expressions complexes, escalation policies, SLA reporting, maps reseau, inventory |
| **PRTG Network Monitor** | Sensors pre-configures (CPU, RAM, disk, bandwidth, ping, HTTP, SQL, SNMP), maps visuelles, auto-discovery, dashboards par role, reports PDF, mobile app |
| **Nagios** | Monitoring legacy reference (checks actifs/passifs), plugins communautaires, event handlers, flap detection, dependency modeling, status pages, downtime scheduling |
| **New Relic** | Full-stack observability (APM, infrastructure, logs, browser, mobile, synthetics), NRQL query language, AI-powered alerts, distributed tracing, error tracking, SLI/SLO |
| **Checkmk** | Auto-discovery agents, 2000+ check plugins, Business Intelligence module, event console, HW/SW inventory, agent-based + agentless, dashlets composables |
| **Better Stack (Uptime)** | Status pages modernes, heartbeat monitoring, incident management integre, on-call scheduling, Slack/Teams/PagerDuty integration, cron job monitoring |
| **Healthchecks.io** | Cron job monitoring simple (ping-based), grace periods, alertes multi-canal, badges status, API simple, team management, integrations webhook |

## Principes directeurs

1. **Immediate visibility** -- the monitoring dashboard displays overall system health at a glance: green = all good, orange = degraded, red = incident. No click required to know the state.
2. **Proactive AI detection** -- anomalies are detected automatically by AI before they become incidents. Not just static thresholds but learned deviation patterns from historical data.
3. **Actionable alerts** -- every alert contains context (which metric, which threshold, since when, estimated impact) and suggested actions. No alert without information to act on.
4. **Native real-time** -- metrics are refreshed in real-time (WebSocket) without polling. Live mode displays data second-by-second.
5. **Exploitable history** -- data is retained with configurable retention for trend analysis, recurring pattern identification, and post-incident correlation.
6. **Self-monitoring** -- the monitoring system monitors itself. If the metrics service goes down, an alert is emitted via an independent mechanism (external heartbeat).

---

## Category 1 -- System Overview Dashboard

### 1.1 Global health status
Banner at the top of the dashboard with a health indicator: `Operational` (green, `bg-green-500`), `Degraded` (orange, `bg-orange-500`), `Incident` (red, `bg-red-500`). The state is computed from the worst state across all services and active alert thresholds. Animation: the indicator pulses gently when in Degraded or Incident state. Clicking the banner scrolls to the first problematic service.

### 1.2 Machine inventory cards
Grid of cards for each monitored machine. Each card shows: hostname (e.g., `SRV-PROD-01`), OS (e.g., `Windows 11 Pro`), IP address, last heartbeat timestamp ("2s ago" / "5m ago"), status icon (green dot = online, orange dot = degraded, red dot = offline, gray dot = no data). Cards are sorted by status (worst first). Click on a card navigates to the machine detail view. Long-press or right-click opens a context menu: View details, Mute alerts, Open terminal.

### 1.3 CPU/RAM/Disk/Uptime KPI gauges
Four KPI cards at the top of the machine detail view, implemented with Recharts `RadialBarChart`:
- **CPU**: circular gauge 0-100%, current value in large text (e.g., "84.8%"), core count below (e.g., "32 cores"), sparkline of the last 1h (Recharts `AreaChart`, 60 data points). Color zones: green 0-70%, orange 70-90%, red 90-100%.
- **Memory**: circular gauge showing percentage used, used/total text (e.g., "80/191 GB"), sparkline 1h. Same color zones.
- **Disk**: circular gauge showing percentage used, used/total text (e.g., "1.71/14.55 TB"), sparkline 1h. Color zones: green 0-80%, orange 80-90%, red 90-100%.
- **Uptime**: text display of duration since last reboot (e.g., "14d 7h 23min"), last reboot date below. No gauge. Icon: clock.

Gauges animate on load with a 500ms ease-out transition. Real-time update via WebSocket pushes every 5 seconds.

### 1.4 Service health table
Table listing every SignApps microservice:
| Column | Content |
|---|---|
| Name | Service name (e.g., signapps-identity) |
| Port | Port number (e.g., 3001) |
| Status | Badge: `Running` (green), `Degraded` (orange), `Stopped` (red) |
| Response Time | Health check latency in ms (e.g., "12ms") with color: green <100ms, orange 100-500ms, red >500ms |
| Uptime | Percentage over last 7 days (e.g., "99.97%") |
| Last Error | Truncated error message or "--" if none |
| Actions | Restart button (admin only), Logs link, Details link |

Sortable by any column. Filterable by status (dropdown). Auto-refresh every 30 seconds. Row click expands an inline detail panel with recent logs and error timeline.

### 1.5 Service topology map
Interactive diagram (rendered with D3.js force-directed layout) showing service-to-service relationships. Nodes represent services (sized by request volume). Edges represent API calls (thickness by request rate). Edge colors: green (normal latency), orange (elevated latency > 200ms), red (error rate > 5%). Hover on a node highlights its connections. Click opens the service detail view. Toggle labels on/off. Zoom and pan supported via mouse wheel and drag. The layout auto-arranges but nodes are draggable for manual adjustment.

### 1.6 Quick stats bar
Horizontal bar below the health banner showing key numbers:
- Total machines monitored: N
- Services running: N/M
- Active alerts: N (with severity breakdown: N critical, N warning)
- Avg response time: Nms
Each stat is a clickable link to the relevant detail section.

---

## Category 2 -- Detailed Metrics and Charts

### 2.1 CPU time-series chart
Recharts `AreaChart` with stacked areas for per-core usage (optional toggle) or aggregated single line. X-axis: time (default 5 minutes window). Y-axis: 0-100%. Alert threshold line rendered as dashed red horizontal line at the configured threshold (default 90%). Zoom: click-and-drag to select a time range. Tooltip on hover shows exact value, timestamp, and core ID. Color palette: blue for aggregated, rainbow spectrum for per-core.

### 2.2 Memory time-series chart
Recharts `AreaChart` showing stacked areas: Used (blue), Cached (cyan), Available (green), Swap (orange). Same zoom and tooltip behavior as CPU chart. Y-axis in GB with auto-scaling. Legend toggleable: click a legend item to hide/show that series.

### 2.3 Disk I/O chart
Dual-axis Recharts `LineChart`:
- Left Y-axis: IOPS (reads in green, writes in blue)
- Right Y-axis: throughput in MB/s (reads dashed green, writes dashed blue)
Per-partition selector dropdown if multiple disks. Tooltip shows read IOPS, write IOPS, read MB/s, write MB/s at the hovered timestamp.

### 2.4 Network traffic chart
Recharts `AreaChart` showing inbound (green) and outbound (blue) traffic in Mbps. Errors and drops overlaid as red/orange scatter points. Per-interface selector dropdown. Tooltip includes: interface name, inbound rate, outbound rate, error count, drop count.

### 2.5 Time range selector
Button group: 5m, 15m, 1h, 6h, 24h, 7d, 30d. Custom range via date picker (start datetime, end datetime). Selecting a range recalculates all charts with appropriate aggregation:
- 5m-1h: raw data points (1 per second for Live, 1 per 5s otherwise)
- 6h-24h: 1-minute aggregation (avg, min, max)
- 7d: 5-minute aggregation
- 30d: 1-hour aggregation
The range selector is shared across all charts on the page. URL param: `?from=...&to=...`.

### 2.6 Live mode (real-time)
Toggle "Live" button (green pulsing dot icon) activates second-by-second chart updates. Charts scroll horizontally like an oscilloscope. The time window is fixed at 5 minutes. Auto-disabled when the user zooms or selects a past range. WebSocket channel: `ws://localhost:3008/ws/metrics?machine_id=...`. Data format: `{ timestamp, cpu, memory, disk_io, network }`.

### 2.7 Period comparison overlay
"Compare" button opens a date picker for a reference period (e.g., "same day last week"). The reference period is rendered as a semi-transparent dashed line overlaid on the current chart. Tooltip shows both current and reference values. Useful for spotting deviations from normal behavior. Visually distinguished by lower opacity (30%) and dashed stroke.

### 2.8 Chart export
Right-click on any chart or click the `...` menu:
- **Export PNG**: renders the chart to a canvas and downloads as `chart-cpu-2026-04-10.png`
- **Export SVG**: vector export for reports
- **Export CSV**: raw data points as `timestamp,value` columns
- **Copy to clipboard**: copies chart as image for pasting into emails/docs
Export respects the current time range and zoom level.

---

## Category 3 -- Alert Rules and Thresholds

### 3.1 Configurable threshold rules
Alert rules management interface (table + form). Default rules:
- **CPU > 90%** for 5 minutes -- critical
- **Memory > 85%** for 5 minutes -- critical
- **Disk > 90%** -- critical (instant, no duration)
- **Service down** (health check fails 3 consecutive times) -- critical
- **Response time p95 > 500ms** for 3 minutes -- warning
- **Error rate > 5%** for 5 minutes -- warning
- **Disk I/O > 90%** for 10 minutes -- warning
- **Network errors > 100/min** for 5 minutes -- warning

Each rule has: toggle on/off, metric (dropdown), operator (>, <, =, !=), threshold (number input), duration ("for N minutes", 0 = instant), severity (dropdown: info/warning/critical), target (all machines, specific machine, specific service, machine group). Rules are evaluated every 30 seconds by the `signapps-metrics` service.

### 3.2 Severity levels
Three levels with distinct visual and behavioral treatment:
- **Info** (blue, `bg-blue-100 text-blue-800`): logged, in-app notification only, no sound
- **Warning** (orange, `bg-orange-100 text-orange-800`): in-app notification + email to configured recipients
- **Critical** (red, `bg-red-100 text-red-800`): in-app notification + email + webhook + optional SMS. Browser notification with sound. Dashboard banner turns red.

### 3.3 Alert notification channels
Configuration per severity level:
- **In-app notification**: always (bell icon badge with count, notification drawer)
- **Email**: configurable recipients (individual users or groups). Email template includes: alert name, metric value, threshold, machine, timestamp, suggested action, link to dashboard.
- **Webhook**: URL + secret. Payload JSON: `{ alert_id, rule_name, severity, metric, value, threshold, machine, timestamp, message }`. Used for Slack/Teams/Discord integration. Retry: 3 attempts with exponential backoff (1s, 5s, 30s).
- **SMS**: via external provider API (configurable). Critical alerts only. Rate-limited to 1 SMS per alert per 15 minutes.

Escalation: if no acknowledgment within N minutes (configurable, default 15), escalate to the next level (e.g., notify manager, then admin).

### 3.4 Alert history
Chronological list of all triggered alerts:
| Column | Content |
|---|---|
| Timestamp | Date and time of trigger |
| Rule | Rule name and metric |
| Severity | Badge (Info/Warning/Critical) |
| Value | Metric value at trigger time |
| Machine | Machine name |
| Duration | How long the alert was active |
| Status | Active / Acknowledged / Resolved |
| Acknowledged by | User who acknowledged + timestamp |
| Resolved at | Auto-resolution timestamp |

Filterable by severity, machine, date range, status. Exportable to CSV. Paginated (50 per page).

### 3.5 Alert acknowledgment
Clicking "Acknowledge" on an active alert transitions it from "Active" to "Acknowledged" with the user's name and timestamp. Optional comment field (e.g., "Investigating - looking at disk I/O"). The alert remains visible until resolved. If the metric returns below threshold, the alert auto-resolves to "Resolved" with resolution timestamp.

### 3.6 Maintenance windows
Schedule a maintenance window: start datetime, end datetime, target (machines/services/groups), description. During the window, alerts for targeted items are suppressed (not triggered). A "Maintenance" badge appears on the affected items in the dashboard. Maintenance windows are listed in a table with: start, end, target, created by, status (scheduled/active/completed). Past windows are kept for audit.

### 3.7 Flap detection
If a metric oscillates around the threshold (triggers/resolves/triggers in a loop -- more than 3 state changes in 10 minutes), the system detects flapping and aggregates into a single alert: "CPU oscillating between 88% and 93% for 15 minutes". The flapping alert has its own severity (configurable, default: warning). Flapping suppresses individual trigger/resolve notifications to avoid alert fatigue.

### 3.8 Alert grouping
Related alerts are grouped. If CPU, Memory, and Disk I/O spike simultaneously on the same machine, they are presented as a single incident group: "Machine SRV-PROD-01: multiple resource alerts" with sub-items. Grouping is by machine + time proximity (within 5 minutes). The group resolves when all sub-alerts resolve.

---

## Category 4 -- AI Anomaly Detection

### 4.1 Automatic baselines
AI learns normal behavior for each metric over 7-30 days: hourly patterns (peak at 9am, trough at night), weekly patterns (lower load on weekends), seasonal patterns. Baselines are recalculated weekly using the `signapps-ai` (port 3005) statistical analysis endpoint. Model: rolling z-score with seasonal decomposition (STL). Baselines are stored per-machine, per-metric in the `metric_baselines` table.

### 4.2 Deviation detection
If a metric deviates significantly from its baseline (z-score > 3.0), an AI anomaly alert is emitted with context: "CPU unusually high for a Sunday at 3am -- baseline: 5%, current: 60%, z-score: 4.2". The anomaly alert includes: current value, expected range (baseline +/- 2 std), deviation direction (above/below), confidence score. Anomaly alerts use severity "info" by default (configurable).

### 4.3 Saturation prediction
AI projects current trends to estimate when a resource will be saturated: "At the current rate, disk will be full in 12 days." Computed via linear regression on the last 30 days of data. Preventive alert configurable: alert N days before estimated saturation (default: 7 days). The prediction is displayed as a projected dashed line on the disk usage chart, extending to 100%.

### 4.4 Anomaly correlation
If multiple metrics deviate simultaneously (e.g., CPU + I/O + service latency), AI correlates them and presents as a single incident with probable cause suggestion: "Probable cause: email indexation job consuming resources on SRV-PROD-01." Correlation is based on temporal proximity (within 2 minutes) and machine affinity.

### 4.5 Feedback loop
User can mark an AI anomaly as "false positive" or "relevant" via thumb-up/thumb-down buttons. Feedback is stored and used to adjust thresholds: false positives increase the z-score threshold for that metric/machine; relevant feedback decreases it. Precision stats displayed in admin: "AI anomaly precision: 78% (based on 156 feedback entries)".

### 4.6 AI incident summary
For each detected incident (manual or AI), the AI generates a natural language summary: "The signapps-mail service (port 3012) experienced elevated latency between 14:30 and 15:15 due to a CPU spike at 95% on machine SRV-PROD-01. Probable cause: email indexation batch. Resolution: automatic (CPU returned to normal after batch completion)." The summary is generated via `signapps-ai` POST `/api/v1/ai/summarize` with the incident data as context.

---

## Category 5 -- Service Monitoring (SignApps-specific)

### 5.1 Health check automation
Each microservice exposes a `GET /health` endpoint checked every 30 seconds by `signapps-metrics`. The health check returns:
```json
{
  "status": "healthy",  // "healthy" | "degraded" | "unhealthy"
  "version": "0.45.0",
  "uptime_seconds": 1234567,
  "checks": {
    "database": "ok",
    "cache": "ok",
    "disk_space": "ok"
  },
  "metrics": {
    "active_connections": 42,
    "queue_size": 7
  }
}
```
Three consecutive failed checks (timeout 5s or non-200) mark the service as "Stopped". One failed check marks as "Degraded" if the previous status was "Running".

### 5.2 Response time percentiles
Per-endpoint API latency tracking: p50, p95, p99. Displayed as a table with sparkline per endpoint. Alert if p95 exceeds configurable threshold (default: 500ms for 3 minutes). The data is collected via middleware that logs request duration to the `endpoint_metrics` table. Recharts `BarChart` showing p50 (blue), p95 (orange), p99 (red) for the top 20 slowest endpoints.

### 5.3 Error rate per service
Counter of HTTP errors (4xx, 5xx) per service and per endpoint. Ratio: errors/total requests. Recharts `LineChart` showing error rate over time. Alert if error rate exceeds X% over N minutes (default: 5% for 5 minutes). Breakdown table: endpoint, 4xx count, 5xx count, total, error rate.

### 5.4 Database connection pool stats
PostgreSQL metrics displayed in a dedicated panel:
- Active connections / max pool size (e.g., 42/100)
- Idle connections
- Queries per second (QPS)
- Slow queries (> 1s) -- count and list of recent slow queries with SQL and duration
- Database size on disk
- Cache hit ratio (should be > 99%)
- Replication lag (if applicable)
Alert if: active connections > 80% of max, cache hit ratio < 95%, slow queries > 10/min.

### 5.5 PgEventBus metrics
Metrics for the event bus:
- Events pending (queue depth)
- Throughput: events/second processed
- Processing latency: time between event emission and processing
- Delivery errors: count and recent error list
Recharts `LineChart` for throughput and queue depth over time. Alert if queue depth grows monotonically for 5 minutes (events not being consumed).

### 5.6 Storage quota monitoring
Per-organization storage usage:
- Drive storage used / quota (e.g., "145 GB / 500 GB")
- Database size
- Attachment storage
- AI model cache size
Recharts `BarChart` stacked by category. Alert at 80% and 95% quota usage. Admin can adjust quotas per organization.

### 5.7 Centralized log viewer
Unified log view from all services. Each log entry: timestamp, service name, log level (debug/info/warn/error), message, span context (trace_id, span_id). Filters: by service (multi-select), by level (checkboxes), by message text (full-text search), by time range. Log entries color-coded by level: gray (debug), blue (info), orange (warn), red (error). Auto-scroll in live mode. Max display: 1000 lines (paginated). Export to file.

---

## Category 6 -- Uptime and SLA

### 6.1 Uptime per service
Percentage availability over 24h, 7d, 30d, 90d. Displayed as a status page-style bar: green segments = up, red segments = down, gray segments = no data. Each segment represents a time interval (24h: 1h segments, 7d: 6h segments, 30d: 1d segments, 90d: 1d segments). Hover on a segment shows exact uptime for that period.

### 6.2 SLA target calculation
Define an SLA target per service (e.g., 99.9%). Dashboard displays:
- Current SLA (e.g., 99.97%)
- SLA target (e.g., 99.9%)
- Error budget remaining (in minutes): e.g., "42 minutes remaining this month"
- Error budget burn rate: "consuming 2 minutes/day, 21 days remaining at this rate"
- Projection: "On track to meet SLA" (green) or "At risk" (orange) or "SLA breached" (red)

### 6.3 Incidents timeline
Vertical timeline of past incidents with: date/time, duration (human readable, e.g., "1h 23min"), services impacted (badges), cause (text), resolution (text), severity (icon). Clickable to expand with full details. Filterable by service, severity, date range. The timeline uses a left-border colored by severity.

### 6.4 Internal status page
Page accessible without authentication (URL configurable, e.g., `/status`). Shows: overall status, per-service status (green/red), current incidents, last 90 days uptime bar per service. Minimal design, fast load. Embeddable as iframe. Updated in real-time via WebSocket.

### 6.5 Availability reports
Monthly/quarterly export:
- Uptime percentage per service
- Number of incidents
- MTTR (Mean Time To Resolve)
- MTTD (Mean Time To Detect)
- SLA compliance (met/breached)
- Incident details table
Format: PDF (auto-generated with `@react-pdf/renderer`) or CSV. Scheduled: auto-generate and email to admin on the 1st of each month.

---

## Category 7 -- Processes and Resources

### 7.1 Process list
Table listing active processes on a machine: PID, name, user, CPU%, memory%, state (running/sleeping/zombie), execution duration. Sortable by CPU or memory. Filterable by name or user. Refreshed every 10 seconds. Collected via the `sysinfo` crate on each monitored machine.

### 7.2 Top consumers
Recharts `BarChart` (horizontal) showing the top 10 processes by CPU consumption and top 10 by memory consumption. Updated in real-time. Click on a process bar to filter the process list to that process. The chart has a toggle: CPU / Memory.

### 7.3 Zombie process detection
Automatic identification of processes in zombie/defunct/hung state. Alert: "3 zombie processes detected on SRV-PROD-01: [process names]". Suggested action: restart the parent service or kill the process (admin action button, requires confirmation dialog).

### 7.4 Software inventory
List of software installed on each monitored machine: name, version, vendor, install date. Drift detection: compare two machines and highlight differences (software present on one but not the other, version mismatches). Link to the IT Assets module if activated. Exportable to CSV.

### 7.5 Hardware and temperature
If available via sensors (sysinfo crate): CPU temperature (Celsius), GPU temperature, fan speed (RPM), disk SMART status (healthy/warning/failing). Recharts `LineChart` for temperature over time. Alert on overheat: CPU > 80C for 5 minutes. Hardware info panel: CPU model, GPU model, RAM slots (used/total), disk models and capacities.

---

## Category 8 -- Configuration and Administration

### 8.1 Collection agents
Configuration of monitoring agents installed on target machines. Each agent reports metrics to `signapps-metrics` (port 3008) via authenticated REST API (`POST /api/v1/metrics/push`). Agent config: collection interval (default 5s), metrics to collect (CPU, memory, disk, network, processes, temperature), authentication token. Agent binary distributed from the admin panel.

### 8.2 Data retention policy
Configure retention for metric data:
- Raw data (per-second): 7 days (default)
- 1-minute aggregation (avg, min, max): 30 days
- 1-hour aggregation: 1 year
- 1-day aggregation: 5 years
Automatic purge runs daily at 3am via a cron job in `signapps-metrics`. Table partitioning by time range for efficient purging (`DROP PARTITION` instead of `DELETE`).

### 8.3 Machine groups
Organize machines into logical groups: "Production", "Development", "Network", "User Workstations". Dashboard filtering by group. Alert rules configurable per group (e.g., stricter thresholds for Production). Groups are managed via the admin panel. A machine can belong to multiple groups. Groups have an icon and color for visual distinction.

### 8.4 RBAC roles for monitoring
Access controlled by RBAC role:
- `admin`: full configuration (rules, retention, agents, groups), acknowledge alerts, view all data
- `operator`: acknowledge alerts, view all data, cannot configure rules
- `viewer`: read-only (dashboards, charts, logs), cannot acknowledge or configure
Standard users have no access to monitoring unless explicitly granted `viewer` role.

### 8.5 REST API integration
Documented REST API (OpenAPI via utoipa) for:
- Push custom metrics programmatically
- Query metric data (time series)
- Manage alert rules
- Query alert history
- Service health status
Used by deployment scripts, CI/CD pipelines, and third-party tools. Rate-limited to 1000 requests/minute per API key.

### 8.6 Outgoing webhooks
Webhook configuration for monitoring events:
- Alert created (with full context)
- Alert resolved
- Service down / Service up
- Maintenance window started / ended
Payload: JSON standardized. Headers: `X-Webhook-Secret` for verification. Retry: 3 attempts with exponential backoff. Webhook test button sends a test payload.

---

## Category 9 -- Dashboards and Visualization

### 9.1 Pre-configured dashboards
Default dashboards installed on first setup:
- **System Overview**: health banner, KPI gauges, service table, quick stats
- **SignApps Services**: service health cards, endpoint latency, error rates
- **Database**: connection pool, QPS, slow queries, cache hit ratio
- **Network**: per-interface traffic, errors, drops
- **Machine [hostname]**: all metrics for a specific machine

### 9.2 Custom dashboards
Admin can create custom dashboards by adding panels via drag-and-drop (`react-grid-layout`, MIT). Each panel is configurable: visualization type, data source (metric + machine + time range), threshold colors, refresh interval. Dashboard saved as JSON in the database. Dashboard CRUD: create, duplicate, rename, delete. Share a dashboard with other users by link.

### 9.3 Gauge panels (Recharts RadialBarChart)
Circular gauge for bounded metrics (CPU%, Memory%, Disk%). Color zones: green (0-70%), orange (70-90%), red (90-100%). Animated needle on value changes (300ms transition). Current value in large text at center. Label below (e.g., "CPU Usage"). Configurable min/max and zone thresholds.

### 9.4 Stat panels
Single large number with unit, trend arrow (up green/red depending on context), and sparkline (Recharts `AreaChart` 60px height). Example: "84.8% CPU" with red up arrow and 5-min sparkline. Background color changes subtly based on threshold (normal = `bg-card`, warning = `bg-orange-50`, critical = `bg-red-50`).

### 9.5 Table panels
Data table with configurable columns, sorting, filtering, and pagination. Used for process lists, log entries, alert history. Column configuration: drag to reorder, resize by dragging header borders, show/hide via column selector dropdown.

### 9.6 Heatmap panels
Color matrix visualizing temporal distribution of a metric (hours x days). Useful for identifying recurring load patterns (e.g., high CPU every weekday at 9am). Color scale: white (low) to dark blue/red (high). Cell hover shows exact value and time. Rendered with D3.js or Recharts custom.

### 9.7 TV / kiosk mode
Full-screen display optimized for wall-mounted screens. "TV Mode" button or keyboard shortcut `F11`. Features:
- No navigation bar, no sidebar
- Dark background for NOC (Network Operations Center)
- Auto-rotate between dashboards every N seconds (configurable, default 30s)
- Large fonts, high contrast
- Clock displayed in the corner
- Alert banner is always visible even in kiosk mode
Exit: press `Escape` or move mouse to top of screen for 3 seconds.

---

## Category 10 -- PostgreSQL Schema

### 10.1 metric_data table (partitioned)
```sql
CREATE TABLE metric_data (
    id              BIGSERIAL,
    machine_id      UUID NOT NULL REFERENCES machines(id),
    metric_name     TEXT NOT NULL,  -- 'cpu_usage', 'memory_used', 'disk_io_read', etc.
    value           DOUBLE PRECISION NOT NULL,
    labels          JSONB NOT NULL DEFAULT '{}',  -- { "core": "0", "interface": "eth0" }
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Partitions created monthly
CREATE TABLE metric_data_2026_04 PARTITION OF metric_data
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX idx_metric_data_machine ON metric_data (machine_id, metric_name, recorded_at DESC);
CREATE INDEX idx_metric_data_name ON metric_data (metric_name, recorded_at DESC);
```

### 10.2 metric_data_aggregated table
```sql
CREATE TABLE metric_data_aggregated (
    id              BIGSERIAL PRIMARY KEY,
    machine_id      UUID NOT NULL REFERENCES machines(id),
    metric_name     TEXT NOT NULL,
    interval        TEXT NOT NULL,  -- '1m', '1h', '1d'
    avg_value       DOUBLE PRECISION NOT NULL,
    min_value       DOUBLE PRECISION NOT NULL,
    max_value       DOUBLE PRECISION NOT NULL,
    sample_count    INTEGER NOT NULL,
    labels          JSONB NOT NULL DEFAULT '{}',
    period_start    TIMESTAMPTZ NOT NULL,
    period_end      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_metric_agg_query ON metric_data_aggregated (machine_id, metric_name, interval, period_start DESC);
```

### 10.3 machines table
```sql
CREATE TABLE machines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    hostname        TEXT NOT NULL,
    ip_address      INET,
    os_name         TEXT,
    os_version      TEXT,
    cpu_model       TEXT,
    cpu_cores       INTEGER,
    total_memory_gb DOUBLE PRECISION,
    total_disk_gb   DOUBLE PRECISION,
    agent_version   TEXT,
    last_heartbeat  TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'unknown',  -- 'online', 'degraded', 'offline', 'unknown'
    groups          TEXT[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_machines_org ON machines (org_id);
CREATE INDEX idx_machines_status ON machines (status);
```

### 10.4 alert_rules table
```sql
CREATE TABLE alert_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,
    metric_name     TEXT NOT NULL,
    operator        TEXT NOT NULL,  -- '>', '<', '=', '!='
    threshold       DOUBLE PRECISION NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,  -- 0 = instant
    severity        TEXT NOT NULL DEFAULT 'warning',  -- 'info', 'warning', 'critical'
    target_type     TEXT NOT NULL DEFAULT 'all',  -- 'all', 'machine', 'service', 'group'
    target_id       UUID,  -- machine_id, service name reference, or null for 'all'
    target_group    TEXT,  -- machine group name if target_type = 'group'
    enabled         BOOLEAN NOT NULL DEFAULT true,
    notification_channels JSONB NOT NULL DEFAULT '["in_app"]',
    escalation_minutes INTEGER DEFAULT 15,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_rules_org ON alert_rules (org_id) WHERE enabled = true;
```

### 10.5 alert_events table
```sql
CREATE TABLE alert_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id         UUID NOT NULL REFERENCES alert_rules(id),
    machine_id      UUID REFERENCES machines(id),
    service_name    TEXT,
    severity        TEXT NOT NULL,
    metric_value    DOUBLE PRECISION NOT NULL,
    threshold       DOUBLE PRECISION NOT NULL,
    message         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',  -- 'active', 'acknowledged', 'resolved', 'flapping'
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    ack_comment     TEXT,
    resolved_at     TIMESTAMPTZ,
    group_id        UUID,  -- for alert grouping
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_events_status ON alert_events (status, created_at DESC);
CREATE INDEX idx_alert_events_machine ON alert_events (machine_id, created_at DESC);
CREATE INDEX idx_alert_events_rule ON alert_events (rule_id, created_at DESC);
```

### 10.6 service_health table
```sql
CREATE TABLE service_health (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name    TEXT NOT NULL,
    port            INTEGER NOT NULL,
    status          TEXT NOT NULL,  -- 'healthy', 'degraded', 'unhealthy', 'stopped'
    version         TEXT,
    uptime_seconds  BIGINT,
    response_time_ms INTEGER,
    last_error      TEXT,
    checks          JSONB NOT NULL DEFAULT '{}',
    metrics         JSONB NOT NULL DEFAULT '{}',
    checked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_health_name ON service_health (service_name, checked_at DESC);
```

### 10.7 maintenance_windows table
```sql
CREATE TABLE maintenance_windows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    description     TEXT NOT NULL,
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ NOT NULL,
    target_type     TEXT NOT NULL,  -- 'machine', 'service', 'group', 'all'
    target_ids      UUID[] NOT NULL DEFAULT '{}',
    target_names    TEXT[] NOT NULL DEFAULT '{}',
    created_by      UUID NOT NULL REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'scheduled',  -- 'scheduled', 'active', 'completed', 'cancelled'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_active ON maintenance_windows (start_at, end_at) WHERE status IN ('scheduled', 'active');
```

### 10.8 metric_baselines table
```sql
CREATE TABLE metric_baselines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id      UUID NOT NULL REFERENCES machines(id),
    metric_name     TEXT NOT NULL,
    day_of_week     SMALLINT NOT NULL,  -- 0=Sunday, 6=Saturday
    hour_of_day     SMALLINT NOT NULL,  -- 0-23
    mean_value      DOUBLE PRECISION NOT NULL,
    std_deviation   DOUBLE PRECISION NOT NULL,
    sample_count    INTEGER NOT NULL,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (machine_id, metric_name, day_of_week, hour_of_day)
);
```

### 10.9 endpoint_metrics table
```sql
CREATE TABLE endpoint_metrics (
    id              BIGSERIAL PRIMARY KEY,
    service_name    TEXT NOT NULL,
    method          TEXT NOT NULL,  -- 'GET', 'POST', etc.
    path            TEXT NOT NULL,
    status_code     INTEGER NOT NULL,
    duration_ms     INTEGER NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_endpoint_metrics_service ON endpoint_metrics (service_name, path, recorded_at DESC);
CREATE INDEX idx_endpoint_metrics_slow ON endpoint_metrics (duration_ms DESC) WHERE duration_ms > 1000;
```

---

## Category 11 -- REST API Endpoints

### 11.1 Metric push
```
POST /api/v1/metrics/push
Body: { machine_id: uuid, metrics: [{ name: string, value: number, labels: object, timestamp: iso8601 }] }
Response 201: { accepted: number }
Response 400: { error: "Invalid metric format" }
Auth: Agent token (X-Agent-Token header).
```

### 11.2 Metric query
```
GET /api/v1/metrics/query
Query params: machine_id (uuid), metric_name (string), from (iso8601), to (iso8601),
              interval (raw|1m|5m|1h|1d), labels (json)
Response 200: { data_points: [{ timestamp, value, min, max }], meta: { count, interval } }
Auth: Bearer JWT required. Role: viewer+.
```

### 11.3 Machine management
```
GET    /api/v1/monitoring/machines           -- list all machines (with status)
GET    /api/v1/monitoring/machines/:id       -- machine detail + latest metrics
POST   /api/v1/monitoring/machines           -- register new machine
PUT    /api/v1/monitoring/machines/:id       -- update machine info
DELETE /api/v1/monitoring/machines/:id       -- deregister machine
PATCH  /api/v1/monitoring/machines/:id/groups -- update groups
Auth: Bearer JWT required. Role: admin for POST/PUT/DELETE, viewer+ for GET.
```

### 11.4 Service health
```
GET /api/v1/monitoring/services              -- list all services with latest health
GET /api/v1/monitoring/services/:name        -- service detail (health history, endpoint metrics)
GET /api/v1/monitoring/services/:name/endpoints -- endpoint latency breakdown
Auth: Bearer JWT required. Role: viewer+.
```

### 11.5 Alert rules CRUD
```
GET    /api/v1/monitoring/alerts/rules       -- list rules
POST   /api/v1/monitoring/alerts/rules       -- create rule
PUT    /api/v1/monitoring/alerts/rules/:id   -- update rule
DELETE /api/v1/monitoring/alerts/rules/:id   -- delete rule
PATCH  /api/v1/monitoring/alerts/rules/:id/toggle -- enable/disable
Auth: Bearer JWT required. Role: admin only.
```

### 11.6 Alert events
```
GET   /api/v1/monitoring/alerts/events       -- list alert events (filters: status, severity, machine, from, to)
PATCH /api/v1/monitoring/alerts/events/:id/ack    -- acknowledge alert { comment: string }
GET   /api/v1/monitoring/alerts/events/active     -- list active alerts only
Auth: Bearer JWT required. Role: operator+ for ack, viewer+ for list.
```

### 11.7 Maintenance windows
```
GET    /api/v1/monitoring/maintenance        -- list windows
POST   /api/v1/monitoring/maintenance        -- create window
PUT    /api/v1/monitoring/maintenance/:id    -- update window
DELETE /api/v1/monitoring/maintenance/:id    -- cancel window
Auth: Bearer JWT required. Role: admin only.
```

### 11.8 Dashboard CRUD
```
GET    /api/v1/monitoring/dashboards         -- list dashboards
GET    /api/v1/monitoring/dashboards/:id     -- get dashboard JSON
POST   /api/v1/monitoring/dashboards         -- create dashboard { name, layout_json }
PUT    /api/v1/monitoring/dashboards/:id     -- update dashboard
DELETE /api/v1/monitoring/dashboards/:id     -- delete dashboard
Auth: Bearer JWT required. Role: admin for CUD, viewer+ for read.
```

### 11.9 Status page (public)
```
GET /status                                  -- public status page HTML
GET /api/v1/monitoring/status                -- public status JSON (no auth required)
Response 200: { overall: "operational", services: [{ name, status, uptime_7d, uptime_30d }], incidents: [...] }
```

### 11.10 Log viewer
```
GET /api/v1/monitoring/logs
Query params: service (string[]), level (string[]), search (text), from (iso8601), to (iso8601),
              page (int), per_page (int, max 100)
Response 200: { logs: [{ timestamp, service, level, message, trace_id, span_id }], total: number }
Auth: Bearer JWT required. Role: viewer+.
```

---

## Category 12 -- PgEventBus Events

### 12.1 Events consumed by monitoring
| Event | Source | Action |
|---|---|---|
| `service.started` | Any service | Record service UP status |
| `service.stopped` | Any service | Record service DOWN status, trigger alert check |
| `service.health.degraded` | Any service | Record degraded status |

### 12.2 Events emitted by monitoring
| Event | Trigger | Payload |
|---|---|---|
| `monitoring.alert.triggered` | Alert rule fires | `{ alert_event_id, rule_id, severity, machine_id, metric, value, threshold }` |
| `monitoring.alert.resolved` | Metric returns below threshold | `{ alert_event_id, rule_id, resolved_at, duration_seconds }` |
| `monitoring.alert.acknowledged` | User acknowledges alert | `{ alert_event_id, user_id, comment }` |
| `monitoring.service.down` | Health check fails 3x | `{ service_name, port, last_error }` |
| `monitoring.service.up` | Health check recovers | `{ service_name, port }` |
| `monitoring.anomaly.detected` | AI detects deviation | `{ machine_id, metric, value, baseline, z_score }` |
| `monitoring.saturation.predicted` | AI predicts saturation | `{ machine_id, metric, days_until_full }` |
| `monitoring.maintenance.started` | Window starts | `{ window_id, targets }` |
| `monitoring.maintenance.ended` | Window ends | `{ window_id, targets }` |

---

## Category 13 -- Inter-Module Integration

### 13.1 Integration with signapps-notifications (port 8095)
Alert notifications (email, push, webhook) are dispatched via PgEventBus event `monitoring.alert.triggered` consumed by `signapps-notifications`. The notification payload includes: recipient list, channel (email/push/webhook), template name, and context data. SMS alerts use a dedicated notification channel.

### 13.2 Integration with signapps-ai (port 3005)
Used for: (1) anomaly detection baseline computation via statistical analysis, (2) saturation prediction via trend analysis, (3) incident summary generation in natural language, (4) anomaly correlation. All calls via REST API: `POST /api/v1/ai/analyze` for time-series analysis, `POST /api/v1/ai/summarize` for natural language summaries.

### 13.3 Integration with signapps-identity (port 3001)
RBAC roles (admin, operator, viewer) are managed by the identity service. Monitoring respects the same JWT claims for authorization. User avatars and names in the alert acknowledgment UI come from identity.

### 13.4 Integration with signapps-it-assets
Machine inventory syncs with the IT Assets module. Machines registered in monitoring are automatically visible in IT Assets. Software inventory from monitoring feeds the IT Assets software catalog. Hardware info (CPU model, RAM, disks) is shared.

### 13.5 Integration with all microservices (health checks)
Every SignApps service must implement the `GET /health` endpoint following the schema defined in section 5.1. The `signapps-metrics` service discovers services from a static config (list of service_name + port) or via PgEventBus `service.started` events.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Grafana Documentation** (grafana.com/docs) -- documentation exhaustive sur les dashboards, panneaux, alerting, data sources, provisioning.
- **Prometheus Documentation** (prometheus.io/docs) -- guides sur PromQL, alerting rules, recording rules, federation.
- **Datadog Documentation** (docs.datadoghq.com) -- guides sur l'APM, l'infrastructure monitoring, les anomaly monitors, les SLOs.
- **Netdata Learn** (learn.netdata.cloud) -- documentation sur le monitoring per-second, les anomaly advisors, les composite charts.
- **Zabbix Documentation** (zabbix.com/documentation) -- guides sur les triggers, les templates, l'auto-discovery, les SLA reports.
- **Better Stack Blog** (betterstack.com/community) -- guides sur les status pages, l'incident management, les bonnes pratiques d'alerte.
- **Healthchecks.io Documentation** (healthchecks.io/docs) -- documentation sur le cron monitoring, les grace periods, les badges.
- **SRE Book (Google)** (sre.google/sre-book) -- chapitres publics sur le monitoring, les SLIs/SLOs/SLAs, l'alerting, l'incident response.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Prometheus** (github.com/prometheus/prometheus) | **Apache-2.0** | Modele de donnees metriques (labels, timestamps), PromQL, alerting rules. Reference architecturale. |
| **Netdata** (github.com/netdata/netdata) | **GPL-3.0** | **INTERDIT** (GPL). Ne pas utiliser ni copier. Etudier les docs publiques pour les patterns de metriques temps reel. |
| **Grafana** (github.com/grafana/grafana) | **AGPL-3.0** | **INTERDIT** (AGPL). Ne pas utiliser ni copier. Etudier les docs publiques pour les patterns de dashboards et panneaux. |
| **VictoriaMetrics** (github.com/VictoriaMetrics/VictoriaMetrics) | **Apache-2.0** | Time-series database performante. Pattern pour le stockage et la compression des metriques. |
| **sysinfo** (github.com/GuillaumeGomez/sysinfo) | **MIT** | Crate Rust pour recuperer les informations systeme (CPU, RAM, disques, processus, temperature). Utilisation directe possible. |
| **Chart.js** (chartjs.org) | **MIT** | Graphiques canvas pour les gauges, sparklines, graphiques de metriques. Deja utilise dans SignApps. |
| **Apache ECharts** (echarts.apache.org) | **Apache-2.0** | Graphiques riches : heatmaps, gauges circulaires, graphiques temps reel avec DataZoom. |
| **D3.js** (d3js.org) | **BSD-3-Clause** | Visualisations custom (topologie reseau, heatmaps, timelines). Pattern pour les panneaux avances. |
| **Recharts** (recharts.org) | **MIT** | Graphiques React declaratifs pour les sparklines et les charts temps reel. |
| **react-grid-layout** (github.com/react-grid-layout/react-grid-layout) | **MIT** | Grille de panneaux drag-and-drop. Pattern pour les dashboards personnalisables. |
| **date-fns** (date-fns.org) | **MIT** | Manipulation de dates/durees pour les plages temporelles et les calculs d'uptime. |

### Pattern d'implementation recommande
1. **Collection** : crate `sysinfo` (MIT) dans un agent Rust embarque dans `signapps-metrics` (port 3008). Metriques exposees via API REST + WebSocket.
2. **Stockage** : metriques en time-series dans PostgreSQL avec table partitionnee par temps. Retention configurable avec aggregation downsampling.
3. **Alertes** : evaluation des regles de seuil dans `signapps-metrics`. Notifications via PgEventBus -> `signapps-notifications` (port 8095).
4. **AI Anomaly** : baselines calculees par `signapps-ai` (port 3005) sur les series temporelles. Modele statistique (z-score, IQR) pour la detection.
5. **Dashboards** : `react-grid-layout` (MIT) pour le layout. Recharts pour les graphiques. WebSocket pour le mode Live.
6. **Health checks** : chaque service expose `/health` (deja en place via Axum). `signapps-metrics` poll toutes les 30s et stocke les resultats.

---

## Assertions E2E cles (a tester)

- The monitoring dashboard displays the global health status (Operational / Degraded / Incident)
- The 4 KPIs (CPU, Memory, Disk, Uptime) display coherent values with animated gauges
- CPU gauge color changes from green to orange at 70% and red at 90%
- The real-time CPU chart updates in Live mode via WebSocket
- The Memory chart distinguishes used / available / cache / swap
- The time range selector (5min, 1h, 24h, 7d, 30d) recalculates all charts with correct aggregation
- The services table lists all microservices with their status, response time, and uptime
- A stopped service appears with red "Stopped" badge in the services table
- The topology map shows service-to-service connections with color-coded edges
- The CPU > 90% rule triggers a critical alert when the threshold is exceeded for 5 minutes
- The toggle on/off of an alert rule disables/enables triggering
- Acknowledging an alert changes its status from "Active" to "Acknowledged" with user name
- Alert history displays past alerts with date, duration, severity, and resolution
- A maintenance window suppresses alerts for targeted services during the window period
- AI anomaly detection flags unusual behavior with baseline comparison
- Saturation prediction displays estimated date of disk full with projected dashed line
- AI incident summary is coherent and mentions the involved metrics and probable cause
- Uptime per service displays a percentage over 7d and 30d with status bar segments
- The internal status page is accessible without authentication at /status
- The process list displays processes sorted by CPU or memory consumption
- Zombie process detection alerts when zombie processes are found
- Custom dashboards allow adding and removing panels via drag-and-drop
- TV/kiosk mode displays the dashboard in full-screen without navigation
- Gauge panels display color zones (green/orange/red) correctly
- WebSocket pushes real-time updates without visible polling
- Chart export to PNG produces a readable image
- CSV export of metric data contains correct timestamp and value columns
- Filtering by machine group restricts the data displayed to that group
- RBAC roles restrict access: viewers cannot configure alert rules
- Alert webhook is triggered with correct JSON payload when an alert fires
- Flap detection aggregates oscillating alerts into a single flapping alert
- Alert escalation notifies the next level after N minutes without acknowledgment
- Database connection pool stats show active/idle connections and slow queries
- PgEventBus metrics show queue depth and processing throughput
- Storage quota monitoring alerts at 80% and 95% usage
