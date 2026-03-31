// PXE OS Image Catalog — built-in list of downloadable OS images

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::AppState;

const IMAGES_DIR: &str = "data/pxe/tftpboot/images";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsImage {
    pub name: String,
    pub version: String,
    pub arch: String,
    pub iso_url: String,
    pub sha256: String,
    pub size_bytes: u64,
    pub os_type: String,
    pub category: String,
    pub description: String,
}

pub fn get_catalog() -> Vec<OsImage> {
    vec![
        // ====================================================================
        // Windows Desktop
        // ====================================================================
        OsImage {
            name: "Windows 11".into(),
            version: "23H2".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Microsoft license — download via microsoft.com/software-download
            sha256: "".into(),
            size_bytes: 6_200_000_000,
            os_type: "windows".into(),
            category: "desktop".into(),
            description: "Windows 11 23H2 — latest consumer release with TPM 2.0 requirement.".into(),
        },
        OsImage {
            name: "Windows 11".into(),
            version: "22H2".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Microsoft license — download via microsoft.com/software-download
            sha256: "".into(),
            size_bytes: 6_100_000_000,
            os_type: "windows".into(),
            category: "desktop".into(),
            description: "Windows 11 22H2 — previous stable consumer release.".into(),
        },
        OsImage {
            name: "Windows 10".into(),
            version: "22H2".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Microsoft license — download via microsoft.com/software-download
            sha256: "".into(),
            size_bytes: 5_900_000_000,
            os_type: "windows".into(),
            category: "desktop".into(),
            description: "Windows 10 22H2 — final feature update for Windows 10 consumer.".into(),
        },
        OsImage {
            name: "Windows 10".into(),
            version: "21H2".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Microsoft license — download via microsoft.com/software-download
            sha256: "".into(),
            size_bytes: 5_700_000_000,
            os_type: "windows".into(),
            category: "desktop".into(),
            description: "Windows 10 21H2 — stable enterprise-supported release.".into(),
        },
        OsImage {
            name: "Windows 10 LTSC".into(),
            version: "2021".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Microsoft VLSC license
            sha256: "".into(),
            size_bytes: 4_700_000_000,
            os_type: "windows".into(),
            category: "desktop".into(),
            description: "Windows 10 LTSC 2021 — long-term servicing channel, no bloatware, 5-year support.".into(),
        },
        OsImage {
            name: "Windows 10 LTSC".into(),
            version: "2019".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Microsoft VLSC license
            sha256: "".into(),
            size_bytes: 4_600_000_000,
            os_type: "windows".into(),
            category: "desktop".into(),
            description: "Windows 10 LTSC 2019 — long-term servicing, based on RS5/1809 build.".into(),
        },
        OsImage {
            name: "Windows 8.1".into(),
            version: "Update 3".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Microsoft license
            sha256: "".into(),
            size_bytes: 4_000_000_000,
            os_type: "windows".into(),
            category: "desktop".into(),
            description: "Windows 8.1 — legacy desktop OS, end of extended support Jan 2023.".into(),
        },
        OsImage {
            name: "Windows 7 SP1".into(),
            version: "SP1".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Microsoft license — EOL Jan 2020
            sha256: "".into(),
            size_bytes: 3_200_000_000,
            os_type: "windows".into(),
            category: "desktop".into(),
            description: "Windows 7 SP1 — legacy OS (EOL). For isolated lab/repair environments only.".into(),
        },
        OsImage {
            name: "Windows PE".into(),
            version: "11 (ADK)".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Built via Windows ADK — https://docs.microsoft.com/windows-hardware/get-started/adk-install
            sha256: "".into(),
            size_bytes: 600_000_000,
            os_type: "windows".into(),
            category: "desktop".into(),
            description: "WinPE — minimal Windows environment for deployment, recovery and diagnostics.".into(),
        },
        // ====================================================================
        // Windows Server
        // ====================================================================
        OsImage {
            name: "Windows Server 2025".into(),
            version: "24H2".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Microsoft VLSC license
            sha256: "".into(),
            size_bytes: 5_600_000_000,
            os_type: "windows".into(),
            category: "server".into(),
            description: "Windows Server 2025 — latest Microsoft server platform with AD, Hyper-V.".into(),
        },
        OsImage {
            name: "Windows Server 2022".into(),
            version: "21H2".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Microsoft VLSC license
            sha256: "".into(),
            size_bytes: 5_400_000_000,
            os_type: "windows".into(),
            category: "server".into(),
            description: "Windows Server 2022 — current LTS server release, supported until 2031.".into(),
        },
        OsImage {
            name: "Windows Server 2019".into(),
            version: "1809".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Microsoft VLSC license
            sha256: "".into(),
            size_bytes: 5_200_000_000,
            os_type: "windows".into(),
            category: "server".into(),
            description: "Windows Server 2019 — stable server release, supported until 2029.".into(),
        },
        OsImage {
            name: "Windows Server 2016".into(),
            version: "1607".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Microsoft VLSC license
            sha256: "".into(),
            size_bytes: 5_000_000_000,
            os_type: "windows".into(),
            category: "server".into(),
            description: "Windows Server 2016 — first Nano Server and container-ready server release.".into(),
        },
        OsImage {
            name: "Windows Server 2012 R2".into(),
            version: "R2".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Microsoft VLSC license
            sha256: "".into(),
            size_bytes: 4_300_000_000,
            os_type: "windows".into(),
            category: "server".into(),
            description: "Windows Server 2012 R2 — legacy server (EOL Oct 2023). For migration scenarios.".into(),
        },
        // ====================================================================
        // Linux — Server
        // ====================================================================
        OsImage {
            name: "Ubuntu Server".into(),
            version: "24.04 LTS".into(),
            arch: "amd64".into(),
            iso_url: "https://releases.ubuntu.com/24.04/ubuntu-24.04-live-server-amd64.iso".into(),
            sha256: "8762f7e74e4d64d72fceb5f70682e6b069932deedb4949c6975d0f0fe0a91be3".into(),
            size_bytes: 2_700_000_000,
            os_type: "linux".into(),
            category: "server".into(),
            description: "Ubuntu Server 24.04 LTS (Noble Numbat) — 5-year LTS, cloud-ready.".into(),
        },
        OsImage {
            name: "Ubuntu Server".into(),
            version: "22.04 LTS".into(),
            arch: "amd64".into(),
            iso_url: "https://releases.ubuntu.com/22.04/ubuntu-22.04-live-server-amd64.iso".into(),
            sha256: "".into(),
            size_bytes: 1_800_000_000,
            os_type: "linux".into(),
            category: "server".into(),
            description: "Ubuntu Server 22.04 LTS (Jammy Jellyfish) — widely deployed LTS release.".into(),
        },
        OsImage {
            name: "Debian".into(),
            version: "12 Bookworm (netinst)".into(),
            arch: "amd64".into(),
            iso_url: "https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/debian-12.9.0-amd64-netinst.iso".into(),
            sha256: "".into(),
            size_bytes: 780_000_000,
            os_type: "linux".into(),
            category: "server".into(),
            description: "Debian 12 Bookworm — current stable, network installer (downloads packages on install).".into(),
        },
        OsImage {
            name: "Debian".into(),
            version: "11 Bullseye (netinst)".into(),
            arch: "amd64".into(),
            iso_url: "https://cdimage.debian.org/cdimage/archive/11.11.0/amd64/iso-cd/debian-11.11.0-amd64-netinst.iso".into(),
            sha256: "".into(),
            size_bytes: 400_000_000,
            os_type: "linux".into(),
            category: "server".into(),
            description: "Debian 11 Bullseye — previous stable, LTS until June 2026.".into(),
        },
        OsImage {
            name: "Rocky Linux".into(),
            version: "9.4".into(),
            arch: "x86_64".into(),
            iso_url: "https://download.rockylinux.org/pub/rocky/9/isos/x86_64/Rocky-9.4-x86_64-minimal.iso".into(),
            sha256: "".into(),
            size_bytes: 1_800_000_000,
            os_type: "linux".into(),
            category: "server".into(),
            description: "Rocky Linux 9.4 — RHEL-compatible, community-driven enterprise Linux.".into(),
        },
        OsImage {
            name: "AlmaLinux".into(),
            version: "9.4".into(),
            arch: "x86_64".into(),
            iso_url: "https://repo.almalinux.org/almalinux/9/isos/x86_64/AlmaLinux-9.4-x86_64-minimal.iso".into(),
            sha256: "".into(),
            size_bytes: 1_900_000_000,
            os_type: "linux".into(),
            category: "server".into(),
            description: "AlmaLinux 9.4 — 1:1 RHEL-compatible, backed by CloudLinux.".into(),
        },
        OsImage {
            name: "Fedora Server".into(),
            version: "40".into(),
            arch: "x86_64".into(),
            iso_url: "https://download.fedoraproject.org/pub/fedora/linux/releases/40/Server/x86_64/iso/Fedora-Server-dvd-x86_64-40-1.14.iso".into(),
            sha256: "".into(),
            size_bytes: 2_300_000_000,
            os_type: "linux".into(),
            category: "server".into(),
            description: "Fedora 40 Server — cutting-edge features, upstream of RHEL.".into(),
        },
        OsImage {
            name: "CentOS Stream".into(),
            version: "9".into(),
            arch: "x86_64".into(),
            iso_url: "https://mirror.stream.centos.org/9-stream/BaseOS/x86_64/iso/CentOS-Stream-9-latest-x86_64-dvd1.iso".into(),
            sha256: "".into(),
            size_bytes: 8_500_000_000,
            os_type: "linux".into(),
            category: "server".into(),
            description: "CentOS Stream 9 — continuous-delivery distro, midstream between Fedora and RHEL.".into(),
        },
        OsImage {
            name: "openSUSE Leap".into(),
            version: "15.6".into(),
            arch: "x86_64".into(),
            iso_url: "https://download.opensuse.org/distribution/leap/15.6/iso/openSUSE-Leap-15.6-DVD-x86_64-Media.iso".into(),
            sha256: "".into(),
            size_bytes: 4_200_000_000,
            os_type: "linux".into(),
            category: "server".into(),
            description: "openSUSE Leap 15.6 — enterprise-grade stability aligned with SUSE Linux Enterprise.".into(),
        },
        OsImage {
            name: "NixOS".into(),
            version: "24.05".into(),
            arch: "x86_64".into(),
            iso_url: "https://channels.nixos.org/nixos-24.05/latest-nixos-minimal-x86_64-linux.iso".into(),
            sha256: "".into(),
            size_bytes: 1_100_000_000,
            os_type: "linux".into(),
            category: "server".into(),
            description: "NixOS 24.05 — declarative, reproducible Linux system configuration.".into(),
        },
        // ====================================================================
        // Linux — Desktop
        // ====================================================================
        OsImage {
            name: "Ubuntu Desktop".into(),
            version: "24.04 LTS".into(),
            arch: "amd64".into(),
            iso_url: "https://releases.ubuntu.com/24.04/ubuntu-24.04-desktop-amd64.iso".into(),
            sha256: "".into(),
            size_bytes: 5_700_000_000,
            os_type: "linux".into(),
            category: "desktop".into(),
            description: "Ubuntu Desktop 24.04 LTS — flagship GNOME desktop, 5-year support.".into(),
        },
        OsImage {
            name: "Ubuntu Desktop".into(),
            version: "22.04 LTS".into(),
            arch: "amd64".into(),
            iso_url: "https://releases.ubuntu.com/22.04/ubuntu-22.04-desktop-amd64.iso".into(),
            sha256: "".into(),
            size_bytes: 4_700_000_000,
            os_type: "linux".into(),
            category: "desktop".into(),
            description: "Ubuntu Desktop 22.04 LTS — mature LTS desktop, widely deployed.".into(),
        },
        OsImage {
            name: "Fedora Workstation".into(),
            version: "40".into(),
            arch: "x86_64".into(),
            iso_url: "https://download.fedoraproject.org/pub/fedora/linux/releases/40/Workstation/x86_64/iso/Fedora-Workstation-Live-x86_64-40-1.14.iso".into(),
            sha256: "".into(),
            size_bytes: 2_100_000_000,
            os_type: "linux".into(),
            category: "desktop".into(),
            description: "Fedora 40 Workstation — latest GNOME, Wayland-first, developer-focused.".into(),
        },
        OsImage {
            name: "Linux Mint".into(),
            version: "21.3 Virginia".into(),
            arch: "x86_64".into(),
            iso_url: "https://mirrors.edge.kernel.org/linuxmint/stable/21.3/linuxmint-21.3-cinnamon-64bit.iso".into(),
            sha256: "".into(),
            size_bytes: 2_800_000_000,
            os_type: "linux".into(),
            category: "desktop".into(),
            description: "Linux Mint 21.3 — beginner-friendly Ubuntu-based desktop with Cinnamon DE.".into(),
        },
        OsImage {
            name: "Arch Linux".into(),
            version: "latest".into(),
            arch: "x86_64".into(),
            iso_url: "https://geo.mirror.pkgbuild.com/iso/latest/archlinux-x86_64.iso".into(),
            sha256: "".into(),
            size_bytes: 1_100_000_000,
            os_type: "linux".into(),
            category: "desktop".into(),
            description: "Arch Linux — rolling release, minimal base, highly customizable.".into(),
        },
        // ====================================================================
        // Diagnostic & Repair Tools
        // ====================================================================
        OsImage {
            name: "Hiren's Boot CD PE".into(),
            version: "1.0.2".into(),
            arch: "x64".into(),
            iso_url: "https://www.hirensbootcd.org/files/HBCD_PE_x64.iso".into(),
            sha256: "".into(),
            size_bytes: 2_800_000_000,
            os_type: "tool".into(),
            category: "diagnostic".into(),
            description: "Hiren's Boot CD PE — all-in-one WinPE toolkit for Windows repair, recovery, and diagnostics.".into(),
        },
        OsImage {
            name: "SystemRescue".into(),
            version: "11.01".into(),
            arch: "amd64".into(),
            iso_url: "https://fastly-cdn.system-rescue.org/releases/11.01/systemrescue-11.01-amd64.iso".into(),
            sha256: "".into(),
            size_bytes: 900_000_000,
            os_type: "tool".into(),
            category: "diagnostic".into(),
            description: "SystemRescue — Linux-based bootable disk for system administration and recovery.".into(),
        },
        OsImage {
            name: "GParted Live".into(),
            version: "1.6.0-10".into(),
            arch: "amd64".into(),
            iso_url: "https://downloads.sourceforge.net/gparted/gparted-live-1.6.0-10-amd64.iso".into(),
            sha256: "".into(),
            size_bytes: 600_000_000,
            os_type: "tool".into(),
            category: "diagnostic".into(),
            description: "GParted Live — bootable partition editor supporting all major filesystems.".into(),
        },
        OsImage {
            name: "Memtest86+".into(),
            version: "7.00".into(),
            arch: "x64".into(),
            iso_url: "https://www.memtest.org/download/v7.00/mt86plus_7.00_64.iso.zip".into(),
            sha256: "".into(),
            size_bytes: 10_000_000,
            os_type: "tool".into(),
            category: "diagnostic".into(),
            description: "Memtest86+ — gold-standard RAM testing tool, runs without OS.".into(),
        },
        OsImage {
            name: "Ultimate Boot CD".into(),
            version: "5.3.9".into(),
            arch: "x86".into(),
            iso_url: "https://www.ultimatebootcd.com/download/redirect.php?UBCD539.iso".into(),
            sha256: "".into(),
            size_bytes: 700_000_000,
            os_type: "tool".into(),
            category: "diagnostic".into(),
            description: "Ultimate Boot CD — comprehensive hardware diagnostics (CPU, RAM, HDD, network).".into(),
        },
        OsImage {
            name: "DBAN".into(),
            version: "2.3.0".into(),
            arch: "x86".into(),
            iso_url: "https://sourceforge.net/projects/dban/files/dban/dban-2.3.0/dban-2.3.0_i586.iso/download".into(),
            sha256: "".into(),
            size_bytes: 16_000_000,
            os_type: "tool".into(),
            category: "diagnostic".into(),
            description: "DBAN (Darik's Boot and Nuke) — secure disk wiping for data destruction.".into(),
        },
        OsImage {
            name: "ShredOS".into(),
            version: "2024.02".into(),
            arch: "x86_64".into(),
            iso_url: "https://github.com/PartialVolume/shredos.x86_64/releases/latest/download/shredos.img.tar.gz".into(),
            sha256: "".into(),
            size_bytes: 50_000_000,
            os_type: "tool".into(),
            category: "diagnostic".into(),
            description: "ShredOS — modern NWIPE-based disk eraser supporting DoD, Gutmann, and PRNG methods.".into(),
        },
        OsImage {
            name: "Trinity Rescue Kit".into(),
            version: "3.4 build 372".into(),
            arch: "x86".into(),
            iso_url: "https://trinityhome.org/files/trk/trk3.4-build372.iso".into(),
            sha256: "".into(),
            size_bytes: 280_000_000,
            os_type: "tool".into(),
            category: "diagnostic".into(),
            description: "Trinity Rescue Kit — Windows password reset, virus scanning, and file recovery.".into(),
        },
        OsImage {
            name: "Windows Recovery Environment".into(),
            version: "WinRE 11".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Extracted from Windows ISO via ADK
            sha256: "".into(),
            size_bytes: 400_000_000,
            os_type: "tool".into(),
            category: "diagnostic".into(),
            description: "WinRE — Windows built-in recovery environment for startup repair and restore.".into(),
        },
        OsImage {
            name: "Boot Repair Disk".into(),
            version: "2023".into(),
            arch: "amd64".into(),
            iso_url: "https://sourceforge.net/projects/boot-repair-cd/files/boot-repair-disk-64bit.img/download".into(),
            sha256: "".into(),
            size_bytes: 800_000_000,
            os_type: "tool".into(),
            category: "diagnostic".into(),
            description: "Boot Repair Disk — automatic GRUB and bootloader repair for Linux/dual-boot systems.".into(),
        },
        OsImage {
            name: "ESET SysRescue".into(),
            version: "latest".into(),
            arch: "x64".into(),
            iso_url: "https://download.eset.com/com/eset/tools/sysinspector/sysrescue/v1/live/eset_sysrescue_live_enu.iso".into(),
            sha256: "".into(),
            size_bytes: 400_000_000,
            os_type: "tool".into(),
            category: "diagnostic".into(),
            description: "ESET SysRescue — bootable antivirus scanner for cleaning infected systems offline.".into(),
        },
        OsImage {
            name: "Kaspersky Rescue Disk".into(),
            version: "18".into(),
            arch: "x64".into(),
            iso_url: "https://rescuedisk.s.kaspersky-labs.com/updatable/2018/krd.iso".into(),
            sha256: "".into(),
            size_bytes: 500_000_000,
            os_type: "tool".into(),
            category: "diagnostic".into(),
            description: "Kaspersky Rescue Disk — offline bootable antivirus scanner for rootkit and malware removal.".into(),
        },
        OsImage {
            name: "Ventoy".into(),
            version: "1.0.99".into(),
            arch: "x86_64".into(),
            iso_url: "https://github.com/ventoy/Ventoy/releases/latest/download/ventoy-1.0.99-livecd.iso".into(),
            sha256: "".into(),
            size_bytes: 600_000_000,
            os_type: "tool".into(),
            category: "diagnostic".into(),
            description: "Ventoy — create multi-boot USB drives from multiple ISOs without formatting.".into(),
        },
        // ====================================================================
        // Cloning & Imaging
        // ====================================================================
        OsImage {
            name: "Clonezilla Live".into(),
            version: "3.1.3-11".into(),
            arch: "amd64".into(),
            iso_url: "https://downloads.sourceforge.net/clonezilla/clonezilla-live-3.1.3-11-amd64.iso".into(),
            sha256: "".into(),
            size_bytes: 500_000_000,
            os_type: "tool".into(),
            category: "cloning".into(),
            description: "Clonezilla Live — bare-metal disk/partition cloning and imaging via command-line.".into(),
        },
        OsImage {
            name: "Rescuezilla".into(),
            version: "2.5.1".into(),
            arch: "amd64".into(),
            iso_url: "https://github.com/rescuezilla/rescuezilla/releases/latest/download/rescuezilla-2.5.1-64bit.noble.iso".into(),
            sha256: "".into(),
            size_bytes: 1_200_000_000,
            os_type: "tool".into(),
            category: "cloning".into(),
            description: "Rescuezilla — GUI frontend for Clonezilla, beginner-friendly disk imaging.".into(),
        },
        OsImage {
            name: "FOG Project".into(),
            version: "1.5.10".into(),
            arch: "x86_64".into(),
            iso_url: "".into(), // Server-side install — see https://fogproject.org/download
            sha256: "".into(),
            size_bytes: 0,
            os_type: "tool".into(),
            category: "cloning".into(),
            description: "FOG Project — network-based OS imaging and deployment server (PXE-native).".into(),
        },
        OsImage {
            name: "Macrium Reflect Rescue".into(),
            version: "8 Free".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Generated by Macrium Reflect desktop app — https://www.macrium.com/reflectfree.aspx
            sha256: "".into(),
            size_bytes: 800_000_000,
            os_type: "tool".into(),
            category: "cloning".into(),
            description: "Macrium Reflect Rescue — WinPE-based bootable backup and restore environment.".into(),
        },
        OsImage {
            name: "Acronis Cyber Protect Boot".into(),
            version: "2024".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires Acronis account — https://www.acronis.com/en-us/products/cyber-protect/
            sha256: "".into(),
            size_bytes: 1_500_000_000,
            os_type: "tool".into(),
            category: "cloning".into(),
            description: "Acronis Cyber Protect Boot — enterprise disaster recovery and bare-metal restore.".into(),
        },
        OsImage {
            name: "AOMEI PE Builder".into(),
            version: "2.0".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Built via AOMEI PE Builder tool — https://www.ubackup.com/pe-builder.html
            sha256: "".into(),
            size_bytes: 900_000_000,
            os_type: "tool".into(),
            category: "cloning".into(),
            description: "AOMEI PE Builder — custom WinPE with integrated backup and partition tools.".into(),
        },
        // ====================================================================
        // Network & Security Tools
        // ====================================================================
        OsImage {
            name: "Kali Linux".into(),
            version: "2024.2".into(),
            arch: "amd64".into(),
            iso_url: "https://cdimage.kali.org/kali-2024.2/kali-linux-2024.2-live-amd64.iso".into(),
            sha256: "".into(),
            size_bytes: 4_100_000_000,
            os_type: "network".into(),
            category: "security".into(),
            description: "Kali Linux — Debian-based penetration testing and security auditing distribution.".into(),
        },
        OsImage {
            name: "Tails".into(),
            version: "6.5".into(),
            arch: "amd64".into(),
            iso_url: "https://mirrors.edge.kernel.org/tails/stable/tails-amd64-6.5/tails-amd64-6.5.iso".into(),
            sha256: "".into(),
            size_bytes: 1_400_000_000,
            os_type: "network".into(),
            category: "security".into(),
            description: "Tails — amnesic live OS routing all traffic through Tor for privacy and anonymity.".into(),
        },
        OsImage {
            name: "pfSense CE".into(),
            version: "2.7.2".into(),
            arch: "amd64".into(),
            iso_url: "https://repo.netgate.com/pfSense-CE-2.7.2-RELEASE-amd64.iso.gz".into(),
            sha256: "".into(),
            size_bytes: 900_000_000,
            os_type: "network".into(),
            category: "security".into(),
            description: "pfSense Community Edition — FreeBSD-based firewall and router platform.".into(),
        },
        OsImage {
            name: "OPNsense".into(),
            version: "24.7".into(),
            arch: "amd64".into(),
            iso_url: "https://mirror.ams1.nl.leaseweb.net/opnsense/releases/24.7/OPNsense-24.7-dvd-amd64.iso.bz2".into(),
            sha256: "".into(),
            size_bytes: 1_100_000_000,
            os_type: "network".into(),
            category: "security".into(),
            description: "OPNsense — FreeBSD-based open-source firewall with modern WebUI and plugins.".into(),
        },
        OsImage {
            name: "IPFire".into(),
            version: "2.29 Core 185".into(),
            arch: "x86_64".into(),
            iso_url: "https://downloads.ipfire.org/releases/ipfire-2.x/2.29-core185/ipfire-2.29-core185-x86_64.iso".into(),
            sha256: "".into(),
            size_bytes: 500_000_000,
            os_type: "network".into(),
            category: "security".into(),
            description: "IPFire — hardened Linux firewall distro with IDS, VPN, and proxy built-in.".into(),
        },
        // ====================================================================
        // Hypervisor / Infrastructure
        // ====================================================================
        OsImage {
            name: "Proxmox VE".into(),
            version: "8.2".into(),
            arch: "amd64".into(),
            iso_url: "https://enterprise.proxmox.com/iso/proxmox-ve_8.2-2.iso".into(),
            sha256: "".into(),
            size_bytes: 1_300_000_000,
            os_type: "hypervisor".into(),
            category: "hypervisor".into(),
            description: "Proxmox VE 8.2 — open-source KVM + LXC virtualization platform with web UI.".into(),
        },
        OsImage {
            name: "VMware ESXi".into(),
            version: "8.0 U3".into(),
            arch: "x64".into(),
            iso_url: "".into(), // Requires VMware account — https://customerconnect.vmware.com/downloads
            sha256: "".into(),
            size_bytes: 500_000_000,
            os_type: "hypervisor".into(),
            category: "hypervisor".into(),
            description: "VMware ESXi Free — bare-metal Type-1 hypervisor (free tier, limited API).".into(),
        },
        OsImage {
            name: "XCP-ng".into(),
            version: "8.3".into(),
            arch: "x86_64".into(),
            iso_url: "https://mirrors.xcp-ng.org/isos/8.3/xcp-ng-8.3.0-2.iso".into(),
            sha256: "".into(),
            size_bytes: 900_000_000,
            os_type: "hypervisor".into(),
            category: "hypervisor".into(),
            description: "XCP-ng 8.3 — open-source Xen-based hypervisor, Xenserver fork, managed by Xen Orchestra.".into(),
        },
        OsImage {
            name: "TrueNAS CORE".into(),
            version: "13.0-U6.1".into(),
            arch: "x86_64".into(),
            iso_url: "https://download.freenas.org/13.0/STABLE/U6.1/x64/TrueNAS-13.0-U6.1.iso".into(),
            sha256: "".into(),
            size_bytes: 1_100_000_000,
            os_type: "hypervisor".into(),
            category: "storage".into(),
            description: "TrueNAS CORE — FreeBSD-based NAS with ZFS, SMB, NFS, iSCSI support.".into(),
        },
        OsImage {
            name: "TrueNAS SCALE".into(),
            version: "24.04.2".into(),
            arch: "x86_64".into(),
            iso_url: "https://download.sys.truenas.net/TrueNAS-SCALE-Dragonfish/24.04.2/TrueNAS-SCALE-24.04.2.iso".into(),
            sha256: "".into(),
            size_bytes: 2_800_000_000,
            os_type: "hypervisor".into(),
            category: "storage".into(),
            description: "TrueNAS SCALE — Linux-based NAS with ZFS, Kubernetes, Docker app support.".into(),
        },
        OsImage {
            name: "OpenMediaVault".into(),
            version: "7.4".into(),
            arch: "amd64".into(),
            iso_url: "https://downloads.sourceforge.net/project/openmediavault/7.4.0/openmediavault_7.4.0-amd64.iso".into(),
            sha256: "".into(),
            size_bytes: 1_000_000_000,
            os_type: "hypervisor".into(),
            category: "storage".into(),
            description: "OpenMediaVault 7 — Debian-based NAS solution with plugin ecosystem.".into(),
        },
    ]
}

