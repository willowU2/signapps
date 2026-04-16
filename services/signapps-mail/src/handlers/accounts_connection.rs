use futures_util::StreamExt;
use lettre::{transport::smtp::authentication::Credentials, AsyncSmtpTransport, Tokio1Executor};

use crate::models::MailAccount;

/// Test SMTP connectivity for a mail account.
pub async fn test_smtp_connection(account: &MailAccount) -> (bool, Option<String>) {
    let Some(ref smtp_server) = account.smtp_server else {
        return (false, Some("SMTP server not configured".to_string()));
    };
    let smtp_port = account.smtp_port.unwrap_or(587) as u16;
    let use_tls = account.smtp_use_tls.unwrap_or(true);

    let mailer_result: Result<AsyncSmtpTransport<Tokio1Executor>, _> = if use_tls {
        let Some(ref password) = account.app_password else {
            return (false, Some("App password not set".to_string()));
        };
        let creds = Credentials::new(account.email_address.clone(), password.clone());
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(smtp_server)
            .map(|builder| builder.credentials(creds).port(smtp_port).build())
    } else {
        Ok(
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(smtp_server)
                .port(smtp_port)
                .build(),
        )
    };

    match mailer_result {
        Ok(mailer) => match mailer.test_connection().await {
            Ok(true) => (true, None),
            Ok(false) => (false, Some("Connection test returned false".to_string())),
            Err(e) => (false, Some(e.to_string())),
        },
        Err(e) => (false, Some(e.to_string())),
    }
}

/// Test IMAP connectivity for a mail account, returning discovered folder names.
pub async fn test_imap_connection(
    account: &MailAccount,
) -> (bool, Option<String>, Option<Vec<String>>) {
    let Some(ref imap_server) = account.imap_server else {
        return (false, Some("IMAP server not configured".to_string()), None);
    };
    let Some(ref password) = account.app_password else {
        return (false, Some("App password not set".to_string()), None);
    };

    let imap_port = account.imap_port.unwrap_or(993) as u16;

    // Build TLS connector (rustls — reliable on Windows)
    let tls = match crate::sync_service::build_native_tls_connector(false) {
        Ok(t) => t,
        Err(e) => return (false, Some(format!("TLS init failed: {}", e)), None),
    };

    // Connect to IMAP server
    let tcp_stream = match tokio::net::TcpStream::connect((imap_server.as_str(), imap_port)).await {
        Ok(stream) => stream,
        Err(e) => return (false, Some(format!("Connection failed: {}", e)), None),
    };

    let tls_stream = match crate::sync_service::tls_connect(&tls, imap_server, tcp_stream).await {
        Ok(stream) => stream,
        Err(e) => return (false, Some(format!("TLS handshake failed: {}", e)), None),
    };

    let client = async_imap::Client::new(tls_stream);

    // Try to login
    let mut session = match client.login(&account.email_address, password).await {
        Ok(session) => session,
        Err((e, _)) => return (false, Some(format!("Login failed: {}", e)), None),
    };

    // List folders to verify connection works
    let stream = match session.list(None, Some("*")).await {
        Ok(s) => s,
        Err(e) => {
            // Connection will be dropped automatically
            return (false, Some(format!("Failed to list folders: {}", e)), None);
        },
    };

    let folder_names: Vec<String> = stream
        .filter_map(|item| async move { item.ok().map(|f| f.name().to_string()) })
        .collect()
        .await;

    // Stream is consumed, now we can logout
    let _ = session.logout().await;

    (true, None, Some(folder_names))
}
