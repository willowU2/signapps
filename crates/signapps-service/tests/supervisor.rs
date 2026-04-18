use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use signapps_service::supervisor::{ServiceSpec, Supervisor};

#[tokio::test]
async fn supervisor_runs_all_services_in_parallel() {
    let counter = Arc::new(AtomicUsize::new(0));

    let specs: Vec<ServiceSpec> = (0..5)
        .map(|i| {
            let c = counter.clone();
            ServiceSpec::new(format!("svc-{i}"), 0, move || {
                let c = c.clone();
                async move {
                    c.fetch_add(1, Ordering::SeqCst);
                    tokio::time::sleep(Duration::from_millis(50)).await;
                    Ok(())
                }
            })
        })
        .collect();

    let supervisor = Supervisor::new(specs);
    let handle = tokio::spawn(async move { supervisor.run_until_all_done().await });
    tokio::time::sleep(Duration::from_millis(200)).await;
    handle.abort();

    assert_eq!(counter.load(Ordering::SeqCst), 5);
}
