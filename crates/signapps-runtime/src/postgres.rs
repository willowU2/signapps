//! PostgreSQL runtime management.

/// Runtime manager for PostgreSQL.
pub struct RuntimeManager {
    database_url: String,
}

impl RuntimeManager {
    /// Ensure a PostgreSQL database is available.
    ///
    /// Resolution order:
    /// 1. `DATABASE_URL` environment variable → use as-is
    /// 2. Detect native PostgreSQL via `pg_isready`
    /// 3. Error with helpful message
    pub async fn ensure_database() -> Result<Self, Box<dyn std::error::Error>> {
        // 1. Check for explicit DATABASE_URL
        if let Ok(url) = std::env::var("DATABASE_URL") {
            if !url.is_empty() {
                tracing::info!("Using configured DATABASE_URL");
                return Ok(Self { database_url: url });
            }
        }

        // 2. Try native PostgreSQL on default port
        if Self::detect_native_postgres(5432).await {
            let url = "postgres://signapps:signapps@localhost:5432/signapps".to_string();
            tracing::info!("Detected native PostgreSQL on port 5432");
            return Ok(Self { database_url: url });
        }

        // 3. Try common alternative ports
        for port in [5433, 5434] {
            if Self::detect_native_postgres(port).await {
                let url = format!("postgres://signapps:signapps@localhost:{}/signapps", port);
                tracing::info!(port = port, "Detected native PostgreSQL");
                return Ok(Self { database_url: url });
            }
        }

        Err("PostgreSQL not found. Either:\n\
             1. Set DATABASE_URL environment variable\n\
             2. Install PostgreSQL natively\n\
             3. Run: docker run -d -p 5432:5432 \
                -e POSTGRES_DB=signapps \
                -e POSTGRES_USER=signapps \
                -e POSTGRES_PASSWORD=signapps \
                postgres:16"
            .into())
    }

    /// Get the database URL.
    pub fn database_url(&self) -> &str {
        &self.database_url
    }

    /// Detect if PostgreSQL is available on a given port.
    async fn detect_native_postgres(port: u16) -> bool {
        let result = tokio::process::Command::new("pg_isready")
            .arg("-h")
            .arg("localhost")
            .arg("-p")
            .arg(port.to_string())
            .output()
            .await;

        match result {
            Ok(output) => output.status.success(),
            Err(_) => {
                // pg_isready not found, try TCP connection instead
                tokio::net::TcpStream::connect(format!("localhost:{}", port))
                    .await
                    .is_ok()
            },
        }
    }
}
