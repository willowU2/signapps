use axum::{
    extract::FromRef,
    routing::{delete, get, post, put},
    Json, Router,
};
use signapps_db::DatabasePool;

use crate::handlers::agent::{
    agent_heartbeat, create_enrollment_token, download_agent, get_agent_config,
    get_pending_scripts, list_hardware_services, queue_script, register_agent,
    report_hardware_inventory, report_script_result, report_services, report_software_inventory,
};
use crate::handlers::automation::{
    create_rule, delete_rule, get_rule, list_executions, list_rules, update_rule,
};
use crate::handlers::cmdb::{
    ci_impact, create_change_request, create_ci, create_ci_relationship, delete_ci,
    delete_ci_relationship, get_change_request, get_ci, import_ldap, list_change_requests,
    list_ci_relationships, list_cis, update_change_status, update_ci,
};
use crate::handlers::commands::{
    get_pending_commands, list_hardware_commands, queue_agent_command, update_command_status,
};
use crate::handlers::custom_fields::{
    create_field_def, delete_field_def, get_hardware_fields, list_field_defs, set_field_value,
    update_field_def,
};
use crate::handlers::device_docs::{create_device_doc, list_device_docs};
use crate::handlers::files::{
    agent_download_file, agent_upload_file, list_hardware_files, push_file_to_machine,
};
use crate::handlers::groups::{
    add_member, assign_tag, create_group, create_tag, delete_group, delete_tag, get_group,
    list_groups, list_hardware_tags, list_members, list_tags, remove_member, unassign_tag,
    update_group,
};
use crate::handlers::monitoring::get_health_score;
use crate::handlers::monitoring::{
    create_alert_rule, create_component, create_license, create_maintenance_window,
    create_network_interface, delete_alert_rule, delete_component, delete_license,
    delete_maintenance_window, delete_network_interface, fleet_overview, get_event_logs,
    get_license, get_metrics, ingest_event_logs, list_alert_rules, list_alerts, list_components,
    list_licenses, list_maintenance_windows, list_network_interfaces, resolve_alert,
    update_component, update_license, update_maintenance_window, update_network_interface,
};
use crate::handlers::network::{
    add_discovery_to_inventory, list_discoveries, port_scan, query_snmp, scan_network,
};
use crate::handlers::packages::{
    create_package, delete_package, deploy_package, get_agent_pending_packages, get_package,
    list_packages, update_deployment_status, update_package,
};
use crate::handlers::patches::{
    approve_patch, deploy_patch, list_patches, patch_compliance, reject_patch,
    report_available_patches, rollback_patch,
};
use crate::handlers::playbooks::{
    create_playbook, delete_playbook, get_playbook, list_playbook_runs, list_playbooks,
    run_playbook, update_playbook,
};
use crate::handlers::policies::{
    assign_policy, compliance_summary, create_policy, delete_policy, get_agent_policies,
    get_policy, list_assignments, list_policies, list_policies_tree, report_compliance,
    update_policy,
};
use crate::handlers::remote_ws::AppState;
use crate::handlers::remote_ws::{
    admin_remote_viewer, agent_remote_ws, list_recordings, start_remote_session,
    stop_remote_session,
};
use crate::handlers::script_library::{
    create_schedule, create_script, delete_schedule, delete_script, get_script, list_schedules,
    list_scripts, run_library_script, update_script,
};
use crate::handlers::security::{
    av_fleet_summary, encryption_fleet_summary, get_antivirus_status, get_encryption_status,
    report_antivirus, report_encryption,
};
use crate::handlers::software_policies::{
    check_software_compliance, create_software_policy, list_software_policies,
};
use crate::handlers::tickets::{
    add_comment, create_psa_integration, create_ticket, delete_psa_integration, delete_ticket,
    get_ticket, list_psa_integrations, list_tickets, log_time_entry, ticket_stats,
    update_psa_integration, update_ticket,
};
use crate::handlers::wol::wake_on_lan;
use crate::handlers::{
    create_hardware, delete_hardware, get_hardware, list_hardware, update_hardware,
};

// ─── State extraction ─────────────────────────────────────────────────────────

/// Allow handlers that only need DatabasePool to extract it from AppState.
impl FromRef<AppState> for DatabasePool {
    fn from_ref(state: &AppState) -> Self {
        state.pool.clone()
    }
}

// ─── Health ───────────────────────────────────────────────────────────────────

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "service": "signapps-it-assets" }))
}

// ─── Routes ───────────────────────────────────────────────────────────────────

