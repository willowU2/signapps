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

#[tokio::test]
async fn supervisor_restarts_crashing_service() {
    use std::sync::atomic::{AtomicU32, Ordering};

    let attempts = Arc::new(AtomicU32::new(0));
    let attempts_c = attempts.clone();

    let spec = ServiceSpec::new("crashy", 0, move || {
        let a = attempts_c.clone();
        async move {
            let n = a.fetch_add(1, Ordering::SeqCst);
            if n < 2 {
                Err(anyhow::anyhow!("boom"))
            } else {
                tokio::time::sleep(Duration::from_millis(20)).await;
                Ok(())
            }
        }
    });

    let supervisor = Supervisor::new(vec![spec]);
    let handle = tokio::spawn(supervisor.run_forever());

    tokio::time::sleep(Duration::from_secs(5)).await;
    handle.abort();

    assert!(
        attempts.load(Ordering::SeqCst) >= 3,
        "supervisor must respawn at least twice before the third succeeds (got {})",
        attempts.load(Ordering::SeqCst)
    );
}

#[tokio::test]
async fn supervisor_gives_up_after_crash_loop() {
    use std::sync::atomic::{AtomicU32, Ordering};

    let attempts = Arc::new(AtomicU32::new(0));
    let attempts_c = attempts.clone();

    let spec = ServiceSpec::new("always-crashy", 0, move || {
        let a = attempts_c.clone();
        async move {
            a.fetch_add(1, Ordering::SeqCst);
            Err::<(), _>(anyhow::anyhow!("always fails"))
        }
    });

    let supervisor = Supervisor::new(vec![spec]);
    tokio::time::timeout(Duration::from_secs(90), supervisor.run_forever())
        .await
        .expect("supervisor should escalate to failed state in under 90 s")
        .expect("run_forever should return Ok after escalating");

    let n = attempts.load(Ordering::SeqCst);
    assert!(
        (4..=6).contains(&n),
        "expected ≈5 attempts before policy cap, got {n}"
    );
}

#[tokio::test]
async fn supervisor_respawns_panicking_service() {
    use std::sync::atomic::{AtomicU32, Ordering};

    let attempts = Arc::new(AtomicU32::new(0));
    let attempts_c = attempts.clone();

    let spec = ServiceSpec::new("panicky", 0, move || {
        let a = attempts_c.clone();
        async move {
            let n = a.fetch_add(1, Ordering::SeqCst);
            if n < 2 {
                panic!("boom");
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
            Ok(())
        }
    });

    let supervisor = Supervisor::new(vec![spec]);
    let handle = tokio::spawn(supervisor.run_forever());

    tokio::time::sleep(Duration::from_secs(5)).await;
    handle.abort();

    assert!(
        attempts.load(Ordering::SeqCst) >= 3,
        "supervisor must respawn panicking tasks (got {})",
        attempts.load(Ordering::SeqCst)
    );
}
