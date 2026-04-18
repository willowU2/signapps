//! Task supervisor with exponential-backoff restart for the single-binary runtime.
//!
//! Each [`ServiceSpec`] declares a name, a port (for diagnostics) and an
//! `async fn() -> Result<()>` factory.  [`Supervisor::run_forever`]
//! spawns every service as a `tokio::task`, restarts those that exit in
//! error with exponential backoff (1 s, 2 s, 4 s, 8 s, 16 s, capped at
//! 30 s), and escalates to a permanent `failed` state on the 5th crash
//! inside a 60 s sliding window — which is logged via `tracing::error!`
//! and leaves the other tasks running.
//!
//! # Panics
//!
//! Panics happening inside a supervised task are surfaced by the inner
//! `tokio::task::spawn` as a `JoinError`, then folded into the same
//! crash counter as ordinary `anyhow::Error` returns.  The respawn loop
//! lives **outside** of the per-task closure so that a single `.unwrap()`
//! panic can no longer silently kill a service forever — the supervisor
//! sees it, counts it, backs off, and restarts until the escalation
//! threshold is reached.

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
    /// The signature returns `Result<()>` for forward compatibility, but
    /// the current implementation always completes with `Ok(())` — every
    /// crash (including panics, folded in as `JoinError`) is either
    /// respawned with backoff or escalated to `failed` by the outer
    /// loop without propagating out.
    ///
    /// # Panics
    ///
    /// None.  Panics inside a supervised service are caught by the
    /// inner `tokio::task::spawn`, converted into an `anyhow::Error`,
    /// and fed through the same backoff/escalation pipeline as ordinary
    /// `Result::Err` returns.
    #[tracing::instrument(skip(self), fields(count = self.specs.len()))]
    pub async fn run_forever(self) -> Result<()> {
        use std::collections::{HashMap, HashSet};

        let policy = self.policy;
        let specs: Vec<(usize, ServiceSpec)> = self.specs.into_iter().enumerate().collect();

        // Per-spec immutable metadata (name, port, factory) kept behind
        // an `Arc` so each spawn site can clone cheaply.  The factory is
        // itself already an `Arc<dyn Fn ...>`, so `.clone()` on it is a
        // refcount bump rather than a deep copy of the closure.
        let factories: HashMap<usize, Arc<(String, u16, ServiceFactory)>> = specs
            .iter()
            .map(|(idx, spec)| {
                (
                    *idx,
                    Arc::new((spec.name.clone(), spec.port, spec.factory.clone())),
                )
            })
            .collect();

        // Per-spec mutable state: sliding window of crash instants in the
        // last 60 s and the exponential backoff attempt counter.
        let mut state: HashMap<usize, (Vec<Instant>, u32)> = specs
            .iter()
            .map(|(idx, _)| (*idx, (Vec::new(), 0)))
            .collect();
        // Specs that have been permanently marked as failed — their
        // remaining tasks, if any, are drained but never respawned.
        let mut failed: HashSet<usize> = HashSet::new();

        // Each JoinSet item carries:
        //  - the spec index (so we can look up metadata + state)
        //  - the task outcome, already flattened into a single Result
        //  - `was_panic`: whether the outcome came from a JoinError
        type TaskOutcome = (usize, std::result::Result<(), anyhow::Error>, bool);
        let mut set: JoinSet<TaskOutcome> = JoinSet::new();

        // Initial spawn of every service.
        for (idx, _) in &specs {
            if let Some(arc) = factories.get(idx) {
                let idx = *idx;
                let arc = arc.clone();
                set.spawn(async move {
                    let fut = (arc.2)();
                    match tokio::task::spawn(fut).await {
                        Ok(res) => (idx, res, false),
                        Err(join_err) => {
                            let err = anyhow::anyhow!("task {} panicked: {join_err}", arc.0);
                            (idx, Err(err), true)
                        },
                    }
                });
            }
        }

        while let Some(join_out) = set.join_next().await {
            let (idx, res, was_panic) = match join_out {
                Ok(t) => t,
                Err(e) => {
                    // Supervisor-level JoinError on the *outer* wrapper
                    // task.  Extremely unlikely (our wrapper never
                    // panics and never returns Err via `?`), but if it
                    // does we log it and keep the supervisor alive.
                    tracing::error!(?e, "supervisor outer join error");
                    continue;
                },
            };

            let Some(arc) = factories.get(&idx) else {
                continue;
            };
            let (name, port, factory) = (arc.0.clone(), arc.1, arc.2.clone());

            if failed.contains(&idx) {
                // Drain any already-in-flight task for a spec we've
                // given up on — no respawn.
                continue;
            }

            match res {
                Ok(()) => {
                    tracing::info!(service = %name, "service exited cleanly");
                    continue;
                },
                Err(err) => {
                    let Some((crashes, attempt)) = state.get_mut(&idx) else {
                        continue;
                    };
                    let now = Instant::now();
                    crashes.retain(|t| now.duration_since(*t) < Duration::from_secs(60));
                    crashes.push(now);

                    tracing::error!(
                        service = %name,
                        port = port,
                        was_panic = was_panic,
                        ?err,
                        crashes_in_last_minute = crashes.len(),
                        "service crashed",
                    );

                    if crashes.len() >= policy.max_crashes_per_minute {
                        tracing::error!(
                            service = %name,
                            "crash loop detected — marking service as failed",
                        );
                        failed.insert(idx);
                        continue;
                    }

                    let backoff = std::cmp::min(
                        Duration::from_secs(1u64 << (*attempt).min(5)),
                        policy.max_backoff,
                    );
                    *attempt = attempt.saturating_add(1);
                    tokio::time::sleep(backoff).await;

                    // Respawn a fresh task for this spec.
                    let factory_c = factory.clone();
                    let name_c = name.clone();
                    set.spawn(async move {
                        let fut = (factory_c)();
                        match tokio::task::spawn(fut).await {
                            Ok(res) => (idx, res, false),
                            Err(join_err) => {
                                let err = anyhow::anyhow!("task {name_c} panicked: {join_err}");
                                (idx, Err(err), true)
                            },
                        }
                    });
                },
            }
        }

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
