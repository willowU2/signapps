//! SMB2/3 SYSVOL share for Active Directory Group Policy.
//!
//! Provides a minimal SMB2 server exposing SYSVOL and NETLOGON shares
//! for Group Policy distribution to domain-joined Windows machines.
//! File storage is backed by signapps-storage (OpenDAL).

pub mod protocol;
pub mod share;
pub mod gpo;
pub mod listener;
