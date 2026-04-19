//! Trait-level contract tests for `OrgPermissionResolver`.
//!
//! These tests exercise the contract — they use a mock resolver to
//! confirm that the trait's `check` method returns the expected
//! [`Decision`] variants across the action / resource matrix.  They
//! are gated by the `rbac` feature; run with:
//!
//! ```bash
//! cargo test -p signapps-common --features rbac --test rbac_matrix
//! ```

#![cfg(feature = "rbac")]

use async_trait::async_trait;
use signapps_common::rbac::resolver::{OrgPermissionResolver, RbacError};
use signapps_common::rbac::types::{
    Action, Decision, DecisionSource, DenyReason, PersonRef, ResourceRef,
};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Mock resolvers
// ---------------------------------------------------------------------------

struct AlwaysAllow;

#[async_trait]
impl OrgPermissionResolver for AlwaysAllow {
    async fn check(
        &self,
        _who: PersonRef,
        _resource: ResourceRef,
        _action: Action,
    ) -> Result<Decision, RbacError> {
        Ok(Decision::Allow {
            source: DecisionSource::Admin,
        })
    }
}

struct AlwaysDeny(DenyReason);

#[async_trait]
impl OrgPermissionResolver for AlwaysDeny {
    async fn check(
        &self,
        _who: PersonRef,
        _resource: ResourceRef,
        _action: Action,
    ) -> Result<Decision, RbacError> {
        Ok(Decision::Deny { reason: self.0 })
    }
}

struct AllowOnlyDocuments;

#[async_trait]
impl OrgPermissionResolver for AllowOnlyDocuments {
    async fn check(
        &self,
        _who: PersonRef,
        resource: ResourceRef,
        action: Action,
    ) -> Result<Decision, RbacError> {
        if matches!(resource, ResourceRef::Document(_)) && matches!(action, Action::Read) {
            Ok(Decision::Allow {
                source: DecisionSource::OwnerOfResource,
            })
        } else {
            Ok(Decision::Deny {
                reason: DenyReason::NoGrant,
            })
        }
    }
}

fn random_person() -> PersonRef {
    PersonRef {
        id: Uuid::new_v4(),
        tenant_id: Uuid::new_v4(),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[tokio::test]
async fn allow_short_circuits_any_resource_kind() {
    let r = AlwaysAllow;
    for res in [
        ResourceRef::Document(Uuid::new_v4()),
        ResourceRef::Folder(Uuid::new_v4()),
        ResourceRef::Calendar(Uuid::new_v4()),
        ResourceRef::MailFolder(Uuid::new_v4()),
        ResourceRef::Form(Uuid::new_v4()),
        ResourceRef::Project(Uuid::new_v4()),
        ResourceRef::OrgNode(Uuid::new_v4()),
        ResourceRef::Custom {
            kind: "ticket",
            id: Uuid::new_v4(),
        },
    ] {
        let d = r.check(random_person(), res.clone(), Action::Read).await.unwrap();
        assert!(d.is_allow(), "expected Allow for {:?}", res);
        assert!(!d.is_deny());
    }
}

#[tokio::test]
async fn deny_returns_reason() {
    let r = AlwaysDeny(DenyReason::GrantExpired);
    let d = r
        .check(
            random_person(),
            ResourceRef::Document(Uuid::new_v4()),
            Action::Write,
        )
        .await
        .unwrap();
    match d {
        Decision::Deny { reason } => assert_eq!(reason, DenyReason::GrantExpired),
        Decision::Allow { .. } => panic!("expected Deny"),
    }
}

#[tokio::test]
async fn selective_resolver_allows_only_read_on_documents() {
    let r = AllowOnlyDocuments;

    // Document + Read → Allow
    let d = r
        .check(
            random_person(),
            ResourceRef::Document(Uuid::new_v4()),
            Action::Read,
        )
        .await
        .unwrap();
    assert!(d.is_allow());

    // Document + Write → Deny
    let d = r
        .check(
            random_person(),
            ResourceRef::Document(Uuid::new_v4()),
            Action::Write,
        )
        .await
        .unwrap();
    assert!(d.is_deny());

    // Folder + Read → Deny
    let d = r
        .check(
            random_person(),
            ResourceRef::Folder(Uuid::new_v4()),
            Action::Read,
        )
        .await
        .unwrap();
    assert!(d.is_deny());
}

#[tokio::test]
async fn resource_kind_labels_are_stable() {
    assert_eq!(ResourceRef::Document(Uuid::new_v4()).kind(), "document");
    assert_eq!(ResourceRef::Folder(Uuid::new_v4()).kind(), "folder");
    assert_eq!(ResourceRef::Calendar(Uuid::new_v4()).kind(), "calendar");
    assert_eq!(ResourceRef::MailFolder(Uuid::new_v4()).kind(), "mail_folder");
    assert_eq!(ResourceRef::Form(Uuid::new_v4()).kind(), "form");
    assert_eq!(ResourceRef::Project(Uuid::new_v4()).kind(), "project");
    assert_eq!(ResourceRef::OrgNode(Uuid::new_v4()).kind(), "org_node");
    assert_eq!(
        ResourceRef::Custom {
            kind: "ticket",
            id: Uuid::new_v4()
        }
        .kind(),
        "ticket"
    );
}

#[tokio::test]
async fn action_labels_are_stable() {
    assert_eq!(Action::Read.as_str(), "read");
    assert_eq!(Action::Write.as_str(), "write");
    assert_eq!(Action::Delete.as_str(), "delete");
    assert_eq!(Action::Share.as_str(), "share");
    assert_eq!(Action::Admin.as_str(), "admin");
}

#[tokio::test]
async fn rbac_error_display_messages() {
    let e = RbacError::Unavailable("db down".into());
    assert_eq!(e.to_string(), "resolver unavailable: db down");
    let e = RbacError::BadRequest("nil uuid".into());
    assert_eq!(e.to_string(), "invalid request: nil uuid");
}
