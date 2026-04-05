//! # SignApps SMB SYSVOL
//!
//! Minimal SMB2 server exposing SYSVOL and NETLOGON shares for Active Directory
//! Group Policy distribution to domain-joined Windows machines.
//!
//! ## Architecture
//!
//! Only the SMB2 commands required to serve read-only Group Policy files are
//! implemented (Negotiate, Session Setup, Tree Connect, Read, Query Directory,
//! Query Info). File storage is backed by `signapps-storage` (OpenDAL), so the
//! SYSVOL tree can live on local disk or an S3-compatible backend.
//!
//! ```text
//! Windows client  →  TCP :445  →  listener
//!                                    │
//!                              protocol (SMB2 codec)
//!                                    │
//!                    ┌───────────────┴───────────────┐
//!                    │ share (SYSVOL / NETLOGON mgmt) │
//!                    │ gpo   (Group Policy objects)   │
//!                    └───────────────────────────────┘
//!                                    │
//!                           signapps-storage (OpenDAL)
//! ```
//!
//! ## Modules
//!
//! | Module | Description |
//! |--------|-------------|
//! | [`protocol`] | SMB2 command codes, header framing, and response helpers (MS-SMB2) |
//! | [`share`] | SYSVOL and NETLOGON share definitions and path resolution |
//! | [`gpo`] | Group Policy Object management (create, update, enumerate) |
//! | [`listener`] | TCP listener on port 445, connection dispatch |
//!
//! ## Supported SMB2 Commands
//!
//! | Command | Code | Purpose |
//! |---------|------|---------|
//! | Negotiate | 0x0000 | Dialect negotiation |
//! | SessionSetup | 0x0001 | Authentication |
//! | TreeConnect | 0x0003 | Share access |
//! | Read | 0x0008 | File read |
//! | QueryDirectory | 0x000E | Directory listing |
//! | QueryInfo | 0x0010 | File/directory metadata |
//!
//! ## Example
//!
//! ```rust,no_run
//! use signapps_smb_sysvol::share::SmbShare;
//! use std::path::PathBuf;
//!
//! let sysvol = SmbShare {
//!     name: "SYSVOL".to_string(),
//!     path: PathBuf::from("/data/sysvol"),
//!     read_only: true,
//!     description: "Active Directory SYSVOL".to_string(),
//! };
//! ```

pub mod protocol;
pub mod share;
pub mod gpo;
pub mod listener;
