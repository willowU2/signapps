/**
 * IT Assets API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from './factory';

// Get the IT assets service client (cached)
const itAssetsClient = getClient(ServiceName.IT_ASSETS);

// ============================================================================
// Types
// ============================================================================

export interface HardwareAsset {
    id: string;
    name: string;
    type: string;
    manufacturer?: string;
    model?: string;
    serial_number?: string;
    purchase_date?: string;
    warranty_expires?: string;
    status?: string;
    location?: string;
    assigned_user_id?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface CreateHardwareRequest {
    name: string;
    type: string;
    manufacturer?: string;
    model?: string;
    serial_number?: string;
    purchase_date?: string;
    warranty_expires?: string;
    location?: string;
    notes?: string;
}

export interface UpdateHardwareRequest {
    name?: string;
    status?: string;
    location?: string;
    assigned_user_id?: string;
    notes?: string;
}

// ─── Wake-on-LAN ──────────────────────────────────────────────────────────────

export interface WolResponse {
    ok: boolean;
    message: string;
    mac_address?: string;
}

// ─── Agent Commands ───────────────────────────────────────────────────────────

export type CommandType = 'reboot' | 'shutdown' | 'lock' | 'run_script' | 'message';

export interface AgentCommand {
    id: string;
    hardware_id: string;
    agent_id?: string;
    command: CommandType;
    parameters: Record<string, unknown>;
    status: 'pending' | 'sent' | 'acknowledged' | 'done' | 'failed';
    created_at: string;
    sent_at?: string;
    acknowledged_at?: string;
    completed_at?: string;
    result: Record<string, unknown>;
}

export interface QueueCommandRequest {
    hardware_id: string;
    command: CommandType;
    parameters?: Record<string, unknown>;
}

// ─── File Transfers ───────────────────────────────────────────────────────────

export interface FileTransfer {
    id: string;
    hardware_id: string;
    direction: 'push' | 'pull';
    filename: string;
    size_bytes?: number;
    mime_type?: string;
    storage_path?: string;
    target_path?: string;
    status: 'pending' | 'transferring' | 'done' | 'failed';
    created_at: string;
    started_at?: string;
    completed_at?: string;
    error_message?: string;
}

export interface PushFileRequest {
    hardware_id: string;
    filename: string;
    target_path: string;
    content_base64?: string;
    size_bytes?: number;
    mime_type?: string;
}

// ─── Network Discovery ────────────────────────────────────────────────────────

export interface NetworkDiscovery {
    id: string;
    subnet: string;
    ip_address: string;
    mac_address?: string;
    hostname?: string;
    os_guess?: string;
    response_time_ms?: number;
    open_ports: number[];
    first_seen: string;
    last_seen: string;
    hardware_id?: string;
}

export interface ScanResult {
    subnet: string;
    hosts_scanned: number;
    hosts_found: number;
    discoveries: Array<{
        ip: string;
        mac_address?: string;
        hostname?: string;
        os_guess?: string;
        response_time_ms: number;
        open_ports: number[];
    }>;
}

export interface PortScanResult {
    ip: string;
    open_ports: number[];
    closed_ports: number[];
    duration_ms: number;
}

// ─── Patch Management ────────────────────────────────────────────────────────

export interface Patch {
    id: string;
    hardware_id: string;
    patch_id: string;
    title: string;
    severity?: 'critical' | 'important' | 'moderate' | 'low' | 'unknown';
    kb_number?: string;
    category?: string;
    size_bytes?: number;
    detected_at: string;
    status: 'pending' | 'approved' | 'deployed' | 'installed' | 'rejected';
    approved_at?: string;
    deployed_at?: string;
    installed_at?: string;
}

export interface PatchComplianceStats {
    total_machines: number;
    fully_patched: number;
    pending_patches: number;
    critical_pending: number;
    compliance_pct: number;
    by_severity: Array<{ severity: string; count: number }>;
}

// ============================================================================
// IT Assets API
// ============================================================================

export const itAssetsApi = {
    // List all hardware assets
    listHardware: () =>
        itAssetsClient.get<HardwareAsset[]>('/it-assets/hardware'),

    // Get a single hardware asset
    getHardware: (id: string) =>
        itAssetsClient.get<HardwareAsset>(`/it-assets/hardware/${id}`),

    // Create a new hardware asset
    createHardware: (data: CreateHardwareRequest) =>
        itAssetsClient.post<HardwareAsset>('/it-assets/hardware', data),

    // Update a hardware asset
    updateHardware: (id: string, data: UpdateHardwareRequest) =>
        itAssetsClient.put<HardwareAsset>(`/it-assets/hardware/${id}`, data),

    // Delete a hardware asset
    deleteHardware: (id: string) =>
        itAssetsClient.delete(`/it-assets/hardware/${id}`),

    // RM2: Wake-on-LAN
    wakeOnLan: (id: string) =>
        itAssetsClient.post<WolResponse>(`/it-assets/hardware/${id}/wake`, {}),

    // RM3: Agent commands
    queueCommand: (data: QueueCommandRequest) =>
        itAssetsClient.post<AgentCommand>('/it-assets/agent/commands/queue', data),

    listHardwareCommands: (hardwareId: string) =>
        itAssetsClient.get<AgentCommand[]>(`/it-assets/hardware/${hardwareId}/commands`),

    // RM4: File transfers
    pushFile: (data: PushFileRequest) =>
        itAssetsClient.post<FileTransfer>('/it-assets/agent/files/push', data),

    listHardwareFiles: (hardwareId: string) =>
        itAssetsClient.get<FileTransfer[]>(`/it-assets/hardware/${hardwareId}/files`),

    // ND1: Network scanner
    scanNetwork: (subnet: string, timeoutMs?: number) =>
        itAssetsClient.post<ScanResult>('/it-assets/network/scan', { subnet, timeout_ms: timeoutMs }),

    listDiscoveries: () =>
        itAssetsClient.get<NetworkDiscovery[]>('/it-assets/network/discoveries'),

    addDiscoveryToInventory: (discoveryId: string, name: string, assetType?: string) =>
        itAssetsClient.post(`/it-assets/network/discoveries/${discoveryId}/add-to-inventory`, {
            discovery_id: discoveryId,
            name,
            asset_type: assetType,
        }),

    // ND4: Port scanner
    portScan: (ip: string, ports: number[], timeoutMs?: number) =>
        itAssetsClient.post<PortScanResult>('/it-assets/network/port-scan', {
            ip,
            ports,
            timeout_ms: timeoutMs,
        }),

    // PM2: List all patches
    listPatches: () =>
        itAssetsClient.get<Patch[]>('/it-assets/patches'),

    // PM3: Approve patch
    approvePatch: (id: string) =>
        itAssetsClient.post(`/it-assets/patches/${id}/approve`, {}),

    // PM3: Reject patch
    rejectPatch: (id: string) =>
        itAssetsClient.post(`/it-assets/patches/${id}/reject`, {}),

    // PM4: Deploy patch
    deployPatch: (id: string, hardwareIds?: string[]) =>
        itAssetsClient.post(`/it-assets/patches/${id}/deploy`, { hardware_ids: hardwareIds }),

    // PM5: Compliance stats
    patchCompliance: () =>
        itAssetsClient.get<PatchComplianceStats>('/it-assets/patches/compliance'),

    // MD1: Metrics
    getMetrics: (hwId: string, range?: string) =>
        itAssetsClient.get<AgentMetric[]>(`/it-assets/hardware/${hwId}/metrics${range ? `?range=${range}` : ''}`),

    // MD2: Alert rules
    listAlertRules: () =>
        itAssetsClient.get<AlertRule[]>('/it-assets/alert-rules'),
    createAlertRule: (data: CreateAlertRuleRequest) =>
        itAssetsClient.post<AlertRule>('/it-assets/alert-rules', data),
    deleteAlertRule: (id: string) =>
        itAssetsClient.delete(`/it-assets/alert-rules/${id}`),
    listAlerts: () =>
        itAssetsClient.get<ITAlert[]>('/it-assets/alerts'),
    resolveAlert: (id: string) =>
        itAssetsClient.post(`/it-assets/alerts/${id}/resolve`, {}),

    // MD3: Event logs
    getEventLogs: (hwId: string, params?: { level?: string; search?: string; limit?: number }) => {
        const q = new URLSearchParams();
        if (params?.level) q.set('level', params.level);
        if (params?.search) q.set('search', params.search);
        if (params?.limit) q.set('limit', String(params.limit));
        const qs = q.toString();
        return itAssetsClient.get<EventLog[]>(`/it-assets/hardware/${hwId}/logs${qs ? `?${qs}` : ''}`);
    },

    // MD4: Fleet overview
    getFleetOverview: () =>
        itAssetsClient.get<FleetOverview>('/it-assets/fleet'),

    // BK1: Components
    listComponents: (hwId: string) =>
        itAssetsClient.get<HardwareComponent[]>(`/it-assets/hardware/${hwId}/components`),
    createComponent: (hwId: string, data: CreateComponentRequest) =>
        itAssetsClient.post<HardwareComponent>(`/it-assets/hardware/${hwId}/components`, data),
    updateComponent: (id: string, data: Partial<CreateComponentRequest>) =>
        itAssetsClient.put<HardwareComponent>(`/it-assets/components/${id}`, data),
    deleteComponent: (id: string) =>
        itAssetsClient.delete(`/it-assets/components/${id}`),

    // BK2: Software licenses
    listLicenses: () =>
        itAssetsClient.get<LicenseWithUsage[]>('/it-assets/licenses'),
    getLicense: (id: string) =>
        itAssetsClient.get<SoftwareLicense>(`/it-assets/licenses/${id}`),
    createLicense: (data: CreateLicenseRequest) =>
        itAssetsClient.post<SoftwareLicense>('/it-assets/licenses', data),
    updateLicense: (id: string, data: Partial<CreateLicenseRequest>) =>
        itAssetsClient.put<SoftwareLicense>(`/it-assets/licenses/${id}`, data),
    deleteLicense: (id: string) =>
        itAssetsClient.delete(`/it-assets/licenses/${id}`),

    // BK3: Network interfaces
    listNetworkInterfaces: (hwId: string) =>
        itAssetsClient.get<NetworkInterfaceAsset[]>(`/it-assets/hardware/${hwId}/interfaces`),
    createNetworkInterface: (hwId: string, data: CreateNetworkInterfaceRequest) =>
        itAssetsClient.post<NetworkInterfaceAsset>(`/it-assets/hardware/${hwId}/interfaces`, data),
    updateNetworkInterface: (id: string, data: Partial<CreateNetworkInterfaceRequest>) =>
        itAssetsClient.put<NetworkInterfaceAsset>(`/it-assets/interfaces/${id}`, data),
    deleteNetworkInterface: (id: string) =>
        itAssetsClient.delete(`/it-assets/interfaces/${id}`),

    // BK4: Maintenance windows
    listMaintenanceWindows: () =>
        itAssetsClient.get<MaintenanceWindow[]>('/it-assets/maintenance-windows'),
    createMaintenanceWindow: (data: CreateMaintenanceWindowRequest) =>
        itAssetsClient.post<MaintenanceWindow>('/it-assets/maintenance-windows', data),
    updateMaintenanceWindow: (id: string, data: Partial<CreateMaintenanceWindowRequest>) =>
        itAssetsClient.put<MaintenanceWindow>(`/it-assets/maintenance-windows/${id}`, data),
    deleteMaintenanceWindow: (id: string) =>
        itAssetsClient.delete(`/it-assets/maintenance-windows/${id}`),

    // CM1: CMDB
    listCIs: () =>
        itAssetsClient.get<ConfigurationItem[]>('/it-assets/cmdb/cis'),
    getCI: (id: string) =>
        itAssetsClient.get<ConfigurationItem>(`/it-assets/cmdb/cis/${id}`),
    createCI: (data: CreateCIRequest) =>
        itAssetsClient.post<ConfigurationItem>('/it-assets/cmdb/cis', data),
    updateCI: (id: string, data: Partial<CreateCIRequest>) =>
        itAssetsClient.put<ConfigurationItem>(`/it-assets/cmdb/cis/${id}`, data),
    deleteCI: (id: string) =>
        itAssetsClient.delete(`/it-assets/cmdb/cis/${id}`),
    listCIRelationships: (ciId: string) =>
        itAssetsClient.get<CIRelationship[]>(`/it-assets/cmdb/cis/${ciId}/relationships`),
    createCIRelationship: (data: CreateCIRelationshipRequest) =>
        itAssetsClient.post<CIRelationship>('/it-assets/cmdb/relationships', data),
    deleteCIRelationship: (id: string) =>
        itAssetsClient.delete(`/it-assets/cmdb/relationships/${id}`),
    getCIImpact: (id: string) =>
        itAssetsClient.get<ConfigurationItem[]>(`/it-assets/cmdb/cis/${id}/impact`),

    // CM3: Change requests
    listChangeRequests: () =>
        itAssetsClient.get<ChangeRequest[]>('/it-assets/changes'),
    getChangeRequest: (id: string) =>
        itAssetsClient.get<ChangeRequest>(`/it-assets/changes/${id}`),
    createChangeRequest: (data: CreateChangeRequestInput) =>
        itAssetsClient.post<ChangeRequest>('/it-assets/changes', data),
    updateChangeStatus: (id: string, status: string, actorId?: string) =>
        itAssetsClient.put<ChangeRequest>(`/it-assets/changes/${id}/status`, { status, actor_id: actorId }),

    // SE1: AV status
    getAntivirusStatus: (hwId: string) =>
        itAssetsClient.get<AntivirusStatus>(`/it-assets/hardware/${hwId}/security/antivirus`),
    getAvFleetSummary: () =>
        itAssetsClient.get<AvFleetSummary>('/it-assets/fleet/security/av'),

    // SE2: Encryption status
    getEncryptionStatus: (hwId: string) =>
        itAssetsClient.get<EncryptionStatus[]>(`/it-assets/hardware/${hwId}/security/encryption`),
    getEncryptionFleetSummary: () =>
        itAssetsClient.get<EncryptionFleetSummary>('/it-assets/fleet/security/encryption'),

    // #51: PSA Ticketing
    listTickets: (filters?: { status?: string; priority?: string; assigned_to?: string; hardware_id?: string }) => {
        const q = new URLSearchParams();
        if (filters?.status) q.set('status', filters.status);
        if (filters?.priority) q.set('priority', filters.priority);
        if (filters?.assigned_to) q.set('assigned_to', filters.assigned_to);
        if (filters?.hardware_id) q.set('hardware_id', filters.hardware_id);
        const qs = q.toString();
        return itAssetsClient.get<Ticket[]>(`/it-assets/tickets${qs ? `?${qs}` : ''}`);
    },
    getTicketStats: () =>
        itAssetsClient.get<TicketStats>('/it-assets/tickets/stats'),
    createTicket: (data: CreateTicketRequest) =>
        itAssetsClient.post<Ticket>('/it-assets/tickets', data),
    getTicket: (id: string) =>
        itAssetsClient.get<TicketDetail>(`/it-assets/tickets/${id}`),
    updateTicket: (id: string, data: Partial<CreateTicketRequest> & { status?: string }) =>
        itAssetsClient.patch<Ticket>(`/it-assets/tickets/${id}`, data),
    addTicketComment: (id: string, data: { content: string; author_name?: string; is_internal?: boolean }) =>
        itAssetsClient.post<TicketComment>(`/it-assets/tickets/${id}/comments`, data),
    logTicketTime: (id: string, data: { duration_minutes: number; description?: string; billable?: boolean }) =>
        itAssetsClient.post<TicketTimeEntry>(`/it-assets/tickets/${id}/time`, data),

    // #11: Per-device documentation
    listDeviceDocs: (hwId: string) =>
        itAssetsClient.get<DeviceDoc[]>(`/it-assets/hardware/${hwId}/docs`),
    createDeviceDoc: (hwId: string, data: { title: string; content?: string; doc_type?: string }) =>
        itAssetsClient.post<DeviceDoc>(`/it-assets/hardware/${hwId}/docs`, data),

    // #12: Health score
    getHealthScore: (hwId: string) =>
        itAssetsClient.get<HealthScore>(`/it-assets/hardware/${hwId}/health-score`),

    // #20: Software policies
    listSoftwarePolicies: () =>
        itAssetsClient.get<SoftwarePolicy[]>('/it-assets/software-policies'),
    createSoftwarePolicy: (data: { name: string; mode: string; patterns: string[]; action: string }) =>
        itAssetsClient.post<SoftwarePolicy>('/it-assets/software-policies', data),
    checkSoftwareCompliance: (hwId: string) =>
        itAssetsClient.get<SoftwarePolicyCheckResult>(`/it-assets/hardware/${hwId}/software-check`),

    // #21: Remediation playbooks
    listPlaybooks: () =>
        itAssetsClient.get<Playbook[]>('/it-assets/playbooks'),
    createPlaybook: (data: { name: string; description?: string; steps: PlaybookStep[] }) =>
        itAssetsClient.post<Playbook>('/it-assets/playbooks', data),
    getPlaybook: (id: string) =>
        itAssetsClient.get<Playbook>(`/it-assets/playbooks/${id}`),
    updatePlaybook: (id: string, data: Partial<{ name: string; description?: string; steps: PlaybookStep[]; enabled: boolean }>) =>
        itAssetsClient.put<Playbook>(`/it-assets/playbooks/${id}`, data),
    deletePlaybook: (id: string) =>
        itAssetsClient.delete(`/it-assets/playbooks/${id}`),
    runPlaybook: (id: string, data: { hardware_id?: string }) =>
        itAssetsClient.post<PlaybookRun>(`/it-assets/playbooks/${id}/run`, data),
    listPlaybookRuns: (id: string) =>
        itAssetsClient.get<PlaybookRun[]>(`/it-assets/playbooks/${id}/runs`),

    // #24: Services monitoring
    listHardwareServices: (hwId: string) =>
        itAssetsClient.get<ServiceEntry[]>(`/it-assets/hardware/${hwId}/services`),

    // #26: Session recordings
    listRecordings: (hwId: string) =>
        itAssetsClient.get<SessionRecording[]>(`/it-assets/hardware/${hwId}/recordings`),

    // #27: Remote file browser
    listRemoteFiles: (agentId: string, path: string) =>
        itAssetsClient.get<RemoteFileEntry[]>(`/it-assets/agent/${agentId}/files/list?path=${encodeURIComponent(path)}`),

    agentCommand: (agentId: string, data: { action: string; path?: string }) =>
        itAssetsClient.post(`/it-assets/agent/commands/queue`, { agent_id: agentId, ...data }),

    // #28: Bandwidth metrics (included in regular metrics endpoint with network_interfaces)

    // #29: PSA integrations
    listPsaIntegrations: () =>
        itAssetsClient.get<PsaIntegration[]>('/it-assets/psa-integrations'),
    createPsaIntegration: (data: CreatePsaIntegrationRequest) =>
        itAssetsClient.post<PsaIntegration>('/it-assets/psa-integrations', data),
    updatePsaIntegration: (id: string, data: Partial<CreatePsaIntegrationRequest & { enabled: boolean }>) =>
        itAssetsClient.put<PsaIntegration>(`/it-assets/psa-integrations/${id}`, data),
    deletePsaIntegration: (id: string) =>
        itAssetsClient.delete(`/it-assets/psa-integrations/${id}`),

    // #30: Patch rollback
    rollbackPatch: (id: string) =>
        itAssetsClient.post(`/it-assets/patches/${id}/rollback`, {}),
};

// ============================================================================
// Additional Types for new endpoints
// ============================================================================

export interface AgentMetric {
    id: string;
    hardware_id: string;
    cpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
    uptime_seconds?: number;
    collected_at: string;
}

export interface AlertRule {
    id: string;
    hardware_id?: string;
    metric: string;
    operator: string;
    threshold: number;
    duration_seconds?: number;
    severity?: string;
    enabled?: boolean;
    created_at: string;
}

export interface CreateAlertRuleRequest {
    hardware_id?: string;
    metric: string;
    operator?: string;
    threshold: number;
    duration_seconds?: number;
    severity?: string;
}

export interface ITAlert {
    id: string;
    rule_id: string;
    hardware_id: string;
    triggered_at: string;
    resolved_at?: string;
    value?: number;
}

export interface EventLog {
    id: string;
    hardware_id: string;
    level: string;
    source?: string;
    message: string;
    metadata?: Record<string, unknown>;
    occurred_at: string;
}

export interface FleetOverview {
    total: number;
    online: number;
    offline: number;
    warning: number;
    by_os: Array<{ os_type: string; count: number }>;
    by_status: Array<{ status: string; count: number }>;
    recently_offline: Array<{
        id: string;
        name: string;
        status?: string;
        os_type?: string;
        last_heartbeat?: string;
    }>;
}

export interface HardwareComponent {
    id: string;
    hardware_id: string;
    type: string;
    name: string;
    details?: string;
    updated_at: string;
}

export interface CreateComponentRequest {
    type: string;
    name: string;
    details?: string;
}

export interface SoftwareLicense {
    id: string;
    software_name: string;
    license_key?: string;
    license_type?: string;
    seats_total?: number;
    vendor?: string;
    purchase_date?: string;
    expiry_date?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface LicenseWithUsage extends SoftwareLicense {
    seats_used: number;
}

export interface CreateLicenseRequest {
    software_name: string;
    license_key?: string;
    license_type?: string;
    seats_total?: number;
    vendor?: string;
    purchase_date?: string;
    expiry_date?: string;
    notes?: string;
}

export interface NetworkInterfaceAsset {
    id: string;
    hardware_id: string;
    name: string;
    mac_address?: string;
    ip_address?: string;
    interface_type?: string;
    speed_mbps?: number;
    is_active?: boolean;
    created_at: string;
}

export interface CreateNetworkInterfaceRequest {
    name: string;
    mac_address?: string;
    ip_address?: string;
    interface_type?: string;
    speed_mbps?: number;
    is_active?: boolean;
}

export interface MaintenanceWindow {
    id: string;
    name: string;
    hardware_id?: string;
    starts_at: string;
    ends_at: string;
    description?: string;
    created_at: string;
}

export interface CreateMaintenanceWindowRequest {
    name: string;
    hardware_id?: string;
    starts_at: string;
    ends_at: string;
    description?: string;
}

export interface ConfigurationItem {
    id: string;
    name: string;
    ci_type: string;
    status?: string;
    owner_id?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface CreateCIRequest {
    name: string;
    ci_type: string;
    status?: string;
    owner_id?: string;
    metadata?: Record<string, unknown>;
}

export interface CIRelationship {
    id: string;
    source_ci_id: string;
    target_ci_id: string;
    relationship_type: string;
    created_at: string;
}

export interface CreateCIRelationshipRequest {
    source_ci_id: string;
    target_ci_id: string;
    relationship_type: string;
}

export interface ChangeRequest {
    id: string;
    title: string;
    description?: string;
    impact_analysis?: string;
    risk_level?: string;
    status?: string;
    submitted_by?: string;
    reviewed_by?: string;
    approved_by?: string;
    submitted_at: string;
    reviewed_at?: string;
    approved_at?: string;
    implemented_at?: string;
    verified_at?: string;
}

export interface CreateChangeRequestInput {
    title: string;
    description?: string;
    impact_analysis?: string;
    risk_level?: string;
    submitted_by?: string;
    ci_ids?: string[];
}

export interface AntivirusStatus {
    id: string;
    hardware_id: string;
    av_name?: string;
    av_version?: string;
    definitions_date?: string;
    last_scan?: string;
    threats_found?: number;
    status?: string;
    reported_at: string;
}

export interface AvFleetSummary {
    total_machines: number;
    protected: number;
    outdated: number;
    disabled: number;
    unknown: number;
}

export interface EncryptionStatus {
    id: string;
    hardware_id: string;
    drive: string;
    encrypted: boolean;
    method?: string;
    reported_at: string;
}

export interface EncryptionFleetSummary {
    total_machines: number;
    fully_encrypted: number;
    partially_encrypted: number;
    not_encrypted: number;
    compliance_pct: number;
}

// ─── #51: PSA Ticketing types ────────────────────────────────────────────────

export interface Ticket {
    id: string;
    number: number;
    title: string;
    description?: string;
    status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
    priority: 'critical' | 'high' | 'medium' | 'low';
    category?: string;
    hardware_id?: string;
    requester_id?: string;
    requester_name?: string;
    requester_email?: string;
    assigned_to?: string;
    assigned_group?: string;
    sla_response_due?: string;
    sla_resolution_due?: string;
    first_response_at?: string;
    resolved_at?: string;
    closed_at?: string;
    tags: string[];
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface TicketComment {
    id: string;
    ticket_id: string;
    author_id?: string;
    author_name?: string;
    content: string;
    is_internal?: boolean;
    attachments?: unknown[];
    created_at: string;
}

export interface TicketTimeEntry {
    id: string;
    ticket_id: string;
    user_id?: string;
    duration_minutes: number;
    description?: string;
    billable?: boolean;
    created_at: string;
}

export interface TicketDetail {
    ticket: Ticket;
    comments: TicketComment[];
    time_entries: TicketTimeEntry[];
}

export interface TicketStats {
    total_open: number;
    by_priority: Array<{ priority: string; count: number }>;
    avg_resolution_minutes?: number;
    sla_compliance_pct: number;
    overdue_count: number;
}

export interface CreateTicketRequest {
    title: string;
    description?: string;
    priority?: string;
    category?: string;
    hardware_id?: string;
    requester_name?: string;
    requester_email?: string;
    assigned_to?: string;
    tags?: string[];
}

// ─── #11: Device documentation ───────────────────────────────────────────────

export interface DeviceDoc {
    id: string;
    hardware_id: string;
    title: string;
    content?: string;
    doc_type?: string;
    created_by?: string;
    created_at: string;
    updated_at: string;
}

// ─── #12: Health score ────────────────────────────────────────────────────────

export interface HealthScore {
    hardware_id: string;
    score: number;
    patch_score: number;
    av_score: number;
    encryption_score: number;
    policy_score: number;
    uptime_score: number;
}

// ─── #20: Software policies ───────────────────────────────────────────────────

export interface SoftwarePolicy {
    id: string;
    name: string;
    mode: 'whitelist' | 'blacklist';
    patterns: string[];
    action: 'alert' | 'remove';
    enabled?: boolean;
    created_at: string;
    updated_at: string;
}

export interface SoftwarePolicyCheckResult {
    hardware_id: string;
    violations: Array<{
        policy_id: string;
        policy_name: string;
        mode: string;
        action: string;
        matched_software: string;
        pattern: string;
    }>;
}

// ─── #21: Remediation playbooks ───────────────────────────────────────────────

export interface PlaybookStep {
    action_type: string;
    config: Record<string, unknown>;
    on_failure: 'continue' | 'stop' | 'escalate';
}

export interface Playbook {
    id: string;
    name: string;
    description?: string;
    steps: PlaybookStep[];
    enabled: boolean;
    created_at: string;
    updated_at: string;
}

export interface PlaybookRun {
    id: string;
    playbook_id: string;
    hardware_id?: string;
    status: string;
    step_results: Array<{
        step_index: number;
        action_type: string;
        status: string;
        output?: string;
        error?: string;
        started_at?: string;
        completed_at?: string;
    }>;
    started_at: string;
    completed_at?: string;
}

// ─── #24: Service monitoring ──────────────────────────────────────────────────

export interface ServiceEntry {
    id: string;
    hardware_id: string;
    name: string;
    status: 'running' | 'stopped' | 'paused' | 'unknown';
    description?: string;
    pid?: number;
    reported_at: string;
}

// ─── #26: Session recordings ──────────────────────────────────────────────────

export interface SessionRecording {
    id: string;
    hardware_id: string;
    session_id: string;
    file_path?: string;
    size_bytes?: number;
    started_at: string;
    ended_at?: string;
}

// ─── #27: Remote file entry ───────────────────────────────────────────────────

export interface RemoteFileEntry {
    name: string;
    path: string;
    is_dir: boolean;
    size?: number;
    modified?: string;
}

// ─── #29: PSA Integrations ────────────────────────────────────────────────────

export interface PsaIntegration {
    id: string;
    name: string;
    type: string;
    webhook_url: string;
    api_key?: string;
    mapping_config: Record<string, unknown>;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreatePsaIntegrationRequest {
    name: string;
    type: string;
    webhook_url: string;
    api_key?: string;
    mapping_config?: Record<string, unknown>;
}
