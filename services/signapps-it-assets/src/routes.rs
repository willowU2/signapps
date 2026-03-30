use axum::{routing::{get, post, put, delete}, Json, Router};
use signapps_db::DatabasePool;

use crate::handlers::{
    create_hardware, delete_hardware, get_hardware, list_hardware, update_hardware,
};
use crate::handlers::agent::{
    register_agent, agent_heartbeat, get_agent_config,
    report_hardware_inventory, report_software_inventory,
    queue_script, get_pending_scripts, report_script_result,
    create_enrollment_token,
};
use crate::handlers::cmdb::{
    ci_impact, create_change_request, create_ci, create_ci_relationship,
    delete_ci, delete_ci_relationship, get_change_request, get_ci,
    import_ldap, list_change_requests, list_ci_relationships, list_cis,
    update_change_status, update_ci,
};
use crate::handlers::monitoring::{
    get_metrics,
    create_alert_rule, delete_alert_rule, list_alert_rules, list_alerts, resolve_alert,
    get_event_logs, ingest_event_logs,
    fleet_overview,
    create_component, delete_component, list_components, update_component,
    create_license, delete_license, get_license, list_licenses, update_license,
    create_network_interface, delete_network_interface, list_network_interfaces,
    update_network_interface,
    create_maintenance_window, delete_maintenance_window, list_maintenance_windows,
    update_maintenance_window,
};
use crate::handlers::patches::{
    report_available_patches, list_patches, approve_patch, reject_patch,
    deploy_patch, patch_compliance,
};
use crate::handlers::policies::{
    list_policies, list_policies_tree, get_policy, create_policy, update_policy, delete_policy,
    assign_policy, list_assignments,
    get_agent_policies, report_compliance, compliance_summary,
};
use crate::handlers::packages::{
    list_packages, get_package, create_package, update_package, delete_package,
    deploy_package, get_agent_pending_packages, update_deployment_status,
};
use crate::handlers::security::{
    av_fleet_summary, encryption_fleet_summary, get_antivirus_status,
    get_encryption_status, report_antivirus, report_encryption,
};
use crate::handlers::wol::wake_on_lan;
use crate::handlers::commands::{
    queue_agent_command, get_pending_commands, update_command_status, list_hardware_commands,
};
use crate::handlers::files::{
    push_file_to_machine, agent_upload_file, agent_download_file, list_hardware_files,
};
use crate::handlers::network::{
    scan_network, list_discoveries, add_discovery_to_inventory, port_scan, query_snmp,
};

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "service": "signapps-it-assets" }))
}

pub fn api_routes() -> Router<DatabasePool> {
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
        .route("/agent/packages/deployment/:deployment_id/status", put(update_deployment_status))
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
        .route("/hardware/:hw_id/components", get(list_components).post(create_component))
        .route("/components/:id", put(update_component).delete(delete_component))
        // BK2: Software licenses
        .route("/licenses", get(list_licenses).post(create_license))
        .route("/licenses/:id", get(get_license).put(update_license).delete(delete_license))
        // BK3: Network interfaces
        .route("/hardware/:hw_id/interfaces", get(list_network_interfaces).post(create_network_interface))
        .route("/interfaces/:id", put(update_network_interface).delete(delete_network_interface))
        // BK4: Maintenance windows
        .route("/maintenance-windows", get(list_maintenance_windows).post(create_maintenance_window))
        .route("/maintenance-windows/:id", put(update_maintenance_window).delete(delete_maintenance_window))
        // CM1: CMDB CIs
        .route("/cmdb/cis", get(list_cis).post(create_ci))
        .route("/cmdb/cis/:id", get(get_ci).put(update_ci).delete(delete_ci))
        .route("/cmdb/cis/:ci_id/relationships", get(list_ci_relationships))
        .route("/cmdb/cis/:id/impact", get(ci_impact))
        .route("/cmdb/relationships", post(create_ci_relationship))
        .route("/cmdb/relationships/:id", delete(delete_ci_relationship))
        // CM3: Change management
        .route("/changes", get(list_change_requests).post(create_change_request))
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
        .route("/hardware/:id/security/encryption", get(get_encryption_status))
        .route("/fleet/security/encryption", get(encryption_fleet_summary))
        // RM2: Wake-on-LAN
        .route("/hardware/:id/wake", post(wake_on_lan))
        // RM3: Agent commands (reboot, shutdown, lock)
        .route("/agent/commands/queue", post(queue_agent_command))
        .route("/agent/commands/pending/:agent_id", get(get_pending_commands))
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
        .route("/network/discoveries/:id/add-to-inventory", post(add_discovery_to_inventory))
        // ND2: SNMP monitoring (conceptual)
        .route("/network/snmp/:ip", get(query_snmp))
        // ND4: Port scanner
        .route("/network/port-scan", post(port_scan))
}

pub fn public_routes() -> Router<DatabasePool> {
    Router::new().route("/health", get(health))
}
