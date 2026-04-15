//! Active stack lookup + swap for Blue/Green deployments.
//!
//! Readers: signapps-proxy (chooses upstream on every request).
//! Writer: signapps-deploy (swaps after a successful Blue/Green deploy).

use anyhow::{Context, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// One of the two parallel stacks in a Blue/Green topology.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Color {
    /// The "blue" stack.
    Blue,
    /// The "green" stack.
    Green,
}

impl Color {
    /// Return the canonical lowercase label (`"blue"` / `"green"`).
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Blue => "blue",
            Self::Green => "green",
        }
    }

    /// Return the opposite color (Blue ↔ Green).
    pub fn other(&self) -> Self {
        match self {
            Self::Blue => Self::Green,
            Self::Green => Self::Blue,
        }
    }

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "blue" => Ok(Self::Blue),
            "green" => Ok(Self::Green),
            other => anyhow::bail!("invalid color: {other}"),
        }
    }
}

/// Read the currently active color for an environment.
///
/// # Errors
///
/// Returns an error if the DB query fails or the stored value is neither
/// `"blue"` nor `"green"`.
pub async fn get_active(pool: &PgPool, env: &str) -> Result<Color> {
    let raw: String =
        sqlx::query_scalar("SELECT active_color FROM active_stack WHERE env = $1")
            .bind(env)
            .fetch_one(pool)
            .await
            .with_context(|| format!("fetch active_stack for env={env}"))?;
    Color::from_str(&raw)
}

/// Atomically swap the active color for an environment.
///
/// Returns the new active color.
///
/// # Errors
///
/// Returns an error if the DB update fails.
pub async fn swap(pool: &PgPool, env: &str, actor: Option<Uuid>) -> Result<Color> {
    let current = get_active(pool, env).await?;
    let new_color = current.other();
    sqlx::query(
        "UPDATE active_stack \
         SET active_color = $2, swapped_at = now(), swapped_by = $3 \
         WHERE env = $1",
    )
    .bind(env)
    .bind(new_color.as_str())
    .bind(actor)
    .execute(pool)
    .await
    .context("swap active_stack")?;
    tracing::warn!(
        %env,
        previous = %current.as_str(),
        new = %new_color.as_str(),
        "active stack swapped"
    );
    Ok(new_color)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn color_other_alternates() {
        assert_eq!(Color::Blue.other(), Color::Green);
        assert_eq!(Color::Green.other(), Color::Blue);
        assert_eq!(Color::Blue.other().other(), Color::Blue);
    }

    #[test]
    fn color_as_str_is_lowercase() {
        assert_eq!(Color::Blue.as_str(), "blue");
        assert_eq!(Color::Green.as_str(), "green");
    }

    #[test]
    fn from_str_accepts_known_and_rejects_unknown() {
        assert_eq!(Color::from_str("blue").unwrap(), Color::Blue);
        assert_eq!(Color::from_str("green").unwrap(), Color::Green);
        assert!(Color::from_str("red").is_err());
    }
}
