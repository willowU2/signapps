//! Thin async wrapper around [`ldap3`] used by the AD sync engine.
//!
//! [`AdClient::connect`] opens a bound connection (simple bind) and
//! drives the background I/O task via the `ldap3::drive!` macro. The
//! `list_users` / `list_ous` helpers run subtree searches with a
//! pinned attribute list so tests can reason about the payload.
//!
//! **Never** log the `password` argument of [`AdClient::connect`].

use anyhow::{Context, Result};
use ldap3::{Ldap, LdapConnAsync, Scope, SearchEntry};

/// Async LDAP / AD client, bound at construction time.
pub struct AdClient {
    ldap: Ldap,
}

impl AdClient {
    /// Open an LDAP connection to `url` and perform a simple bind with
    /// `bind_dn` / `password`.
    ///
    /// The background I/O future is spawned with `ldap3::drive!` so
    /// callers do not need to drive it manually.
    ///
    /// # Errors
    ///
    /// - Connection failure (unreachable host, TLS handshake failure).
    /// - Bind rejection (wrong credentials, disabled account).
    ///
    /// # Examples
    ///
    /// ```no_run
    /// # use signapps_org::ad::client::AdClient;
    /// # async fn _demo() -> anyhow::Result<()> {
    /// let client = AdClient::connect(
    ///     "ldap://dc.example.com:389",
    ///     "CN=svc,DC=example,DC=com",
    ///     "super-secret",
    /// ).await?;
    /// drop(client); // unbind automatically
    /// # Ok(())
    /// # }
    /// ```
    pub async fn connect(url: &str, bind_dn: &str, password: &str) -> Result<Self> {
        let (conn, mut ldap) = LdapConnAsync::new(url).await.context("ldap connect")?;
        ldap3::drive!(conn);
        ldap.simple_bind(bind_dn, password)
            .await
            .context("ldap simple_bind")?
            .success()
            .context("ldap bind rejected")?;
        Ok(Self { ldap })
    }

    /// Search the tree at `base_dn` with `filter` and return the user
    /// attributes relevant to the Org mapping
    /// (`cn`, `mail`, `givenName`, `sn`, `distinguishedName`,
    /// `uSNChanged`).
    ///
    /// # Errors
    ///
    /// Any LDAP search failure is propagated with context.
    pub async fn list_users(
        &mut self,
        base_dn: &str,
        filter: &str,
    ) -> Result<Vec<SearchEntry>> {
        let (rs, _res) = self
            .ldap
            .search(
                base_dn,
                Scope::Subtree,
                filter,
                vec![
                    "cn",
                    "mail",
                    "givenName",
                    "sn",
                    "distinguishedName",
                    "uSNChanged",
                ],
            )
            .await
            .context("ldap search users")?
            .success()
            .context("ldap search users status")?;
        Ok(rs.into_iter().map(SearchEntry::construct).collect())
    }

    /// Search the tree at `base_dn` with `filter` and return the OU
    /// attributes relevant to the Org mapping (`ou`,
    /// `distinguishedName`, `description`).
    ///
    /// # Errors
    ///
    /// Any LDAP search failure is propagated with context.
    pub async fn list_ous(
        &mut self,
        base_dn: &str,
        filter: &str,
    ) -> Result<Vec<SearchEntry>> {
        let (rs, _res) = self
            .ldap
            .search(
                base_dn,
                Scope::Subtree,
                filter,
                vec!["ou", "distinguishedName", "description"],
            )
            .await
            .context("ldap search ous")?
            .success()
            .context("ldap search ous status")?;
        Ok(rs.into_iter().map(SearchEntry::construct).collect())
    }

    /// Gracefully unbind the connection. Errors during unbind are
    /// swallowed — the caller is dropping the client anyway.
    pub async fn unbind(mut self) {
        let _ = self.ldap.unbind().await;
    }
}
