//! LDAP/Active Directory service.

use ldap3::{Ldap, LdapConnAsync, LdapConnSettings, Scope, SearchEntry};
use std::time::Duration;
use tokio::time::Instant;
use tracing::{debug, error, info, warn};

use signapps_common::{Error, Result};
use signapps_db::models::{LdapConfig, LdapGroup, LdapTestResult, LdapSyncResult};

/// LDAP service for Active Directory operations.
pub struct LdapService;

impl LdapService {
    /// Test LDAP connection with the given configuration.
    pub async fn test_connection(config: &LdapConfig, password: &str) -> Result<LdapTestResult> {
        let start = Instant::now();

        // Build connection settings
        let settings = LdapConnSettings::new()
            .set_conn_timeout(Duration::from_secs(10))
            .set_starttls(config.use_tls && !config.server_url.starts_with("ldaps://"));

        // Connect to LDAP server
        let (conn, mut ldap) = match LdapConnAsync::with_settings(settings, &config.server_url).await {
            Ok(result) => result,
            Err(e) => {
                error!("Failed to connect to LDAP server: {}", e);
                return Ok(LdapTestResult {
                    success: false,
                    message: format!("Connection failed: {}", e),
                    connection_time_ms: Some(start.elapsed().as_millis() as u64),
                    users_found: None,
                    groups_found: None,
                });
            }
        };

        // Spawn connection handler
        ldap3::drive!(conn);

        // Bind with service account
        if let Err(e) = ldap.simple_bind(&config.bind_dn, password).await {
            error!("LDAP bind failed: {}", e);
            let _ = ldap.unbind().await;
            return Ok(LdapTestResult {
                success: false,
                message: format!("Bind failed: {}", e),
                connection_time_ms: Some(start.elapsed().as_millis() as u64),
                users_found: None,
                groups_found: None,
            });
        }

        // Search for users
        let user_filter = config.user_filter.as_deref()
            .unwrap_or("(&(objectClass=user)(objectCategory=person))");

        let users_found = match Self::count_entries(&mut ldap, &config.base_dn, user_filter).await {
            Ok(count) => Some(count),
            Err(e) => {
                warn!("Failed to count users: {}", e);
                None
            }
        };

        // Search for groups
        let group_filter = config.group_filter.as_deref()
            .unwrap_or("(objectClass=group)");

        let groups_found = match Self::count_entries(&mut ldap, &config.base_dn, group_filter).await {
            Ok(count) => Some(count),
            Err(e) => {
                warn!("Failed to count groups: {}", e);
                None
            }
        };

        let _ = ldap.unbind().await;

        let connection_time = start.elapsed().as_millis() as u64;
        info!(
            "LDAP test successful: {} users, {} groups found in {}ms",
            users_found.unwrap_or(0),
            groups_found.unwrap_or(0),
            connection_time
        );

        Ok(LdapTestResult {
            success: true,
            message: "Connection successful".to_string(),
            connection_time_ms: Some(connection_time),
            users_found,
            groups_found,
        })
    }

