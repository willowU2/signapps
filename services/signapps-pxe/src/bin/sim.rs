//! Test client that simulates a PXE DHCPDISCOVER packet and prints the
//! server's response.
//!
//! Environment:
//! * `PXE_SIM_PORT` — target ProxyDHCP UDP port (default 4011)
//! * `PXE_SIM_HOST` — target host (default 127.0.0.1)
//! * `PXE_SIM_MAC`  — spoofed client MAC (default aa:bb:cc:00:00:99)
//!
//! Usage:
//! ```bash
//! cargo run -p signapps-pxe --bin signapps-pxe-sim
//! PXE_SIM_PORT=4011 PXE_SIM_MAC=aa:bb:cc:dd:ee:ff \
//!     cargo run -p signapps-pxe --bin signapps-pxe-sim
//! ```

use std::net::UdpSocket;
use std::time::Duration;

const BOOTREQUEST: u8 = 1;
const DHCPDISCOVER: u8 = 1;
const OPT_DHCP_MSG_TYPE: u8 = 53;
const OPT_CLASS_ID: u8 = 60;
const OPT_END: u8 = 255;

fn main() -> anyhow::Result<()> {
    let port: u16 = std::env::var("PXE_SIM_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(4011);
    let host = std::env::var("PXE_SIM_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let mac = std::env::var("PXE_SIM_MAC").unwrap_or_else(|_| "aa:bb:cc:00:00:99".to_string());
    let mac_bytes: Vec<u8> = mac
        .split(':')
        .map(|s| u8::from_str_radix(s, 16).expect("malformed MAC"))
        .collect();
    anyhow::ensure!(mac_bytes.len() == 6, "MAC must be 6 bytes");

    println!(
        "PXE Sim -> ProxyDHCP on {}:{} (MAC {})",
        host, port, mac
    );

    // Build a minimal PXE DHCPDISCOVER.
    let mut pkt = vec![0u8; 236];
    pkt[0] = BOOTREQUEST;
    pkt[1] = 1; // Ethernet
    pkt[2] = 6; // hlen
    pkt[4..8].copy_from_slice(&[0xDE, 0xAD, 0xBE, 0xEF]); // xid
    pkt[28..34].copy_from_slice(&mac_bytes[..6]);

    // DHCP magic cookie + options
    pkt.extend_from_slice(&[99, 130, 83, 99]);
    pkt.extend_from_slice(&[OPT_DHCP_MSG_TYPE, 1, DHCPDISCOVER]);
    pkt.extend_from_slice(&[OPT_CLASS_ID, 9]);
    pkt.extend_from_slice(b"PXEClient");
    pkt.push(OPT_END);

    let client = UdpSocket::bind("0.0.0.0:0")?;
    client.set_read_timeout(Some(Duration::from_secs(3)))?;
    client.send_to(&pkt, format!("{}:{}", host, port))?;
    println!("  -> sent DHCPDISCOVER ({} bytes)", pkt.len());

    let mut buf = [0u8; 1024];
    match client.recv_from(&mut buf) {
        Ok((len, from)) => {
            println!("  <- received reply from {} ({} bytes)", from, len);
            if len >= 236 {
                let siaddr = &buf[20..24];
                let fname_end = buf[108..108 + 128]
                    .iter()
                    .position(|&b| b == 0)
                    .unwrap_or(128);
                let fname = std::str::from_utf8(&buf[108..108 + fname_end])
                    .unwrap_or("<non-utf8>");
                println!(
                    "    TFTP server: {}.{}.{}.{}",
                    siaddr[0], siaddr[1], siaddr[2], siaddr[3]
                );
                println!("    Boot file:   {}", fname);
            } else {
                println!("    (truncated reply, no boot info)");
            }
        }
        Err(e) => {
            eprintln!("  <- no reply received: {}", e);
            std::process::exit(1);
        }
    }

    Ok(())
}
