//! ManageSieve protocol server implementation (RFC 5804).
//!
//! Accepts TCP connections on port 4190, authenticates users via SASL PLAIN,
//! and provides script management backed by `mailserver.sieve_scripts`.

use crate::state::MailServerState;
use sqlx::{Pool, Postgres};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use uuid::Uuid;

/// Capabilities advertised by the ManageSieve server.
const CAPABILITIES: &str = r#""IMPLEMENTATION" "signapps-sieve"
"SIEVE" "fileinto reject vacation"
"SASL" "PLAIN"
"VERSION" "1.0"
OK
"#;

/// Start the ManageSieve server on the given port.
///
/// Runs forever, accepting TCP connections. Should be spawned via `tokio::spawn`.
///
/// # Errors
///
/// Logs errors but does not propagate them.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(state), fields(port))]
pub async fn start(state: MailServerState, port: u16) {
    let addr = format!("0.0.0.0:{}", port);
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => {
            tracing::info!("ManageSieve listening on port {}", port);
            l
        },
        Err(e) => {
            tracing::error!("Failed to bind ManageSieve on {}: {}", addr, e);
            return;
        },
    };

    loop {
        let (stream, peer_addr) = match listener.accept().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::warn!("ManageSieve accept error: {}", e);
                continue;
            },
        };

        let state = state.clone();
        tokio::spawn(async move {
            tracing::debug!(peer = %peer_addr, "ManageSieve connection");
            if let Err(e) = handle_connection(stream, state).await {
                tracing::debug!(peer = %peer_addr, "ManageSieve connection ended: {}", e);
            }
        });
    }
}

/// ManageSieve session state.
struct SieveSession {
    /// Authenticated account ID (set after AUTHENTICATE).
    account_id: Option<Uuid>,
    /// Authenticated email address.
    email: Option<String>,
}

