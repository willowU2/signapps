//! Lazy-initialized heavy AI resources shared across all handlers.
//!
//! Hardware detection (via `nvidia-smi`, `rocm-smi`, Windows WMI, etc.)
//! can take several seconds to probe GPUs. Paying this cost at every
//! boot of the single-binary runtime would bloat the boot budget.
//!
//! Instead, we defer hardware detection and model-manager construction
//! to the first handler that needs them, via
//! [`tokio::sync::OnceCell`]. Subsequent calls are instantaneous.
//!
//! # Errors
//!
//! [`ensure_hardware`] and [`ensure_model_manager`] never fail today:
//! hardware detection is infallible (falls back to CPU) and model
//! manager construction is a simple `Arc::new`. The `Result` return
//! type is preserved so future backends can propagate failures.

use std::sync::Arc;

use signapps_runtime::{HardwareProfile, ModelManager};
use tokio::sync::OnceCell;

static HARDWARE: OnceCell<HardwareProfile> = OnceCell::const_new();
static MODEL_MANAGER: OnceCell<Arc<ModelManager>> = OnceCell::const_new();

/// Probe the machine's GPUs and cache the resulting [`HardwareProfile`].
///
/// The first call pays the cost of invoking `nvidia-smi` /
/// `rocm-smi` / Windows WMI (~2–5 s depending on driver). Subsequent
/// calls are instantaneous.
///
/// # Errors
///
/// Currently infallible. Returns `Result` for forward-compatibility.
///
/// # Panics
///
/// No panics possible — all probe failures fall back to CPU backend.
pub async fn ensure_hardware() -> anyhow::Result<&'static HardwareProfile> {
    let hw = HARDWARE
        .get_or_init(|| async {
            let profile = HardwareProfile::detect().await;
            tracing::info!(
                "Hardware: {} (VRAM: {} MB, CPU: {} cores)",
                profile.preferred_backend,
                profile.total_vram_mb,
                profile.cpu_cores
            );
            profile
        })
        .await;
    Ok(hw)
}

/// Build the [`ModelManager`] on first access.
///
/// The model manager itself is cheap to construct (just sets up a
/// cache directory), but by wiring it alongside the hardware profile
/// we keep all model-related initialization in one place.
///
/// # Errors
///
/// Currently infallible. Returns `Result` for forward-compatibility.
///
/// # Panics
///
/// No panics possible.
pub async fn ensure_model_manager() -> anyhow::Result<Arc<ModelManager>> {
    let mm = MODEL_MANAGER
        .get_or_init(|| async {
            // Eagerly ensure the hardware profile is cached so handlers
            // that only need model management (not GPU probing) still
            // share the same detection result.
            let _ = ensure_hardware().await;
            let manager = Arc::new(ModelManager::new(None));
            tracing::info!("Model manager initialized");
            manager
        })
        .await;
    Ok(mm.clone())
}

/// Umbrella initializer invoked by the top-level integration test.
///
/// Forces both [`HARDWARE`] and [`MODEL_MANAGER`] to materialize so
/// that a lazy-init smoke test can assert the second call is
/// essentially free (< 50 ms).
///
/// # Errors
///
/// Returns an error if either sub-initializer fails (currently never).
pub async fn ensure_initialized() -> anyhow::Result<()> {
    let _hw = ensure_hardware().await?;
    let _mm = ensure_model_manager().await?;
    Ok(())
}