    /// Authenticate a user against LDAP.
    #[allow(dead_code)]
    pub async fn authenticate(
        config: &LdapConfig,
        service_password: &str,
        username: &str,
        user_password: &str,
    ) -> Result<Option<LdapUserInfo>> {
        let settings = LdapConnSettings::new()
            .set_conn_timeout(Duration::from_secs(10))
            .set_starttls(config.use_tls && !config.server_url.starts_with("ldaps://"));

        let (conn, mut ldap) = LdapConnAsync::with_settings(settings, &config.server_url)
            .await
            .map_err(|e| Error::Internal(format!("LDAP connection failed: {}", e)))?;

        ldap3::drive!(conn);

        // Bind with service account to search for user
        ldap.simple_bind(&config.bind_dn, service_password)
            .await
            .map_err(|e| Error::Internal(format!("LDAP service bind failed: {}", e)))?;

        // Search for user DN
        let user_filter = config.user_filter.as_deref()
            .unwrap_or("(&(objectClass=user)(sAMAccountName={username}))")
            .replace("{username}", username);

        let (rs, _) = ldap.search(
            &config.base_dn,
            Scope::Subtree,
            &user_filter,
            vec!["dn", "sAMAccountName", "displayName", "mail", "memberOf"],
        )
        .await
        .map_err(|e| Error::Internal(format!("LDAP search failed: {}", e)))?
        .success()
        .map_err(|e| Error::Internal(format!("LDAP search error: {}", e)))?;

        if rs.is_empty() {
            debug!("User {} not found in LDAP", username);
            let _ = ldap.unbind().await;
            return Ok(None);
        }

        let entry = SearchEntry::construct(rs.into_iter().next().unwrap());
        let user_dn = entry.dn.clone();

        // Extract user info
        let display_name = entry.attrs.get("displayName")
            .and_then(|v| v.first())
            .cloned();
        let email = entry.attrs.get("mail")
            .and_then(|v| v.first())
            .cloned();
        let member_of: Vec<String> = entry.attrs.get("memberOf")
            .cloned()
            .unwrap_or_default();

        // Unbind service account and try user bind
        let _ = ldap.unbind().await;

        // Reconnect and bind as user to verify password
        let (conn2, mut ldap2) = LdapConnAsync::with_settings(
            LdapConnSettings::new()
                .set_conn_timeout(Duration::from_secs(10))
                .set_starttls(config.use_tls && !config.server_url.starts_with("ldaps://")),
            &config.server_url,
        )
        .await
        .map_err(|e| Error::Internal(format!("LDAP reconnection failed: {}", e)))?;

        ldap3::drive!(conn2);

        match ldap2.simple_bind(&user_dn, user_password).await {
            Ok(result) => {
                let _ = ldap2.unbind().await;
                if result.rc == 0 {
                    info!("LDAP authentication successful for user: {}", username);

                    // Determine role based on group membership
                    let is_admin = config.admin_groups.iter()
                        .any(|g| member_of.iter().any(|m| m.contains(g)));

                    Ok(Some(LdapUserInfo {
                        dn: user_dn,
                        username: username.to_string(),
                        display_name,
                        email,
                        groups: member_of,
                        is_admin,
                    }))
                } else {
                    debug!("LDAP bind failed for user {}: rc={}", username, result.rc);
                    Ok(None)
                }
            }
            Err(e) => {
                let _ = ldap2.unbind().await;
                debug!("LDAP authentication failed for {}: {}", username, e);
                Ok(None)
            }
        }
    }

    /// List groups from LDAP.
    pub async fn list_groups(config: &LdapConfig, password: &str) -> Result<Vec<LdapGroup>> {
        let settings = LdapConnSettings::new()
            .set_conn_timeout(Duration::from_secs(10))
            .set_starttls(config.use_tls && !config.server_url.starts_with("ldaps://"));

        let (conn, mut ldap) = LdapConnAsync::with_settings(settings, &config.server_url)
            .await
            .map_err(|e| Error::Internal(format!("LDAP connection failed: {}", e)))?;

        ldap3::drive!(conn);

        ldap.simple_bind(&config.bind_dn, password)
            .await
            .map_err(|e| Error::Internal(format!("LDAP bind failed: {}", e)))?;

        let group_filter = config.group_filter.as_deref()
            .unwrap_or("(objectClass=group)");

        let (rs, _) = ldap.search(
            &config.base_dn,
            Scope::Subtree,
            group_filter,
            vec!["dn", "cn", "description", "member"],
        )
        .await
        .map_err(|e| Error::Internal(format!("LDAP search failed: {}", e)))?
        .success()
        .map_err(|e| Error::Internal(format!("LDAP search error: {}", e)))?;

        let _ = ldap.unbind().await;

        let groups: Vec<LdapGroup> = rs.into_iter()
            .map(|entry| {
                let entry = SearchEntry::construct(entry);
                let name = entry.attrs.get("cn")
                    .and_then(|v| v.first())
                    .cloned()
                    .unwrap_or_else(|| "Unknown".to_string());
                let description = entry.attrs.get("description")
                    .and_then(|v| v.first())
                    .cloned();
                let member_count = entry.attrs.get("member")
                    .map(|v| v.len() as i32)
                    .unwrap_or(0);

                LdapGroup {
                    dn: entry.dn,
                    name,
                    description,
                    member_count,
                }
            })
            .collect();

        info!("Found {} LDAP groups", groups.len());
        Ok(groups)
    }

