//! SO1 delegations seeder.
//!
//! 5 délégations démo :
//! - 2 actives (Marie→Paul manager, Jean→Sophie rbac)
//! - 3 expirées (pour tester l'historique : Marie→Claire all -7j,
//!   Nicolas→Anne manager -30j, Victor→Marie rbac -2j)
//!
//! Dépend de `OrgSeeder` (persons).

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::Duration;

/// (slug, delegator_username, delegate_username, scope, start_offset_days, end_offset_days, reason, active)
type DelegationSpec = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    i64,
    i64,
    &'static str,
    bool,
);

const DELEGATIONS: &[DelegationSpec] = &[
    // Active — Marie (CEO) délègue manager à Paul (CFO) pendant 7 jours.
    (
        "marie-paul-manager",
        "marie.dupont",
        "paul.durand",
        "manager",
        -1,
        7,
        "CEO away on board meeting",
        true,
    ),
    // Active — Jean (CTO) délègue rbac à Sophie (Platform Lead) pendant 14 jours.
    (
        "jean-sophie-rbac",
        "jean.martin",
        "sophie.leroy",
        "rbac",
        -1,
        14,
        "CTO technical sabbat",
        true,
    ),
    // Expirée — Marie → Claire (CHRO) all, -7 jours.
    (
        "marie-claire-all",
        "marie.dupont",
        "claire.moreau",
        "all",
        -30,
        -7,
        "CEO leave (past)",
        true,
    ),
    // Expirée — Nicolas (VP Sales EMEA) → Anne (Account Mgr) manager, -30 jours.
    (
        "nicolas-anne-manager",
        "nicolas.robert",
        "anne.girard",
        "manager",
        -60,
        -30,
        "Sales VP off (past)",
        true,
    ),
    // Expirée — Victor (CMO) → Marie (CEO) rbac, -2 jours.
    (
        "victor-marie-rbac",
        "victor.leblanc",
        "marie.dupont",
        "rbac",
        -10,
        -2,
        "Marketing review (past)",
        true,
    ),
];

/// Seeds 5 demo delegations covering active + expired state.
pub struct DelegationsSeeder;

#[async_trait]
impl Seeder for DelegationsSeeder {
    fn name(&self) -> &'static str {
        "delegations"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();
        let now = chrono::Utc::now();

        for (slug, delegator, delegate, scope, start_offset, end_offset, reason, active) in
            DELEGATIONS
        {
            let id = acme_uuid("org-delegation", slug);
            let delegator_id = acme_uuid("person", delegator);
            let delegate_id = acme_uuid("person", delegate);
            let start_at = now + Duration::days(*start_offset);
            let end_at = now + Duration::days(*end_offset);

            // Safety : aucune self-delegation au niveau seeds.
            if delegator_id == delegate_id {
                report
                    .errors
                    .push(format!("delegation `{slug}` has equal delegator/delegate"));
                continue;
            }

            // Pour les expirées on insère avec active=true puis le cron
            // `expire_due` les marquera false. Mais pour le seed nous
            // bypassons le cron et écrivons directement l'état final
            // (active=false si end_at < now) afin que le dashboard montre
            // immédiatement le bon nombre d'actives.
            let effective_active = *active && end_at > now;

            let res = sqlx::query(
                r#"
                INSERT INTO org_delegations
                    (id, tenant_id, delegator_person_id, delegate_person_id, node_id,
                     scope, start_at, end_at, reason, active)
                VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET
                    delegator_person_id = EXCLUDED.delegator_person_id,
                    delegate_person_id  = EXCLUDED.delegate_person_id,
                    scope               = EXCLUDED.scope,
                    start_at            = EXCLUDED.start_at,
                    end_at              = EXCLUDED.end_at,
                    reason              = EXCLUDED.reason,
                    active              = EXCLUDED.active,
                    updated_at          = now()
                "#,
            )
            .bind(id)
            .bind(ctx.tenant_id)
            .bind(delegator_id)
            .bind(delegate_id)
            .bind(scope)
            .bind(start_at)
            .bind(end_at)
            .bind(reason)
            .bind(effective_active)
            .execute(pool)
            .await;
            bump(&mut report, res, "delegation");
        }

        Ok(report)
    }
}
