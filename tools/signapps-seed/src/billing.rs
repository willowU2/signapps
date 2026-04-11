//! Billing seeding — inserts invoices, line items, and payments.
//!
//! Tables: `billing.invoices` (only `id`), `billing.line_items`, `billing.payments`.

use rand::Rng;
use tracing::info;
use uuid::Uuid;

const LINE_ITEM_DESCRIPTIONS: &[&str] = &[
    "Abonnement mensuel — plan Entreprise",
    "Support prioritaire (12 mois)",
    "Formation utilisateurs (5 jours)",
    "Intégration personnalisée",
    "Stockage supplémentaire (500 Go)",
    "Licences additionnelles (10 utilisateurs)",
    "Maintenance annuelle",
    "Audit de sécurité",
    "Développement sur mesure — module RH",
    "Développement sur mesure — module Finance",
    "Migration de données",
    "Conseil en architecture",
    "SLA Gold (disponibilité 99.9%)",
    "Backup & restauration avancé",
    "Hébergement dédié (1 an)",
];

const PAYMENT_METHODS: &[&str] = &["bank_transfer", "card", "bank_transfer", "check", "other"];

/// Seeds Acme Corp billing (20 invoices + line_items + payments).
///
/// # Errors
///
/// Returns an error if any database operation fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn seed_acme(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    _user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding acme billing");
    seed_invoices(pool, 20).await?;
    Ok(())
}

/// Seeds Startup SAS billing (5 invoices).
///
/// # Errors
///
/// Returns an error if any database operation fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn seed_startup(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    _user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!("seeding startup billing");
    seed_invoices(pool, 5).await?;
    Ok(())
}

// ── Private helpers ───────────────────────────────────────────────────────────

async fn seed_invoices(
    pool: &sqlx::PgPool,
    count: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut rng = rand::thread_rng();

    for inv_idx in 0..count {
        let invoice_id = Uuid::new_v4();

        // billing.invoices requires: number (NOT NULL), amount_cents, currency, status, issued_at, metadata
        let number = format!("INV-SEED-{:06}", inv_idx + 1);
        let total_invoice_cents: i32 = rng.gen_range(10_000i32..=500_000);
        sqlx::query(
            r#"
            INSERT INTO billing.invoices
                (id, number, amount_cents, currency, status, issued_at, metadata)
            VALUES ($1, $2, $3, 'EUR', 'draft', NOW(), '{}')
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(invoice_id)
        .bind(&number)
        .bind(total_invoice_cents)
        .execute(pool)
        .await?;

        // 1–4 line items per invoice
        let item_count = 1 + (inv_idx % 4);
        for item_idx in 0..item_count {
            let description = crate::helpers::pick(LINE_ITEM_DESCRIPTIONS, inv_idx + item_idx);
            let quantity: i32 = rng.gen_range(1i32..=10);
            let unit_price_cents: i32 = rng.gen_range(5000i32..=50_000);
            let total_cents = quantity * unit_price_cents;

            sqlx::query(
                r#"
                INSERT INTO billing.line_items
                    (id, invoice_id, description, quantity, unit_price_cents, total_cents,
                     sort_order, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(invoice_id)
            .bind(*description)
            .bind(quantity)
            .bind(unit_price_cents)
            .bind(total_cents)
            .bind(item_idx as i32)
            .execute(pool)
            .await?;
        }

        // Payment for ~70% of invoices
        if rng.gen_bool(0.7) {
            let amount_cents: i32 = rng.gen_range(10_000i32..=500_000);
            let method = *crate::helpers::pick(PAYMENT_METHODS, inv_idx);
            let reference = format!("REF-{:06}", inv_idx + 1);
            let paid_at_offset: i64 = -(rng.gen_range(1i64..=90));

            sqlx::query(
                r#"
                INSERT INTO billing.payments
                    (id, invoice_id, amount_cents, currency, method, reference, paid_at, created_at)
                VALUES
                    ($1, $2, $3, 'EUR', $4, $5,
                     NOW() + ($6 || ' days')::INTERVAL,
                     NOW())
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(invoice_id)
            .bind(amount_cents)
            .bind(method)
            .bind(reference)
            .bind(paid_at_offset.to_string())
            .execute(pool)
            .await?;
        }
    }

    info!(invoices = count, "billing invoices seeded");
    Ok(())
}
