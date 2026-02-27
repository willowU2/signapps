use async_tftp::server::TftpServerBuilder;

pub async fn start_tftp_server(dir: &str, port: u16) -> anyhow::Result<()> {
    tokio::fs::create_dir_all(dir).await?;

    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", port).parse()?;

    let mut server = match TftpServerBuilder::with_dir_ro(dir)?
        .bind(addr)
        .build()
        .await
    {
        Ok(s) => s,
        Err(e) => return Err(anyhow::anyhow!("Failed to build TFTP server: {:?}", e)),
    };

    tracing::info!("TFTP Server listening on {} serving {}", addr, dir);

    match server.serve().await {
        Ok(_) => Ok(()),
        Err(e) => Err(anyhow::anyhow!("TFTP serve error: {:?}", e)),
    }
}
