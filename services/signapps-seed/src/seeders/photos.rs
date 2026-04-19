//! SO4 IN4 — photos seeder.
//!
//! Sets `photo_url` on 10 Nexus persons using the public DiceBear v7
//! avatar generator. The URL is deterministic for a given seed string,
//! so the same person always renders the same avatar.
//!
//! Idempotent : the UPDATE only writes when the column is currently
//! NULL or differs from the seeded URL.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// 10 deterministic person usernames receiving DiceBear avatars.
const PERSONS: &[&str] = &[
    "marie.dupont",
    "jean.martin",
    "paul.durand",
    "claire.moreau",
    "victor.leblanc",
    "sophie.leroy",
    "thomas.petit",
    "emma.rousseau",
    "agnes.perrin",
    "raphael.benoit",
];

/// Build the DiceBear URL for a given seed.
fn dicebear_url(seed: &str) -> String {
    format!("https://api.dicebear.com/7.x/avataaars/svg?seed={seed}")
}

/// Seeds photo URLs on 10 Nexus persons.
pub struct PhotosSeeder;

#[async_trait]
impl Seeder for PhotosSeeder {
    fn name(&self) -> &'static str {
        "photos"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        for username in PERSONS {
            let person_id = acme_uuid("person", username);
            let url = dicebear_url(username);
            let res = sqlx::query(
                r#"
                UPDATE org_persons
                   SET photo_url = $2,
                       updated_at = now()
                 WHERE id = $1
                   AND (photo_url IS DISTINCT FROM $2)
                "#,
            )
            .bind(person_id)
            .bind(&url)
            .execute(pool)
            .await;

            match res {
                Ok(r) => {
                    if r.rows_affected() > 0 {
                        report.created += 1;
                    } else {
                        report.skipped += 1;
                    }
                },
                Err(e) => report.errors.push(format!("photo {username}: {e}")),
            }
        }

        Ok(report)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dicebear_url_is_deterministic() {
        let a = dicebear_url("alice");
        let b = dicebear_url("alice");
        assert_eq!(a, b);
        assert!(a.contains("seed=alice"));
        let c = dicebear_url("bob");
        assert_ne!(a, c);
    }
}