pub fn api_routes() -> Router<AppState> {
    Router::new()
        // Hardware
        .route("/hardware", get(list_hardware).post(create_hardware))
        .route(
            "/hardware/:id",
            get(get_hardware).put(update_hardware).delete(delete_hardware),
        )
        // Agent registration & lifecycle
        .route("/agent/register", post(register_agent))
        .route("/agent/:agent_id/heartbeat", post(agent_heartbeat))
        .route("/agent/:agent_id/config", get(get_agent_config))
        .route("/agent/:agent_id/hardware", post(report_hardware_inventory))
        .route("/agent/:agent_id/software", post(report_software_inventory))
        .route("/agent/:agent_id/scripts", get(get_pending_scripts).post(queue_script))
        .route("/agent/:agent_id/scripts/result", post(report_script_result))
        .route("/enrollment/token", post(create_enrollment_token))
        // Patches
        .route("/patches", get(list_patches))
        .route("/patches/report", post(report_available_patches))
        .route("/patches/:id/approve", post(approve_patch))
        .route("/patches/:id/reject", post(reject_patch))
        .route("/patches/:id/deploy", post(deploy_patch))
        .route("/patches/:id/rollback", post(rollback_patch))
        .route("/patches/compliance", get(patch_compliance))
        // Policies (GP1-GP5)
        .route("/policies", get(list_policies).post(create_policy))
        .route("/policies/tree", get(list_policies_tree))
        .route("/policies/compliance", get(compliance_summary))
        .route(
            "/policies/:id",
            get(get_policy).put(update_policy).delete(delete_policy),
        )
        .route("/policies/:id/assign", post(assign_policy))
        .route("/policies/:id/assignments", get(list_assignments))
        // Agent policy endpoints
        .route("/agent/policies/:agent_id", get(get_agent_policies))
        .route("/agent/policies/compliance", post(report_compliance))
        // Software Packages (SD1-SD4)
        .route("/packages", get(list_packages).post(create_package))
        .route(
            "/packages/:id",
            get(get_package).put(update_package).delete(delete_package),
        )
        .route("/packages/:id/deploy", post(deploy_package))
        // Agent package endpoints
        .route("/agent/packages/pending/:agent_id", get(get_agent_pending_packages))
        .route(
            "/agent/packages/deployment/:deployment_id/status",
            put(update_deployment_status),
        )
        // MD1: Metrics
        .route("/hardware/:id/metrics", get(get_metrics))
        // MD2: Alert rules & alerts
        .route("/alert-rules", get(list_alert_rules).post(create_alert_rule))
        .route("/alert-rules/:id", delete(delete_alert_rule))
        .route("/alerts", get(list_alerts))
        .route("/alerts/:id/resolve", post(resolve_alert))
        // MD3: Event logs (agent ingest)
        .route("/agent/logs", post(ingest_event_logs))
        // MD3: Event logs (read per machine)
        .route("/hardware/:hw_id/logs", get(get_event_logs))
        // MD4: Fleet overview
        .route("/fleet", get(fleet_overview))
        // BK1: Hardware components
        .route(
            "/hardware/:hw_id/components",
            get(list_components).post(create_component),
        )
        .route("/components/:id", put(update_component).delete(delete_component))
        // BK2: Software licenses
        .route("/licenses", get(list_licenses).post(create_license))
        .route(
            "/licenses/:id",
            get(get_license).put(update_license).delete(delete_license),
        )
        // BK3: Network interfaces
        .route(
            "/hardware/:hw_id/interfaces",
            get(list_network_interfaces).post(create_network_interface),
        )
        .route(
            "/interfaces/:id",
            put(update_network_interface).delete(delete_network_interface),
        )
        // BK4: Maintenance windows
        .route(
            "/maintenance-windows",
            get(list_maintenance_windows).post(create_maintenance_window),
        )
        .route(
            "/maintenance-windows/:id",
            put(update_maintenance_window).delete(delete_maintenance_window),
        )
        // CM1: CMDB CIs
        .route("/cmdb/cis", get(list_cis).post(create_ci))
        .route(
            "/cmdb/cis/:id",
            get(get_ci).put(update_ci).delete(delete_ci),
        )
        .route("/cmdb/cis/:ci_id/relationships", get(list_ci_relationships))
        .route("/cmdb/cis/:id/impact", get(ci_impact))
        .route("/cmdb/relationships", post(create_ci_relationship))
        .route("/cmdb/relationships/:id", delete(delete_ci_relationship))
        // CM3: Change management
        .route(
            "/changes",
            get(list_change_requests).post(create_change_request),
        )
        .route("/changes/:id", get(get_change_request))
        .route("/changes/:id/status", put(update_change_status))
        // CM4: LDAP import stub
        .route("/import/ldap", post(import_ldap))
        // SE1: AV status
        .route("/agent/security/antivirus", post(report_antivirus))
        .route("/hardware/:id/security/antivirus", get(get_antivirus_status))
        .route("/fleet/security/av", get(av_fleet_summary))
        // SE2: Encryption status
        .route("/agent/security/encryption", post(report_encryption))
        .route(
            "/hardware/:id/security/encryption",
            get(get_encryption_status),
        )
        .route("/fleet/security/encryption", get(encryption_fleet_summary))
        // RM2: Wake-on-LAN
        .route("/hardware/:id/wake", post(wake_on_lan))
        // RM3: Agent commands (reboot, shutdown, lock)
        .route("/agent/commands/queue", post(queue_agent_command))
        .route(
            "/agent/commands/pending/:agent_id",
            get(get_pending_commands),
        )
        .route("/agent/commands/:id/status", put(update_command_status))
        .route("/hardware/:id/commands", get(list_hardware_commands))
        // RM4: File transfer
        .route("/agent/files/push", post(push_file_to_machine))
        .route("/agent/files/upload", post(agent_upload_file))
        .route("/agent/files/download/:file_id", get(agent_download_file))
        .route("/hardware/:id/files", get(list_hardware_files))
        // ND1: Network scanner
        .route("/network/scan", post(scan_network))
        .route("/network/discoveries", get(list_discoveries))
        .route(
            "/network/discoveries/:id/add-to-inventory",
            post(add_discovery_to_inventory),
        )
        // ND2: SNMP monitoring
        .route("/network/snmp/:ip", get(query_snmp))
        // ND4: Port scanner
        .route("/network/port-scan", post(port_scan))
        // EA7: Agent binary download (placeholder — returns install instructions)
        .route("/agent/download/:platform", get(download_agent))
        // Agent services reporting (Feature 24)
        .route("/agent/:agent_id/services", post(report_services))
        .route("/hardware/:hw_id/services", get(list_hardware_services))
        // RM5: Remote access — custom WSS protocol (no VNC)
        .route("/agent/:agent_id/remote-ws", get(agent_remote_ws))
        .route("/hardware/:hw_id/remote-session", get(admin_remote_viewer))
        .route(
            "/hardware/:hw_id/remote-session/start",
            post(start_remote_session),
        )
        .route(
            "/hardware/:hw_id/remote-session/stop",
            post(stop_remote_session),
        )
        // RM6: Session recordings (Feature 26)
        .route("/hardware/:hw_id/recordings", get(list_recordings))
        // GR1-GR4: Device groups & tags
        .route("/groups", get(list_groups).post(create_group))
        .route(
            "/groups/:id",
            get(get_group).put(update_group).delete(delete_group),
        )
        .route("/groups/:id/members", get(list_members).post(add_member))
        .route("/groups/:id/members/:hardware_id", delete(remove_member))
        .route("/tags", get(list_tags).post(create_tag))
        .route("/tags/:id", delete(delete_tag))
        .route("/tags/:id/assign", post(assign_tag))
        .route("/tags/:id/assign/:hardware_id", delete(unassign_tag))
        .route("/hardware/:id/tags", get(list_hardware_tags))
        // CF1-CF3: Custom fields
        .route("/custom-fields", get(list_field_defs).post(create_field_def))
        .route(
            "/custom-fields/:id",
            put(update_field_def).delete(delete_field_def),
        )
        .route("/hardware/:id/custom-fields", get(get_hardware_fields))
        .route(
            "/hardware/:hw_id/custom-fields/:def_id",
            put(set_field_value),
        )
        // AT1-AT3: Automation rules
        .route("/automation/rules", get(list_rules).post(create_rule))
        .route(
            "/automation/rules/:id",
            get(get_rule).put(update_rule).delete(delete_rule),
        )
        .route("/automation/rules/:id/executions", get(list_executions))
        // SL1-SL3: Script library
        .route("/script-library", get(list_scripts).post(create_script))
        .route(
            "/script-library/:id",
            get(get_script).put(update_script).delete(delete_script),
        )
        .route("/script-library/:id/run", post(run_library_script))
        .route("/script-library/schedules", get(list_schedules).post(create_schedule))
        .route("/script-library/schedules/:id", delete(delete_schedule))
        // #51: PSA Ticketing
        .route("/tickets", get(list_tickets).post(create_ticket))
        .route("/tickets/stats", get(ticket_stats))
        .route(
            "/tickets/:id",
            get(get_ticket).patch(update_ticket).delete(delete_ticket),
        )
        .route("/tickets/:id/comments", post(add_comment))
        .route("/tickets/:id/time", post(log_time_entry))
        // #11: Per-device documentation
        .route(
            "/hardware/:hw_id/docs",
            get(list_device_docs).post(create_device_doc),
        )
        // #12: Unified device health score
        .route("/hardware/:hw_id/health-score", get(get_health_score))
        // #20: Software blacklist/whitelist policies
        .route(
            "/software-policies",
            get(list_software_policies).post(create_software_policy),
        )
        .route(
            "/hardware/:hw_id/software-check",
            get(check_software_compliance),
        )
        // PSA webhook integrations
        .route(
            "/psa-integrations",
            get(list_psa_integrations).post(create_psa_integration),
        )
        .route(
            "/psa-integrations/:id",
            put(update_psa_integration).delete(delete_psa_integration),
        )
        // PB1-PB6: Remediation playbooks (Feature 21)
        .route("/playbooks", get(list_playbooks).post(create_playbook))
        .route(
            "/playbooks/:id",
            get(get_playbook).put(update_playbook).delete(delete_playbook),
        )
        .route("/playbooks/:id/run", post(run_playbook))
        .route("/playbooks/:id/runs", get(list_playbook_runs))
}

pub fn public_routes() -> Router<DatabasePool> {
    Router::new().route("/health", get(health))
}
