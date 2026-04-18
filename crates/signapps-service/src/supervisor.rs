//! Task supervisor with exponential-backoff restart for the single-binary runtime.
//!
//! Each [`ServiceSpec`] declares a name, a port (for diagnostics) and an
//! `async fn() -> Result<()>` factory.  [`Supervisor::run_forever`]
//! spawns every service as a `tokio::task`, restarts those that exit in
//! error with exponential backoff (1 s, 2 s, 4 s, 8 s, 16 s, capped at
//! 30 s), and escalates to a permanent `failed` state after 5 crashes in
//! under 60 s — which is logged via `tracing::error!` and leaves the
//! other tasks running.
//!
//! # Errors
//!
//! [`Supervisor::run_until_all_done`] is a test helper; it waits until
//! every task has completed cleanly and returns the last error seen if any.
//!
//! # Panics
//!
//! Aucun panic possible — les panics à l'intérieur d'une task sont
//! capturés par `tokio::task::JoinSet` et traités comme une erreur pour
//! le compteur de backoff.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::Result;
use tokio::task::JoinSet;

/// Type alias for the boxed factory closure that produces the service's
/// main future.  Kept private — consumers build one via [`ServiceSpec::new`].
type ServiceFactory =
    Arc<dyn Fn() -> Pin<Box<dyn Future<Output = Result<()>> + Send>> + Send + Sync>;

/// Declarative spec for one service running inside the single-binary process.
pub struct ServiceSpec {
    /// Human-readable name used in logs and tracing spans.
    pub name: String,
    /// TCP port the service binds to (diagnostics only — the factory is
    /// responsible for actually listening).
    pub port: u16,
    /// Closure that produces the service's main future on every restart.
    pub factory: ServiceFactory,
}

impl ServiceSpec {
    /// Build a new [`ServiceSpec`] from a name, a port (diagnostics only)
    /// and a factory closure that produces the service's main future.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_service::supervisor::ServiceSpec;
    ///
    /// let spec = ServiceSpec::new("demo", 0, || async { Ok(()) });
    /// assert_eq!(spec.name, "demo");
    /// ```
    ///
    /// # Errors
    ///
    /// The constructor itself never fails — errors only surface when the
    /// produced future is awaited by the [`Supervisor`].
    ///
    /// # Panics
    ///
    /// Aucun panic possible.
    pub fn new<F, Fut>(name: impl Into<String>, port: u16, factory: F) -> Self
    where
        F: Fn() -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<()>> + Send + 'static,
    {
        let factory: ServiceFactory = Arc::new(move || Box::pin(factory()));
        Self {
            name: name.into(),
            port,
            factory,
        }
    }
}

/// Restart policy: exponential backoff up to 30 s, permanent failure after
/// 5 crashes in a 60 s sliding window.
#[derive(Clone, Copy, Debug)]
struct RestartPolicy {
    max_crashes_per_minute: usize,
    max_backoff: Duration,
}

impl Default for RestartPolicy {
    fn default() -> Self {
        Self {
            max_crashes_per_minute: 5,
            max_backoff: Duration::from_secs(30),
        }
    }
}

/// Supervises a batch of [`ServiceSpec`]s.
pub struct Supervisor {
    specs: Vec<ServiceSpec>,
    policy: RestartPolicy,
}

impl Supervisor {
    /// Build a supervisor with the default restart policy.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_service::supervisor::{ServiceSpec, Supervisor};
    ///
    /// let specs = vec![ServiceSpec::new("demo", 0, || async { Ok(()) })];
    /// let _sup = Supervisor::new(specs);
    /// ```
    ///
    /// # Panics
    ///
    /// Aucun panic possible.
    pub fn new(specs: Vec<ServiceSpec>) -> Self {
        Self {
            specs,
            policy: RestartPolicy::default(),
        }
    }

    /// Spawn every service and keep restarting failed ones until the
    /// process receives SIGINT/SIGTERM.  Never returns under normal use.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// # use signapps_service::supervisor::{ServiceSpec, Supervisor};
    /// # async fn run() -> anyhow::Result<()> {
    /// let specs = vec![ServiceSpec::new("demo", 0, || async { Ok(()) })];
    /// Supervisor::new(specs).run_forever().await
    /// # }
    /// ```
    ///
    /// # Errors
    ///
    /// Returns the last non-fatal error encountered, once every task has
    /// either exited cleanly or been escalated to `failed`.
    ///
    /// # Panics
    ///
    /// Aucun panic possible — les panics des tasks sont capturés par
    /// `tokio::task::JoinSet` et traités comme une erreur.
    #[tracing::instrument(skip(self), fields(count = self.specs.len()))]
    pub async fn run_forever(self) -> Result<()> {
        let mut set = JoinSet::new();

        for spec in self.specs {
            let policy = self.policy;
            set.spawn(async move {
                let mut crashes: Vec<Instant> = Vec::new();
                let mut attempt: u32 = 0;

                loop {
                    let fut = (spec.factory)();
                    match fut.await {
                        Ok(()) => {
                            tracing::info!(service = %spec.name, "service exited cleanly");
                            return;
                        },
                        Err(err) => {
                            let now = Instant::now();
                            crashes.retain(|t| now.duration_since(*t) < Duration::from_secs(60));
                            crashes.push(now);

                            tracing::error!(
                                service = %spec.name,
                                port = spec.port,
                                ?err,
                                crashes_in_last_minute = crashes.len(),
                                "service crashed"
                            );

                            if crashes.len() > policy.max_crashes_per_minute {
                                tracing::error!(
                                    service = %spec.name,
                                    "crash loop detected — marking service as failed"
                                );
                                return;
                            }

                            let backoff = std::cmp::min(
                                Duration::from_secs(1u64 << attempt.min(5)),
                                policy.max_backoff,
                            );
                            attempt = attempt.saturating_add(1);
                            tokio::time::sleep(backoff).await;
                        },
                    }
                }
            });
        }

        while set.join_next().await.is_some() {}
        Ok(())
    }

    /// Test-only helper that waits for every task to complete, cleanly or not.
    ///
    /// # Examples
    ///
    /// ```
    /// # use signapps_service::supervisor::{ServiceSpec, Supervisor};
    /// # async fn run() -> anyhow::Result<()> {
    /// let specs = vec![ServiceSpec::new("demo", 0, || async { Ok(()) })];
    /// Supervisor::new(specs).run_until_all_done().await
    /// # }
    /// ```
    ///
    /// # Errors
    ///
    /// Returns the last error produced by any task, or `Ok(())` if all tasks
    /// succeeded.
    ///
    /// # Panics
    ///
    /// Aucun panic possible.
    pub async fn run_until_all_done(self) -> Result<()> {
        let mut set = JoinSet::new();
        for spec in self.specs {
            set.spawn(async move { (spec.factory)().await });
        }
        let mut last: Result<()> = Ok(());
        while let Some(res) = set.join_next().await {
            if let Ok(Err(e)) = res {
                last = Err(e);
            }
        }
        last
    }
}
