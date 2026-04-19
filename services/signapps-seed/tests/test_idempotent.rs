//! Full-seed idempotence test.
//!
//! Runs the full pipeline twice; second run must add 0 new rows for
//! our Nexus Industries tenant across all seeded tables. Requires a live
//! localhost Postgres (skipped otherwise).

use signapps_seed::{run_seed, SeedArgs};

fn db_url() -> Option<String> {
    std::env::var("DATABASE_URL").ok()
}

async fn snapshot(pool: &sqlx::PgPool, tenant_id: uuid::Uuid) -> Vec<(String, i64)> {
    let queries: Vec<(&str, String)> = vec![
        ("org_nodes", format!("SELECT COUNT(*) FROM org_nodes WHERE tenant_id = '{}'", tenant_id)),
        ("org_persons", format!("SELECT COUNT(*) FROM org_persons WHERE tenant_id = '{}'", tenant_id)),
        ("org_assignments", format!("SELECT COUNT(*) FROM org_assignments WHERE tenant_id = '{}'", tenant_id)),
        ("ad_config", format!("SELECT COUNT(*) FROM org_ad_config WHERE tenant_id = '{}'", tenant_id)),
        ("nexus_users", "SELECT COUNT(*) FROM identity.users WHERE email LIKE '%@nexus.corp'".to_string()),
        ("calendars", format!("SELECT COUNT(*) FROM calendar.calendars WHERE tenant_id = '{}'", tenant_id)),
        ("events", format!("SELECT COUNT(*) FROM calendar.events WHERE tenant_id = '{}'", tenant_id)),
        ("projects", format!("SELECT COUNT(*) FROM calendar.projects WHERE tenant_id = '{}'", tenant_id)),
        ("tasks", format!("SELECT COUNT(*) FROM calendar.tasks WHERE tenant_id = '{}'", tenant_id)),
        ("mail_emails", "SELECT COUNT(*) FROM mail.emails WHERE sender LIKE '%@nexus.corp'".to_string()),
        ("chat_channels", "SELECT COUNT(*) FROM chat.channels WHERE name IN ('Général','Engineering','Platform Team','Frontend Team','AI Team','Sales EMEA','Sales US','Marketing','Support','Random','Announcements','CEO Office')".to_string()),
        ("pxe_profiles", "SELECT COUNT(*) FROM pxe.profiles WHERE description LIKE 'Profile démo%'".to_string()),
        ("pxe_assets", "SELECT COUNT(*) FROM pxe.assets WHERE mac_address LIKE 'aa:bb:cc:00:00:%'".to_string()),
    ];
    let mut out = Vec::new();
    for (name, sql) in queries {
        let n: (i64,) = sqlx::query_as(&sql)
            .fetch_one(pool)
            .await
            .unwrap_or((-1,));
        out.push((name.to_string(), n.0));
    }
    out
}

#[tokio::test]
async fn test_full_seed_idempotent() {
    let Some(db_url) = db_url() else {
        eprintln!("DATABASE_URL not set — skipping");
        return;
    };

    // First run
    let args1 = SeedArgs {
        database_url: db_url.clone(),
        force: false,
        reset: false,
        dry_run: false,
        only: None,
    };
    run_seed(args1).await.expect("first run ok");

    let pool = sqlx::PgPool::connect(&db_url).await.expect("connect");
    let tenant_id: (uuid::Uuid,) =
        sqlx::query_as("SELECT id FROM identity.tenants WHERE slug='acme-corp'")
            .fetch_one(&pool)
            .await
            .expect("tenant");
    let before = snapshot(&pool, tenant_id.0).await;

    // Second run
    let args2 = SeedArgs {
        database_url: db_url,
        force: false,
        reset: false,
        dry_run: false,
        only: None,
    };
    run_seed(args2).await.expect("second run ok");

    let after = snapshot(&pool, tenant_id.0).await;

    let mut diffs: Vec<String> = Vec::new();
    for ((n1, c1), (n2, c2)) in before.iter().zip(after.iter()) {
        assert_eq!(n1, n2, "snapshot order mismatch");
        if c1 != c2 {
            diffs.push(format!("{}: {} -> {}", n1, c1, c2));
        }
    }
    assert!(
        diffs.is_empty(),
        "second run was not idempotent: {:?}",
        diffs
    );
}
