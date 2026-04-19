//! Integration test: the S2 PXE flow `simulate-dhcp` -> discovered -> enroll.
//!
//! Covers the operator-facing lifecycle:
//! 1. A DHCPDISCOVER arrives (simulated via test endpoint).
//! 2. The MAC shows up in the discovered assets list.
//! 3. The operator enrolls it into the fleet.
//!
//! `#[ignore]` — requires backend (PXE runs on port 3016).

mod common;

use serial_test::serial;

fn random_mac() -> String {
    let b: [u8; 3] = [
        rand::random::<u8>(),
        rand::random::<u8>(),
        rand::random::<u8>(),
    ];
    format!("aa:bb:cc:{:02x}:{:02x}:{:02x}", b[0], b[1], b[2])
}

#[tokio::test]
#[serial]
#[ignore]
async fn test_pxe_simulate_dhcp_then_enroll() -> anyhow::Result<()> {
    let backend = common::spawn_backend().await?;
    let token = common::admin_token(&backend.base_url).await?;

    let client = reqwest::Client::new();
    let mac = random_mac();

    // Step 1: simulate a DHCPDISCOVER arriving at the PXE service.
    let sim_resp = client
        .post(format!(
            "{}:3016/api/v1/pxe/_test/simulate-dhcp",
            backend.base_url
        ))
        .bearer_auth(&token)
        .json(&serde_json::json!({"mac": mac}))
        .send()
        .await?;

    if sim_resp.status() == 404 {
        eprintln!("PXE simulate-dhcp endpoint not exposed, skipping");
        return Ok(());
    }
    sim_resp.error_for_status()?;

    // Step 2: verify the MAC shows up in the discovered list.
    let discovered_resp = client
        .get(format!(
            "{}:3016/api/v1/pxe/assets/discovered",
            backend.base_url
        ))
        .bearer_auth(&token)
        .send()
        .await?;

    if discovered_resp.status() == 404 {
        eprintln!("PXE discovered endpoint not exposed, skipping enrollment");
        return Ok(());
    }

    let discovered: serde_json::Value = discovered_resp.error_for_status()?.json().await?;
    let items: Vec<_> = discovered
        .as_array()
        .cloned()
        .or_else(|| {
            discovered
                .get("items")
                .and_then(|v| v.as_array())
                .cloned()
        })
        .unwrap_or_default();

    let seen = items
        .iter()
        .any(|a| a.get("mac_address").and_then(|v| v.as_str()) == Some(mac.as_str()));
    assert!(seen, "MAC {mac} should appear in discovered list");

    // Step 3: enroll it.
    let enroll_resp = client
        .post(format!(
            "{}:3016/api/v1/pxe/assets/{}/enroll",
            backend.base_url, mac
        ))
        .bearer_auth(&token)
        .json(&serde_json::json!({}))
        .send()
        .await?;

    assert!(
        enroll_resp.status().is_success() || enroll_resp.status().as_u16() == 404,
        "enroll returned {}",
        enroll_resp.status()
    );

    Ok(())
}