/// Handle a single ManageSieve connection.
///
/// # Errors
///
/// Returns I/O errors on unrecoverable failures.
///
/// # Panics
///
/// None.
async fn handle_connection(
    stream: tokio::net::TcpStream,
    state: MailServerState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    let mut session = SieveSession {
        account_id: None,
        email: None,
    };

    // Send capabilities
    writer.write_all(CAPABILITIES.as_bytes()).await?;

    let mut line = String::new();

    loop {
        line.clear();
        let n = reader.read_line(&mut line).await?;
        if n == 0 {
            break; // EOF
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let upper = trimmed.to_uppercase();

        if upper.starts_with("AUTHENTICATE") {
            handle_authenticate(&mut writer, &mut reader, &mut session, &state.pool, trimmed)
                .await?;
        } else if upper == "LISTSCRIPTS" {
            handle_listscripts(&mut writer, &session, &state.pool).await?;
        } else if upper.starts_with("GETSCRIPT") {
            handle_getscript(&mut writer, &session, &state.pool, trimmed).await?;
        } else if upper.starts_with("PUTSCRIPT") {
            handle_putscript(&mut writer, &mut reader, &session, &state.pool, trimmed).await?;
        } else if upper.starts_with("SETACTIVE") {
            handle_setactive(&mut writer, &session, &state.pool, trimmed).await?;
        } else if upper.starts_with("DELETESCRIPT") {
            handle_deletescript(&mut writer, &session, &state.pool, trimmed).await?;
        } else if upper.starts_with("CAPABILITY") {
            writer.write_all(CAPABILITIES.as_bytes()).await?;
        } else if upper.starts_with("LOGOUT") {
            writer.write_all(b"OK \"Goodbye\"\r\n").await?;
            break;
        } else if upper.starts_with("NOOP") {
            writer.write_all(b"OK\r\n").await?;
        } else {
            writer.write_all(b"NO \"Unknown command\"\r\n").await?;
        }
    }

    Ok(())
}

/// Handle AUTHENTICATE PLAIN command.
///
/// Expects: `AUTHENTICATE "PLAIN" "<base64>"`
/// The base64 decodes to: `\0<authzid>\0<password>` or `<authzid>\0<authcid>\0<password>`
async fn handle_authenticate(
    writer: &mut (impl AsyncWriteExt + Unpin),
    reader: &mut (impl AsyncBufReadExt + Unpin),
    session: &mut SieveSession,
    pool: &Pool<Postgres>,
    line: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Parse the AUTHENTICATE command
    let parts: Vec<&str> = line.splitn(3, ' ').collect();

    let b64_data = if parts.len() >= 3 {
        // Inline: AUTHENTICATE "PLAIN" "base64data"
        parts[2].trim_matches('"').to_string()
    } else {
        // Challenge-response: send empty challenge, read response
        writer.write_all(b"\r\n").await?;
        let mut response = String::new();
        reader.read_line(&mut response).await?;
        response.trim().trim_matches('"').to_string()
    };

    // Decode SASL PLAIN
    let decoded = match base64::engine::general_purpose::STANDARD.decode(&b64_data) {
        Ok(d) => d,
        Err(_) => {
            writer
                .write_all(b"NO \"Invalid base64 encoding\"\r\n")
                .await?;
            return Ok(());
        },
    };

    // SASL PLAIN: \0authcid\0password
    let parts: Vec<&[u8]> = decoded.splitn(3, |&b| b == 0).collect();
    if parts.len() < 3 {
        writer
            .write_all(b"NO \"Invalid SASL PLAIN format\"\r\n")
            .await?;
        return Ok(());
    }

    let authcid = String::from_utf8_lossy(parts[1]);
    let password = String::from_utf8_lossy(parts[2]);

    // Look up account and verify password
    #[derive(sqlx::FromRow)]
    struct AuthRow {
        id: Uuid,
        password_hash: Option<String>,
    }

    let account = sqlx::query_as::<_, AuthRow>(
        "SELECT id, password_hash FROM mailserver.accounts WHERE LOWER(address) = LOWER($1) AND COALESCE(is_active, true)",
    )
    .bind(authcid.as_ref())
    .fetch_optional(pool)
    .await;

    match account {
        Ok(Some(row)) => {
            // Verify password with Argon2
            let hash = row.password_hash.unwrap_or_default();
            let valid = verify_password(&password, &hash);
            if valid {
                session.account_id = Some(row.id);
                session.email = Some(authcid.to_string());
                writer.write_all(b"OK\r\n").await?;
            } else {
                writer.write_all(b"NO \"Invalid credentials\"\r\n").await?;
            }
        },
        Ok(None) => {
            writer.write_all(b"NO \"Account not found\"\r\n").await?;
        },
        Err(e) => {
            tracing::error!("Auth lookup failed: {}", e);
            writer.write_all(b"NO \"Internal error\"\r\n").await?;
        },
    }

    Ok(())
}

/// Handle LISTSCRIPTS command.
async fn handle_listscripts(
    writer: &mut (impl AsyncWriteExt + Unpin),
    session: &SieveSession,
    pool: &Pool<Postgres>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let account_id = match session.account_id {
        Some(id) => id,
        None => {
            writer.write_all(b"NO \"Not authenticated\"\r\n").await?;
            return Ok(());
        },
    };

    #[derive(sqlx::FromRow)]
    struct ScriptRow {
        name: String,
        is_active: bool,
    }

    let scripts: Vec<ScriptRow> = sqlx::query_as(
        "SELECT name, is_active FROM mailserver.sieve_scripts WHERE account_id = $1 ORDER BY name",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for script in &scripts {
        if script.is_active {
            let line = format!("\"{}\" ACTIVE\r\n", script.name);
            writer.write_all(line.as_bytes()).await?;
        } else {
            let line = format!("\"{}\"\r\n", script.name);
            writer.write_all(line.as_bytes()).await?;
        }
    }
    writer.write_all(b"OK\r\n").await?;

    Ok(())
}

/// Handle GETSCRIPT command.
///
/// Format: `GETSCRIPT "scriptname"`
async fn handle_getscript(
    writer: &mut (impl AsyncWriteExt + Unpin),
    session: &SieveSession,
    pool: &Pool<Postgres>,
    line: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let account_id = match session.account_id {
        Some(id) => id,
        None => {
            writer.write_all(b"NO \"Not authenticated\"\r\n").await?;
            return Ok(());
        },
    };

    let script_name = extract_quoted_arg(line, 1).unwrap_or_default();

    let source: Option<String> = sqlx::query_scalar(
        "SELECT script_source FROM mailserver.sieve_scripts WHERE account_id = $1 AND name = $2",
    )
    .bind(account_id)
    .bind(&script_name)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    match source {
        Some(src) => {
            let response = format!("{{{}}}\r\n{}\r\nOK\r\n", src.len(), src);
            writer.write_all(response.as_bytes()).await?;
        },
        None => {
            writer.write_all(b"NO \"Script not found\"\r\n").await?;
        },
    }

    Ok(())
}

/// Handle PUTSCRIPT command.
///
/// Format: `PUTSCRIPT "scriptname" {size+}`
/// Followed by the script content.
async fn handle_putscript(
    writer: &mut (impl AsyncWriteExt + Unpin),
    reader: &mut (impl AsyncBufReadExt + Unpin),
    session: &SieveSession,
    pool: &Pool<Postgres>,
    line: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let account_id = match session.account_id {
        Some(id) => id,
        None => {
            writer.write_all(b"NO \"Not authenticated\"\r\n").await?;
            return Ok(());
        },
    };

    let script_name = extract_quoted_arg(line, 1).unwrap_or_default();

    // Parse size from {NNN+} or {NNN}
    let size = if let Some(start) = line.find('{') {
        if let Some(end) = line.find('}') {
            line[start + 1..end]
                .trim_end_matches('+')
                .parse::<usize>()
                .unwrap_or(0)
        } else {
            0
        }
    } else {
        0
    };

    if size == 0 || size > 1_000_000 {
        writer.write_all(b"NO \"Invalid script size\"\r\n").await?;
        return Ok(());
    }

    // Read the script content
    let mut content = vec![0u8; size];
    tokio::io::AsyncReadExt::read_exact(reader, &mut content).await?;
    let script_source = String::from_utf8_lossy(&content).to_string();

    // Read trailing CRLF
    let mut trailing = String::new();
    let _ = reader.read_line(&mut trailing).await;

    // Validate syntax
    if let Err(e) = signapps_sieve::SieveScript::compile(&script_source) {
        let msg = format!("NO \"Script compilation error: {}\"\r\n", e);
        writer.write_all(msg.as_bytes()).await?;
        return Ok(());
    }

    // Upsert script
    let result = sqlx::query(
        r#"INSERT INTO mailserver.sieve_scripts (account_id, name, script_source, is_active)
           VALUES ($1, $2, $3, false)
           ON CONFLICT (account_id, name) DO UPDATE SET script_source = $3, updated_at = NOW()"#,
    )
    .bind(account_id)
    .bind(&script_name)
    .bind(&script_source)
    .execute(pool)
    .await;

    match result {
        Ok(_) => writer.write_all(b"OK\r\n").await?,
        Err(e) => {
            tracing::error!("PUTSCRIPT failed: {}", e);
            writer.write_all(b"NO \"Internal error\"\r\n").await?;
        },
    }

    Ok(())
}

/// Handle SETACTIVE command.
///
/// Format: `SETACTIVE "scriptname"` or `SETACTIVE ""` (deactivate all)
async fn handle_setactive(
    writer: &mut (impl AsyncWriteExt + Unpin),
    session: &SieveSession,
    pool: &Pool<Postgres>,
    line: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let account_id = match session.account_id {
        Some(id) => id,
        None => {
            writer.write_all(b"NO \"Not authenticated\"\r\n").await?;
            return Ok(());
        },
    };

    let script_name = extract_quoted_arg(line, 1).unwrap_or_default();

    // Deactivate all
    let _ =
        sqlx::query("UPDATE mailserver.sieve_scripts SET is_active = false WHERE account_id = $1")
            .bind(account_id)
            .execute(pool)
            .await;

    if !script_name.is_empty() {
        let result = sqlx::query(
            "UPDATE mailserver.sieve_scripts SET is_active = true, updated_at = NOW() \
             WHERE account_id = $1 AND name = $2 RETURNING id",
        )
        .bind(account_id)
        .bind(&script_name)
        .fetch_optional(pool)
        .await;

        match result {
            Ok(Some(_)) => writer.write_all(b"OK\r\n").await?,
            Ok(None) => {
                writer.write_all(b"NO \"Script not found\"\r\n").await?;
            },
            Err(e) => {
                tracing::error!("SETACTIVE failed: {}", e);
                writer.write_all(b"NO \"Internal error\"\r\n").await?;
            },
        }
    } else {
        writer.write_all(b"OK\r\n").await?;
    }

    Ok(())
}

/// Handle DELETESCRIPT command.
///
/// Format: `DELETESCRIPT "scriptname"`
async fn handle_deletescript(
    writer: &mut (impl AsyncWriteExt + Unpin),
    session: &SieveSession,
    pool: &Pool<Postgres>,
    line: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let account_id = match session.account_id {
        Some(id) => id,
        None => {
            writer.write_all(b"NO \"Not authenticated\"\r\n").await?;
            return Ok(());
        },
    };

    let script_name = extract_quoted_arg(line, 1).unwrap_or_default();

    // Cannot delete the active script
    let is_active: bool = sqlx::query_scalar(
        "SELECT COALESCE(is_active, false) FROM mailserver.sieve_scripts WHERE account_id = $1 AND name = $2",
    )
    .bind(account_id)
    .bind(&script_name)
    .fetch_optional(pool)
    .await
    .unwrap_or(None)
    .unwrap_or(false);

    if is_active {
        writer
            .write_all(b"NO \"Cannot delete active script\"\r\n")
            .await?;
        return Ok(());
    }

    let result = sqlx::query(
        "DELETE FROM mailserver.sieve_scripts WHERE account_id = $1 AND name = $2 RETURNING id",
    )
    .bind(account_id)
    .bind(&script_name)
    .fetch_optional(pool)
    .await;

    match result {
        Ok(Some(_)) => writer.write_all(b"OK\r\n").await?,
        Ok(None) => {
            writer.write_all(b"NO \"Script not found\"\r\n").await?;
        },
        Err(e) => {
            tracing::error!("DELETESCRIPT failed: {}", e);
            writer.write_all(b"NO \"Internal error\"\r\n").await?;
        },
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Extract the nth quoted argument from a ManageSieve command line.
///
/// E.g., for `GETSCRIPT "myscript"`, `extract_quoted_arg(line, 1)` returns `"myscript"`.
fn extract_quoted_arg(line: &str, index: usize) -> Option<String> {
    let mut count = 0;
    let mut start = None;

    for (i, ch) in line.char_indices() {
        if ch == '"' {
            if start.is_some() {
                // End of a quoted arg
                if count == index {
                    return Some(line[start.unwrap()..i].to_string());
                }
                count += 1;
                start = None;
            } else {
                // Start of a quoted arg
                start = Some(i + 1);
            }
        }
    }

    None
}

/// Verify a password against an Argon2 hash.
fn verify_password(password: &str, hash: &str) -> bool {
    use argon2::{Argon2, PasswordHash, PasswordVerifier};
    let parsed = match PasswordHash::new(hash) {
        Ok(h) => h,
        Err(_) => return false,
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

use base64::Engine;
