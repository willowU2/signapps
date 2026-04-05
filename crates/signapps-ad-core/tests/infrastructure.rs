//! Integration tests for the unified infrastructure system.

use signapps_ad_core::provisioner;

#[test]
fn internal_domain_detection() {
    assert!(provisioner::is_internal_domain("corp.local"));
    assert!(provisioner::is_internal_domain("office.internal"));
    assert!(provisioner::is_internal_domain("dev.lan"));
    assert!(provisioner::is_internal_domain("test.home"));
    assert!(!provisioner::is_internal_domain("example.com"));
    assert!(!provisioner::is_internal_domain("company.fr"));
    assert!(!provisioner::is_internal_domain("app.io"));
    assert!(!provisioner::is_internal_domain("startup.dev"));
}

#[test]
fn provision_result_tracks_all_subsystems() {
    let result = provisioner::ProvisionResult {
        domain_id: uuid::Uuid::new_v4(),
        dns_name: "test.local".to_string(),
        realm: Some("TEST.LOCAL".to_string()),
        domain_sid: Some("S-1-5-21-1-2-3".to_string()),
        ad_provisioned: true,
        dns_provisioned: true,
        cert_provisioned: true,
        mail_provisioned: false,
        dhcp_provisioned: true,
        ntp_configured: true,
        deploy_profile_created: true,
    };

    let json = serde_json::to_string(&result).unwrap();
    assert!(json.contains("ad_provisioned"));
    assert!(json.contains("dhcp_provisioned"));
    assert!(json.contains("ntp_configured"));
    assert!(json.contains("deploy_profile_created"));
}
