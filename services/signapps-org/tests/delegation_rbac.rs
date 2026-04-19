//! Test RBAC delegation resolution.
//!
//! Scenario : Marie (delegator) a une direct access grant sur un node.
//! Jean (delegate) n'a rien. Après création d'une délégation active avec
//! scope=rbac, Jean doit être autorisé via la branche "Delegation" du
//! résolveur.
//!
//! `#[ignore]` — requires Postgres with migrations applied.

#![allow(missing_docs)]

use chrono::{Duration, Utc};
use signapps_common::rbac::resolver::OrgPermissionResolver;
use signapps_common::rbac::types::{Action, Decision, DecisionSource, PersonRef, ResourceRef};
use signapps_db::models::org::DelegationScope;
use signapps_db::repositories::org::DelegationRepository;
use signapps_org::rbac_client::OrgClient;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://signapps:signapps_dev@localhost:5432/signapps".into()
    });
    PgPool::connect(&url).await.expect("connect")
}

#[tokio::test]
#[ignore]
async fn delegation_grants_transitive_rbac() {
    let pool = pool().await;
    let tenant = Uuid::new_v4();
    let resource_id = Uuid::new_v4();

    // Seed delegator + delegate as org_persons.
    let delegator_id = Uuid::new_v4();
    let delegate_id = Uuid::new_v4();
    for (id, email) in [
        (delegator_id, format!("del-{}@example.com", Uuid::new_v4().simple())),
        (delegate_id, format!("dte-{}@example.com", Uuid::new_v4().simple())),
    ] {
        sqlx::query(
            "INSERT INTO org_persons (id, tenant_id, email, active)
             VALUES ($1, $2, $3, true)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(id)
        .bind(tenant)
        .bind(email)
        .execute(&pool)
        .await
        .expect("seed person");
    }

    // Seed direct access grant on delegator for a custom resource.
    let grant_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO org_access_grants
            (id, tenant_id, resource_type, resource_id, granted_to, granted_by, permissions)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(grant_id)
    .bind(tenant)
    .bind("document")
    .bind(resource_id)
    .bind(delegator_id)
    .bind(delegator_id)
    .bind(serde_json::json!(["read"]))
    .execute(&pool)
    .await
    .expect("seed grant");

    // 1) Delegate without delegation : must be denied.
    let resolver = OrgClient::new(Arc::new(pool.clone()), 0);
    let who_delegate = PersonRef {
        id: delegate_id,
        tenant_id: tenant,
    };
    let resource = ResourceRef::Document(resource_id);

    let d1 = resolver
        .check(who_delegate, resource.clone(), Action::Read)
        .await
        .expect("resolver");
    assert!(d1.is_deny(), "delegate should be denied without delegation, got {d1:?}");

    // 2) Create an active delegation scope=rbac.
    let repo = DelegationRepository::new(&pool);
    let now = Utc::now();
    let _d = repo
        .create(
            tenant,
            delegator_id,
            delegate_id,
            None,
            DelegationScope::Rbac,
            now - Duration::hours(1),
            now + Duration::days(7),
            Some("Test delegation"),
            None,
        )
        .await
        .expect("create delegation");

    // Need a fresh resolver (cache would otherwise return the cached deny).
    let resolver2 = OrgClient::new(Arc::new(pool.clone()), 0);
    let d2 = resolver2
        .check(who_delegate, resource, Action::Read)
        .await
        .expect("resolver");
    assert!(d2.is_allow(), "delegate should be allowed after delegation, got {d2:?}");
    // Source should be Delegation { ... }.
    if let Decision::Allow { source } = d2 {
        match source {
            DecisionSource::Delegation { delegator_person_id, .. } => {
                assert_eq!(delegator_person_id, delegator_id);
            },
            other => panic!("expected Delegation source, got {other:?}"),
        }
    }
}