    /// Sync users from LDAP to local database.
    pub async fn sync_users(
        config: &LdapConfig,
        password: &str,
    ) -> Result<(Vec<LdapUserInfo>, LdapSyncResult)> {
        let settings = LdapConnSettings::new()
            .set_conn_timeout(Duration::from_secs(30))
            .set_starttls(config.use_tls && !config.server_url.starts_with("ldaps://"));

        let (conn, mut ldap) = LdapConnAsync::with_settings(settings, &config.server_url)
            .await
            .map_err(|e| Error::Internal(format!("LDAP connection failed: {}", e)))?;

        ldap3::drive!(conn);

        ldap.simple_bind(&config.bind_dn, password)
            .await
            .map_err(|e| Error::Internal(format!("LDAP bind failed: {}", e)))?;

        let user_filter = config.user_filter.as_deref()
            .unwrap_or("(&(objectClass=user)(objectCategory=person))");

        let (rs, _) = ldap.search(
            &config.base_dn,
            Scope::Subtree,
            user_filter,
            vec!["dn", "sAMAccountName", "displayName", "mail", "memberOf", "userAccountControl"],
        )
        .await
        .map_err(|e| Error::Internal(format!("LDAP search failed: {}", e)))?
        .success()
        .map_err(|e| Error::Internal(format!("LDAP search error: {}", e)))?;

        let _ = ldap.unbind().await;

        let mut users = Vec::new();
        let mut errors = Vec::new();

        for entry_result in rs {
            let entry = SearchEntry::construct(entry_result);

            let username = match entry.attrs.get("sAMAccountName").and_then(|v| v.first()) {
                Some(u) => u.clone(),
                None => {
                    errors.push(format!("Entry {} missing sAMAccountName", entry.dn));
                    continue;
                }
            };

            let display_name = entry.attrs.get("displayName")
                .and_then(|v| v.first())
                .cloned();
            let email = entry.attrs.get("mail")
                .and_then(|v| v.first())
                .cloned();
            let member_of: Vec<String> = entry.attrs.get("memberOf")
                .cloned()
                .unwrap_or_default();

            let is_admin = config.admin_groups.iter()
                .any(|g| member_of.iter().any(|m| m.contains(g)));

            users.push(LdapUserInfo {
                dn: entry.dn,
                username,
                display_name,
                email,
                groups: member_of,
                is_admin,
            });
        }

        info!("Synced {} users from LDAP", users.len());

        let result = LdapSyncResult {
            users_created: 0,  // Caller will update these
            users_updated: 0,
            users_disabled: 0,
            groups_synced: 0,
            errors,
        };

        Ok((users, result))
    }

    /// Count entries matching a filter.
    async fn count_entries(ldap: &mut Ldap, base_dn: &str, filter: &str) -> Result<i32> {
        let (rs, _) = ldap.search(base_dn, Scope::Subtree, filter, vec!["dn"])
            .await
            .map_err(|e| Error::Internal(format!("LDAP search failed: {}", e)))?
            .success()
            .map_err(|e| Error::Internal(format!("LDAP search error: {}", e)))?;

        Ok(rs.len() as i32)
    }
}

/// Information about an LDAP user.
#[derive(Debug, Clone)]
pub struct LdapUserInfo {
    pub dn: String,
    pub username: String,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub groups: Vec<String>,
    pub is_admin: bool,
}
