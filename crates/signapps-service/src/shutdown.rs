//! Graceful shutdown signal handling
//!
//! Provides a cross-platform way to handle shutdown signals (Ctrl+C, SIGTERM, Windows service stop).

use std::sync::Arc;
use tokio::sync::watch;

/// A signal that can be used to coordinate graceful shutdown.
///
/// Clone this and pass it to different parts of your application.
/// When shutdown is triggered, all clones will be notified.
#[derive(Clone)]
pub struct ShutdownSignal {
    sender: Arc<watch::Sender<bool>>,
    receiver: watch::Receiver<bool>,
}

impl Default for ShutdownSignal {
    fn default() -> Self {
        Self::new()
    }
}

impl ShutdownSignal {
    /// Create a new shutdown signal.
    pub fn new() -> Self {
        let (sender, receiver) = watch::channel(false);
        Self {
            sender: Arc::new(sender),
            receiver,
        }
    }

    /// Trigger the shutdown signal.
    ///
    /// All waiting tasks will be notified.
    pub fn trigger(&self) {
        let _ = self.sender.send(true);
        tracing::info!("Shutdown signal triggered");
    }

    /// Check if shutdown has been triggered.
    pub fn is_triggered(&self) -> bool {
        *self.receiver.borrow()
    }

    /// Wait for the shutdown signal.
    ///
    /// Returns immediately if shutdown has already been triggered.
    pub async fn wait(&mut self) {
        // If already triggered, return immediately
        if *self.receiver.borrow() {
            return;
        }

        // Wait for the signal to change
        let _ = self.receiver.changed().await;
    }

    /// Create a future that completes when shutdown is triggered.
    ///
    /// This is useful for `tokio::select!` patterns.
    pub fn notified(&mut self) -> impl std::future::Future<Output = ()> + '_ {
        async move {
            self.wait().await;
        }
    }

    /// Get a receiver for the shutdown signal.
    ///
    /// Useful when you need to pass the signal to multiple tasks.
    pub fn subscribe(&self) -> watch::Receiver<bool> {
        self.receiver.clone()
    }
}

/// Install signal handlers for graceful shutdown.
///
/// This installs handlers for:
/// - Ctrl+C (SIGINT on Unix)
/// - SIGTERM on Unix
/// - Windows service stop events (when running as a service)
///
/// Returns a ShutdownSignal that will be triggered when any of these signals are received.
pub async fn install_signal_handlers() -> ShutdownSignal {
    let signal = ShutdownSignal::new();
    let signal_clone = signal.clone();

    tokio::spawn(async move {
        wait_for_shutdown_signal().await;
        signal_clone.trigger();
    });

    signal
}

/// Wait for a shutdown signal from the OS.
async fn wait_for_shutdown_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};

        let mut sigint = signal(SignalKind::interrupt()).expect("Failed to install SIGINT handler");
        let mut sigterm =
            signal(SignalKind::terminate()).expect("Failed to install SIGTERM handler");

        tokio::select! {
            _ = sigint.recv() => {
                tracing::info!("Received SIGINT (Ctrl+C)");
            }
            _ = sigterm.recv() => {
                tracing::info!("Received SIGTERM");
            }
        }
    }

    #[cfg(windows)]
    {
        // On Windows, we just listen for Ctrl+C
        // Windows service stop events are handled separately in service.rs
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
        tracing::info!("Received Ctrl+C");
    }

    #[cfg(not(any(unix, windows)))]
    {
        // Fallback: just wait for Ctrl+C
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
        tracing::info!("Received Ctrl+C");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_shutdown_signal_trigger() {
        let signal = ShutdownSignal::new();
        assert!(!signal.is_triggered());

        signal.trigger();
        assert!(signal.is_triggered());
    }

    #[tokio::test]
    async fn test_shutdown_signal_clone() {
        let signal1 = ShutdownSignal::new();
        let signal2 = signal1.clone();

        signal1.trigger();

        assert!(signal1.is_triggered());
        assert!(signal2.is_triggered());
    }

    #[tokio::test]
    async fn test_shutdown_signal_wait() {
        let signal = ShutdownSignal::new();
        let mut waiter = signal.clone();

        // Trigger in background
        let trigger = signal.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            trigger.trigger();
        });

        // Wait should complete
        tokio::time::timeout(std::time::Duration::from_millis(100), waiter.wait())
            .await
            .expect("Wait timed out");

        assert!(signal.is_triggered());
    }
}