// ============================================================================
// GET /api/v1/pxe/catalog
// ============================================================================

pub async fn list_catalog() -> Json<Vec<OsImage>> {
    Json(get_catalog())
}

// ============================================================================
// POST /api/v1/pxe/catalog/:index/download
// Starts a background download of the ISO at the given catalog index.
// ============================================================================

#[derive(Debug, Serialize)]
pub struct DownloadStarted {
    pub download_id: Uuid,
    pub name: String,
    pub version: String,
    pub iso_url: String,
    pub status: String,
    pub message: String,
}

pub async fn download_catalog_image(
    State(_state): State<AppState>,
    Path(index): Path<usize>,
) -> Result<(StatusCode, Json<DownloadStarted>), (StatusCode, String)> {
    let catalog = get_catalog();
    let image = catalog.get(index).ok_or((
        StatusCode::NOT_FOUND,
        format!(
            "Catalog index {} out of range (catalog has {} entries)",
            index,
            catalog.len()
        ),
    ))?;

    if image.iso_url.is_empty() {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            format!(
                "'{}' has no public download URL — manual download required (e.g. VLSC for Windows Server).",
                image.name
            ),
        ));
    }

    let download_id = Uuid::new_v4();
    let iso_url = image.iso_url.clone();
    let name = image.name.clone();
    let version = image.version.clone();
    let arch = image.arch.clone();
    let os_type = image.os_type.clone();

    // Spawn background download task
    tokio::spawn(async move {
        let filename = format!(
            "{}-{}-{}-{}.iso",
            name.to_lowercase().replace(' ', "_"),
            version.to_lowercase().replace(' ', "_"),
            arch,
            download_id
        );

        if let Err(e) = tokio::fs::create_dir_all(IMAGES_DIR).await {
            tracing::error!("Failed to create images directory: {}", e);
            return;
        }

        let dest_path = PathBuf::from(IMAGES_DIR).join(&filename);

        tracing::info!(
            download_id = %download_id,
            iso_url = %iso_url,
            dest = %dest_path.display(),
            "Starting catalog ISO download"
        );

        match reqwest_download(
            &iso_url,
            &dest_path,
            &download_id,
            &name,
            &version,
            &os_type,
        )
        .await
        {
            Ok(size) => {
                tracing::info!(
                    download_id = %download_id,
                    bytes = size,
                    "Catalog ISO download complete"
                );
            },
            Err(e) => {
                tracing::error!(download_id = %download_id, error = %e, "Catalog ISO download failed");
                // Clean up partial file
                let _ = tokio::fs::remove_file(&dest_path).await;
            },
        }
    });

    Ok((
        StatusCode::ACCEPTED,
        Json(DownloadStarted {
            download_id,
            name: image.name.clone(),
            version: image.version.clone(),
            iso_url: image.iso_url.clone(),
            status: "downloading".into(),
            message: "Download started in background. Check server logs for progress.".into(),
        }),
    ))
}

/// Streams an HTTP download to disk, returning the number of bytes written.
async fn reqwest_download(
    url: &str,
    dest: &PathBuf,
    download_id: &Uuid,
    name: &str,
    version: &str,
    os_type: &str,
) -> anyhow::Result<u64> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3600 * 4)) // 4-hour timeout for large ISOs
        .build()?;

    let resp = client.get(url).send().await?;
    if !resp.status().is_success() {
        return Err(anyhow::anyhow!("HTTP {} for {}", resp.status(), url));
    }

    let mut file = tokio::fs::File::create(dest).await?;
    let mut stream = resp.bytes_stream();
    let mut total: u64 = 0;

    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk).await?;
        total += chunk.len() as u64;
    }
    file.flush().await?;

    tracing::info!(
        download_id = %download_id,
        name = %name,
        version = %version,
        os_type = %os_type,
        bytes = total,
        dest = %dest.display(),
        "ISO download finished"
    );

    Ok(total)
}
