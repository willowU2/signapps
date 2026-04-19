//! Live `OrgClient` integration tests.
//!
//! These tests require a running Postgres with the `org_*` schema
//! migrated.  They are `#[ignore]`d by default — opt in with:
//!
//! ```bash
//! export DATABASE_URL=postgres://signapps:signapps_dev@localhost:5432/signapps
//! cargo test -p signapps-org --test rbac_client_impl -- --ignored --nocapture
//! ```

use std::sync::Arc;

use signapps_common::rbac::resolver::OrgPermissionResolver;
use signapps_common::rbac::types::{Action, Decision, DecisionSource, PersonRef, ResourceRef};
use signapps_org::rbac_client::OrgClient;
use sqlx::PgPool;
use uuid::Uuid;

async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    PgPool::connect(&url).await.expect("connect")
}

#[tokio::test]
#[ignore]
async fn grant_allows_matching_person_resource_action() {
    let pool = pool().await;
    let tenant = Uuid::new_v4();
    let granted_by = Uuid::new_v4();
    let granted_to = Uuid::new_v4();
    let resource_id = Uuid::new_v4();

    // Seed a person for the "granted_by" / "granted_to" FK.
    sqlx::query(
        "INSERT INTO org_persons (id, tenant_id, display_name, active) VALUES ($1,$2,'by',true) ON CONFLICT DO NOTHING",
    )
    .bind(granted_by)
    .bind(tenant)
    .execute(&pool)
    .await
    .expect("seed by");
    sqlx::query(
        "INSERT INTO org_persons (id, tenant_id, display_name, active) VALUES ($1,$2,'to',true) ON CONFLICT DO NOTHING",
    )
    .bind(granted_to)
    .bind(tenant)
    .execute(&pool)
    .await
    .expect("seed to");

    // Seed the grant — permissions contains "read".
    let token_hash = format!("hash-{}", Uuid::new_v4());
    sqlx::query(
        r#"
        INSERT INTO org_access_grants
            (tenant_id, granted_by, granted_to, resource_type, resource_id,
             permissions, token_hash)
        VALUES ($1, $2, $3, 'document', $4, '["read"]'::jsonb, $5)
        "#,
    )
    .bind(tenant)
    .bind(granted_by)
    .bind(granted_to)
    .bind(resource_id)
    .bind(&token_hash)
    .execute(&pool)
    .await
    .expect("seed grant");

    let client = OrgClient::new(Arc::new(pool.clone()), 60);
    let decision = client
        .check(
            PersonRef {
                id: granted_to,
                tenant_id: tenant,
            },
            ResourceRef::Document(resource_id),
            Action::Read,
        )
        .await
        .expect("check");

    match decision {
        Decision::Allow {
            source: DecisionSource::AccessGrant { .. },
        } => {},
        other => panic!("expected Allow/AccessGrant, got {other:?}"),
    }

    // Cleanup best-effort (tests run against shared DB).
    let _ = sqlx::query("DELETE FROM org_access_grants WHERE token_hash = $1")
        .bind(&token_hash)
        .execute(&pool)
        .await;
}

#[tokio::test]
#[ignore]
async fn no_grant_returns_deny_no_grant() {
    let pool = pool().await;
    let tenant = Uuid::new_v4();
    let person = Uuid::new_v4();
    let resource_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO org_persons (id, tenant_id, display_name, active) VALUES ($1,$2,'solo',true) ON CONFLICT DO NOTHING",
    )
    .bind(person)
    .bind(tenant)
    .execute(&pool)
    .await
    .expect("seed person");

    let client = OrgClient::new(Arc::new(pool), 60);
    let decision = client
        .check(
            PersonRef {
                id: person,
                tenant_id: tenant,
            },
            ResourceRef::Document(resource_id),
            Action::Read,
        )
        .await
        .expect("check");

    assert!(decision.is_deny(), "expected Deny, got {decision:?}");
}

#[tokio::test]
#[ignore]
async fn admin_role_short_circuits_deny_path() {
    let pool = pool().await;
    let tenant = Uuid::new_v4();
    let person = Uuid::new_v4();

    let client = OrgClient::new(Arc::new(pool), 60);
    let decision = client
        .check_with_role(
            PersonRef {
                id: person,
                tenant_id: tenant,
            },
            ResourceRef::Document(Uuid::new_v4()),
            Action::Delete,
            Some(3), // super-admin
        )
        .await
        .expect("check");

    match decision {
        Decision::Allow {
            source: DecisionSource::Admin,
        } => {},
        other => panic!("expected Allow/Admin, got {other:?}"),
    }
}
