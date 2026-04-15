//! Integration tests for signapps-ad-core.
//!
//! These tests verify the core AD types work together correctly.

use std::collections::HashMap;

use chrono::Utc;
use signapps_ad_core::{
    acl::{check_access, AclDecision, AclOperation},
    dn::DistinguishedName,
    entry::{DirectoryEntry, LifecycleState},
    filter::LdapFilter,
    guid::ObjectGuid,
    schema::{classes::class_hierarchy, syntax::AttributeValue},
    sid::SecurityIdentifier,
    uac::UserAccountControl,
};
use uuid::Uuid;

#[test]
fn dn_sid_guid_roundtrip() {
    // Create a user's identity.
    let dn = DistinguishedName::parse("CN=John Doe,OU=Users,DC=example,DC=com").unwrap();
    let domain_sid = SecurityIdentifier::parse("S-1-5-21-100-200-300").unwrap();
    let user_sid = domain_sid.child(1001);
    let guid = ObjectGuid::new();

    assert_eq!(dn.rdn_value(), "John Doe");
    assert_eq!(dn.domain_suffix(), "example.com");
    assert_eq!(user_sid.rid(), Some(1001));
    assert_eq!(
        user_sid.domain_sid().unwrap().to_string(),
        "S-1-5-21-100-200-300"
    );

    // Binary roundtrips.
    let sid_bytes = user_sid.to_bytes();
    let sid_back = SecurityIdentifier::from_bytes(&sid_bytes).unwrap();
    assert_eq!(user_sid, sid_back);

    let guid_bytes = guid.to_ad_bytes();
    let guid_back = ObjectGuid::from_ad_bytes(&guid_bytes);
    assert_eq!(guid, guid_back);
}

#[test]
fn filter_compilation_produces_valid_sql() {
    let filter = LdapFilter::parse("(&(objectClass=user)(mail=*@example.com))").unwrap();
    let (sql, params) = filter.to_sql(0);

    assert!(sql.contains("AND"));
    assert_eq!(params.len(), 2);
    assert_eq!(params[0], "user");
    assert_eq!(params[1], "%@example.com");
}

#[test]
fn uac_flags_cover_common_scenarios() {
    let normal = UserAccountControl::normal_user();
    assert!(!normal.is_disabled());
    assert!(normal.requires_preauth());

    let mut disabled = normal;
    disabled.set(UserAccountControl::ACCOUNTDISABLE);
    assert!(disabled.is_disabled());

    let computer = UserAccountControl::computer();
    assert!(computer.has(UserAccountControl::WORKSTATION_TRUST_ACCOUNT));
}

#[test]
fn schema_hierarchy_is_consistent() {
    // user inherits from person which inherits from top.
    let chain = class_hierarchy("user");
    assert!(chain.contains(&"top"));
    assert!(chain.contains(&"person"));

    // computer inherits from user.
    let comp_chain = class_hierarchy("computer");
    assert!(comp_chain.contains(&"user"));
    assert!(comp_chain.contains(&"top"));

    // group is independent.
    let group_chain = class_hierarchy("group");
    assert!(group_chain.contains(&"top"));
    assert!(!group_chain.contains(&"person"));
}

#[test]
fn acl_enforces_role_based_access() {
    // Admin can do everything.
    assert_eq!(
        check_access(2, AclOperation::Write, None),
        AclDecision::Allow
    );
    assert_eq!(
        check_access(3, AclOperation::Delete, None),
        AclDecision::Allow
    );

    // Regular user is read-only.
    assert_eq!(
        check_access(1, AclOperation::Read, None),
        AclDecision::Allow
    );
    assert_eq!(
        check_access(1, AclOperation::Write, None),
        AclDecision::Deny
    );
    assert_eq!(
        check_access(1, AclOperation::Create, None),
        AclDecision::Deny
    );
}

#[test]
fn entry_builder_creates_valid_entries() {
    let mut entry = DirectoryEntry {
        guid: Uuid::new_v4(),
        sid: Some(SecurityIdentifier::parse("S-1-5-21-100-200-300-1001").unwrap()),
        dn: DistinguishedName::parse("CN=Test,DC=example,DC=com").unwrap(),
        object_classes: vec!["top".into(), "person".into(), "user".into()],
        attributes: HashMap::new(),
        uac: UserAccountControl::normal_user(),
        lifecycle: LifecycleState::Live,
        created: Utc::now(),
        modified: Utc::now(),
    };

    entry.set_str("sAMAccountName", "testuser");
    entry.set_str("mail", "test@example.com");
    entry.add_value(
        "memberOf",
        AttributeValue::String("CN=Users,DC=example,DC=com".into()),
    );

    assert_eq!(entry.get_str("sAMAccountName"), Some("testuser"));
    assert!(entry.has_class("user"));
    assert!(entry.has_class("User")); // case-insensitive
    assert!(!entry.has_class("group"));
    assert_eq!(entry.get_all("memberOf").len(), 1);
}
